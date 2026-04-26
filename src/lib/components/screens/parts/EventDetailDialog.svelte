<script lang="ts">
	// spec-024 PR5c T033 — KV detail modal for an EventStream row.
	//
	// Reuses the bits-ui AlertDialog primitive (precedent:
	// gsm-evil/ErrorDialog.svelte) so we keep one dialog implementation
	// for the whole app, and the Mk II KV.svelte primitive so the body
	// renders in the same data-row style as the rest of the chassis.

	import KV from '$lib/components/mk2/KV.svelte';
	import AlertDialogRoot from '$lib/components/ui/alert-dialog/alert-dialog.svelte';
	import AlertDialogAction from '$lib/components/ui/alert-dialog/alert-dialog-action.svelte';
	import AlertDialogContent from '$lib/components/ui/alert-dialog/alert-dialog-content.svelte';
	import AlertDialogDescription from '$lib/components/ui/alert-dialog/alert-dialog-description.svelte';
	import AlertDialogFooter from '$lib/components/ui/alert-dialog/alert-dialog-footer.svelte';
	import AlertDialogHeader from '$lib/components/ui/alert-dialog/alert-dialog-header.svelte';
	import AlertDialogTitle from '$lib/components/ui/alert-dialog/alert-dialog-title.svelte';
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

<AlertDialogRoot bind:open>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>EVENT DETAIL</AlertDialogTitle>
			<AlertDialogDescription>
				{event ? `${event.source} · ${event.level}` : ''}
			</AlertDialogDescription>
		</AlertDialogHeader>
		{#if event}
			<KV rows={rowsFor(event)} />
		{/if}
		<AlertDialogFooter>
			<AlertDialogAction>CLOSE</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialogRoot>
