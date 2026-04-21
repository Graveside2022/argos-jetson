/**
 * Shared types for the HackRF tool lifecycle framework.
 *
 * `RecoveryPolicy` selects which underlying claim function {@link claim.ts}
 * routes to. The three policies map to the three asymmetric claim semantics
 * already present in the codebase:
 *
 *   - `peer-webrx`  → `acquireHackRfForWebRx`  (openwebrx/novasdr/sdrpp)
 *   - `stale-only`  → `acquireHackRfResource`  (gsm-evil)
 *   - `direct`      → `resourceManager.acquire` (trunk-recorder, hackrf-sweep)
 *
 * The asymmetry is preserved intentionally — collapsing the enum would
 * change runtime behavior. See plan `i-want-you-to-zazzy-kitten.md` §
 * "Out-of-scope items".
 */

import type { z } from 'zod';

export type RecoveryPolicy = 'peer-webrx' | 'stale-only' | 'direct';

export type ControlAction = 'start' | 'stop' | 'restart' | 'status';

/**
 * Result of a unified claim attempt. Matches the shape of the underlying
 * claim functions so drivers' conflict-response builders can consume it
 * without translation.
 */
export interface ClaimResult {
	success: boolean;
	owner?: string;
	message?: string;
}

/**
 * Contract for a tool driver. Each driver owns its own Response bodies so
 * the lifecycle module can stay tool-agnostic while preserving byte-identical
 * response shapes with the pre-refactor route handlers.
 */
export interface ToolDriver {
	/** Claim key — must match an existing owner string known to ResourceManager. */
	readonly toolName: string;

	/** Which underlying claim function to route through. */
	readonly recoveryPolicy: RecoveryPolicy;

	/** Actions the driver supports. Unsupported actions return 400 via dynamic Zod. */
	readonly supportedActions: readonly ControlAction[];

	/**
	 * True for WebRX peers — lifecycle calls are serialized through the shared
	 * `withWebRxLock` Promise chain. False for non-peer tools (gsm-evil).
	 */
	readonly serializeInLock: boolean;

	/**
	 * True if the lifecycle module should acquire the HackRF claim before
	 * calling `start()`. Set false when the underlying service manages its
	 * own claim internally (gsm-evil's `startGsmEvil`).
	 *
	 * When true: lifecycle acquires before start; releases on throw.
	 * When false: driver is responsible for acquire/release.
	 */
	readonly acquireOnStart: boolean;

	/**
	 * Optional extension to the handler's request schema. Merged into the
	 * base `{ action: enum }` schema via `.merge()` so drivers can validate
	 * tool-specific fields (e.g. gsm-evil's `frequency` regex). Unset means
	 * the base schema is used as-is with `.passthrough()`.
	 */
	readonly extendSchema?: z.ZodObject<z.ZodRawShape>;

	/** Build the start success Response (claim already held when acquireOnStart=true). */
	start(body: unknown): Promise<Response>;

	/** Build the stop success Response. Driver handles claim release internally. */
	stop(body: unknown): Promise<Response>;

	/**
	 * Build the restart success Response. Claim already held if acquireOnStart=true.
	 * Optional — drivers that don't include 'restart' in supportedActions may omit.
	 */
	restart?(body: unknown): Promise<Response>;

	/**
	 * Build the status Response. No claim acquisition.
	 * Optional — drivers that don't include 'status' in supportedActions may omit.
	 */
	status?(body: unknown): Promise<Response> | Response;

	/** Build the 409 conflict response shape for this tool. */
	buildConflictResponse(claim: ClaimResult): Response;
}

/**
 * Narrower `ToolDriver` shape for drivers that support all four actions
 * (WebRX trio). Forces `restart` + `status` to be non-optional so tests and
 * callers can invoke them without TS non-null assertions.
 */
export type FullActionDriver = ToolDriver & {
	restart: NonNullable<ToolDriver['restart']>;
	status: NonNullable<ToolDriver['status']>;
};
