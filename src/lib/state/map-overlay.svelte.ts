// spec-024 PR6 T038 — Mk II MAP-screen layer-chip toggles.
//
// One lsState'd boolean per chip. Heatmap / Centroids / Path are RF
// layers from spec-023 (consumed by the MapScreen via MapLibre layer
// gates). Detections is the PR5c bearing-ray overlay. OwnPosition is
// the operator GPS marker + heading cone. Defaults match the prototype:
// every overlay on. Persists across reload via lsState. PR2 T014 helper.

import { lsState } from '$lib/state/ui.svelte';

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

export const overlayHeatmap = lsState<boolean>('argos.mk2.map.overlay.heatmap', true, isBool);
export const overlayCentroids = lsState<boolean>('argos.mk2.map.overlay.centroids', true, isBool);
export const overlayPath = lsState<boolean>('argos.mk2.map.overlay.path', true, isBool);
export const overlayDetections = lsState<boolean>('argos.mk2.map.overlay.detections', true, isBool);
export const overlayOwnPosition = lsState<boolean>(
	'argos.mk2.map.overlay.ownPosition',
	true,
	isBool
);
