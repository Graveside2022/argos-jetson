<!--
  spec-024 placeholder for PR7 — AGENTS + Workflows (T039–T045).
  The LeftRail keeps AGENTS at slot 01 to preserve the published prototype's
  numbering; this placeholder absorbs the navigation hit so a click doesn't 404
  before PR7 ships ScreenAgents.svelte.
-->
<div class="placeholder">
	<div class="placeholder-eyebrow">SPEC-024 · PR7</div>
	<div class="placeholder-title">AGENTS</div>
	<div class="placeholder-body">
		Mission-Control bar, 9-session grid, and workflows dock-anywhere ship in
		<code>spec-024 PR7</code>. Until then this slot is wired but empty.
	</div>
</div>

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
