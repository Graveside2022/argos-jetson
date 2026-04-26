import { redirect } from '@sveltejs/kit';

import type { PageLoad } from './$types';

// MapLibre GL JS requires browser APIs (WebGL, DOM) - disable SSR.
export const ssr = false;
export const csr = true;

// spec-024 PR11 (T054) — Mk II is now the default. `/dashboard` redirects
// to the Mk II OVERVIEW screen for every visitor, including bookmarks that
// still pin `?ui=mk2`. The legacy Lunaris shell stays reachable for one
// release behind the `?ui=lunaris` escape hatch (T055 sunsets it next
// release: deletes the legacy chassis and the conditional below).
export const load: PageLoad = ({ url }) => {
	if (url.searchParams.get('ui') !== 'lunaris') {
		redirect(307, '/dashboard/mk2/overview');
	}
};
