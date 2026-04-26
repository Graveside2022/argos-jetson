<script lang="ts">
	// Shared Loading / Error banner for HostMetricsTab + ServicesTab so the
	// state-envelope copy + retry hint isn't duplicated.

	interface Props {
		kind: 'loading' | 'error';
		endpoint: string;
		message?: string;
		retrySeconds?: number;
	}

	let { kind, endpoint, message, retrySeconds }: Props = $props();
</script>

{#if kind === 'loading'}
	<p class="loading mono" aria-live="polite">connecting to {endpoint}…</p>
{:else}
	<p class="err mono" role="alert">
		cannot reach {endpoint} — {message}. Check ARGOS_API_KEY + service status; retrying every
		{retrySeconds ?? '?'}s.
	</p>
{/if}

<style>
	.mono {
		font-family: var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.loading {
		font-size: var(--mk2-fs-3);
		color: var(--mk2-ink-3);
	}

	.err {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-red);
	}
</style>
