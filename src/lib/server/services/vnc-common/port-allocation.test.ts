import { describe, expect, it } from 'vitest';

import {
	getAllVncAllocations,
	getVncAllocation,
	VNC_TOOL_ALLOCATION,
	type VncToolId
} from './port-allocation';

describe('VNC port allocation registry', () => {
	it('exposes the five known VNC tools', () => {
		const ids = Object.keys(VNC_TOOL_ALLOCATION).sort();
		expect(ids).toEqual(
			(
				[
					'gnss-sdr-vnc',
					'gnu-radio-vnc',
					'sdrpp',
					'sparrow',
					'wireshark-vnc'
				] as VncToolId[]
			).sort()
		);
	});

	it('assigns a unique X display to every tool', () => {
		const displays = Object.values(VNC_TOOL_ALLOCATION).map((a) => a.display);
		expect(new Set(displays).size).toBe(displays.length);
	});

	it('assigns a unique VNC (RFB) port to every tool', () => {
		const ports = Object.values(VNC_TOOL_ALLOCATION).map((a) => a.vncPort);
		expect(new Set(ports).size).toBe(ports.length);
	});

	it('assigns a unique websockify port to every tool', () => {
		const ports = Object.values(VNC_TOOL_ALLOCATION).map((a) => a.wsPort);
		expect(new Set(ports).size).toBe(ports.length);
	});

	it('keeps VNC + websockify ports in their conventional ranges', () => {
		for (const alloc of Object.values(VNC_TOOL_ALLOCATION)) {
			expect(alloc.vncPort).toBeGreaterThanOrEqual(5900);
			expect(alloc.vncPort).toBeLessThan(6000);
			expect(alloc.wsPort).toBeGreaterThanOrEqual(6080);
			expect(alloc.wsPort).toBeLessThan(6100);
			expect(alloc.display).toMatch(/^:[0-9]{1,2}$/);
		}
	});

	it('getVncAllocation returns the correct row for each tool', () => {
		expect(getVncAllocation('gnss-sdr-vnc')).toEqual({
			display: ':98',
			vncPort: 5998,
			wsPort: 6083
		});
		expect(getVncAllocation('gnu-radio-vnc')).toEqual({
			display: ':99',
			vncPort: 5999,
			wsPort: 6084
		});
	});

	it('getAllVncAllocations returns the full table', () => {
		expect(getAllVncAllocations()).toHaveLength(5);
	});

	it('table is frozen at runtime (top-level key reassignment guarded)', () => {
		const before = VNC_TOOL_ALLOCATION['sparrow'].vncPort;
		try {
			// @ts-expect-error — intentional violation to verify freeze guard
			VNC_TOOL_ALLOCATION['sparrow'] = { display: ':00', vncPort: 0, wsPort: 0 };
		} catch {
			/* expected in strict mode */
		}
		expect(VNC_TOOL_ALLOCATION['sparrow'].vncPort).toBe(before);
	});

	it('each row is deep-frozen (inner field mutation guarded)', () => {
		// Object.freeze is shallow by default — outer freeze blocks key
		// reassignment but does not block `row.vncPort = 0`. Each row is
		// explicitly Object.freeze'd so callers cannot accidentally edit
		// a single allocation's fields at runtime.
		for (const tool of Object.keys(VNC_TOOL_ALLOCATION) as VncToolId[]) {
			expect(Object.isFrozen(VNC_TOOL_ALLOCATION[tool])).toBe(true);
		}
	});

	it('inner field mutation attempt is no-op (proves deep-freeze)', () => {
		const before = VNC_TOOL_ALLOCATION['sparrow'].wsPort;
		// Cast through `unknown` to bypass the Readonly<VncAllocation> type
		// (TS would otherwise reject the mutation at compile-time — we want
		// to verify Object.freeze blocks it at *runtime* in strict mode).
		try {
			(VNC_TOOL_ALLOCATION['sparrow'] as unknown as { wsPort: number }).wsPort = 0;
		} catch {
			/* expected in strict mode */
		}
		expect(VNC_TOOL_ALLOCATION['sparrow'].wsPort).toBe(before);
	});
});
