/**
 * Factory that produces a SvelteKit POST handler for a HackRF tool driver.
 *
 * Builds a Zod schema dynamically from `driver.supportedActions` so drivers
 * with different action sets (e.g. gsm-evil has no `restart`) get the
 * correct validation without a separate schema file per route.
 *
 * Request body shape: `{ action: '<one of supportedActions>' }` plus any
 * additional fields the driver's methods may pull off the event.
 */

import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';

import { runLifecycleAction } from './lifecycle';
import type { ControlAction, ToolDriver } from './types';

/**
 * Build a POST handler for the given driver. The returned value is
 * compatible with SvelteKit's `RequestHandler` type.
 */
export function createHackRfToolHandler(driver: ToolDriver) {
	const schema = buildActionSchema(driver);
	return createHandler(
		async ({ request }) => {
			const body = (await request.json()) as { action: ControlAction };
			return runLifecycleAction(driver, body.action, body);
		},
		{ validateBody: schema, method: `hackrf-tool:${driver.toolName}` }
	);
}

/**
 * Build a Zod schema that accepts only the driver's supported actions, merged
 * with any driver-supplied `extendSchema` (e.g. gsm-evil's `frequency` regex).
 * Unknown fields passthrough so the driver method can pluck them off the body.
 *
 * Exported so test suites can validate the *exact* schema the handler uses,
 * rather than a drifting copy.
 */
export function buildActionSchema(driver: ToolDriver): z.ZodType {
	const [first, ...rest] = driver.supportedActions;
	const enumSchema = z.enum([first, ...rest] as [ControlAction, ...ControlAction[]]);
	const base = z.object({ action: enumSchema });
	const merged = driver.extendSchema ? base.merge(driver.extendSchema) : base;
	return merged.passthrough();
}
