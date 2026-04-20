/**
 * Re-export shim: the real trunk-recorder preset repository now lives at
 * `$lib/server/db/trunk-recorder-preset-repository` so that all better-sqlite3
 * access is contained under `src/lib/server/db/`.
 *
 * This file is preserved as a back-compat façade for existing route-layer
 * callers. New code should import directly from the db/ location.
 */

export {
	createPreset,
	deletePreset,
	getPreset,
	listPresets,
	updatePreset
} from '$lib/server/db/trunk-recorder-preset-repository';
