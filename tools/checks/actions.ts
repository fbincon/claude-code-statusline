/** Offline identity checks for workflows and reachable local composite Actions. */
import * as fs from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { isAlias, isMap, isScalar, isSeq, LineCounter, parseDocument } from 'yaml';

export interface ActionReference {
    file: string;
    line: number;
    uses: string;
    version?: string;
}
export interface ActionsCheck {
    files: number;
    references: ActionReference[];
    errors: string[];
}

const REMOTE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*@[a-f0-9]{40}$/u;
const VERSION = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z.-]+)?(?=\s|$)/u;

export function checkActions(directory: string): ActionsCheck {
    const root = resolve(directory), visited = new Set<string>();
    const result: ActionsCheck = { files: 0, references: [], errors: [] };
    const nameOf = (path: string) => relative(root, path).split(sep).join('/');
    const inside = (path: string) => {
        const name = relative(root, path);
        return name !== '..' && !name.startsWith('..' + sep) && !isAbsolute(name);
    };

    function read(path: string, kind: 'workflow' | 'action'): void {
        if (visited.has(path)) return;
        visited.add(path);
        const file = nameOf(path);
        let source: string;
        try {
            if (!inside(fs.realpathSync(path)) || !fs.lstatSync(path).isFile()) throw new Error('Expected a regular repository file');
            source = fs.readFileSync(path, 'utf8');
        } catch (error) { result.errors.push(`${file}:1: Cannot read ${kind}: ${String(error)}`); return; }
        result.files++;
        const lineCounter = new LineCounter();
        const document = parseDocument(source, { lineCounter, uniqueKeys: true, version: '1.2' });
        for (const error of [...document.errors, ...document.warnings])
            result.errors.push(`${file}:${lineCounter.linePos(error.pos[0]).line}: ${error.message}`);
        if (document.errors.length || document.warnings.length) return;

        function lineOf(node: unknown): number {
            return lineCounter.linePos(isScalar(node) || isMap(node) || isSeq(node) || isAlias(node) ? node.range?.[0] ?? 0 : 0).line;
        }
        function fail(node: unknown, message: string): void { result.errors.push(`${file}:${lineOf(node)}: ${message}`); }
        function dereference(value: unknown): unknown {
            const seen = new Set<unknown>();
            while (isAlias(value)) {
                if (seen.has(value)) { fail(value, 'Cyclic YAML alias'); return undefined; }
                seen.add(value);
                const target = value.resolve(document);
                if (!target) { fail(value, 'Unresolved YAML alias'); return undefined; }
                value = target;
            }
            return value;
        }
        function mapping(node: unknown, label: string) {
            const value = dereference(node);
            if (isMap(value)) return value;
            fail(node, `Expected ${label} mapping`);
            return undefined;
        }
        function local(reference: ActionReference, node: unknown, reusable: boolean): void {
            const target = resolve(root, reference.uses);
            if (!inside(target)) { fail(node, 'Local reference leaves the repository'); return; }
            if (reusable) {
                if (!/^\.\/\.github\/workflows\/[^/]+\.ya?ml$/u.test(reference.uses))
                    fail(node, 'Local reusable workflow must name ./.github/workflows/FILE.yml or .yaml');
                else read(target, 'workflow');
                return;
            }
            try {
                if (!inside(fs.realpathSync(target)) || !fs.statSync(target).isDirectory()) throw new Error('Expected a repository directory');
                const manifests = ['action.yml', 'action.yaml'].map(name => join(target, name)).filter(name => fs.existsSync(name));
                if (manifests.length !== 1) throw new Error('Expected exactly one action.yml or action.yaml');
                read(manifests[0]!, 'action');
            } catch (error) { fail(node, `Cannot read local Action ${reference.uses}: ${String(error)}`); }
        }
        function uses(node: unknown, reusable = false, enclosingComment?: string | null): void {
            const value = dereference(node);
            if (!isScalar(value) || typeof value.value !== 'string') { fail(node, 'uses must be a string'); return; }
            const reference: ActionReference = { file, line: lineOf(node), uses: value.value };
            result.references.push(reference);
            if (reference.uses.startsWith('./')) { local(reference, node, reusable); return; }
            if (reference.uses.startsWith('docker://')) {
                if (reusable || !/^docker:\/\/[^\s@]+@sha256:[a-f0-9]{64}$/u.test(reference.uses))
                    fail(node, 'Docker Action must use docker://IMAGE@sha256:FULL_DIGEST in a step');
                return;
            }
            if (!REMOTE.test(reference.uses)) fail(node, 'External reference must use OWNER/REPO[/PATH]@FULL_40_CHARACTER_COMMIT_SHA');
            // Flow-style mappings attach their trailing comment to the enclosing map.
            const comment = (isAlias(node) ? node.comment : undefined) ?? value.comment ?? enclosingComment ?? '';
            reference.version = comment.trim().match(VERSION)?.[0];
            if (!reference.version) fail(node, 'External reference requires a # vX.Y.Z version comment');
        }
        function steps(node: unknown): void {
            const value = dereference(node);
            if (!isSeq(value)) { fail(node, 'Expected steps sequence'); return; }
            for (const entry of value.items) {
                const step = mapping(entry, 'step');
                if (step?.has('uses')) uses(step.get('uses', true), false, step.comment);
            }
        }
        const top = mapping(document.contents, kind);
        if (!top) return;
        if (kind === 'action') {
            const runs = mapping(top.get('runs', true), 'Action runs');
            const using = dereference(runs?.get('using', true));
            if (!isScalar(using) || typeof using.value !== 'string') fail(using, 'Action runs.using must be a string');
            else if (using.value === 'composite') steps(runs?.get('steps', true));
            return;
        }
        const jobs = mapping(top.get('jobs', true), 'jobs');
        if (!jobs) return;
        for (const pair of jobs.items) {
            const job = mapping(pair.value, 'job');
            if (job?.has('uses')) uses(job.get('uses', true), true, job.comment);
            if (job?.has('steps')) steps(job.get('steps', true));
        }
    }

    function workflows(directory: string): void {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) workflows(path);
            else if (/\.ya?ml$/u.test(entry.name)) read(path, 'workflow');
        }
    }
    try { workflows(join(root, '.github/workflows')); }
    catch (error) { result.errors.push(`.github/workflows:1: Cannot enumerate workflows: ${String(error)}`); }
    if (!result.files && !result.errors.length) result.errors.push('.github/workflows:1: No workflow files found');
    return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { values } = parseArgs({ options: { root: { type: 'string', default: '.' } } });
    const result = checkActions(values.root!);
    for (const error of result.errors) console.error(error);
    console.log(`Actions identity check: ${result.files} files, ${result.references.length} references, ${result.errors.length} errors`);
    process.exitCode = result.errors.length ? 1 : 0;
}
