// spec-024 PR5b T030 — Mk II MissionStrip client state.
//
// Holds the active-mission selection + the full list, talks to
// /api/missions/list (GET), /api/missions/:id (GET/PATCH), and
// /api/missions/:id/activate (POST). Server-side persistence is
// authoritative; localStorage is intentionally NOT used so a cold
// reload always reflects the SQLite truth.
//
// Module-scope $state is fine: Svelte 5 schedules updates lazily and
// every reader through the exposed getter opts in automatically.

import type { Mission, MissionCreateInput, MissionPatch } from '$lib/types/mission';

interface MissionsResponse {
	success: boolean;
	missions?: Mission[];
	error?: string;
}

interface MissionResponse {
	success: boolean;
	mission?: Mission;
	error?: string;
}

async function readJson<T>(res: Response): Promise<T> {
	if (!res.ok && res.status !== 404) {
		throw new Error(`HTTP ${res.status}`);
	}
	return (await res.json()) as T;
}

function createMissionStore() {
	let missions = $state<Mission[]>([]);
	let lastError = $state<string | null>(null);
	const active = $derived<Mission | null>(missions.find((m) => m.active) ?? null);

	function setError(err: unknown): null {
		lastError = err instanceof Error ? err.message : String(err);
		return null;
	}

	function replaceMission(updated: Mission): void {
		const next = missions.map((m) => (m.id === updated.id ? updated : m));
		// active flag is single-row at the DB layer; if the patch toggled it,
		// clear active on every other row in our local mirror.
		missions = updated.active
			? next.map((m) => (m.id === updated.id ? m : { ...m, active: false }))
			: next;
	}

	function unwrapMission(json: MissionResponse): Mission {
		if (!json.success || !json.mission) throw new Error(json.error ?? 'request failed');
		return json.mission;
	}

	function unwrapMissions(json: MissionsResponse): Mission[] {
		if (!json.success || !json.missions) throw new Error(json.error ?? 'no missions');
		return json.missions;
	}

	async function load(): Promise<void> {
		try {
			const res = await fetch('/api/missions/list');
			missions = unwrapMissions(await readJson<MissionsResponse>(res));
			lastError = null;
		} catch (err) {
			setError(err);
		}
	}

	async function setActive(id: string): Promise<void> {
		try {
			const res = await fetch(`/api/missions/${encodeURIComponent(id)}/activate`, {
				method: 'POST'
			});
			replaceMission(unwrapMission(await readJson<MissionResponse>(res)));
		} catch (err) {
			setError(err);
		}
	}

	async function patch(id: string, body: MissionPatch): Promise<Mission | null> {
		if (Object.keys(body).length === 0) return null;
		try {
			const res = await fetch(`/api/missions/${encodeURIComponent(id)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const m = unwrapMission(await readJson<MissionResponse>(res));
			replaceMission(m);
			return m;
		} catch (err) {
			return setError(err);
		}
	}

	async function create(input: MissionCreateInput): Promise<Mission | null> {
		try {
			const res = await fetch('/api/missions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			const m = unwrapMission(await readJson<MissionResponse>(res));
			missions = [m, ...missions];
			if (m.active) replaceMission(m);
			return m;
		} catch (err) {
			return setError(err);
		}
	}

	return {
		get missions() {
			return missions;
		},
		get active() {
			return active;
		},
		get lastError() {
			return lastError;
		},
		load,
		setActive,
		patch,
		create
	};
}

export const missionStore = createMissionStore();
