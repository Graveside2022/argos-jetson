// V3 is a client-rendered SPA shell (matches V1 /dashboard + Mk II). Applying
// ssr:false at the layout covers every /dashboard/v3 route in one place.
// Server-load redirects are unreliable under ssr:false — the port-aware
// :5175 -> /dashboard/v3 redirect lives in src/hooks.server.ts instead.
export const ssr = false;
export const csr = true;
