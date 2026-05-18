<!--
	V3 Overview — P1 placeholder. Confirms the NVIDIA-themed shell, the
	[data-ui='v3'] token system, and the dark/light toggle render end-to-end
	on :5175. Real overview content (status cards, callout stats) lands in P3.
-->
<script lang="ts">
	import V3Button from '$lib/components/v3/V3Button.svelte';
</script>

<section class="v3-overview">
	<p class="v3-overview__eyebrow">Argos · V3</p>
	<h1 class="v3-overview__title">NVIDIA-themed console</h1>
	<p class="v3-overview__lede">
		Port 5175 runs the V3 UI — NVIDIA's engineering-grade design language applied to the Argos
		SDR &amp; network-analysis console. Toggle dark / light from the bar above; the whole surface
		re-themes through the CSS cascade.
	</p>
	<div class="v3-overview__actions">
		<V3Button variant="primary">Primary action</V3Button>
		<V3Button variant="outline">Secondary</V3Button>
	</div>
</section>

<style>
	.v3-overview {
		max-width: 1280px;
		margin: 0 auto;
		padding: var(--v3-space-section) var(--v3-space-xxl);
	}
	.v3-overview__eyebrow {
		margin: 0 0 var(--v3-space-md);
		font-family: var(--v3-font-sans);
		font-size: var(--v3-text-caption);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--primary);
	}
	.v3-overview__title {
		margin: 0;
		font-family: var(--v3-font-sans);
		font-size: var(--v3-text-display-xl);
		font-weight: 700;
		line-height: 1.25;
		color: var(--foreground);
	}
	.v3-overview__lede {
		max-width: 60ch;
		margin: var(--v3-space-lg) 0 0;
		font-family: var(--v3-font-sans);
		font-size: var(--v3-text-heading-lg);
		font-weight: 400;
		line-height: 1.6;
		color: var(--foreground-secondary);
	}
	.v3-overview__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--v3-space-md);
		margin-top: var(--v3-space-xl);
	}
</style>
