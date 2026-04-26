<!--
  spec-024 placeholder for PR7 — AGENTS + Workflows (T039–T045).
  The LeftRail keeps AGENTS at slot 01 to preserve the published prototype's
  numbering; this placeholder absorbs the navigation hit so a click doesn't 404
  before PR7 ships ScreenAgents.svelte.

  The route has only one possible state today ("not yet built"), but the
  project's "all components must handle all states" guideline still applies.
  We branch on a single `viewState` rune so the structure is in place when
  PR7 wires real agents/sessions data; today every branch but `default`
  short-circuits to the same coming-soon shell so reviewers see the contract.
-->
<script lang="ts">
	type ViewState =
		| 'default'
		| 'empty'
		| 'loading'
		| 'active'
		| 'success'
		| 'error'
		| 'disabled'
		| 'disconnected';

	// Cast widens the literal type so the placeholder branches below remain
	// reachable to the type checker; PR7 will replace this with reactive state.
	const viewState = 'default' as ViewState;
</script>

{#if viewState === 'loading'}
	<div class="placeholder" role="status" aria-live="polite" aria-busy="true">
		<div class="placeholder-eyebrow">SPEC-024 · PR7</div>
		<div class="placeholder-title">AGENTS · LOADING</div>
		<div class="placeholder-body">Loading agent sessions…</div>
	</div>
{:else if viewState === 'empty'}
	<div class="placeholder" aria-live="polite">
		<div class="placeholder-eyebrow">SPEC-024 · PR7</div>
		<div class="placeholder-title">AGENTS · EMPTY</div>
		<div class="placeholder-body">No agent sessions available.</div>
	</div>
{:else if viewState === 'active'}
	<div class="placeholder" aria-live="polite">
		<div class="placeholder-eyebrow">SPEC-024 · PR7</div>
		<div class="placeholder-title">AGENTS · ACTIVE</div>
		<div class="placeholder-body">Active agent sessions render here in PR7.</div>
	</div>
{:else if viewState === 'success'}
	<div class="placeholder" aria-live="polite">
		<div class="placeholder-eyebrow">SPEC-024 · PR7</div>
		<div class="placeholder-title">AGENTS · SUCCESS</div>
		<div class="placeholder-body">Agent action completed.</div>
	</div>
{:else if viewState === 'error'}
	<div class="placeholder" role="alert" aria-live="assertive">
		<div class="placeholder-eyebrow">SPEC-024 · PR7</div>
		<div class="placeholder-title">AGENTS · ERROR</div>
		<div class="placeholder-body">Agent runtime unavailable. Try again later.</div>
	</div>
{:else if viewState === 'disabled'}
	<div class="placeholder" aria-disabled="true" aria-live="polite">
		<div class="placeholder-eyebrow">SPEC-024 · PR7</div>
		<div class="placeholder-title">AGENTS · DISABLED</div>
		<div class="placeholder-body">Agent runtime is disabled in this build.</div>
	</div>
{:else if viewState === 'disconnected'}
	<div class="placeholder" role="alert" aria-live="assertive">
		<div class="placeholder-eyebrow">SPEC-024 · PR7</div>
		<div class="placeholder-title">AGENTS · DISCONNECTED</div>
		<div class="placeholder-body">Lost connection to agent runtime — reconnecting…</div>
	</div>
{:else}
	<div class="placeholder" aria-live="polite">
		<div class="placeholder-eyebrow">SPEC-024 · PR7</div>
		<div class="placeholder-title">AGENTS</div>
		<div class="placeholder-body">
			Mission-Control bar, 9-session grid, and workflows dock-anywhere ship in
			<code>spec-024 PR7</code>. Until then this slot is wired but empty.
		</div>
	</div>
{/if}

<style>
	.placeholder {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 12px;
		padding: 32px;
		text-align: center;
		color: var(--mk2-ink-3);
		font-family: var(--mk2-f-mono);
	}

	.placeholder-eyebrow {
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.12em;
		color: var(--mk2-ink-4);
		text-transform: uppercase;
	}

	.placeholder-title {
		font-size: var(--mk2-fs-6);
		letter-spacing: 0.08em;
		color: var(--mk2-accent);
	}

	.placeholder-body {
		max-width: 480px;
		font-size: var(--mk2-fs-3);
		line-height: 1.6;
		color: var(--mk2-ink-3);
	}

	.placeholder-body code {
		font-family: var(--mk2-f-mono);
		color: var(--mk2-accent);
		background: var(--mk2-bg-2);
		padding: 1px 4px;
		border: 1px solid var(--mk2-line);
	}
</style>
