import { redirect } from '@sveltejs/kit';

// A bare visit to /dashboard/v3 always lands on the Overview screen.
export function load(): void {
	redirect(307, '/dashboard/v3/overview');
}
