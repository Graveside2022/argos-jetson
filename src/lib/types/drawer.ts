// Bottom-drawer tab identity. Lives in types/ so non-state callers (e.g.
// types/mk2-tool.ts which composes a tool-action discriminated union over
// drawer tabs) can reference the type without pulling client-state code.

export type DrawerTab = 'terminal' | 'logs' | 'captures' | 'wifi' | 'bluetooth' | 'uas';

export const DRAWER_TABS: DrawerTab[] = [
	'terminal',
	'logs',
	'captures',
	'wifi',
	'bluetooth',
	'uas'
];

export const isDrawerTab = (v: unknown): v is DrawerTab =>
	typeof v === 'string' && (DRAWER_TABS as readonly string[]).includes(v);
