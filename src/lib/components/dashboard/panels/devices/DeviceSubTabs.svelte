<script lang="ts">
	import Tabs, { type TabDef } from '$lib/components/chassis/forms/Tabs.svelte';

	interface InputTab {
		id: string;
		label: string;
	}

	interface Props {
		activeTab: string;
		counts: Record<string, number>;
		tabs: InputTab[];
		onTabChange: (tab: string) => void;
	}

	let { activeTab, counts, tabs, onTabChange }: Props = $props();

	const chassisTabs = $derived<TabDef[]>(
		tabs.map((t) => ({
			id: t.id,
			label: t.label,
			badge: t.id === 'whitelist' ? undefined : (counts[t.id] ?? 0),
			hasItems: t.id !== 'all' && t.id !== 'whitelist' && (counts[t.id] ?? 0) > 0
		}))
	);
</script>

<Tabs tabs={chassisTabs} selectedId={activeTab} onChange={onTabChange} />
