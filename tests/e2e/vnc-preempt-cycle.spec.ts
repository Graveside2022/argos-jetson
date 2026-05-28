/**
 * vnc-preempt-cycle.spec.ts — B205 cooperative preempt E2E
 *
 * Tests ADR 0004 contract: when program A holds B205 and program B
 * requests it, A's preempt handler fires (resource-manager
 * `acquireWithPreempt` + `registerPreemptHandler`), A releases, B
 * acquires within ~5s.
 *
 * Three programs share B205 via cooperative preempt:
 *  1. dragonsync (FPV detector) — B205 owner `FPV_OWNER`, see
 *     src/lib/server/services/dragonsync/process-manager.ts
 *     (prompt called this "bluedragon"; actual B205 claimant is
 *     dragonsync's FPV service).
 *  2. gnss-sdr-vnc — noVNC iframe, ports :98/5998/6083.
 *  3. gnu-radio-vnc — noVNC iframe, ports :99/5999/6084.
 *
 * API-only flow — does NOT navigate to /dashboard. Uses request
 * fixture against the JSON endpoints directly.
 *
 * Endpoints (verified via grep on src/routes/api/):
 *  - POST /api/dragonsync/control  body {action:'start'|'stop'}
 *  - GET  /api/dragonsync/status   → {status:'running'|'starting'|'stopped'}
 *  - POST /api/gnss-sdr/control    body {action:'start'|'stop'|'status'}
 *  - GET  via POST {action:'status'} → {status:'active'|'inactive'}
 *  - POST /api/gnuradio/control    body {action:'start'|'stop'|'status'}
 *  - GET  via POST {action:'status'} → {status:'active'|'inactive'}
 *
 * Skips with test.skip() when the relevant POST returns 404 (route
 * not wired in this build).
 *
 * Per feedback_playwright_argos_jetson.md: NO networkidle waits, no
 * iframe canvas inspection (P2-live's job).
 */

import { type APIRequestContext, expect, test } from '@playwright/test';

// ---- Program adapters ---------------------------------------------------

type ActiveState = 'active' | 'inactive';

interface ProgramAdapter {
	name: string;
	controlPath: string;
	start: (request: APIRequestContext) => Promise<{ status: number }>;
	stop: (request: APIRequestContext) => Promise<{ status: number }>;
	getActive: (request: APIRequestContext) => Promise<ActiveState>;
}

const dragonsync: ProgramAdapter = {
	name: 'dragonsync (FPV / B205)',
	controlPath: '/api/dragonsync/control',
	start: (request) =>
		request
			.post('/api/dragonsync/control', { data: { action: 'start' } })
			.then((r) => ({ status: r.status() })),
	stop: (request) =>
		request
			.post('/api/dragonsync/control', { data: { action: 'stop' } })
			.then((r) => ({ status: r.status() })),
	getActive: async (request) => {
		const res = await request.get('/api/dragonsync/status');
		if (!res.ok()) return 'inactive';
		const body = (await res.json()) as { status?: string };
		// 'running' = all FPV+dragonsync+droneidGo up; 'starting' = mid-handoff.
		// Treat 'running' as active, anything else as inactive.
		return body.status === 'running' ? 'active' : 'inactive';
	}
};

const gnssSdr: ProgramAdapter = {
	name: 'gnss-sdr-vnc',
	controlPath: '/api/gnss-sdr/control',
	start: (request) =>
		request
			.post('/api/gnss-sdr/control', { data: { action: 'start' } })
			.then((r) => ({ status: r.status() })),
	stop: (request) =>
		request
			.post('/api/gnss-sdr/control', { data: { action: 'stop' } })
			.then((r) => ({ status: r.status() })),
	getActive: async (request) => {
		const res = await request.post('/api/gnss-sdr/control', {
			data: { action: 'status' }
		});
		if (!res.ok()) return 'inactive';
		const body = (await res.json()) as { status?: string };
		return body.status === 'active' ? 'active' : 'inactive';
	}
};

const gnuRadio: ProgramAdapter = {
	name: 'gnu-radio-vnc',
	controlPath: '/api/gnuradio/control',
	start: (request) =>
		request
			.post('/api/gnuradio/control', { data: { action: 'start' } })
			.then((r) => ({ status: r.status() })),
	stop: (request) =>
		request
			.post('/api/gnuradio/control', { data: { action: 'stop' } })
			.then((r) => ({ status: r.status() })),
	getActive: async (request) => {
		const res = await request.post('/api/gnuradio/control', {
			data: { action: 'status' }
		});
		if (!res.ok()) return 'inactive';
		const body = (await res.json()) as { status?: string };
		return body.status === 'active' ? 'active' : 'inactive';
	}
};

// ---- Helpers ------------------------------------------------------------

/** True if the control endpoint exists (any non-404 to OPTIONS-like probe). */
async function endpointExists(request: APIRequestContext, controlPath: string): Promise<boolean> {
	// A POST with empty body returns 400 (bad body) when wired, 404 when not.
	const res = await request.post(controlPath, { data: {} });
	return res.status() !== 404;
}

/** Poll getActive() until target reached or timeout. Web-first wait —
 *  no networkidle, polls JSON endpoint directly. */
async function waitForActive(
	request: APIRequestContext,
	program: ProgramAdapter,
	target: ActiveState,
	timeoutMs: number
): Promise<ActiveState> {
	const deadline = Date.now() + timeoutMs;
	let last: ActiveState = 'inactive';
	while (Date.now() < deadline) {
		last = await program.getActive(request);
		if (last === target) return last;
		await new Promise((r) => setTimeout(r, 500));
	}
	return last;
}

/** Best-effort cleanup — never throws. */
async function safeStop(request: APIRequestContext, program: ProgramAdapter): Promise<void> {
	try {
		await program.stop(request);
	} catch {
		/* swallow */
	}
}

// ---- Swap test factory --------------------------------------------------

/**
 * Run a preempt swap: start A, assert active; start B (preempts A);
 * assert A inactive + B active; stop B; cleanup A defensively.
 *
 * Per ADR 0004, preempt handoff must complete within ~5s; we allow
 * 10s for start ack + 10s for status convergence to absorb Jetson
 * event-loop lag.
 */
function defineSwapTest(label: string, a: ProgramAdapter, b: ProgramAdapter): void {
	test(label, async ({ request }) => {
		// Skip if either endpoint isn't wired in this build.
		const [aExists, bExists] = await Promise.all([
			endpointExists(request, a.controlPath),
			endpointExists(request, b.controlPath)
		]);
		if (!aExists || !bExists) {
			test.skip(
				true,
				`Endpoint missing: ${a.controlPath}=${aExists}, ${b.controlPath}=${bExists}`
			);
			return;
		}

		try {
			// 1. POST start A → 200 + active within 10s.
			const startA = await a.start(request);
			expect(startA.status, `start ${a.name}`).toBe(200);
			const aActive = await waitForActive(request, a, 'active', 10_000);
			expect(aActive, `${a.name} active within 10s`).toBe('active');

			// 2. POST start B → 200 within 10s (preempt path).
			const startB = await b.start(request);
			expect(startB.status, `start ${b.name} (preempt)`).toBe(200);

			// 3. GET status A → inactive (preempted) — allow ~10s convergence.
			const aFinal = await waitForActive(request, a, 'inactive', 10_000);
			expect(aFinal, `${a.name} inactive after preempt`).toBe('inactive');

			// 4. GET status B → active.
			const bActive = await waitForActive(request, b, 'active', 10_000);
			expect(bActive, `${b.name} active after preempt`).toBe('active');

			// 5. POST stop B (cleanup of held device).
			const stopB = await b.stop(request);
			expect(stopB.status, `stop ${b.name}`).toBe(200);
		} finally {
			// Defensive cleanup — both, in case mid-test failure left them up.
			await safeStop(request, b);
			await safeStop(request, a);
		}
	});
}

// ---- Test cases ---------------------------------------------------------

test.describe('B205 cooperative preempt cycle (ADR 0004)', () => {
	// Each swap stops/starts shared B205 hardware — serialize.
	test.describe.configure({ mode: 'serial' });

	// Generous per-test timeout: 4 status windows × 10s + start/stop overhead.
	test.setTimeout(90_000);

	defineSwapTest('T1: gnss-sdr-vnc ↔ gnu-radio-vnc swap', gnssSdr, gnuRadio);

	defineSwapTest('T2: dragonsync (FPV) ↔ gnss-sdr-vnc swap', dragonsync, gnssSdr);

	defineSwapTest('T3: dragonsync (FPV) ↔ gnu-radio-vnc swap', dragonsync, gnuRadio);
});
