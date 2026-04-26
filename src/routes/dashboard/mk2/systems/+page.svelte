<script lang="ts">
	// spec-024 PR6 — mounts the Mk II SYSTEMS screen (PR4 T023-T026)
	// as a nested route. PR4 shipped the component but never wired it
	// into the chassis; this is the first time it's reachable.
	import SystemsScreen from '$lib/components/screens/SystemsScreen.svelte';
</script>

<SystemsScreen />
