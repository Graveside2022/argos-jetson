<script lang="ts">
	// spec-024 PR4 T026 — PROCESSES sub-tab placeholder.
	//
	// The prototype renders a sortable PID/USER/CMD/CPU/MEM/NET table. Argos
	// has no `/api/system/processes` endpoint today. Adding `ps` parsing +
	// auth surface is its own scope; tracked for PR5+ when the OVERVIEW
	// screen needs the same data.
</script>

<div class="empty">
	<p class="title mono">PROCESS TABLE</p>
	<p class="body mono">
		Sortable PID/USER/CMD/CPU/MEM/NET wiring deferred to PR5+. Requires
		<code>/api/system/processes</code> (ps parsing + rate-limit) which does not exist yet.
	</p>
</div>

<style>
	.empty {
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

	code {
		color: var(--mk2-ink-2);
	}
</style>
