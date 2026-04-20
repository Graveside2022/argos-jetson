/**
 * Schema validation tests for Task #13 Wave E — tak/* + gsm-evil/* routes.
 *
 * Wave E covers five POST handlers that are now wired via `createHandler`
 * option `validateBody:`. Three already had inline Zod (now exported +
 * wired): tak/config, tak/enroll, gsm-evil/control. Two introduce NEW
 * schemas: gsm-evil/scan, gsm-evil/tower-location.
 *
 * Routes intentionally excluded from Wave E as "audit §4.2 false positives":
 *   - /api/tak/certs POST           — multipart FormData (p12 upload)
 *   - /api/tak/connection POST      — bodyless (reconnect trigger)
 *   - /api/tak/import-package POST  — multipart FormData (zip)
 *   - /api/tak/truststore POST      — multipart FormData (p12)
 *   - /api/gsm-evil/intelligent-scan POST         — bodyless
 *   - /api/gsm-evil/intelligent-scan-stream POST  — SSE (text/event-stream)
 *
 * Only schema-level parse checks — handler integration is covered by the
 * route-level e2e tests (not in scope here).
 */
import { describe, expect, it } from 'vitest';

import { _GsmEvilControlRequestSchema as GsmEvilControlRequestSchema } from '../../../src/routes/api/gsm-evil/control/+server';
import { _GsmScanRequestSchema as GsmScanRequestSchema } from '../../../src/routes/api/gsm-evil/scan/+server';
import { _GsmTowerLocationRequestSchema as GsmTowerLocationRequestSchema } from '../../../src/routes/api/gsm-evil/tower-location/+server';
import { _TakConfigSchema as TakConfigSchema } from '../../../src/routes/api/tak/config/+server';
import { _EnrollSchema as EnrollSchema } from '../../../src/routes/api/tak/enroll/+server';

describe('TakConfigSchema (tak/config POST)', () => {
	it('accepts a minimal TLS TAK server config', () => {
		const parsed = TakConfigSchema.safeParse({
			name: 'Alpha TAK Server',
			hostname: 'tak.example.mil',
			port: 8089,
			protocol: 'tls',
			shouldConnectOnStartup: true
		});
		expect(parsed.success).toBe(true);
	});
	it('rejects non-tls protocol literal', () => {
		const parsed = TakConfigSchema.safeParse({
			name: 'Bravo',
			hostname: 'tak.example.mil',
			port: 8089,
			protocol: 'tcp',
			shouldConnectOnStartup: false
		});
		expect(parsed.success).toBe(false);
	});
});

describe('EnrollSchema (tak/enroll POST)', () => {
	it('accepts a valid enrollment request with default port', () => {
		const parsed = EnrollSchema.safeParse({
			hostname: 'enroll.tak.example.mil',
			username: 'operator',
			password: 'correct-horse-battery-staple'
		});
		expect(parsed.success).toBe(true);
		// default(8446) applies when port is omitted
		if (parsed.success) expect(parsed.data.port).toBe(8446);
	});
	it('rejects empty username', () => {
		const parsed = EnrollSchema.safeParse({
			hostname: 'enroll.tak.example.mil',
			port: 8446,
			username: '',
			password: 'pw'
		});
		expect(parsed.success).toBe(false);
	});
});

describe('GsmEvilControlRequestSchema (gsm-evil/control POST)', () => {
	it('accepts start action with a numeric-string frequency', () => {
		const parsed = GsmEvilControlRequestSchema.safeParse({
			action: 'start',
			frequency: '947.2'
		});
		expect(parsed.success).toBe(true);
	});
	it('rejects unknown action', () => {
		const parsed = GsmEvilControlRequestSchema.safeParse({
			action: 'pause'
		});
		expect(parsed.success).toBe(false);
	});
});

describe('GsmScanRequestSchema (gsm-evil/scan POST)', () => {
	it('accepts empty body (all fields optional)', () => {
		const parsed = GsmScanRequestSchema.safeParse({});
		expect(parsed.success).toBe(true);
	});
	it('rejects non-coercible frequency string', () => {
		const parsed = GsmScanRequestSchema.safeParse({ frequency: 'not-a-number' });
		expect(parsed.success).toBe(false);
	});
});

describe('GsmTowerLocationRequestSchema (gsm-evil/tower-location POST)', () => {
	it('accepts numeric-string cell identifiers within range', () => {
		const parsed = GsmTowerLocationRequestSchema.safeParse({
			mcc: '310',
			mnc: '260',
			lac: '12345',
			ci: '67890'
		});
		expect(parsed.success).toBe(true);
	});
	it('rejects ci > uint28 max (268435455)', () => {
		const parsed = GsmTowerLocationRequestSchema.safeParse({
			mcc: 310,
			mnc: 260,
			lac: 12345,
			ci: 999999999
		});
		expect(parsed.success).toBe(false);
	});
});
