/**
 * Idempotent registration of the three built-in signal sources.
 *
 * Blue Dragon + GSM Evil are read-only adapters (they report runtime state
 * without owning the lifecycle). Kismet is lazy — it constructs the
 * persistence-polling adapter on first access and registers itself at that
 * point.
 *
 * Call `registerSignalSources()` once on server start (hooks.server.ts) so
 * `/api/sessions` and the dashboard can enumerate all known sources.
 */

import { bluedragonSignalSource } from './bluedragon-signal-source';
import { gsmEvilSignalSource } from './gsm-evil-signal-source';
import { getSignalSource, registerSignalSource } from './signal-sources';

function registerIfMissing(adapter: { name: string } & typeof bluedragonSignalSource): void {
	if (getSignalSource(adapter.name)) return;
	registerSignalSource(adapter);
}

export function registerSignalSources(): void {
	registerIfMissing(bluedragonSignalSource);
	registerIfMissing(gsmEvilSignalSource);
	// Kismet is lazily registered inside kismet-source-singleton when first used.
}
