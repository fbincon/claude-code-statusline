export const ACTIVE_REFRESH_MS = 2000;
export const IDLE_REFRESH_MS = 10000;
export const MAX_REFRESH_BACKOFF_MS = 30000;

export type RefreshReason = 'entry' | 'manual' | 'automatic';
export interface RefreshTarget {
    owner: object;
    key: string;
    /** Milliseconds between successful reads. Null permits entry and manual reads only. */
    interval: number | null;
    /** A manual read can include extra data, such as the current UI language. */
    rereadOnManualJoin?: boolean;
    read(signal: AbortSignal, reason: RefreshReason): Promise<() => boolean>;
    failed(error: unknown): boolean;
}

const sameTarget = (a: RefreshTarget | null, b: RefreshTarget | null) =>
    a?.owner === b?.owner && a?.key === b?.key;

/** Background work produces a snapshot. Only the terminal queue can apply it and redraw. */
export class ForegroundRefresh {
    private submit?: (apply: () => boolean) => void;
    private current: RefreshTarget | null = null;
    private pending: { controller: AbortController; reason: RefreshReason } | null = null;
    private manualQueued = false;
    private lastRead: number | null = null;
    private retryDelay = 0;
    private closed = false;

    constructor(private readonly target: () => RefreshTarget | null,
        private readonly now: () => number = () => performance.now()) {}

    bind(submit: (apply: () => boolean) => void): void {
        if (!this.closed) this.submit = submit;
    }

    tick(): void { this.schedule(false); }
    immediate(): void { this.schedule(true); }

    invalidate(): void {
        this.current = null;
        this.lastRead = null;
        this.retryDelay = 0;
        this.manualQueued = false;
        this.pending?.controller.abort();
    }

    close(): void {
        this.closed = true;
        this.invalidate();
        this.pending = null;
        this.submit = undefined;
    }

    private schedule(manual: boolean): void {
        if (this.closed || !this.submit) return;
        const target = this.target();
        if (!sameTarget(this.current, target)) this.invalidate();
        this.current = target;
        if (!target) return;
        if (this.pending) {
            if (manual && (this.pending.controller.signal.aborted ||
                this.pending.reason === 'automatic' && target.rereadOnManualJoin)) this.manualQueued = true;
            return;
        }
        const reason = manual || this.manualQueued ? 'manual' : this.lastRead === null ? 'entry' : 'automatic';
        if (reason === 'automatic' && (target.interval === null ||
            this.now() - this.lastRead! < (this.retryDelay || target.interval))) return;

        this.manualQueued = false;
        const controller = new AbortController();
        this.pending = { controller, reason };
        void this.read(target, controller.signal, reason);
    }

    private async read(target: RefreshTarget, signal: AbortSignal, reason: RefreshReason): Promise<void> {
        let apply: () => boolean;
        try { apply = await target.read(signal, reason); }
        catch (error) { apply = () => { throw error; }; }
        if (signal.aborted || this.closed) {
            this.settled();
            return;
        }
        this.submit!(() => {
            try {
                if (this.closed || signal.aborted || !sameTarget(target, this.target())) return false;
                this.lastRead = this.now();
                try {
                    const changed = apply();
                    this.retryDelay = 0;
                    return changed;
                } catch (error) {
                    this.retryDelay = Math.min(MAX_REFRESH_BACKOFF_MS,
                        2 * (this.retryDelay || target.interval || ACTIVE_REFRESH_MS));
                    return target.failed(error);
                }
            } finally { this.settled(); }
        });
    }

    private settled(): void {
        this.pending = null;
        // A foreground operation may have invalidated the page before it finished.
        // Only resume if a terminal observation has selected a target since then.
        if (this.current) this.tick();
    }
}
