<script lang="ts">
	import PlaceholderTab from './PlaceholderTab.svelte';

	// spec-024 PR4 T026 — NETWORK sub-tab. PR4 ships `disabled` — the
	// /api/system/interfaces endpoint (per-iface IP / RX / TX / errors
	// across wlan / eth / tun) does not exist yet; /api/system/info exposes
	// only wlan{name,ip,mac} and /api/system/metrics only the first matching
	// iface counter. PR5+ swap to 'default' once the proper iterator lands.
</script>

<PlaceholderTab title="NETWORK INTERFACES" endpoint="/api/system/interfaces" />
