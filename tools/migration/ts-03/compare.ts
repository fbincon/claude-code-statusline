import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical, decode, isLosslessNumber } from '@fbincon/statusline-core/json';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { checkBaseline, fixtures, repoRoot } from './common.js';
import { VERSION } from '@fbincon/statusline-core/release';
import { PROTOCOL_VERSION, PRESETS } from '@fbincon/statusline-core/contracts/ui';
import { ITEMS } from '@fbincon/statusline-core/config/catalog';
import { LANGUAGES } from '@fbincon/statusline-core/i18n/registry';
import { appearanceBaseline } from './appearance-compatibility.js';

// TS-06 release metadata only. Frozen fixtures and the three wording exceptions stay intact.
const versionFields = new Set([
  'ui-read/value/response/result/backend_version', 'ui-describe/value/response/result/backend_version',
  ...['initial', 'first_save', 'reopen'].map(step => `transaction-save-conflict-backup/value/${step}/response/result/backend_version`),
]);
const runtimeOutputs = new Set([
  ...['runtime-v1-dedup-order', 'runtime-v2-dedup-order'].flatMap(id => [0, 1].map(i => `${id}/value/${i}/stdout`)),
  'runtime-null-prompt/value/0/stdout', 'runtime-opt-out-no-write/value/0/stdout',
]);
export function releaseMetadataDifference(id: string, path: string, before: unknown, after: unknown): boolean {
  const key = id + path;
  if (versionFields.has(key)) return before === '2.0.0' && after === VERSION;
  if (key === 'cli-version/value/stdout') return before === 'claude-statusline 2.0.0\n' && after === `claude-statusline ${VERSION}\n`;
  if (!runtimeOutputs.has(key) || typeof before !== 'string' || typeof after !== 'string') return false;
  const field = /"backend_version":( ?)"2\.0\.0"/gu;
  if ([...before.matchAll(field)].length !== 1) return false;
  return before.replace(field, (_match, space: string) => '"backend_version":' + space + JSON.stringify(VERSION)) === after;
}

/** v3.0.0 explicitly changes the no-preference collector policy, not the frozen oracle. */
export function runtimeDefaultDifference(id: string, path: string, before: unknown, after: unknown): boolean {
  if (id !== 'runtime-null-prompt' || path !== '/value/0/stdout' || typeof before !== 'string' || typeof after !== 'string') return false;
  if (sha256(before) !== '31d3f479903f622279afdf0f0a6016a8c519807da0a84b0da8b9d3fd02c69be8') return false;
  return before.replace('"native_timing": true', '"native_timing": false')
    .replace('"backend_version": "2.0.0"', '"backend_version": ' + JSON.stringify(VERSION))
    .replace('"enabled": true, "fresh": false, "reason": "not_observed"', '"enabled": false, "fresh": false, "reason": "runtime_disabled"')
    .replace('"task-active-timer": {"value": null, "reason": "not_observed"', '"task-active-timer": {"value": null, "reason": "native_timing_disabled"') === after;
}

/** Only malformed-input envelopes with no usable request version adopt runtime v3. */
export function runtimeProtocolDifference(id: string, path: string, before: unknown, after: unknown): boolean {
  return ['runtime-invalid', 'runtime-duplicate', 'runtime-nonfinite'].includes(id) && path === '/value/0/stdout' && typeof before === 'string' && typeof after === 'string'
    && before.startsWith('{"protocol_version": 2, "error":') && before.replace(/^\{"protocol_version": 2,/u, '{"protocol_version": 3,') === after;
}

export interface Difference { case: string; path: string; before_sha256: string; after_sha256: string; reason: string }
const UI_CASES = new Set(['ui-read', 'ui-describe', 'ui-preview', 'ui-read-ui-preferences', 'ui-invalid', 'ui-duplicate', 'ui-nonfinite', 'ui-wrong-version', 'ui-unknown-operation', 'ui-null-draft', 'ui-zero-width']);
/** v3.1.0's explicit protocol/registry changes, bounded to known frozen fields. */
export function regionalLanguageDifference(id: string, path: string, before: unknown, after: unknown): boolean {
  const protocol = UI_CASES.has(id) && path === '/value/response/protocol_version'
    || id === 'transaction-save-conflict-backup' && /^\/value\/(initial|first_save|stale_save|reopen)\/response\/protocol_version$/u.test(path)
    || id === 'portable-roundtrip-review-no-save' && /^\/value\/responses\/[012]\/response\/protocol_version$/u.test(path);
  if (protocol || id === 'ui-wrong-version' && path === '/value/response/error/localization/params/version') return canonical(before) === canonical(11) && canonical(after) === canonical(PROTOCOL_VERSION);
  if (id === 'ui-wrong-version' && ['/value/response/error/message', '/value/response/error/localization/fallback'].includes(path)) {
    return before === 'Only protocol_version 11 is supported; reinstall matching frontend/backend resources'
      && after === `Only protocol_version ${PROTOCOL_VERSION} is supported; reinstall matching frontend/backend resources`;
  }
  if (id === 'ui-describe' && ['/value/response/result/editor_fields/global/2/choices', '/value/response/result/options/statusline-language/choices'].includes(path)) {
    return canonical(before) === canonical(['en', 'zh-CN', 'zh-Hant', 'ja', 'ko']) && canonical(after) === canonical([...LANGUAGES]);
  }
  return false;
}
export function compare(expected: unknown, actual: unknown, differences: readonly Difference[] = []): string[] {
  const errors: string[] = [], used = new Set<Difference>();
  const permitted = new Map<string, string>([['cli-help', '/value/stdout'], ['cli-unknown-command', '/value/stderr'], ['cli-config-refused', '/value/stderr']]);
  for (const d of differences) {
    if (permitted.get(d.case) !== d.path || !d.reason || !/^[a-f0-9]{64}$/.test(d.before_sha256) || !/^[a-f0-9]{64}$/.test(d.after_sha256)) throw new Error('Unapproved comparison exemption');
    if (differences.filter(x => x.case === d.case && x.path === d.path).length !== 1) throw new Error('Duplicate comparison exemption');
  }
  function walk(a: unknown, b: unknown, path: string, id: string) {
    if (canonical(a) === canonical(b)) return;
    const migrated = appearanceBaseline(id, path, a);
    if (migrated !== a) { walk(migrated, b, path, id); return; }
    if (releaseMetadataDifference(id, path, a, b)) return;
    if (runtimeDefaultDifference(id, path, a, b)) return;
    if (runtimeProtocolDifference(id, path, a, b)) return;
    if (regionalLanguageDifference(id, path, a, b)) return;
    if (id==='ui-describe' && path==='/value/response/result/operations') {
      const old=['describe','read','preview','apply','import','export','preset','read_ui_preferences','set_ui_language','review_import'];
      if(canonical(a)===canonical(old) && canonical(b)===canonical(['sources_read','sources_apply','source_review','source_context','source_refresh','source_status','source_cancel','source_diagnose',...old,'explain','diagnose','profiles_read','profiles_apply','profile_import','profile_export','task_details'])) return;
    }
    if (id === 'ui-describe' && path === '/value/response/result/catalog' && Array.isArray(a) && Array.isArray(b)) {
      const extensionIds = ['external-value','github-pr','github-ci'];
      const extensions = b.filter(item => extensionIds.includes(item.id));
      const supported = b.filter(item => item.capabilities && !extensionIds.includes(item.id));
      if (canonical(extensions) !== canonical(ITEMS.filter(item => extensionIds.includes(item.id))) ||
          canonical(supported) !== canonical(ITEMS.filter(item => item.capabilities && !extensionIds.includes(item.id)))) {
        errors.push('ui-describe/catalog: unexpected extension capabilities'); return;
      }
      const cause = b.filter(item => item.id === 'cache-miss-reason');
      const worktree = b.find(item => item.scope === 'main' && item.id === 'worktree');
      const expectedTree = ITEMS.find(item => item.scope === 'main' && item.id === 'worktree');
      const original = b.filter(item => !['cache-miss-reason',...extensionIds].includes(item.id)).map(({capabilities,...item})=>item).map(item => item.scope === 'main' && item.id === 'worktree'
        ? { ...item, description: 'Worktree name in --worktree sessions', sources: ['worktree.name'], guidance: { ...item.guidance, requirements: ['observed_field', 'worktree_session'] } } : item);
      if (canonical(worktree) === canonical(expectedTree) && cause.length === 1 && canonical(cause[0]) === canonical(ITEMS.find(item => item.id === 'cache-miss-reason')) && canonical(a) === canonical(original)) return;
    }
    if (id === 'ui-describe' && path === '/value/response/result/presets') {
      const order=['left-right','repeated-metrics','minimal','developer','monitoring','multi-agent'];
      const old=order.map(id=> { const p=PRESETS.find(p=>p.id===id)!; return {id:p.id,label:p.label,rows:p.rows,layout_mode:p.layout_mode}; });
      if (canonical(a)===canonical(old) && canonical(b)===canonical(PRESETS)) return;
    }
    const allowed = differences.find(x => x.case === id && x.path === path);
    if (allowed && typeof a === 'string' && typeof b === 'string' && sha256(a) === allowed.before_sha256 && sha256(b) === allowed.after_sha256) { used.add(allowed); return; }
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
      a.forEach((value, i) => walk(value, b[i], path + '/' + i, id)); return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b) && !isLosslessNumber(a) && !isLosslessNumber(b)) {
      const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        if (!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) errors.push(`${id}${path}/${key}: missing or extra field`);
        else walk(left[key], right[key], path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1'), id);
      }
      return;
    }
    errors.push(`${id}${path}: value or type differs`);
  }
  if (!expected || !actual || typeof expected !== 'object' || typeof actual !== 'object' || Array.isArray(expected) || Array.isArray(actual)) throw new Error('Expected case maps');
  const left = expected as Record<string, unknown>, right = actual as Record<string, unknown>;
  for (const id of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!Object.hasOwn(left, id) || !Object.hasOwn(right, id)) errors.push(`${id}: missing or extra case`);
    else walk(left[id], right[id], '', id);
  }
  for (const d of differences) if (!used.has(d)) errors.push(`${d.case}${d.path}: stale comparison exemption`);
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkBaseline();
  if (process.argv.length !== 3) throw new Error('Usage: migration:compare CANDIDATE.json');
  const expected = decode(readFileSync(join(fixtures, 'expected.json'), 'utf8'));
  const actual = decode(readFileSync(process.argv[2]!, 'utf8'));
  const differences = JSON.parse(readFileSync(join(repoRoot, 'tools/migration/ts-03/differences.json'), 'utf8')) as Difference[];
  const errors = compare(expected, actual, differences);
  console.log(JSON.stringify({ status: errors.length ? 'fail' : 'pass', cases: Object.keys(expected as object).length, differences: differences.length, errors }));
  process.exitCode = errors.length ? 1 : 0;
}
