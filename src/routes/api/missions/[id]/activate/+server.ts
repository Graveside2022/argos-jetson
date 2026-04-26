/**
 * POST /api/missions/:id/activate
 *
 * Promotes the specified mission to active (unsets any prior active mission).
 */

import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { getMission, setActiveMission } from '$lib/server/services/reports/mission-store';

export const POST = createHandler(({ params }) => {
	const id = params.id;
	if (!id) {
		return json({ success: false, error: 'Missing mission id' }, { status: 400 });
	}

	const db = getRFDatabase().rawDb;
	const existing = getMission(db, id);
	if (!existing) {
		return json({ success: false, error: 'Mission not found' }, { status: 404 });
	}

	setActiveMission(db, id);
	const mission = getMission(db, id);
	// Race-window guard: a concurrent DELETE between activate + read would
	// leave the row missing. Surface a 500 rather than an inconsistent
	// success payload so the client doesn't silently no-op.
	if (!mission) {
		return json(
			{ success: false, error: 'Mission disappeared between activate + read' },
			{ status: 500 }
		);
	}
	return { success: true, mission, active_mission_id: id };
});
