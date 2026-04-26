<script lang="ts">
	// spec-024 PR10a T053 — mounts the Mk II Kismet screen as a nested
	// route under /dashboard/mk2/+layout. PR8 (Tools flyout) will pin
	// this route to the LeftRail's middle dynamic-tools section; for
	// now it's URL-reachable directly.
	import ScreenKismet from '$lib/components/screens/ScreenKismet.svelte';
</script>

<ScreenKismet />
