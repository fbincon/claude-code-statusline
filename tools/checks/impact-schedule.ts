import { estimatedScopedTaskMs, scopedTaskBudget, SCOPED_HOSTED_JOB_MS } from './impact-budget.ts';
import type { ImpactTask } from './impact-plan.ts';

/** Split oversized tasks at check boundaries in the plan's original order. */
export function partitionScopedTasks(tasks: readonly ImpactTask[], files: readonly string[]): ImpactTask[] {
    return tasks.flatMap(task => {
        if (estimatedScopedTaskMs(task, files) <= SCOPED_HOSTED_JOB_MS) return [task];

        const partitions: ImpactTask[] = [];
        let partition: ImpactTask = { ...task, checks: [] };
        for (const check of task.checks) {
            const candidate = { ...partition, checks: [...partition.checks, check] };
            if (partition.checks.length && estimatedScopedTaskMs(candidate, files) > SCOPED_HOSTED_JOB_MS) {
                partitions.push(partition);
                partition = { ...task, id: task.id + '-' + (partitions.length + 1), checks: [check] };
            } else {
                partition = candidate;
            }
        }
        partitions.push(partition);
        for (const part of partitions) scopedTaskBudget(part, files);
        return partitions;
    });
}
