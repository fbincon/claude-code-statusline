/** Independent acceptance envelopes: later cases cannot extend an earlier phase. */
export interface PhaseReceipt {
    phase: 'baseline' | 'editor_execution';
    budget_ms: number;
    elapsed_ms: number;
    status: 'pass';
}
export class VersionPhaseBudget {
    private phase: PhaseReceipt['phase'] = 'baseline';
    private started: number;
    private timer: ReturnType<typeof setTimeout>;
    private expired = false;
    private closed = false;
    private readonly receipts: PhaseReceipt[] = [];
    constructor(private readonly baselineMs: number, private readonly editorMs: number,
        private readonly onExpire: (phase: PhaseReceipt['phase']) => void,
        private readonly now: () => number = () => performance.now()) {
        if (![baselineMs, editorMs].every(ms => Number.isSafeInteger(ms) && ms > 0)) throw new Error('Invalid acceptance budget');
        this.started = now(); this.timer = this.arm();
    }
    private limit(): number { return this.phase === 'baseline' ? this.baselineMs : this.editorMs; }
    private arm(): ReturnType<typeof setTimeout> {
        return setTimeout(() => { this.expired = true; this.onExpire(this.phase); }, this.limit()).unref();
    }
    private complete(): void {
        const elapsed_ms = this.now() - this.started;
        if (this.closed || this.expired || elapsed_ms < 0 || elapsed_ms > this.limit()) throw new Error('Acceptance phase expired: ' + this.phase);
        clearTimeout(this.timer);
        this.receipts.push({ phase: this.phase, budget_ms: this.limit(), elapsed_ms, status: 'pass' });
    }
    beginEditor(): void {
        if (this.phase !== 'baseline') throw new Error('Editor acceptance already started');
        this.complete(); this.phase = 'editor_execution'; this.started = this.now(); this.timer = this.arm();
    }
    finish(): PhaseReceipt[] { this.complete(); this.closed = true; return this.receipts.map(row => ({ ...row })); }
    close(): void { clearTimeout(this.timer); this.closed = true; }
}
