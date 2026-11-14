import * as fs from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const TYPES = new Set(['markdown', 'input', 'textarea', 'dropdown', 'checkboxes', 'upload']);
const PULL_REQUEST_TEMPLATE = '.github/pull_request_template.md';
const PULL_REQUEST_HEADINGS = [
    '## Purpose / 目的',
    '## Changes / 变更',
    '## Validation / 验证',
    '## Applicable follow-ups / 按需事项',
] as const;
const PULL_REQUEST_FOLLOW_UPS = [
    'Documentation and English/Chinese consistency / 文档与中英同步:',
    'UI screenshots, when relevant / 相关界面截图:',
    'CHANGELOG, when relevant / 相关变更日志:',
    'Related Issue, if any / 关联 Issue（如有）:',
] as const;
const PULL_REQUEST_GUIDES = ['CONTRIBUTING.md', 'CONTRIBUTING.zh-CN.md'] as const;
const PULL_REQUEST_SANITIZATION = ['sanitized evidence', '脱敏证据'] as const;

/** Check the maintained GitHub community templates offline; GitHub remains the final schema authority. */
export function checkCommunity(root: string): { errors: string[]; markdown: { file: string; text: string }[] } {
    const errors: string[] = [], markdown: { file: string; text: string }[] = [];
    errors.push(...checkPullRequestTemplate(root));
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

/** Validate the single bilingual pull request template without duplicating its link checks. */
export function checkPullRequestTemplate(root: string): string[] {
    const file = join(root, '.github', 'pull_request_template.md');
    if (!fs.existsSync(file)) return [];
    const body = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'), lines = body.split('\n'), errors: string[] = [];
    const fail = (message: string) => errors.push(PULL_REQUEST_TEMPLATE + ': ' + message);
    let previous = -1;
    for (const heading of PULL_REQUEST_HEADINGS) {
        const indexes = lines.flatMap((line, index) => line.trim() === heading ? [index] : []);
        if (indexes.length === 0) { fail('missing heading ' + heading); continue; }
        if (indexes.length > 1) { fail('duplicate heading ' + heading); continue; }
        if (indexes[0]! <= previous) { fail('heading order differs at ' + heading); continue; }
        previous = indexes[0]!;
    }
    for (const label of PULL_REQUEST_FOLLOW_UPS) if (!body.includes(label)) fail('missing follow-up ' + label);
    for (const guide of PULL_REQUEST_GUIDES) if (!body.includes(guide)) fail('missing guide link ' + guide);
    for (const hint of PULL_REQUEST_SANITIZATION) if (!body.includes(hint)) fail('missing sanitization hint ' + hint);
    return errors;
}
