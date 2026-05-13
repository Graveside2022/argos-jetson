<script lang="ts">
	import ContentSwitcher from '$lib/components/chassis/forms/ContentSwitcher.svelte';
	import { SESSION_VIEW_MODES, type SessionViewMode } from '$lib/types/agents';

	interface Props {
		value: SessionViewMode;
		onChange: (next: SessionViewMode) => void;
	}

	const { value, onChange }: Props = $props();

	const options = SESSION_VIEW_MODES.map((id) => ({ text: id.toUpperCase() }));
	const selectedIndex = $derived(SESSION_VIEW_MODES.indexOf(value));
</script>

<ContentSwitcher
	{options}
	{selectedIndex}
	onChange={(idx) => onChange(SESSION_VIEW_MODES[idx] ?? 'grid')}
/>
