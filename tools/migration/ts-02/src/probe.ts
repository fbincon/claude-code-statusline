import { spawnSync, execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { machine, platform, release, tmpdir } from 'node:os';
import { packageRoot, repoRoot, cli, sha, sourceHashes, reference } from './context.js';
import { decode, integer } from './json.js';
import { sample } from './clocks.js';

const root = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass a new output directory');
fs.mkdirSync(root, { recursive: false });
const report: Record<string, unknown> = {
  format_version: 1, reference, node: process.version, platform: platform(), os: release(), host_arch: machine(),
  runner_arch: process.env.RUNNER_ARCH ?? null, process_arch: process.arch, source_hashes: sourceHashes(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim()),
  policy_sha256: sha(fs.readFileSync(join(packageRoot, 'policy.json'))), checks: {}, limitations: [
    'No physical suspend, reboot or power-loss evidence', 'No WSL desktop evidence',
    'No human Windows/macOS/Linux visual acceptance', 'No Windows 10 or macOS 14 Intel desktop evidence',
    'Minimal render and installation prototypes are not TS-03/TS-04 implementations',
  ],
};
const checks = report.checks as Record<string, unknown>;
const installed = fs.mkdtempSync(join(tmpdir(), 'ts02 installed 中文 $` & '));
try {
  if (process.version !== 'v24.21.0' || process.arch !== 'x64' && process.arch !== 'arm64') throw new Error('Unpinned runtime');
  if (process.env.TS02_EXPECT_PROCESS_ARCH && process.arch !== process.env.TS02_EXPECT_PROCESS_ARCH) throw new Error('Unexpected process architecture');
  const tests = fs.readdirSync(join(packageRoot, 'dist/tests')).filter(f => f.endsWith('.test.js')).map(f => join(packageRoot, 'dist/tests', f));
  const test = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-concurrency=1', '--test-timeout=30000', ...tests], { encoding: 'utf8', timeout: 180000 });
  fs.writeFileSync(join(root, 'tests.tap'), test.stdout + test.stderr);
  checks.tests = Object.fromEntries(['tests', 'pass', 'fail', 'skipped'].map(key => [key, Number(test.stdout.match(new RegExp(`# ${key} (\\d+)`))?.[1] ?? -1)]));
  if (test.status !== 0) { process.stderr.write(test.stdout + test.stderr); throw new Error('Platform tests failed; inspect tests.tap'); }
  const npm = process.env.npm_execpath;
  if (!npm || !fs.existsSync(npm)) throw new Error('Run via npm run probe so the exact npm entry is known');
  const pack = JSON.parse(execFileSync(process.execPath, [npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', installed], { cwd: packageRoot, encoding: 'utf8' }))[0];
  const tarball = join(installed, pack.filename);
  fs.writeFileSync(join(installed, 'package.json'), '{"name":"ts02-install-check","version":"0.0.0","private":true}\n');
  const installEnv = { ...process.env, PATH: dirname(process.execPath), npm_config_audit: 'false', npm_config_fund: 'false' };
  const installation = spawnSync(process.execPath, [npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], { cwd: installed, env: installEnv, encoding: 'utf8', timeout: 180000 });
  fs.writeFileSync(join(root, 'install.log'), installation.stdout + installation.stderr);
  if (installation.status !== 0) throw new Error('Isolated npm installation failed');
  const entry = join(installed, 'node_modules/@fbincon/statusline-ts02-probes/dist/cli.js');
  const node = join(installed, process.platform === 'win32' ? 'node.exe' : 'node');
  fs.copyFileSync(process.execPath, node); if (process.platform !== 'win32') fs.chmodSync(node, 0o700);
  const clock = spawnSync(node, [entry, 'clock'], { cwd: installed, env: installEnv, encoding: 'utf8' });
  if (clock.status !== 0) throw new Error(`Installed native dependency failed: ${clock.stderr}`);
  const measured = decode(clock.stdout) as Record<string, unknown>;
  if (!measured.boot_id || integer(measured.boot_ns) <= 0n) throw new Error('Installed boot clock unavailable');
  const fixture = JSON.parse(fs.readFileSync(join(packageRoot, 'fixtures/render.json'), 'utf8'));
  const config = join(installed, 'node_modules/@fbincon/statusline-ts02-probes/fixtures/model.json');
  const rendered = spawnSync(node, [entry, 'render', config, '80'], { cwd: installed, env: installEnv, input: fixture.source_case.input.stdin, encoding: 'utf8' });
  if (rendered.status !== 0 || rendered.stdout !== fixture.expected.stdout || rendered.stderr) throw new Error('Installed render mismatch');
  checks.installation = { prebuilt_native_loaded: true, lifecycle_scripts_disabled: true, path_excludes_python_and_compilers: true,
    outside_checkout: true, unicode_special_paths: true, resource_and_render_parity: true, tarball_sha256: sha(fs.readFileSync(tarball)),
    npm_version: execFileSync(process.execPath, [npm, '--version'], { encoding: 'utf8' }).trim(), entries: pack.files.map((f: { path: string }) => f.path) };
  checks.native_clock = { boot_available: Boolean(sample().boot_id), wall_encoding: 'JSON integer, bigint in memory' };
  report.status = 'pass';
} catch (error) { report.status = 'fail'; report.failure = String(error); process.exitCode = 1; }
finally {
  fs.rmSync(installed, { recursive: true, force: true });
  report.artifacts = Object.fromEntries(fs.readdirSync(root).map(name => [name, sha(fs.readFileSync(join(root, name)))]));
  fs.writeFileSync(join(root, 'evidence.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ status: report.status, checks, failure: report.failure }) + '\n');
}
