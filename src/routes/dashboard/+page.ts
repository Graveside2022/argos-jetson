import { redirect } from '@sveltejs/kit';

import type { PageLoad } from './$types';

// MapLibre GL JS requires browser APIs (WebGL, DOM) - disable SSR.
export const ssr = false;
export const csr = true;

// spec-024 PR6 — redirect the old `?ui=mk2` flag to the canonical
// /dashboard/mk2/overview route. The flag was the PR1-PR5b-era gating
// mechanism; PR6 promotes Mk II to its own URL space so the URL itself
// is the source of truth. Old bookmarks keep working via this hop.
export const load: PageLoad = ({ url }) => {
	if (url.searchParams.get('ui') === 'mk2') {
		redirect(307, '/dashboard/mk2/overview');
	}
};
