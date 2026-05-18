<!--
	V3 layout — wraps every /dashboard/v3 route in the NVIDIA-themed V3Shell
	and derives the breadcrumb from the current path. The V3 equivalent of
	dashboard/mk2/+layout.svelte (which mounts the Chassis).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	import { page } from '$app/state';
	import V3Shell from '$lib/components/v3/V3Shell.svelte';
	import type { V3Crumb } from '$lib/types/v3';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	/** Human labels for V3 path segments; extended as routes are added. */
	const SEGMENT_LABELS: Record<string, string> = {
		overview: 'Overview'
	};

	let breadcrumb = $derived.by((): V3Crumb[] => {
		const last = page.url.pathname.split('/').filter(Boolean).pop() ?? 'overview';
		return [
			{ label: 'Argos', href: '/dashboard/v3/overview' },
			{ label: SEGMENT_LABELS[last] ?? last }
		];
	});
</script>

<V3Shell {breadcrumb}>
	{@render children()}
</V3Shell>
