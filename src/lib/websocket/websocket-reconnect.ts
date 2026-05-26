import type { ResolvedConfig } from './websocket-types';

/** Mutable reconnection state tracked per WebSocket instance. */
export interface ReconnectState {
	reconnectAttempts: number;
	currentReconnectInterval: number;
	reconnectTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Returns true if a reconnection attempt should be made based on the
 * current attempt count and configured maximum.
 *
 * A maxReconnectAttempts of -1 means unlimited retries.
 */
export function shouldReconnect(state: ReconnectState, config: ResolvedConfig): boolean {
	return (
		config.maxReconnectAttempts === -1 || state.reconnectAttempts < config.maxReconnectAttempts
	);
}

/**
 * Schedules a reconnection attempt using exponential backoff. Mutates
 * `state` to increment the attempt counter and advance the backoff
 * interval. Calls `connectFn` after the delay fires.
 *
 * Does nothing if a timer is already pending.
 */
export function scheduleReconnect(
	state: ReconnectState,
	config: ResolvedConfig,
	connectFn: () => void
): void {
	if (state.reconnectTimer !== null) return;

	state.reconnectAttempts++;

	// 0-50% additive jitter on the actual sleep to break thundering-herd
	// lockstep when N clients reconnect simultaneously after a server bounce.
	// Stored currentReconnectInterval stays clean so exponential backoff math
	// below remains deterministic and the maxReconnectInterval cap still
	// bounds growth (max possible sleep = maxReconnectInterval * 1.5).
	const sleepMs =
		state.currentReconnectInterval + Math.random() * state.currentReconnectInterval * 0.5;

	state.reconnectTimer = setTimeout(() => {
		state.reconnectTimer = null;
		connectFn();
	}, sleepMs);

	// Apply backoff for the next scheduled attempt
	state.currentReconnectInterval = Math.min(
		state.currentReconnectInterval * config.reconnectBackoffMultiplier,
		config.maxReconnectInterval
	);
}
