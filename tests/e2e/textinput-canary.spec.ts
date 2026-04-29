/**
 * Phase 3 PR3a — TextInput canary characterization tests.
 *
 * Covers the GpServerForm `portal` + `username` fields after migration
 * from bespoke `<input>` to the Carbon-wrapped `<TextInput>` adapter at
 * `src/lib/components/chassis/forms/TextInput.svelte`.
 *
 * Pattern: Feathers, "Working Effectively with Legacy Code" (2004) — these
 * are characterization tests that lock current observable behavior so the
 * Carbon swap cannot regress label association, focus order, or WCAG 2.1 AA
 * conformance. Test must be GREEN against bespoke (proves it works) AND
 * GREEN against Carbon (proves the swap preserves behavior).
 *
 * Spec authority:
 *   - specs/026-lunaris-design-system/components/text-input/accessibility.md
 *   - specs/026-lunaris-design-system/adrs/0001-phase-3-canary-textinput.md
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

// @axe-core/playwright bundles an older Page type — bridge with a helper.
// Same workaround as accessibility.spec.ts:19-21.
function axe(page: Page) {
	return new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0]);
}

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;

function logViolations(violations: AxeResults['violations']): void {
	if (violations.length === 0) return;
	console.warn('\n⚠️  GpServerForm a11y violations:');
	for (const v of violations) {
		console.warn(`  [${v.impact}] ${v.id}: ${v.description}`);
		console.warn(`     ${v.helpUrl}`);
		for (const node of v.nodes) console.warn(`     - ${node.html.substring(0, 160)}`);
	}
}

const DASHBOARD_ROUTE = '/dashboard';

async function clickIfVisible(page: Page, name: RegExp): Promise<void> {
	const btn = page.getByRole('button', { name }).first();
	const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
	if (visible) await btn.click();
}

/**
 * Activation path (verified 2026-04-29):
 *   /dashboard → SettingsPanel → "GlobalProtect" button → activeView='globalprotect' → GpConfigView renders.
 */
async function openGlobalProtectView(page: Page): Promise<void> {
	await page.goto(DASHBOARD_ROUTE);
	await page.waitForLoadState('networkidle');
	await clickIfVisible(page, /settings/i);
	await page
		.getByRole('button', { name: /globalprotect/i })
		.first()
		.click();
	await page
		.getByLabel(/portal address/i)
		.first()
		.waitFor({ state: 'visible', timeout: 5000 });
}

test.describe('TextInput canary — GpServerForm WCAG 2.1 AA', () => {
	test.beforeEach(async ({ page }) => {
		await openGlobalProtectView(page);
	});

	test('GpServerForm passes axe audit (wcag2aa + wcag21aa + best-practice)', async ({ page }) => {
		const results = await axe(page)
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
			.analyze();
		logViolations(results.violations);
		expect(results.violations).toEqual([]);
	});

	test('Portal Address input has accessible label', async ({ page }) => {
		const portal = page.getByLabel(/portal address/i).first();
		await expect(portal).toBeVisible();
		await expect(portal).toBeEditable();

		// Label association must survive the migration.
		const labelledByOrFor = await portal.evaluate((el) => {
			const id = el.id;
			const ariaLabel = el.getAttribute('aria-label');
			const ariaLabelledBy = el.getAttribute('aria-labelledby');
			const linkedLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
			return Boolean(ariaLabel || ariaLabelledBy || linkedLabel);
		});
		expect(labelledByOrFor).toBe(true);
	});

	test('Username input has accessible label', async ({ page }) => {
		const username = page.getByLabel(/^username$/i).first();
		await expect(username).toBeVisible();
		await expect(username).toBeEditable();
	});

	test('Tab order: portal → username (then onward)', async ({ page }) => {
		const portal = page.getByLabel(/portal address/i).first();
		await portal.focus();
		await page.keyboard.press('Tab');
		await expect(page.getByLabel(/^username$/i).first()).toBeFocused();
	});

	test('Portal value updates via onInput callback', async ({ page }) => {
		const portal = page.getByLabel(/portal address/i).first();
		await portal.fill('vpn.example.mil');
		await expect(portal).toHaveValue('vpn.example.mil');
	});

	test('Focus ring is visible on portal field', async ({ page }) => {
		const portal = page.getByLabel(/portal address/i).first();
		await portal.focus();

		const focusVisible = await portal.evaluate((el) => {
			const style = window.getComputedStyle(el);
			const outlineWidth = style.outlineWidth;
			const boxShadow = style.boxShadow;
			const outlineVisible = outlineWidth !== '0px' && outlineWidth !== 'none';
			const shadowVisible = Boolean(boxShadow) && boxShadow !== 'none';
			return outlineVisible || shadowVisible;
		});

		expect(focusVisible).toBe(true);
	});
});
