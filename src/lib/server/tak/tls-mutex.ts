/**
 * tls-mutex.ts — serialized TLS-verification bypass for TAK enrollment.
 *
 * Background
 * ----------
 * TAK servers almost always present self-signed certificates during the
 * enrollment handshake (`/Marti/api/tls/config`, `/Marti/api/tls/signClient`,
 * `/oauth/token`). The `@tak-ps/node-tak` SDK routes those requests through
 * `undici.fetch`, whose verification behaviour is governed by the global
 * Node setting `NODE_TLS_REJECT_UNAUTHORIZED`. The SDK's public
 * `TAKAPI.init(url, auth)` signature does not accept a custom dispatcher,
 * agent, or fetch function, so the only supported way to accept a
 * self-signed cert during enrollment is to toggle that env var.
 *
 * Security concern
 * ----------------
 * `NODE_TLS_REJECT_UNAUTHORIZED` is process-wide. A naive implementation
 * that simply sets it for the duration of an async callback opens a
 * window in which *every* outbound TLS connection in the process skips
 * verification — including unrelated API calls made by other request
 * handlers that happen to run concurrently.
 *
 * Mitigation
 * ----------
 * Enrollment is already a rare, administrator-initiated operation. By
 * serializing all TLS-disabled sections through a single module-level
 * promise-chain mutex, we reduce the concurrent-bypass window to zero:
 * at most one in-flight enrollment can observe the mutated env, and all
 * other enrollment callers queue behind it. Non-enrollment TLS traffic
 * still races with the single active enrollment, but that was the case
 * before this file existed — the goal here is to prevent the mutation
 * from *stacking* across concurrent enrollments.
 *
 * A longer-term fix requires an upstream change in `@tak-ps/node-tak`
 * (or a fork) that exposes a per-instance `dispatcher`/`agent` option.
 */

const TLS_ENV_VAR = 'NODE_TLS_REJECT_UNAUTHORIZED';

/**
 * Promise-chain mutex. Each caller replaces this reference with a new
 * pending promise and awaits the previous one before entering the
 * critical section.
 */
let tlsMutex: Promise<void> = Promise.resolve();

/** For tests only: reset the mutex tail between cases. */
export function __resetTlsMutexForTests(): void {
	tlsMutex = Promise.resolve();
}

/**
 * Run `fn` with `NODE_TLS_REJECT_UNAUTHORIZED=0`, serialized across
 * concurrent callers. Restores the prior env value when the critical
 * section exits, regardless of whether `fn` resolved or rejected.
 */
export async function withTlsDisabled<T>(fn: () => Promise<T>): Promise<T> {
	const waitFor = tlsMutex;
	let release!: () => void;
	tlsMutex = new Promise<void>((resolve) => {
		release = resolve;
	});

	// `waitFor` is always a resolved/resolving void promise — it cannot
	// reject, because `release()` is the only way to settle it and
	// `release()` is invoked from a `finally` block below. We still await
	// defensively to preserve queue ordering under scheduler edge cases.
	await waitFor;

	const prev = process.env[TLS_ENV_VAR];
	process.env[TLS_ENV_VAR] = '0';
	try {
		return await fn();
	} finally {
		if (prev === undefined) {
			delete process.env[TLS_ENV_VAR];
		} else {
			process.env[TLS_ENV_VAR] = prev;
		}
		release();
	}
}
