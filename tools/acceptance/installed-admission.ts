import { AsyncLocalStorage } from 'node:async_hooks';

/** A bounded journey can stop admitting commands; once admitted, the command
 * retains its entire existing timeout. Diagnostic drivers can run independently. */
const scope = new AsyncLocalStorage<{ name: string; deadline: number }>();
export function withinInstalledBudget<T>(name: string, budgetMs: number, run: () => T): T {
    return scope.run({ name, deadline: performance.now() + budgetMs }, run);
}
export function admitInstalledCommand(durationMs: number, now = performance.now()): void {
    const active = scope.getStore();
    if (active && now + durationMs > active.deadline) throw new Error('Installed phase cannot admit another command: ' + active.name);
}
