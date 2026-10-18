/** Capture the installed external editor in a real PTY; reconstruct cells, never an OS screenshot. */
import * as fs from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { release } from 'node:os';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { installCandidate } from './install.js';
import { verifyDelivery } from '../build/verify.js';
import { sha256 } from '../build/files.js';
import { sourceHashes } from '../migration/ts-03/common.js';
import { openPty } from '../migration/ts-04/test/pty.js';
import { Capture } from '../migration/ts-04/capture.js';
import { renderCapture } from './render-capture.js';

const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, output: { type: 'string' }, font: { type: 'string', multiple: true } } });
if (!values.artifact || !values.commit || !values.output || !values.font?.length)
    throw new Error('Require --artifact TGZ --commit FULL_SHA --output NEW_DIRECTORY --font FILE [--font FILE]');
if (process.platform === 'win32') throw new Error('POSIX PTY capture; Windows requires its console acceptance');
const artifact = verifyDelivery(resolve(values.artifact), values.commit);
assert.deepEqual(artifact.source.source_hashes, sourceHashes(), 'Capture tools differ from the installed source');
const output = resolve(values.output), fonts = values.font.map(path => resolve(path));
fs.mkdirSync(output);
const installed = installCandidate(values.artifact, values.commit), captures: Record<string, unknown>[] = [];
const columns = 120, rows = 32;
try {
    const config = installed.env.CLAUDE_CONFIG_DIR;
    execFileSync(installed.node, [installed.entry, 'install', '--no-native-editor', '--no-experimental-slash-tui', '--no-live-metrics'], { cwd: installed.temporary, env: installed.env, timeout: 30000 });
    const settings = fs.readFileSync(join(config, 'settings.json'));
    for (const language of ['en', 'zh-CN']) {
        const pty = openPty(config, columns, rows, installed.env, language, { executable: installed.node, args: [installed.entry, '--language', language, 'configure'], cwd: installed.temporary });
        try {
            await pty.wait(text => text.includes(`\x1b[${rows};1H`));
            for (const page of ['main', 'subagents', 'settings', 'layout']) {
                const raw = pty.captured(), screen = new Capture(columns, rows);
                screen.feed(raw);
                const cells = { columns, rows, cells: screen.buffer, terminal_foreground: '#dedee7', terminal_background: '#17191e' };
                const directory = join(output, language);
                fs.mkdirSync(directory, { recursive: true });
                fs.writeFileSync(join(directory, page + '.ansi'), raw);
                const json = JSON.stringify(cells);
                fs.writeFileSync(join(directory, page + '.json'), json);
                const image = renderCapture(cells, [0, 0, columns, rows], fonts);
                fs.writeFileSync(join(directory, page + '.png'), image.png);
                captures.push({ language, page, columns, rows, ansi_sha256: sha256(raw), cells_sha256: sha256(json), png_sha256: sha256(image.png), width: image.width, height: image.height });
                if (page !== 'layout') {
                    const length = raw.length;
                    pty.send('\t');
                    await pty.wait(text => Buffer.byteLength(text) > length && text.slice(text.lastIndexOf('\x1b[H')).includes(`\x1b[${rows};1H`));
                }
            }
            pty.send('\x1b');
            await pty.exited();
            assert.equal(pty.child.exitCode, 0);
            assert.deepEqual(pty.attributes(), pty.before, 'Terminal attributes were not restored');
            assert.deepEqual(fs.readFileSync(join(config, 'settings.json')), settings, 'Capture changed configuration');
        } finally { await pty.close(); }
    }
    const report = { status: 'pass', kind: 'installed PTY terminal-cell reconstruction; not an OS screenshot', commit: values.commit, tarball_sha256: artifact.sha256,
        application_version: artifact.source.application_version, platform: process.platform, arch: process.arch, os_release: release(), node: process.version,
        collector_sha256: artifact.source.source_hashes['tools/acceptance/editor-capture.ts'], model_calls: 0, terminal_restored: true,
        font_sha256: Object.fromEntries(fonts.map(path => [basename(path), sha256(fs.readFileSync(path))])), captures };
    fs.writeFileSync(join(output, 'editor-capture.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'pass', captures: captures.length, commit: values.commit, tarball_sha256: artifact.sha256 }));
} finally { installed.cleanup(); }
