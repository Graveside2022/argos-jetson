/**
 * Registry of signal-producing adapters.
 *
 * Every live capture pipeline (Blue Dragon, Kismet, GSM Evil, future SDR
 * sources) implements `SignalSourceAdapter` so the session + persistence +
 * bus plumbing is uniform. Upstream services register their adapter on
 * startup; the dashboard's "start scan" endpoints look them up here.
 */

export interface SignalSourceAdapter {
	/** Stable identifier — used by `/api/sessions` and the control endpoints. */
	readonly name: string;
	/** Start capturing into the provided session. Idempotent w.r.t. repeat calls. */
	start(sessionId: string): Promise<void>;
	/** Stop capturing. Idempotent. */
	stop(): Promise<void>;
	/** Current run state. */
	isRunning(): boolean;
}

const registry = new Map<string, SignalSourceAdapter>();

export function registerSignalSource(adapter: SignalSourceAdapter): void {
	if (registry.has(adapter.name)) {
		throw new Error(`SignalSource '${adapter.name}' already registered`);
	}
	registry.set(adapter.name, adapter);
}

export function unregisterSignalSource(name: string): void {
	registry.delete(name);
}

export function getSignalSource(name: string): SignalSourceAdapter | undefined {
	return registry.get(name);
}

export function listSignalSources(): SignalSourceAdapter[] {
	return Array.from(registry.values());
}
