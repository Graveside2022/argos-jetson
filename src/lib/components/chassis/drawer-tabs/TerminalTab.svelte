<script lang="ts">
	import { onMount } from 'svelte';

	import { browser } from '$app/environment';
	import TerminalPanel from '$lib/components/dashboard/TerminalPanel.svelte';

	// spec-024 PR3 T020 — Terminal drawer tab.
	// Re-uses the existing dashboard TerminalPanel (xterm + node-pty) so the
	// drawer doesn't fork a parallel terminal stack. The /terminal-ws WebSocket
	// only exists under `npm run dev` (vite-plugin-terminal); under `node build`
	// (production via argos-final.service) the route 404s — surface that as an
	// explicit empty state per memory `project_argos_terminal_prod_gap.md`.

	let probeStatus = $state<'pending' | 'available' | 'missing'>('pending');

	onMount(() => {
		if (!browser) return;
		// HEAD probe is cheaper than upgrading; the dev plugin exposes the WS at
		// the same path so a 404 here is a reliable signal.
		fetch('/terminal-ws', { method: 'HEAD' })
			.then((r) => {
				probeStatus = r.status === 404 ? 'missing' : 'available';
			})
			.catch(() => {
				probeStatus = 'missing';
			});
	});
</script>

{#if probeStatus === 'available'}
	<div class="terminal-host">
		<TerminalPanel />
	</div>
{:else if probeStatus === 'missing'}
	<div class="empty">
		<div class="empty-title">Terminal not available in production build</div>
		<div class="empty-body">
			The interactive terminal is provided by <code>vite-plugin-terminal</code>, which only
			loads under <code>npm run dev</code>. Production servers (running
			<code>node build</code>) ship without the
			<code>/terminal-ws</code> WebSocket.
		</div>
		<div class="empty-hint">Switch to the dev server to use this tab.</div>
	</div>
{:else}
	<div class="empty">
		<div class="empty-title">Probing terminal…</div>
	</div>
{/if}

<style>
	.terminal-host {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		background: #000;
	}

	.empty {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 8px;
		padding: 20px;
		text-align: center;
		font-family: var(--mk2-f-mono);
		color: var(--mk2-ink-3);
	}

	.empty-title {
		font-size: var(--mk2-fs-4);
		color: var(--mk2-ink-2);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.empty-body {
		max-width: 520px;
		font-size: var(--mk2-fs-drawer-body);
		line-height: 1.6;
		color: var(--mk2-ink-3);
	}

	.empty-body code {
		color: var(--mk2-accent);
		font-family: var(--mk2-f-mono);
		background: var(--mk2-bg-2);
		padding: 1px 4px;
		border: 1px solid var(--mk2-line);
	}

	.empty-hint {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
</style>
