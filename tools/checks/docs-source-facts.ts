/** Read current execution facts without importing or running the host/installed suites. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { FIXED_HOST_POLICY } from './ci-coverage.js';
import { HOSTS, TARGETS } from './runtime-inputs.js';

export type SourceReader = (path: string) => string;
export const sourceReader = (root: string): SourceReader => path => readFileSync(join(root, path), 'utf8');

function nodes<T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] {
    const found: T[] = [];
    const visit = (node: ts.Node) => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); };
    visit(root); return found;
}
function one<T>(values: T[], label: string): T {
    assert.equal(values.length, 1, 'Expected one source definition: ' + label); return values[0]!;
}
function unwrap(node: ts.Expression): ts.Expression {
    return ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ? unwrap(node.expression) : node;
}
function number(node: ts.Expression, label: string): number {
    node = unwrap(node);
    assert(ts.isNumericLiteral(node), 'Expected numeric source literal: ' + label);
    const value = Number(node.text); assert(Number.isSafeInteger(value) && value > 0, label); return value;
}
const named = (node: ts.Node, name: string): node is ts.VariableDeclaration =>
    ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name;
function variable(root: ts.Node, name: string, direct = false): ts.Expression {
    const declaration = one(nodes(root, (node): node is ts.VariableDeclaration => named(node, name) &&
        (!direct || node.parent.parent.parent === root)), name);
    assert(declaration.initializer, 'Missing source initializer: ' + name); return unwrap(declaration.initializer);
}
function strings(node: ts.Expression, label: string): string[] {
    node = unwrap(node); assert(ts.isArrayLiteralExpression(node), label);
    const result = node.elements.map(item => { assert(ts.isStringLiteral(item), label); return item.text; });
    assert(result.length && new Set(result).size === result.length, label); return result;
}
function call(node: ts.Expression, name: string, arity: number): ts.CallExpression {
    node = unwrap(node); assert(ts.isCallExpression(node) && node.expression.getText() === name && node.arguments.length === arity,
        'Unrecognized source call: ' + name); return node;
}
function automaticDefault(root: ts.Node): { initial: number; minimum: number; maximum: number } {
    const conditional = one(nodes(root, (node): node is ts.ConditionalExpression => ts.isConditionalExpression(node) &&
        ts.isBinaryExpression(node.condition) && node.condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        ts.isPropertyAccessExpression(node.condition.left) && node.condition.left.name.text === 'kind' &&
        ts.isStringLiteral(node.condition.right) && node.condition.right.text === 'command'), 'command automatic default');
    const maximumCall = call(conditional.whenFalse, 'Math.max', 2), minimumCall = call(maximumCall.arguments[1]!, 'Math.min', 2);
    assert(ts.isPropertyAccessExpression(minimumCall.arguments[1]!) && minimumCall.arguments[1].name.text === 'ttl_seconds',
        'Unrecognized automatic TTL clamp');
    const result = { initial: number(conditional.whenTrue, 'command default'), minimum: number(maximumCall.arguments[0]!, 'interval minimum'),
        maximum: number(minimumCall.arguments[0]!, 'interval maximum') };
    assert(result.minimum <= result.initial && result.initial <= result.maximum, 'Invalid automatic defaults'); return result;
}
function intervalBounds(root: ts.Node): number[] {
    const integer = one(nodes(root, (node): node is ts.CallExpression => ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) && node.expression.text === 'integer' && node.arguments.length === 4 &&
        ts.isStringLiteral(node.arguments[3]!) && node.arguments[3].text === 'interval_seconds'), 'interval_seconds validator');
    assert(ts.isPropertyAccessExpression(integer.arguments[0]!) && integer.arguments[0].name.text === 'interval_seconds',
        'Unrecognized interval validator input');
    return [number(integer.arguments[1]!, 'validated minimum'), number(integer.arguments[2]!, 'validated maximum')];
}

export function developmentFacts(root: string, read: SourceReader = sourceReader(root)) {
    const source = (path: string) => {
        const parsed = ts.createSourceFile(path, read(path), ts.ScriptTarget.ESNext, true);
        assert.equal((parsed as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics.length, 0, 'Cannot parse source: ' + path);
        return parsed;
    };
    const service = source('packages/cli/src/sources/service.ts'), state = source('packages/cli/src/sources/automatic-state.ts');
    const defaults = automaticDefault(variable(service, 'interval'));
    const base = variable(state, 'base');
    assert(ts.isObjectLiteralExpression(base), 'Unrecognized automatic status');
    const statusInterval = one(base.properties.filter((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) &&
        node.name.getText() === 'interval_seconds'), 'automatic status interval');
    assert.deepEqual(automaticDefault(statusInterval.initializer), defaults, 'Automatic service/status defaults disagree');
    for (const [name, parsed] of [['service', service], ['registry', source('packages/core/src/extensions/model.ts')]] as const)
        assert.deepEqual(intervalBounds(parsed), [defaults.minimum, defaults.maximum], name + ' interval bounds disagree');
    const leaseMs = number(variable(state, 'LEASE_MS'), 'LEASE_MS');
    const observer = source('mods/statusline-runtime/hooks/observe.ts');
    const renewal = one(nodes(observer, (node): node is ts.CallExpression => ts.isCallExpression(node) &&
        node.expression.getText() === '$.clock.every' && node.arguments.length === 2 &&
        nodes(node.arguments[1]!, (child): child is ts.CallExpression => ts.isCallExpression(child) &&
            ts.isIdentifier(child.expression) && child.expression.text === 'sourceLifecycle' && child.arguments.length === 4 &&
            ts.isStringLiteral(child.arguments[3]!) && child.arguments[3].text === 'tick').length > 0), 'source lifecycle renewal timer');
    const renewalMs = number(renewal.arguments[0]!, 'source lifecycle interval');
    assert(renewalMs % 1000 === 0 && leaseMs % 1000 === 0 && renewalMs < leaseMs, 'Invalid source lease timing');

    const checks = variable(source('tools/migration/ts-04/test/installed.test.ts'), 'checks');
    assert(ts.isObjectLiteralExpression(checks), 'Unrecognized installed check registry');
    const categories = checks.properties.map(node => {
        assert(ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.initializer.kind === ts.SyntaxKind.FalseKeyword,
            'Unrecognized installed check category'); return node.name.text;
    });
    assert(categories.length && new Set(categories).size === categories.length, 'Invalid installed check categories');
    const selectors = strings(variable(source('tools/checks/ci-coverage.ts'), 'selectors'), 'Node selectors');
    const runtime = source('tools/checks/runtime-inputs.ts');
    const inputs = one(nodes(runtime, (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'runtimeInputs'), 'runtimeInputs');
    assert(inputs.body, 'Missing runtime input implementation');
    const versions = variable(inputs.body, 'versions', true);
    assert(ts.isObjectLiteralExpression(versions), 'Unrecognized Node runtime registry');
    assert.deepEqual(versions.properties.map(node => {
        assert(ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name), 'Unrecognized Node selector'); return node.name.text;
    }).sort(), [...selectors].sort(), 'Runtime and coverage selectors disagree');
    const hosts = FIXED_HOST_POLICY.flatMap(host => host.os.map(os => ({ os, claude: host.version })));
    assert.deepEqual(hosts.map(host => host.os + '/' + host.claude).sort(), HOSTS.map(host => host.os + '/' + host.claude).sort(),
        'Fixed host registries disagree');
    const fullHosts = FIXED_HOST_POLICY.reduce((total, host) => total + host.full.length, 0);
    return { ...defaults, leaseSeconds: leaseMs / 1000, renewalSeconds: renewalMs / 1000, installedCategories: categories.length,
        installations: TARGETS.length, nodeCases: TARGETS.length * selectors.length,
        logical: TARGETS.length * (selectors.length + 1), hosts: hosts.length, fullHosts, shortHosts: hosts.length - fullHosts };
}
