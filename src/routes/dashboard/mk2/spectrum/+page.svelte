<script lang="ts">
	// spec-024 PR9a — Spectrum Analyzer route mount.
	//
	// PR9a ships only the abstraction layer (server-side SpectrumSource +
	// /api/spectrum/* routes). The full Spectrum.svelte peak-hold graph
	// and Waterfall.svelte canvas render land in PR9a-2 after T048 spike
	// validates the Canvas 2D performance gate (P95 frame ≤ 6 ms on
	// Jetson). Until then this placeholder subscribes to the new SSE
	// channel and proves the end-to-end wiring without committing to a
	// render path.
	//
	// All states must render (CLAUDE.md component-state rule):
	// loading / streaming / idle / error.

	import { onDestroy, onMount } from 'svelte';

	type ConnState = 'loading' | 'streaming' | 'idle' | 'error';

	let connState = $state<ConnState>('loading');
	let frameCount = $state(0);
	let lastDevice = $state<string | null>(null);
	let lastBinCount = $state<number | null>(null);
	let lastError = $state<string | null>(null);
	let source: EventSource | null = null;

	function bindHandlers(es: EventSource): void {
		es.addEventListener('connected', (e) => {
			const data = JSON.parse((e as MessageEvent).data);
			connState = data.active === null ? 'idle' : 'streaming';
			lastDevice = data.active;
		});
		es.addEventListener('frame', (e) => {
			const frame = JSON.parse((e as MessageEvent).data);
			frameCount += 1;
			lastDevice = frame.device;
			lastBinCount = frame.power?.length ?? null;
			connState = 'streaming';
		});
		es.addEventListener('status', (e) => {
			const status = JSON.parse((e as MessageEvent).data);
			connState = status.state === 'streaming' ? 'streaming' : 'idle';
		});
		es.addEventListener('error', (e) => {
			const data = JSON.parse((e as MessageEvent).data);
			lastError = data.message ?? 'Unknown spectrum source error';
			connState = 'error';
		});
		es.onerror = () => {
			lastError = 'EventSource connection failed';
			connState = 'error';
		};
	}

	onMount(() => {
		source = new EventSource('/api/spectrum/stream');
		bindHandlers(source);
	});

	onDestroy(() => {
		source?.close();
	});
</script>

<section class="placeholder" aria-live="polite">
	<header class="head">
		<span class="eyebrow">SPEC-024 · PR9a</span>
		<span class="title">SPECTRUM · PIPELINE PROOF</span>
	</header>

	{#if connState === 'loading'}
		<p class="body" role="status">Connecting to /api/spectrum/stream…</p>
	{:else if connState === 'error'}
		<p class="body" role="alert">{lastError ?? 'Spectrum source error'}</p>
	{:else if connState === 'idle'}
		<p class="body">
			No active SDR. Start a sweep via <code>POST /api/spectrum/start</code>. PR9a-2 ships
			the START control surface alongside the waterfall.
		</p>
	{:else}
		<dl class="kv">
			<dt>device</dt>
			<dd>{lastDevice ?? '—'}</dd>
			<dt>frames</dt>
			<dd>{frameCount}</dd>
			<dt>bins/frame</dt>
			<dd>{lastBinCount ?? '—'}</dd>
		</dl>
	{/if}
</section>

<style>
	.placeholder {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 16px;
		padding: 32px;
		font-family: var(--mk2-f-mono);
		color: var(--mk2-ink-3);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: center;
	}
	.eyebrow {
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.12em;
		color: var(--mk2-ink-4);
		text-transform: uppercase;
	}
	.title {
		font-size: var(--mk2-fs-6);
		letter-spacing: 0.08em;
		color: var(--mk2-accent);
	}
	.body {
		max-width: 520px;
		font-size: var(--mk2-fs-3);
		line-height: 1.6;
		text-align: center;
	}
	.body code {
		color: var(--mk2-accent);
		background: var(--mk2-bg-2);
		padding: 1px 4px;
		border: 1px solid var(--mk2-line);
	}
	.kv {
		display: grid;
		grid-template-columns: auto auto;
		gap: 4px 16px;
		font-size: var(--mk2-fs-3);
	}
	.kv dt {
		color: var(--mk2-ink-4);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: var(--mk2-fs-2);
	}
	.kv dd {
		color: var(--mk2-ink-1);
		margin: 0;
	}
</style>
