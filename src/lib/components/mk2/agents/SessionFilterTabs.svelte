<script lang="ts">
	import ContentSwitcher from '$lib/components/chassis/forms/ContentSwitcher.svelte';
	import { SESSION_FILTERS, type SessionFilter } from '$lib/types/agents';

	interface Props {
		value: SessionFilter;
		onChange: (next: SessionFilter) => void;
	}

	const { value, onChange }: Props = $props();

	const options = SESSION_FILTERS.map((id) => ({ text: id }));
	const selectedIndex = $derived(SESSION_FILTERS.indexOf(value));
</script>

<ContentSwitcher
	{options}
	{selectedIndex}
	onChange={(idx) => onChange(SESSION_FILTERS[idx] ?? 'ALL')}
/>
