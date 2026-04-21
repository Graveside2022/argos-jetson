/**
 * Single home for filesystem path resolution that depends on `process.cwd()`.
 *
 * The Argos systemd unit sets `WorkingDirectory=/home/jetson2/code/Argos`, so
 * `process.cwd()` is a stable anchor. Centralizing the resolver here keeps
 * the cwd assumption out of route/driver files and makes the invariant
 * reviewable in one place.
 */

import * as path from 'node:path';

/** Resolve a path relative to the Argos project root (i.e. systemd `WorkingDirectory`). */
export function resolveComposeFile(rel: string): string {
	return path.resolve(process.cwd(), rel);
}
