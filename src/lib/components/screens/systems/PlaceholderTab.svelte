<script lang="ts">
	// Single state envelope for HW / PROC / NET sub-tabs — full
	// component-state contract per CLAUDE.md without per-tab duplication.

	export type PlaceholderState =
		| 'loading'
		| 'empty'
		| 'default'
		| 'active'
		| 'error'
		| 'success'
		| 'disabled'
		| 'disconnected';

	interface Props {
		title: string;
		endpoint: string;
		state?: PlaceholderState;
		errorMessage?: string;
	}

	let { title, endpoint, state = 'disabled', errorMessage }: Props = $props();

	const COPY_BY_STATE: Record<PlaceholderState, (e: string, m?: string) => string> = {
		loading: (e) => `connecting to ${e}…`,
		empty: (e) => `${e} returned no rows.`,
		default: (e) => `${e} ready.`,
		active: (e) => `${e} active — receiving live data.`,
		error: (e, m) => `${e} failed: ${m ?? 'unknown error'}`,
		success: (e) => `${e} healthy.`,
		disconnected: (e) => `${e} unreachable — check ARGOS_API_KEY + service status.`,
		disabled: (e) => `endpoint ${e} is not yet implemented — wiring lands in PR5+.`
	};

	const ALERT_STATES: ReadonlySet<PlaceholderState> = new Set(['error', 'disconnected']);

	const copy = $derived(COPY_BY_STATE[state](endpoint, errorMessage));
	const role = $derived(ALERT_STATES.has(state) ? 'alert' : undefined);
</script>

<div class="placeholder" data-state={state}>
	<p class="title mono">{title}</p>
	<p class="body mono" {role} aria-live={role ? 'polite' : undefined}>{copy}</p>
</div>

<style>
	.placeholder {
		padding: 32px 18px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 540px;
	}

	.title {
		font: 500 var(--mk2-fs-2) / 1 var(--mk2-f-mono);
		letter-spacing: 0.14em;
		color: var(--mk2-ink-3);
		text-transform: uppercase;
	}

	.body {
		font-size: var(--mk2-fs-3);
		color: var(--mk2-ink-4);
		line-height: 1.5;
	}

	.placeholder[data-state='error'] .body,
	.placeholder[data-state='disconnected'] .body {
		color: var(--mk2-red);
	}

	.placeholder[data-state='loading'] .body {
		color: var(--mk2-ink-3);
	}

	.placeholder[data-state='default'] .body {
		color: var(--mk2-ink-2);
	}
</style>
