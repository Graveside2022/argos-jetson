/**
 * TAK module shared types — interfaces extracted to break cycles.
 *
 * `tak-sa-broadcaster.ts` previously imported `type { TakService }` from
 * `tak-service.ts`, while `tak-service.ts` constructs `TakSaBroadcaster`
 * — a 2-file SCC that sentrux flagged at quality_signal=5402 (Day-0
 * baseline, see `project_sentrux_baseline.md`).
 *
 * Broadcaster only consumes ONE method from TakService (`sendCot`).
 * Declaring that surface as a structural interface here lets broadcaster
 * depend on the leaf type instead of the concrete service. The cycle
 * inverts to a clean tree:
 *
 *     types.ts (leaf)
 *        ↑
 *   tak-sa-broadcaster.ts ←──── tak-service.ts
 *
 * @module
 */

import type CoT from '@tak-ps/node-cot';

/**
 * Minimal contract for any class that can dispatch a CoT message.
 * `TakService` satisfies this structurally — no `implements` clause
 * needed; the type-checker confirms shape at the broadcaster's
 * constructor call site.
 */
export interface CotSender {
	sendCot(cot: CoT): void;
}
