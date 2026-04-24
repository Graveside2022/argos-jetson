/**
 * Live-refresh controller for the RF visualization store.
 *
 * Owns the EventSource to `/api/rf/stream` plus two timers: a debounced
 * reload (fires after the stream settles) and a periodic reconcile (fires
 * regardless, so a dropped event doesn't leave the map stale forever).
 *
 * Pure class — no Svelte runes, so it's unit-testable with fake timers and
 * a mock EventSource factory.
 */

const DEFAULT_STREAM_URL = '/api/rf/stream';
const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_RECONCILE_MS = 30_000;

export type EventSourceFactory = (url: string) => EventSource;

export interface LiveRefreshCallbacks {
	/** Called when the controller wants the store to re-fetch the aggregate. */
	reload: () => Promise<void> | void;
	/** Override for testing. Defaults to the native EventSource. */
	eventSourceFactory?: EventSourceFactory;
	/** Debounce window for observation-triggered reloads. Default 250 ms. */
	debounceMs?: number;
	/** Reconcile cadence. Default 30 s. */
	reconcileMs?: number;
	/** Override for the SSE URL base. Default /api/rf/stream. */
	streamUrl?: string;
}

export class LiveRefreshController {
	private source: EventSource | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private reconcileTimer: ReturnType<typeof setInterval> | null = null;
	private live = false;

	constructor(private readonly callbacks: LiveRefreshCallbacks) {}

	get isLive(): boolean {
		return this.live;
	}

	connect(sessionId?: string): void {
		// Tear down any prior connection so repeat calls replace rather than stack.
		this.disconnect();

		const url = this.buildUrl(sessionId);
		const factory = this.callbacks.eventSourceFactory ?? ((u: string) => new EventSource(u));
		const source = factory(url);
		this.source = source;
		this.live = true;

		source.addEventListener('observation', () => this.scheduleReload());
		// `connected` and `heartbeat` are intentionally ignored — they are
		// lifecycle markers, not state changes the map needs to reflect.

		const reconcileMs = this.callbacks.reconcileMs ?? DEFAULT_RECONCILE_MS;
		this.reconcileTimer = setInterval(() => {
			void this.callbacks.reload();
		}, reconcileMs);
	}

	disconnect(): void {
		if (this.source) {
			this.source.close();
			this.source = null;
		}
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		if (this.reconcileTimer) {
			clearInterval(this.reconcileTimer);
			this.reconcileTimer = null;
		}
		this.live = false;
	}

	private buildUrl(sessionId?: string): string {
		const base = this.callbacks.streamUrl ?? DEFAULT_STREAM_URL;
		if (!sessionId) return base;
		const params = new URLSearchParams({ session: sessionId });
		return `${base}?${params.toString()}`;
	}

	private scheduleReload(): void {
		const debounceMs = this.callbacks.debounceMs ?? DEFAULT_DEBOUNCE_MS;
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null;
			void this.callbacks.reload();
		}, debounceMs);
	}
}
