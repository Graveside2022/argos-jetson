<script lang="ts">
	import ToastNotification from '$lib/components/chassis/forms/ToastNotification.svelte';
	import { getToasts, toast } from '$lib/stores/toast.svelte';

	const items = $derived(getToasts());
</script>

<div class="toast-region" role="region" aria-label="Notifications">
	{#each items as entry (entry.id)}
		<ToastNotification
			kind={entry.kind === 'warning' ? 'warning' : entry.kind}
			title={entry.title}
			subtitle={entry.subtitle ?? ''}
			caption={entry.caption ?? ''}
			timeout={entry.timeout}
			onClose={() => toast.dismiss(entry.id)}
		/>
	{/each}
</div>

<style>
	.toast-region {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		z-index: 9000;
		pointer-events: none;
	}

	.toast-region :global(.bx--toast-notification) {
		pointer-events: auto;
	}
</style>
