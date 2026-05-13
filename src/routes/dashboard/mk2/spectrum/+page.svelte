<!--
  Spec-024 PR9a-2 — Spectrum Analyzer route mount.

  Replaces the PR9a-1 pipeline-proof placeholder with the full
  ScreenSpectrum composition (peak-hold graph + waterfall + controls).

  All composition lives inside ScreenSpectrum; this file is the
  SvelteKit route shell only.
-->
<script lang="ts">
	import ScreenSpectrum from '$lib/components/screens/ScreenSpectrum.svelte';
</script>

<ScreenSpectrum />
