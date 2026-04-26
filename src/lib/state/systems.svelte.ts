// spec-024 PR4 T026 — Mk II SYSTEMS screen state.
// Single lsState container for the active sub-tab so HOST → HW → PROC → SVC →
// NET selection survives reloads. Validator collapses any unknown persisted
// value back to 'host'.

import { lsState } from './ui.svelte';

export type SystemsTab = 'host' | 'hw' | 'proc' | 'svc' | 'net';

const KNOWN: ReadonlySet<SystemsTab> = new Set(['host', 'hw', 'proc', 'svc', 'net']);

function isSystemsTab(v: unknown): v is SystemsTab {
	return typeof v === 'string' && (KNOWN as ReadonlySet<string>).has(v);
}

export const systemsTabStore = lsState<SystemsTab>(
	'argos.mk2.systems.tab',
	'host',
	isSystemsTab
);
