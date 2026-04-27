import type { IconProps } from '@lucide/svelte';
import type { Component } from 'svelte';

import type { DrawerTab } from '$lib/types/drawer';

// spec-024 PR8 T046/T047 — Tools Flyout type defs.
//
// A pillar groups tools by operational mode: OFFNET (RF / wireless),
// ONNET (network / packet-level), OSINT (open-source / situational).
// Pillars are display-only and don't drive any logic; they map 1:1
// to the 3 columns rendered by `ToolsFlyout.svelte`.

export type Mk2ToolPillar = 'OFFNET' | 'ONNET' | 'OSINT';

// `route`    — navigates to a wired Mk II URL via SvelteKit goto().
// `drawer`   — pops the bottom drawer at a specific tab.
// `external` — opens a separate web app/VNC tenant in a new tab.
// `unwired`  — listed for catalog completeness, but no v1 action.
export type Mk2ToolAction =
	| { kind: 'route'; href: string }
	| { kind: 'drawer'; tab: DrawerTab }
	| { kind: 'external'; url: string }
	| { kind: 'unwired' };

export interface Mk2Tool {
	id: string;
	name: string;
	description: string;
	icon: Component<IconProps>;
	pillar: Mk2ToolPillar;
	action: Mk2ToolAction;
}
