/** Resolve a package-sensitive plan without coupling the local CLI to Actions. */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { hash } from './impact-content.ts';
import { buildComparisonPackage, comparePackages } from '../build/impact-package.ts';
import type { ImpactPlan } from './impact-plan.ts';

export async function resolveComparison(plan: ImpactPlan, output: string): Promise<{ file: string; comparison_sha256: string }> {
    assert(plan.route !== 'blocked' && plan.route !== 'product');
    fs.mkdirSync(output, { recursive: false });
    const before = buildComparisonPackage(plan.base, join(output, 'base')), after = buildComparisonPackage(plan.head, join(output, 'head'));
    fs.copyFileSync(before, join(output, 'base.tgz')); fs.copyFileSync(after, join(output, 'head.tgz'));
    const comparison = comparePackages(plan.base, plan.head, before, after), bytes = JSON.stringify(comparison, null, 2) + '\n';
    fs.writeFileSync(join(output, 'comparison.json'), bytes);
    plan.comparison_sha256 = hash(bytes); plan.route = comparison.equivalent ? 'maintenance' : 'product';
    fs.writeFileSync(join(output, 'SHA256SUMS'), hash(fs.readFileSync(after)) + '  head.tgz\n');
    return { file: 'head.tgz', comparison_sha256: hash(bytes) };
}
