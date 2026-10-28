import { taskFixture } from './task-fixture.js';
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
import { Capture, TERMINAL_THEMES, verifyColors } from '../migration/ts-04/capture.js';
import { renderCapture } from './render-capture.js';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { dimensions } from '@fbincon/statusline-tui/layout';
import { PRESETS } from '@fbincon/statusline-core/contracts/ui';

const { values } = parseArgs({ options: { artifact: { type: 'string' }, commit: { type: 'string' }, output: { type: 'string' }, font: { type: 'string', multiple: true }, extended: { type: 'boolean' } } });
if (!values.artifact || !values.commit || !values.output || !values.font?.length)
    throw new Error('Require --artifact TGZ --commit FULL_SHA --output NEW_DIRECTORY --font FILE [--font FILE]');
if (process.platform === 'win32') throw new Error('POSIX PTY capture; Windows requires its console acceptance');
const artifact = verifyDelivery(resolve(values.artifact), values.commit);
assert.deepEqual(artifact.source.source_hashes, sourceHashes(), 'Capture tools differ from the installed source');
const output = resolve(values.output), fonts = values.font.map(path => resolve(path));
fs.mkdirSync(output);
const installed = installCandidate(values.artifact, values.commit), captures: Record<string, unknown>[] = [];
const monochrome: Record<string, unknown>[] = [];
const columns = 120, rows = 32;
try {
    const config = installed.env.CLAUDE_CONFIG_DIR;
    const run = (args: string[]) => execFileSync(installed.node, [installed.entry, ...args], { cwd: installed.temporary, env: installed.env, timeout: 30000 });
    run(['install', '--no-native-editor', '--no-experimental-slash-tui', '--no-live-metrics']);
    run(['config', 'set', 'directory-style', 'home']);
    const sourceSpec = join(installed.temporary, 'capture-source.json');
    fs.writeFileSync(sourceSpec, JSON.stringify({ name: 'Sample JSON · 中文 日本語 한글', kind: 'json', settings: { path: join(installed.temporary, 'explicit-source.json') } }));
    run(['source', 'add', 'capture', '--file', sourceSpec]);
    fs.writeFileSync(sourceSpec, JSON.stringify({ name: 'Sample GitHub', kind: 'github', scope: { project: installed.temporary, session: null, agent: null }, settings: { repository: 'example/project', branch: 'main', account: 'example' } }));
    run(['source', 'add', 'capture-github', '--file', sourceSpec]);
    const githubReview = JSON.parse(run(['source', 'review', 'capture-github', '--json']).toString()).review_revision;
    run(['source', 'enable', 'capture-github', '--review', githubReview]);
    const sources = fs.readFileSync(join(config, 'claude-statusline-sources.json'));
    const settings = fs.readFileSync(join(config, 'settings.json'));
    const taskEvidence=taskFixture(config,'capture-session');
    for (const language of LANGUAGES) {
        run(['config', 'set', 'statusline-language', language]);
        run(['config', 'profile', 'save', 'Capture scheme', '--overwrite']);
        const display = fs.readFileSync(join(config, 'claude-statusline.json'));
        const profiles = fs.readFileSync(join(config, 'claude-statusline-profiles.json'));
        let pty = openPty(config, columns, rows, installed.env, language, { executable: installed.node, args: [installed.entry, '--language', language, 'configure'], cwd: installed.temporary });
        try {
            await pty.wait(text => text.includes(`\x1b[${rows};1H`));
            const key = async (value: string, contains?: string) => {
                const length = pty.captured().length;
                pty.send(value);
                await pty.wait(text => Buffer.byteLength(text) > length &&
                    text.slice(text.lastIndexOf('\x1b[H')).includes(`\x1b[${rows};1H`) &&
                    (!contains || text.slice(text.lastIndexOf('\x1b[H')).includes(contains)));
            };
            const capture = (page: string, width = columns, height = rows) => {
                const raw = pty.captured();
                const screen = new Capture(width, height);
                screen.feed(raw.subarray(raw.lastIndexOf(Buffer.from('\x1b[H'))));
                const directory = join(output, language);
                fs.mkdirSync(directory, { recursive: true });
                fs.writeFileSync(join(directory, page + '.ansi'), raw);
                if (width >= 64 && height >= 18) {
                    for (const [foreground, background] of Object.values(TERMINAL_THEMES)) {
                        verifyColors(screen.buffer, width, height, foreground, background, ['gradient-selector', 'theme-selector'].includes(page));
                    }
                    const panel = dimensions(width, height).content;
                    for (const line of screen.buffer.slice(panel.innerY, panel.innerY + panel.innerHeight)) {
                        if (line[panel.innerX]?.data !== '─' || line[panel.innerX + 1]?.data !== ' ') continue;
                        assert(line.slice(panel.innerX, panel.innerX + panel.innerWidth)
                            .every(cell => cell.fg === 'cyan' && cell.bold), 'A group separator lost its heading style');
                    }
                }
                for (const [theme, [foreground, background]] of Object.entries(TERMINAL_THEMES)) {
                    if (!values.extended && theme !== 'dark') continue;
                    const cells = { columns: width, rows: height, cells: screen.buffer,
                        terminal_foreground: foreground, terminal_background: background };
                    const name = page + (theme === 'light' ? '-light' : '');
                    const json = JSON.stringify(cells);
                    fs.writeFileSync(join(directory, name + '.json'), json);
                    const image = renderCapture(cells, [0, 0, width, height], fonts);
                    fs.writeFileSync(join(directory, name + '.png'), image.png);
                    captures.push({ language, page, theme, columns: width, rows: height,
                        ansi_sha256: sha256(raw), cells_sha256: sha256(json), png_sha256: sha256(image.png),
                        width: image.width, height: image.height });
                }
                return screen.buffer.map(row => row.map(cell => cell.data).join(''));
            };
            const selectSetting = async (name: string) => {
                await key('\x1b[H');
                for (let index = 0; index < 64; index++) {
                    const raw = pty.captured();
                    const screen = new Capture(columns, rows);
                    screen.feed(raw.subarray(raw.lastIndexOf(Buffer.from('\x1b[H'))));
                    if (screen.buffer.some(row => row.some(cell => cell.reverse) &&
                        row.map(cell => cell.data).join('').includes('› ' + t(name.startsWith('fields.') ? name : 'settings.' + name, language)))) return;
                    await key('\x1b[B');
                }
                throw new Error('Setting not found in installed editor: ' + name);
            };
            for (const page of ['main', 'subagents', 'settings', 'layout']) {
                capture(page);
                if (page !== 'layout') {
                    await key('\t');
                }
            }
            if (values.extended) {
                await key('\x1b[H'); await key('\x1b[B\x1b[B ');
                await key('\x1b[H\x1b[B\r', t('alignment.title', language)); capture('alignment-list');
                await key('\r'); await key('\x1b[B\x1b[C\x1b[B\x1b[C'); capture('alignment-form');
                await key('\x1b[F\r'); capture('alignment-draft');
                await key('\r\x1b[B\r'); await key('\x07');
                await key('\x1b[H\x1b[D');
                await key('\t');
                await key('\x02', t('composition.groups.title', language));
                capture('groups-list');
                await key('\x1b[B\r'); capture('groups-form');
                await key('\x1b[F\r'); capture('groups-draft');
                await key('\x1b[B\r'); await key('\x1b[F\r');
                await key('\x07');
                for (const type of ['context-used', 'session-cost-rate']) {
                    await key('\x01'); await key('/');
                    for (const character of type) await key(character);
                    await key('\r'); await key('\r'); await key('\x05');
                    await selectSetting(type === 'context-used' ? 'fields.item.presentation.label' : 'fields.item.cost_rate_basis.label');
                    await key('\x1b[C');
                    const screen = capture(type === 'context-used' ? 'indicator-controls' : 'cost-rate-controls');
                    const preview = dimensions(columns, rows).preview;
                    assert(screen.slice(preview.innerY, preview.innerY + preview.innerHeight).some(line => line.includes(type === 'context-used' ? '[' : '5.76')), 'The selected representation did not reach the installed preview');
                    if (type === 'context-used') {
                        await selectSetting('fields.item.foreground_gradient.label'); await key('\x1b[C'); capture('foreground-gradient');
                        await selectSetting('fields.item.background_gradient.label'); await key('\x1b[C'); capture('background-gradient');
                        await key('\r'); capture('gradient-selector'); await key('\x1b[H');
                        for(let index=0;index<12;index++)await key('\x1b[B');
                        await key('\r'); await key('\x15'); await key('#112233,#445566,#778899'); capture('gradient-custom'); await key('\r'); await key('\x13');
                    }
                    await key('\x07'); await key('\x18'); await key('\x1b[H');
                }
                await key('\x19', t('sources.title', language));
                capture('sources-list');
                await key('\r');
                capture('sources-actions');
                await key('\x1b[B\r', t('sources.enable_review', language));
                capture('sources-review');
                await key('\x1b[6~');
                capture('sources-review-details');
                await key('\x07');
                await key('\r');await key('\x1b[B'.repeat(6)+'\r');capture('source-summary');await key('\x07');
                await key('\x1b[B'.repeat(3)+'\r');capture('source-bindings');await key('\x07');
                await key('\x1b[B\r');
                await key('\x1b[B'.repeat(10) + '\r', t('sources.interval', language));
                capture('automatic-review');
                await key('\x1b[C'); capture('automatic-interval');
                await key('\x07');
                await key('\x1b[B\x1b[B\r');
                capture('sources-kinds');
                await key('\x1b[B\x1b[B\r');
                capture('sources-command');
                await key('\x07'); await key('\x07');
                for (const id of ['daily-development', 'agent-focus', 'quota-watch']) {
                    await key('\x10', t('quick.title', language));
                    await key('\x1b[H');
                    for (let index = 0; index < PRESETS.findIndex(preset => preset.id === id); index++) await key('\x1b[B');
                    await key('\r', t('quick.appearance', language));
                    capture('scheme-' + id);
                    await key('\x1b[F\r', t('quick.review', language));
                    await key('\x1b[B\x1b[B\r', t('profiles.field.name', language));
                    capture('scheme-copy-' + id);
                    await key('\x07'); await key('\x07');
                }
                await key('\x10',t('quick.title',language));
                capture('quick-scenario');
                await key('\r',t('quick.appearance',language));
                capture('quick-appearance');
                await key('\x1b[F\r',t('quick.review',language));
                capture('quick-review');
                await key('\x07');
                await key('\x0f',t('profiles.title',language));
                capture('profiles-list');
                await key('\x1b[B\r',t('profiles.action.edit',language));
                capture('profiles-actions');
                await key('\x1b[B\x1b[B\r',t('profiles.field.name',language));
                capture('profiles-rename');
                await key('\x07'); await key('\x07');
                await key(' ');
                await key('\x0f',t('profiles.title',language));
                await key('\r',t('profiles.dirty',language));
                capture('profiles-dirty-switch');
                await key('\x07'); await key('\x07'); await key(' ');
                // Exercise catalog guidance and semantic text focus through installed keys.
                for (const scope of ['main', 'subagent'] as const) {
                    const type = scope === 'main' ? 'task-active-timer' : 'status';
                    await key('\x01');
                    await key('/');
                    for (const character of type) await key(character);
                    await key('\r');
                    await key('\x05', t('guidance.title', language));
                    const guidance = capture('picker-guidance-' + scope);
                    assert(guidance[1]!.includes(t(`items.${scope}.${type}.label`, language)));
                    await key('\x1b');
                    await key('\x1b');
                    await key('\x01');
                    await key('/');
                    for (const character of 'text') await key(character);
                    await key('\r');
                    await key('\r');
                    await key('\x05');
                    await key('\r');
                    await key('\x15');
                    const literal = '中文 日本語 한글 é 👩🏽‍💻';
                    await key(literal, '👩🏽‍💻');
                    await key('\r');
                    const body = capture('text-body-' + scope);
                    const preview = dimensions(columns, rows).preview;
                    assert(body.slice(preview.innerY, preview.innerY + preview.innerHeight).some(line => line.includes(literal)), 'Text body did not reach production preview');
                    await key('\x07');
                    await key(scope === 'main' ? '\t' : '\x1b[Z');
                }
                await key('\x06');
                assert(capture('category')[3]!.includes(t('catalog.search.choose_category', language)));
                await key('\x1b');
                await key('\x01');
                assert(capture('picker').at(-2)!.includes(t('composition.add', language)));
                await key('/');
                for (const character of 'git') await key(character);
                await key('\r');
                capture('search');
                await key('\x1b');
                await key('\x05');
                const detail = capture('detail');
                assert.equal(detail.find(line => line.includes(t('settings.item-guidance', language)))?.match(/Enter/gu)?.length, 1);
                await key('\r');
                await key('\x15');
                await key('中文 é 👩🏽‍💻', '👩🏽‍💻');
                assert(capture('text-edit')[0]!.includes('*'));
                await key('\x1b[H\x1b[C');
                await key('标','中标▏文');
                capture('text-cursor');
                await key('\x1b');
                await key('\x1b[H');
                await key('\r',t('explain.title',language));
                capture('explanation');
                await key('\x07');
                await key('\x1b[B\r',t('guidance.title',language));
                capture('guidance');
                await key('\x1b');
                await key('\x07');
                await key('\t');
                await key('\t');
                await selectSetting('fields.global.theme.label');await key('\r',t('colors.title',language));capture('theme-selector');await key('\x07');
                await key('\x16');capture('sample-warning');await key('\x17');capture('sample-width');
                await key('\x0c',t('diagnosis.title',language));capture('file-diagnosis-form');await key('\x07');
                for (const option of ['padding', 'separator', 'start_cap', 'end_cap', 'color_mode']) {
                    await selectSetting('fields.global.powerline.' + option + '.label');
                    await key('\x1b[C');
                }
                capture('powerline-controls');
                await selectSetting('padding');
                await key('9');
                assert(capture('numeric').some(line => line.includes('9▏')));
                await key('9');
                capture('numeric-error');
                await key('\x1b');
                run(['config', 'export', 'statusline.json', '--overwrite']);
                const portablePath = join(installed.temporary, 'statusline.json');
                const portable = JSON.parse(fs.readFileSync(portablePath, 'utf8'));
                portable.draft.host.padding = 2;
                fs.writeFileSync(portablePath, JSON.stringify(portable));
                await selectSetting('task-details');await key('\r',t('task.title',language));capture('task-identity');
                await key('capture-session');await key('\r','captured-task');capture('task-summary');
                await key('/agent-alpha\r');await key('e');await key('\x1b[F');capture('task-evidence');
                await key('r');await key('q');
                await selectSetting('package-management');await key('\r',t('package.ui.title',language));capture('package-local');
                await key('\x1b[F');capture('package-local-details');await key('q');
                await selectSetting('import-file');
                await key('\r');
                await key('\r', t('review.selection.help', language));
                capture('review');
                await key('\r');
                capture('review-expanded');
                await key('s'); capture('review-selection-empty');
                await key('\x1b[B\x1b[B\x1b[B\x1b[B '); capture('review-selection-theme');
                await key('\r'); capture('review-selection-differences');
                await key('\x1b');
                await key('\x1b[H');
                for (let index = 0; index < 15; index++) await key('\x1b[B');
                const selected = capture('settings-focus').find(line => line.includes('› '));
                await key('\t');
                await key('\x1b[F');
                capture('layout-focus');
                await key('\x1b[Z');
                assert.equal(capture('settings-restored').find(line => line.includes('› ')), selected);
                await key('\t');
                await key('\t');
                for (const [width, height] of [[32, 12], [64, 18], [64, 19], [64, 20], [80, 24], [120, 30], [80, 48]]) {
                    const length = pty.captured().length;
                    pty.resize(width!, height!);
                    await pty.wait(text => Buffer.byteLength(text) > length &&
                        text.slice(text.lastIndexOf('\x1b[H')).includes(`\x1b[${height};1H`));
                    capture(`boundary-${width}x${height}`, width, height);
                }
            }
            pty.send('\x1b');
            await pty.exited();
            assert.equal(pty.child.exitCode, 0);
            assert.deepEqual(pty.attributes(), pty.before, 'Terminal attributes were not restored');
            if(values.extended){
                await pty.close();
                pty=openPty(config,columns,rows,installed.env,language,{executable:installed.node,args:[installed.entry,'--language',language,'task','view','--session-id','capture-session'],cwd:installed.temporary});
                await pty.wait(text=>text.includes('captured-task')&&text.includes(`\x1b[${rows};1H`));capture('task-standalone');
                pty.send('q');await pty.exited();assert.equal(pty.child.exitCode,0);assert.deepEqual(pty.attributes(),pty.before);
                assert.deepEqual(fs.readFileSync(taskEvidence.path),taskEvidence.bytes);
            }

            assert.deepEqual(fs.readFileSync(join(config, 'settings.json')), settings, 'Capture changed configuration');
            assert.deepEqual(fs.readFileSync(join(config, 'claude-statusline-sources.json')), sources, 'Cancelled automatic review changed source policy');
            assert.deepEqual(fs.readFileSync(join(config, 'claude-statusline.json')), display, 'Capture changed display configuration');
            assert.deepEqual(fs.readFileSync(join(config, 'claude-statusline-profiles.json')), profiles, 'Capture changed scheme collection');
        } finally { await pty.close(); }
    }
    if (values.extended) {
        const config = installed.env.CLAUDE_CONFIG_DIR;
        const display = fs.readFileSync(join(config, 'claude-statusline.json'));
        for (const TERM of ['vt100', 'vt220', 'xterm-mono', 'dumb']) {
            let pty = openPty(config, 80, 24, { ...installed.env, TERM, COLORTERM: 'truecolor', NO_COLOR: undefined }, 'en',
                { executable: installed.node, args: [installed.entry, '--language', 'en', 'configure'], cwd: installed.temporary });
            try {
                const supported = TERM !== 'dumb';
                await pty.wait(text => text.includes(supported ? '\x1b[24;1H' : 'Interactive configuration requires an ANSI/VT terminal'));
                const raw = pty.captured();
                assert(!/\x1b\[(?:3[0-9]|4[0-9]|9[0-7]|10[0-7])(?:;|m)/u.test(raw.toString('utf8')), TERM + ' emitted explicit colors');
                fs.writeFileSync(join(output, TERM + '.ansi'), raw);
                monochrome.push({ TERM, COLORTERM: 'truecolor', supported, explicit_colors: false, ansi_sha256: sha256(raw) });
                if (supported) pty.send('\x1b');
                await pty.exited();
                assert.equal(pty.child.exitCode, supported ? 0 : 2);
                assert.deepEqual(pty.attributes(), pty.before);
                assert.deepEqual(fs.readFileSync(join(config, 'claude-statusline.json')), display);
            } finally { await pty.close(); }
        }
    }
    const report = { status: 'pass', kind: 'installed PTY terminal-cell reconstruction; not an OS screenshot', commit: values.commit, tarball_sha256: artifact.sha256,
        application_version: artifact.source.application_version, platform: process.platform, arch: process.arch, os_release: release(), node: process.version,
        collector_sha256: artifact.source.source_hashes['tools/acceptance/editor-capture.ts'], model_calls: 0, terminal_restored: true, extended: values.extended === true,
        sample_configuration: { directory_style: 'home', statusline_language: 'matches the interface language', data: 'fixed production preview samples' },
        font_sha256: Object.fromEntries(fonts.map(path => [basename(path), sha256(fs.readFileSync(path))])), captures, monochrome };
    fs.writeFileSync(join(output, 'editor-capture.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'pass', captures: captures.length, commit: values.commit, tarball_sha256: artifact.sha256 }));
} finally { installed.cleanup(); }
