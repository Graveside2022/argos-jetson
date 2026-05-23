import type { PageLoad } from './$types';

// MapLibre GL JS requires browser APIs (WebGL, DOM) - disable SSR.
export const ssr = false;
export const csr = true;

// `/dashboard` serves the Argos shell. v2/Mk II UI retired 2026-05-23.
export const load: PageLoad = () => {};
