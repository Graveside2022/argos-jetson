import type { KismetDevice } from '$lib/kismet/types';
import { gpsStore } from '$lib/stores/tactical-map/gps-store.svelte';
import { kismetStore } from '$lib/stores/tactical-map/kismet-store.svelte';

/**
 * Agent Context Store - AG-UI Shared State Bridge
 *
 * This store implements the AG-UI shared state pattern, providing bidirectional
 * context synchronization between the Argos UI and the agent (Claude AI).
 *
 * Architecture:
 * - Captures UI interactions (device clicks, map state, etc.)
 * - Aggregates tactical context (GPS location, active signals, Kismet status)
 * - Provides structured context for agent prompts
 * - Enables workflow-aware agent behavior
 */

// ============================================================================
// Selected Entity Stores
// ============================================================================

/**
 * MAC address of the currently selected device (when operator clicks a device on map)
 */
let selectedDeviceMACValue = $state<string | null>(null);

/**
 * Type of interaction that triggered the last context update
 */
interface InteractionEvent {
	type: 'device_selected' | 'tower_selected' | 'area_selected' | 'manual_query';
	data: Record<string, unknown>;
	timestamp: number;
}

/**
 * Last interaction event - used to trigger auto-queries in the chat panel
 */
let lastInteractionEventValue = $state<InteractionEvent | null>(null);
export const lastInteractionEvent = {
	get current(): InteractionEvent | null {
		return lastInteractionEventValue;
	},
	set(value: InteractionEvent | null): void {
		lastInteractionEventValue = value;
	}
};

// ============================================================================
// Workflow Context
// ============================================================================

/**
 * Current workflow the operator is engaged in (enables workflow-aware agent responses)
 */
export type WorkflowType =
	| 'reconnaissance'
	| 'device_investigation'
	| 'threat_analysis'
	| 'network_mapping'
	| 'rogue_ap_detection'
	| 'imsi_catcher_detection'
	| null;

let currentWorkflowValue = $state<WorkflowType>(null);
// agentContext (consumed by src/lib/server/agent/tools.ts + runtime.ts via agentContext)
// fallow-ignore-next-line unused-export
export const currentWorkflow = {
	get current(): WorkflowType {
		return currentWorkflowValue;
	},
	set(value: WorkflowType): void {
		currentWorkflowValue = value;
	}
};

let workflowStepValue = $state<number>(0);
// fallow-ignore-next-line unused-export
export const workflowStep = {
	get current(): number {
		return workflowStepValue;
	},
	set(value: number): void {
		workflowStepValue = value;
	}
};

let workflowGoalValue = $state<string>('');
// fallow-ignore-next-line unused-export
export const workflowGoal = {
	get current(): string {
		return workflowGoalValue;
	},
	set(value: string): void {
		workflowGoalValue = value;
	}
};

// ============================================================================
// Derived Context - Full Device Details
// ============================================================================

function firstTruthy(...vals: (string | undefined | null)[]): string | undefined {
	for (const v of vals) if (v) return v;
	return undefined;
}

// fallow-ignore-next-line complexity
function buildIdentity(device: KismetDevice, mac: string) {
	return {
		mac: device.mac || mac,
		ssid: device.ssid || 'Unknown',
		type: device.type || 'unknown',
		manufacturer: firstTruthy(device.manufacturer, device.manuf) ?? 'Unknown'
	};
}

function buildSignal(device: KismetDevice) {
	const signal = device.signal?.last_signal ?? null;
	return { signal, signalDbm: signal };
}

// fallow-ignore-next-line complexity
function buildRadio(device: KismetDevice) {
	return {
		channel: device.channel ?? null,
		frequency: device.frequency ?? null,
		encryption: device.encryption?.[0] ?? null
	};
}

// fallow-ignore-next-line complexity
function buildActivity(device: KismetDevice) {
	return {
		packets: device.packets ?? 0,
		lastSeen: device.lastSeen ?? device.last_seen ?? null,
		firstSeen: device.firstSeen ?? null
	};
}

/** Build the full device details context for the agent. */
function buildDeviceDetails(device: KismetDevice, mac: string) {
	return {
		...buildIdentity(device, mac),
		...buildSignal(device),
		...buildRadio(device),
		...buildActivity(device)
	};
}

// agentContext depends on this; consumed by src/lib/server/agent/tools.ts + runtime.ts
// fallow-ignore-next-line unused-export
export const selectedDeviceDetails = {
	get current() {
		const mac = selectedDeviceMACValue;
		if (!mac) return null;
		const device = kismetStore.current.devices.get(mac);
		return device ? buildDeviceDetails(device, mac) : null;
	}
};

// ============================================================================
// Aggregated Agent Context (AG-UI Shared State)
// ============================================================================

/**
 * Complete agent context - this is the AG-UI "shared state" that gets passed
 * to the agent with every message. It provides full situational awareness.
 */
export const agentContext = {
	get current() {
		const gps = gpsStore.current;
		const kismet = kismetStore.current;
		return {
			// Selected entity context
			selectedDevice: selectedDeviceMACValue,
			selectedDeviceDetails: selectedDeviceDetails.current,

			// Operator location context
			userLocation:
				gps.position.lat !== 0 || gps.position.lon !== 0
					? {
							lat: gps.position.lat,
							lon: gps.position.lon,
							accuracy: gps.status.accuracy,
							heading: gps.status.heading,
							speed: gps.status.speed
						}
					: null,

			// Tactical environment context
			activeSignals: kismet.deviceCount,
			kismetStatus: {
				connected: kismet.status === 'running',
				status: kismet.status,
				message: kismet.message
			},

			// Workflow context (enables workflow-aware agent behavior)
			currentWorkflow: currentWorkflowValue,
			workflowStep: workflowStepValue,
			workflowGoal: workflowGoalValue,

			// Timestamp
			timestamp: Date.now()
		};
	}
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Set a device as selected (triggered by map clicks)
 */
export function selectDevice(mac: string, deviceData?: Record<string, unknown>) {
	selectedDeviceMACValue = mac;
	lastInteractionEvent.set({
		type: 'device_selected',
		data: deviceData || { mac },
		timestamp: Date.now()
	});
}

/**
 * Set the current workflow context
 */
// src/lib/server/agent/frontend-tool-definitions.ts:112
// fallow-ignore-next-line unused-export
export function setWorkflow(workflow: WorkflowType, goal?: string) {
	currentWorkflow.set(workflow);
	workflowStep.set(0);
	if (goal) {
		workflowGoal.set(goal);
	}
}

/**
 * Advance to the next workflow step
 */
// src/lib/server/agent/frontend-tool-definitions.ts:137
// fallow-ignore-next-line unused-export
export function nextWorkflowStep() {
	workflowStep.set(workflowStep.current + 1);
}

/**
 * Reset workflow context
 */
// src/lib/server/agent/frontend-tool-definitions.ts:143
// fallow-ignore-next-line unused-export
export function clearWorkflow() {
	currentWorkflow.set(null);
	workflowStep.set(0);
	workflowGoal.set('');
}
