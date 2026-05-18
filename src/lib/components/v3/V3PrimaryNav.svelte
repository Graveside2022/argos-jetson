<!--
	V3PrimaryNav — NVIDIA primary-nav (DESIGN.md): a 64px black bar. Wordmark
	left, nav links centred, a single green CTA right.
-->
<script lang="ts">
	import { page } from '$app/state';

	import V3Button from './V3Button.svelte';

	interface NavItem {
		label: string;
		href: string;
	}

	// P1 ships the Overview route only; later phases extend this list as the
	// V3 route subtree grows (map, tools, reports, …).
	const navItems: NavItem[] = [{ label: 'Overview', href: '/dashboard/v3/overview' }];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		return path === href || path.startsWith(href + '/');
	}
</script>

<nav class="v3-primarynav" aria-label="Primary">
	<a class="v3-primarynav__wordmark" href="/dashboard/v3/overview">ARGOS</a>

	<ul class="v3-primarynav__links">
		{#each navItems as item (item.href)}
			<li>
				<a
					class="v3-primarynav__link"
					class:v3-primarynav__link--active={isActive(item.href)}
					href={item.href}
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					{item.label}
				</a>
			</li>
		{/each}
	</ul>

	<div class="v3-primarynav__cta">
		<V3Button variant="primary" href="/dashboard/v3/overview">Get Started</V3Button>
	</div>
</nav>

<style>
	.v3-primarynav {
		display: flex;
		align-items: center;
		gap: var(--v3-space-xl);
		height: var(--v3-primarynav-h);
		padding: 0 var(--v3-space-xl);
		background: var(--v3-hero);
		color: var(--v3-on-hero);
	}
	.v3-primarynav__wordmark {
		flex-shrink: 0;
		font-family: var(--v3-font-sans);
		font-size: var(--v3-text-heading-md);
		font-weight: 700;
		color: var(--primary);
		text-decoration: none;
		letter-spacing: 0.02em;
	}
	.v3-primarynav__links {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: var(--v3-space-xl);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.v3-primarynav__link {
		font-family: var(--v3-font-sans);
		font-size: var(--v3-text-body);
		font-weight: 700;
		color: var(--v3-on-hero);
		text-decoration: none;
	}
	.v3-primarynav__link:hover,
	.v3-primarynav__link--active {
		color: var(--primary);
	}
	.v3-primarynav__cta {
		flex-shrink: 0;
	}
</style>
