<script lang="ts">
	// spec-024 PR5c T033 — KV detail modal for an EventStream row.
	// spec-026 Phase 7 — migrated from bits-ui AlertDialog to chassis Modal
	// (matches Phase 4 PR-A ErrorDialog migration `1f27dba8`). Unblocks
	// deletion of `src/lib/components/ui/alert-dialog/` directory.

	import Modal from '$lib/components/chassis/forms/Modal.svelte';
	import KV from '$lib/components/mk2/KV.svelte';
	import type { AppEvent } from '$lib/types/event';

	interface Props {
		open: boolean;
		event: AppEvent | null;
	}

	let { open = $bindable(false), event }: Props = $props();

	function rowsFor(evt: AppEvent | null): readonly (readonly [string, string])[] {
		if (!evt) return [];
		const base: (readonly [string, string])[] = [
			['ID', evt.id],
			['TIME', new Date(evt.timestamp).toISOString()],
			['LEVEL', evt.level.toUpperCase()],
			['SOURCE', evt.source]
		];
		for (const [k, v] of Object.entries(evt.payload)) {
			base.push([k.toUpperCase(), formatPayloadValue(v)]);
		}
		return base;
	}

	const PRIMITIVE_TYPES = new Set(['string', 'number', 'boolean']);

	function formatPayloadValue(v: unknown): string {
		if (v == null) return '—';
		if (PRIMITIVE_TYPES.has(typeof v)) return String(v);
		try {
			return JSON.stringify(v);
		} catch {
			return '[unserializable]';
		}
	}
</script>

<Modal
	bind:open
	modalLabel="EVENT DETAIL"
	modalHeading={event ? `${event.source} · ${event.level}` : 'Event Detail'}
	primaryButtonText="CLOSE"
	onSubmit={() => (open = false)}
	onClose={() => (open = false)}
>
	{#if event}
		<KV rows={rowsFor(event)} />
	{/if}
</Modal>
