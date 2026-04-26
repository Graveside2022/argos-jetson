import { redirect } from '@sveltejs/kit';

// spec-024 PR6 — /dashboard/mk2 redirects to the OVERVIEW screen so a
// bare visit to /dashboard/mk2 always lands somewhere useful.
export function load(): void {
	redirect(307, '/dashboard/mk2/overview');
}

export const ssr = false;
export const csr = true;
