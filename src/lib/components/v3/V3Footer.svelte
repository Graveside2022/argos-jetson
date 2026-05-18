<!--
	V3Footer — NVIDIA footer-section (DESIGN.md): the black chapter that closes
	every page. P1 ships a minimal brand + fine-print band; the full multi-
	column link grid lands in a later phase.
-->
<script lang="ts">
	const year = new Date().getFullYear();
</script>

<footer class="v3-footer">
	<div class="v3-footer__brand">
		<span class="v3-footer__wordmark">ARGOS</span>
		<p class="v3-footer__tagline">SDR &amp; Network Analysis Console</p>
	</div>
	<div class="v3-footer__fineprint">
		<span>&copy; {year} Argos — Army EW Training Console</span>
		<span>V3 · NVIDIA design system</span>
	</div>
</footer>

<style>
	.v3-footer {
		padding: var(--v3-space-section) var(--v3-space-xxl) var(--v3-space-xl);
		background: var(--v3-hero);
		color: var(--v3-on-hero-mute);
	}
	.v3-footer__brand {
		padding-bottom: var(--v3-space-xl);
		border-bottom: 1px solid var(--v3-hairline-strong);
	}
	.v3-footer__wordmark {
		font-family: var(--v3-font-sans);
		font-size: var(--v3-text-heading-md);
		font-weight: 700;
		color: var(--primary);
		letter-spacing: 0.02em;
	}
	.v3-footer__tagline {
		margin: var(--v3-space-xs) 0 0;
		font-family: var(--v3-font-sans);
		font-size: var(--v3-text-body-sm);
		color: var(--v3-on-hero-mute);
	}
	.v3-footer__fineprint {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--v3-space-md);
		padding-top: var(--v3-space-lg);
		font-family: var(--v3-font-sans);
		font-size: var(--v3-text-utility-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted-foreground);
	}
</style>
