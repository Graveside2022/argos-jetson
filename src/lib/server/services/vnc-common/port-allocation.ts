/**
 * Canonical port + display allocation for every noVNC tool stack.
 *
 * Each row reserves one X display number, one VNC (RFB) TCP port,
 * and one websockify TCP port. Adding a new VNC tool MUST claim a
 * new row here — collisions break `Xtigervnc` spawn at runtime and
 * the unit tests in `port-allocation.test.ts` guard against re-use.
 *
 * Historical context: each service used to declare its own constants
 * in `<service>-vnc-types.ts`, and the JSDoc tables in those files
 * drifted out of sync (gnu-radio-vnc claimed `:95/5995/6084` while
 * gnss-sdr-vnc and sparrow both claimed `:95/5995/*` in their own
 * docs). This single source of truth is the fix.
 *
 * @module
 */

export type VncToolId = 'sparrow' | 'wireshark-vnc' | 'sdrpp' | 'gnss-sdr-vnc' | 'gnu-radio-vnc';

export type VncAllocation = {
	/** X display number (`:NN`). Must be unique across all VNC tools. */
	display: string;
	/** TCP port where Xtigervnc serves the RFB protocol on localhost. Must be unique. */
	vncPort: number;
	/** TCP port where websockify exposes the VNC session as a WebSocket. Must be unique. */
	wsPort: number;
};

/**
 * The allocation table. Adding a new VNC tool:
 *   1. Add the tool name to `VncToolId`.
 *   2. Add the row here with a unique `display`, `vncPort`, `wsPort`.
 *   3. Re-export the row's fields from `<tool>-vnc-types.ts` via
 *      `getVncAllocation('<tool>')` instead of hard-coding numbers.
 *   4. Run `pnpm test src/lib/server/services/vnc-common` to confirm
 *      no collisions.
 *
 * Display `:99` is the last X server slot Xtigervnc tolerates without
 * conflicting with the host's default `:0` and the SSH-X11-forwarding
 * range. If a sixth VNC tool is needed, reuse a freed slot or audit
 * the host's X11 setup first.
 */
// Each row deep-frozen so callers cannot accidentally mutate inner fields
// (`Object.freeze` is shallow — outer freeze blocks key reassignment but not
// `VNC_TOOL_ALLOCATION.sparrow.wsPort = 0`). Tests assert isFrozen on each row.
export const VNC_TOOL_ALLOCATION: Readonly<Record<VncToolId, VncAllocation>> = Object.freeze({
	sparrow: Object.freeze({ display: ':95', vncPort: 5995, wsPort: 6080 }),
	'wireshark-vnc': Object.freeze({ display: ':96', vncPort: 5996, wsPort: 6081 }),
	sdrpp: Object.freeze({ display: ':97', vncPort: 5997, wsPort: 6082 }),
	'gnss-sdr-vnc': Object.freeze({ display: ':98', vncPort: 5998, wsPort: 6083 }),
	'gnu-radio-vnc': Object.freeze({ display: ':99', vncPort: 5999, wsPort: 6084 })
});

/** Returns the allocation for `tool`. Throws on unknown ids — they would be type errors anyway. */
export function getVncAllocation(tool: VncToolId): VncAllocation {
	return VNC_TOOL_ALLOCATION[tool];
}

/** Convenience iterator for tests + status endpoints. */
export function getAllVncAllocations(): ReadonlyArray<readonly [VncToolId, VncAllocation]> {
	return Object.entries(VNC_TOOL_ALLOCATION) as ReadonlyArray<
		readonly [VncToolId, VncAllocation]
	>;
}
