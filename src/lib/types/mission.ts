/**
 * Client-facing Mission types — mirror of
 * `src/lib/server/services/reports/types.ts`. Kept separate so client
 * components/state never reach into `$lib/server/*` (SvelteKit boundary).
 * Drift between this file and the server source is caught by the
 * PATCH/POST round-trip tests in `mission-store.test.ts` +
 * `wave-c-schemas.test.ts`.
 */

export type MissionType = 'sitrep-loop' | 'emcon-survey';

export interface Mission {
	id: string;
	name: string;
	type: MissionType;
	unit: string | null;
	ao_mgrs: string | null;
	operator: string | null;
	target: string | null;
	link_budget: number | null;
	created_at: number;
	active: boolean;
}

export type MissionPatch = Partial<
	Pick<Mission, 'name' | 'unit' | 'ao_mgrs' | 'operator' | 'target' | 'link_budget'>
>;

export type MissionCreateInput = Pick<Mission, 'name' | 'type'> &
	Partial<Pick<Mission, 'unit' | 'ao_mgrs' | 'operator' | 'target' | 'link_budget'>> & {
		set_active?: boolean;
	};
