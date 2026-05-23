import { describe, expect, it } from 'vitest';

import {
	agentContext,
	clearWorkflow,
	currentWorkflow,
	lastInteractionEvent,
	selectDevice,
	setWorkflow
} from './agent-context-store.svelte';

describe('agent-context-store (Phase 3 / ADR-0003 runes migration)', () => {
	it('selectDevice records the MAC and a device_selected interaction', () => {
		selectDevice('AA:BB:CC:DD:EE:FF');
		expect(agentContext.current.selectedDevice).toBe('AA:BB:CC:DD:EE:FF');
		expect(lastInteractionEvent.current?.type).toBe('device_selected');
	});

	it('agentContext aggregates workflow + kismet status reactively', () => {
		setWorkflow('reconnaissance', 'sweep the AO');
		const ctx = agentContext.current;
		expect(ctx.currentWorkflow).toBe('reconnaissance');
		expect(ctx.workflowGoal).toBe('sweep the AO');
		expect(ctx.kismetStatus).toHaveProperty('status');
		expect(ctx).toHaveProperty('timestamp');
	});

	it('clearWorkflow resets workflow context', () => {
		setWorkflow('threat_analysis');
		clearWorkflow();
		expect(currentWorkflow.current).toBeNull();
		expect(agentContext.current.workflowStep).toBe(0);
	});
});
