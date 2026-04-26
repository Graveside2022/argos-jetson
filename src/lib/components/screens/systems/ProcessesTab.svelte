<script lang="ts">
	import PlaceholderTab from './PlaceholderTab.svelte';

	// spec-024 PR4 T026 — PROCESSES sub-tab. PR4 ships `disabled` — the
	// /api/system/processes endpoint (ps parsing + rate-limit + auth) does
	// not exist yet. PR5+ swap to 'default' with sortable PID/USER/CMD/CPU/
	// MEM/NET rows.
</script>

<PlaceholderTab title="PROCESS TABLE" endpoint="/api/system/processes" />
