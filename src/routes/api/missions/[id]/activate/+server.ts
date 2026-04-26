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
	// Return the full mission row (with active=true) so clients can update
	// their local mirror without an extra round-trip. Falls back to the
	// id-only payload if the row vanished between activate + read.
	if (!mission) return { success: true, active_mission_id: id };
	return { success: true, mission, active_mission_id: id };
});
