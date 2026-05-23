/**
 * Single source of truth for HTTP Origin allowlisting.
 *
 * Applied to:
 *   - CORS REST headers (`cors.ts:getCorsHeaders`)
 *   - WebSocket upgrade gating (`ws-connection-handler.ts`, terminal handler)
 *   - SSE Origin checks
 *
 * IMPORTANT — no `$lib/*` imports. The terminal handler imports this module
 * via a RELATIVE path (`../security/origin-allowlist`) because
 * `config/vite-plugin-terminal.ts` evaluates the terminal handler BEFORE
 * the `$lib` alias exists. Keep this file dependency-free.
 *
 * Defense-in-depth model (CWE-1385 CSWSH):
 *   1. Origin allowlist (this module) — rejects forged cross-origin browser requests
 *   2. ARGOS_API_KEY / session auth (separate) — rejects unauth requests regardless of origin
 *   3. Rate limit (separate) — bounds per-IP request volume
 *   4. Overlay-layer ACL (Tailscale ACL / WireGuard AllowedIPs / ZeroTier flow rules) —
 *      restrict who can reach :5173 at the network layer; recommended over CIDR auto-allow
 *
 * Non-browser clients (CLI, server-to-server, `ws` lib) send no Origin and are
 * allowed by this module — CSWSH requires a browser. Auth still gates them.
 *
 * To add a new operator machine (Tailscale/WireGuard/ZeroTier), append to
 * `ARGOS_CORS_ORIGINS` in `.env` (or run `scripts/ops/add-origin.sh <origin>`)
 * and restart `argos-final`. See `docs/security/multi-vpn-origin-setup.md`.
 */

const DEFAULT_LOCALHOST_ORIGINS: readonly string[] = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'http://localhost:3000',
	'http://127.0.0.1:3000'
];

/**
 * Parse the `ARGOS_CORS_ORIGINS` env var into a normalized list.
 * Format: comma-separated origin URLs.
 * Empty / missing / whitespace-only entries are dropped.
 */
function parseExtraOrigins(): string[] {
	const raw = process.env.ARGOS_CORS_ORIGINS;
	if (!raw) return [];
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/** Full effective allowlist: localhost defaults + `ARGOS_CORS_ORIGINS` additions. */
export function getAllowedOrigins(): string[] {
	return [...DEFAULT_LOCALHOST_ORIGINS, ...parseExtraOrigins()];
}

/**
 * True if `origin` is in the allowlist, OR is missing entirely (non-browser client).
 *
 * Browsers always send `Origin` on cross-origin WS upgrades, SSE (EventSource),
 * and CORS-credentialed fetches. A missing Origin therefore implies a non-browser
 * caller, which CSWSH cannot exploit (no cookie jar / no auth-cookie hijack).
 */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
	if (!origin) return true;
	return getAllowedOrigins().includes(origin);
}
