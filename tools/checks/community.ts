import * as fs from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const TYPES = new Set(['markdown', 'input', 'textarea', 'dropdown', 'checkboxes', 'upload']);

/** Check the maintained GitHub form fields offline; GitHub remains the final schema authority. */
export function checkCommunity(root: string): { errors: string[]; markdown: { file: string; text: string }[] } {
    const errors: string[] = [], markdown: { file: string; text: string }[] = [];
    const directory = join(root, '.github', 'ISSUE_TEMPLATE');
    if (!fs.existsSync(directory)) return { errors, markdown };
    for (const name of fs.readdirSync(directory).filter(name => /\.ya?ml$/u.test(name))) {
        const file = '.github/ISSUE_TEMPLATE/' + name;
        const fail = (message: string) => errors.push(file + ': ' + message);
        const requireText = (value: unknown, label: string) => { if (!text(value)) fail(label + ' must be a nonempty string'); };
        const linkText = (value: unknown) => { if (typeof value === 'string') markdown.push({ file, text: value }); };
        let value: unknown;
        try {
            const document = parseDocument(fs.readFileSync(join(directory, name), 'utf8'), { uniqueKeys: true, version: '1.2' });
            for (const error of [...document.errors, ...document.warnings]) fail(error.message);
            if (document.errors.length || document.warnings.length) continue;
            value = document.toJS({ maxAliasCount: 100 });
        } catch (error) { fail(String(error)); continue; }
        if (!object(value)) { fail('expected a YAML mapping'); continue; }
        if (name === 'config.yml') {
            if ('blank_issues_enabled' in value && typeof value.blank_issues_enabled !== 'boolean')
                fail('blank_issues_enabled must be a boolean');
            if ('contact_links' in value) {
                if (!Array.isArray(value.contact_links)) { fail('contact_links must be an array'); continue; }
                for (const [index, contact] of value.contact_links.entries()) {
                    const label = `contact_links[${index}]`;
                    if (!object(contact)) { fail(label + ' must be a mapping'); continue; }
                    for (const key of ['name', 'url', 'about']) requireText(contact[key], label + '.' + key);
                    try {
                        if (!text(contact.url) || !['https:', 'http:'].includes(new URL(contact.url).protocol)) throw new Error();
                        linkText(`[Contact](<${contact.url}>)`);
                    } catch { fail(label + '.url must be an absolute HTTP(S) URL'); }
                    linkText(contact.about);
                }
            }
            continue;
        }
        requireText(value.name, 'name'); requireText(value.description, 'description');
        if (!Array.isArray(value.body) || value.body.length === 0) { fail('body must be a nonempty array'); continue; }
        const ids = new Set<string>();
        let inputs = 0;
        for (const [index, field] of value.body.entries()) {
            const label = `body[${index}]`;
            if (!object(field) || !text(field.type) || !TYPES.has(field.type)) { fail(label + ' has an unsupported field type'); continue; }
            if (field.type !== 'markdown') {
                inputs++;
                if (!text(field.id) || !/^[A-Za-z0-9_-]+$/u.test(field.id)) fail(label + '.id must use letters, numbers, hyphens or underscores');
                else if (ids.has(field.id)) fail(label + '.id duplicates ' + field.id);
                else ids.add(field.id);
            }
            if (!object(field.attributes)) { fail(label + '.attributes must be a mapping'); continue; }
            const attributes = field.attributes;
            requireText(attributes[field.type === 'markdown' ? 'value' : 'label'], label + '.attributes.' + (field.type === 'markdown' ? 'value' : 'label'));
            linkText(attributes.description);
            if (field.type === 'markdown' || field.type === 'textarea' && !attributes.render) linkText(attributes.value);
            if ('validations' in field && (!object(field.validations) || 'required' in field.validations && typeof field.validations.required !== 'boolean'))
                fail(label + '.validations.required must be a boolean');
            if (field.type === 'dropdown' || field.type === 'checkboxes') {
                if (!Array.isArray(attributes.options) || attributes.options.length === 0) { fail(label + '.options must be a nonempty array'); continue; }
                const labels = new Set<string>();
                for (const option of attributes.options) {
                    const optionLabel = field.type === 'checkboxes' && object(option) ? option.label : option;
                    if (!text(optionLabel)) fail(label + '.options need nonempty labels');
                    else {
                        if (labels.has(optionLabel)) fail(label + '.options contain duplicate labels');
                        labels.add(optionLabel);
                        if (field.type === 'checkboxes') linkText(optionLabel);
                    }
                    if (field.type === 'checkboxes' && (!object(option) || 'required' in option && typeof option.required !== 'boolean'))
                        fail(label + '.options.required must be a boolean');
                }
                if (field.type === 'dropdown') {
                    if ('multiple' in attributes && typeof attributes.multiple !== 'boolean') fail(label + '.multiple must be a boolean');
                    if ('default' in attributes && (!Number.isInteger(attributes.default) || Number(attributes.default) < 0 || Number(attributes.default) >= attributes.options.length))
                        fail(label + '.default must be a valid option index');
                }
            }
        }
        if (!inputs) fail('body must contain at least one input field');
    }
    return { errors, markdown };
}
