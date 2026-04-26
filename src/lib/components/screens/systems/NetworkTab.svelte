<script lang="ts">
	// spec-024 PR4 T026 — NETWORK sub-tab placeholder.
	//
	// Per-interface IP / kind / RX / TX / errors needs an iterator over
	// `/proc/net/dev` exposed as a route. /api/system/info exposes wifi
	// interfaces only (name/ip/mac); throughput counters and error counts
	// live in /api/system/metrics but only for the first matching wlan/eth.
	// A proper /api/system/interfaces shape is a PR5+ task.
</script>

<div class="empty">
	<p class="title mono">NETWORK INTERFACES</p>
	<p class="body mono">
		Per-interface IP / RX / TX / ERR rows deferred to PR5+. Needs
		<code>/api/system/interfaces</code> covering wlan / eth / tun beyond the single
		primary-iface counter exposed today.
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
