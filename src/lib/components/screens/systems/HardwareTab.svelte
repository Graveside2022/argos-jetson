<script lang="ts">
	import PlaceholderTab from './PlaceholderTab.svelte';

	// spec-024 PR4 T026 — HARDWARE sub-tab. Wired through PlaceholderTab
	// envelope so the full state contract (Loading / Empty / Default /
	// Error / Disabled / Disconnected) is honored. PR4 ships in `disabled`
	// state — the /api/hardware/inventory endpoint does not exist yet.
	// PR5+ swap `state` to 'default' once the endpoint lands.
</script>

<PlaceholderTab title="HARDWARE INVENTORY" endpoint="/api/hardware/inventory" />
