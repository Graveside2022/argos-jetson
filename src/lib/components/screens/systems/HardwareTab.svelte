<script lang="ts">
	// spec-024 PR4 T026 — HARDWARE sub-tab placeholder.
	//
	// Real bindings (HackRF / Alfa / GPS / TAK / Kismet / RTL / USRP / battery
	// rows from prototype `systems-overview.jsx` HARDWARE seed) need a
	// `/api/hardware/inventory` style endpoint that does not exist yet. Per the
	// spec-024 phase model, PR4 ships the screen + tab strip; the per-screen
	// data wiring happens in PR5+ alongside its first real consumer.
</script>

<div class="empty">
	<p class="title mono">HARDWARE INVENTORY</p>
	<p class="body mono">
		Detection wiring deferred to PR5+. This tab will list HackRF / Alfa / GPS / TAK / Kismet
		/ SDR adapters once <code>/api/hardware/inventory</code> lands.
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
