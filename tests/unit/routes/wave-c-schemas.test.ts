/**
 * Schema validation tests for Task #8 Wave C routes.
 *
 * Wave C covers routes that either (a) already had inline schemas now wired
 * via `createHandler` `validateBody:` (missions POST, db/cleanup POST) or
 * (b) had NO Zod before — now introduced (system/docker/[action] POST).
 *
 * Routes intentionally excluded from Wave C as "audit §4.2 false positives"
 * — bodyless handlers with no request.json() call:
 *   - /api/missions/:id DELETE (route params only)
 *   - /api/missions/:id/activate POST (route params only)
 *   - /api/reports/:id DELETE (route params only)
 *   - /api/kismet/start,stop,restart (no body)
 *   - /api/hackrf/emergency-stop,stop-sweep (no body)
 *   - /api/bluedragon/devices/reset (no body)
 *   - /api/terminal/shells (GET only)
 *
 * Only schema-level parse checks — handler integration is covered by the
 * route-level e2e tests (not in scope here).
 */
import { describe, expect, it } from 'vitest';

import { _CleanupPostSchema as CleanupPostSchema } from '../../../src/routes/api/db/cleanup/+server';
import { _MissionPatchSchema as MissionPatchSchema } from '../../../src/routes/api/missions/[id]/+server';
import { _CreateMissionSchema as CreateMissionSchema } from '../../../src/routes/api/missions/+server';
import { _DockerContainerBodySchema as DockerContainerBodySchema } from '../../../src/routes/api/system/docker/[action]/+server';

describe('CreateMissionSchema (missions POST)', () => {
	it('accepts a valid sitrep-loop mission', () => {
		const parsed = CreateMissionSchema.safeParse({
			name: 'Operation Roadrunner',
			type: 'sitrep-loop',
			unit: 'A/1-75 RGR',
			ao_mgrs: '11SMS1234567890',
			set_active: true
		});
		expect(parsed.success).toBe(true);
	});
	it('rejects an unknown mission type', () => {
		const parsed = CreateMissionSchema.safeParse({
			name: 'X',
			type: 'free-form'
		});
		expect(parsed.success).toBe(false);
	});
	it('accepts new strip metadata fields (operator/target/link_budget)', () => {
		const parsed = CreateMissionSchema.safeParse({
			name: 'Op North Star',
			type: 'emcon-survey',
			operator: 'SSG Doe',
			target: 'AO 12 — east ridge',
			link_budget: -84.5
		});
		expect(parsed.success).toBe(true);
	});
	it('rejects link_budget when not finite', () => {
		const parsed = CreateMissionSchema.safeParse({
			name: 'X',
			type: 'sitrep-loop',
			link_budget: Number.NaN
		});
		expect(parsed.success).toBe(false);
	});
});

describe('MissionPatchSchema (missions PATCH)', () => {
	it('accepts a single-field patch', () => {
		const parsed = MissionPatchSchema.safeParse({ operator: 'CPT Smith' });
		expect(parsed.success).toBe(true);
	});
	it('accepts an explicit-null clear of an editable field', () => {
		const parsed = MissionPatchSchema.safeParse({ target: null });
		expect(parsed.success).toBe(true);
	});
	it('rejects an empty patch (must include at least one field)', () => {
		const parsed = MissionPatchSchema.safeParse({});
		expect(parsed.success).toBe(false);
	});
	it('rejects unknown keys (strict)', () => {
		const parsed = MissionPatchSchema.safeParse({ active: true });
		expect(parsed.success).toBe(false);
	});
	it('rejects link_budget as string', () => {
		const parsed = MissionPatchSchema.safeParse({ link_budget: '-42' });
		expect(parsed.success).toBe(false);
	});
	it('rejects empty mission name', () => {
		const parsed = MissionPatchSchema.safeParse({ name: '' });
		expect(parsed.success).toBe(false);
	});
});

describe('CleanupPostSchema (db/cleanup POST)', () => {
	it('accepts optimize-workload with valid workload', () => {
		const parsed = CleanupPostSchema.safeParse({
			action: 'optimize-workload',
			workload: 'read_heavy'
		});
		expect(parsed.success).toBe(true);
	});
	it('rejects cleanup-aggregated with daysToKeep > 365', () => {
		const parsed = CleanupPostSchema.safeParse({
			action: 'cleanup-aggregated',
			daysToKeep: 9999
		});
		expect(parsed.success).toBe(false);
	});
});

describe('DockerContainerBodySchema (system/docker/[action] POST)', () => {
	it('accepts a known container name', () => {
		const parsed = DockerContainerBodySchema.safeParse({ container: 'openwebrx-hackrf' });
		expect(parsed.success).toBe(true);
	});
	it('rejects unknown container name', () => {
		const parsed = DockerContainerBodySchema.safeParse({ container: 'rm-rf-slash' });
		expect(parsed.success).toBe(false);
	});
});
