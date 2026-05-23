# Multi-VPN Origin Setup

Argos's dashboard `:5173` is **LAN-first** — typically reached from an operator
machine over a VPN/overlay network (Tailscale, WireGuard, ZeroTier, or plain
LAN). Each operator machine reaches Argos via a different IP, and that IP
appears in the browser's `Origin` HTTP header on every WebSocket upgrade,
SSE connection, and cross-origin REST call.

The server's **Origin allowlist** (defined in
`src/lib/server/security/origin-allowlist.ts`) defaults to `localhost` only.
You must extend it to include each access URL operators will use.

## TL;DR

```bash
./scripts/ops/add-origin.sh http://100.119.153.120:5173
sudo systemctl restart argos-final
```

## The 4-layer defense model

| #   | Layer                             | Where                     | Purpose                                                               |
| --- | --------------------------------- | ------------------------- | --------------------------------------------------------------------- |
| 1   | **Origin allowlist** (this guide) | `ARGOS_CORS_ORIGINS` env  | CWE-1385 CSWSH defense — rejects forged cross-origin browser requests |
| 2   | **`ARGOS_API_KEY` auth**          | `.env` + headers          | Rejects unauthenticated requests regardless of origin                 |
| 3   | **Rate limit**                    | `rate-limiter.ts`         | Bounds per-IP request volume                                          |
| 4   | **Overlay ACL** (recommended)     | Tailscale / WG / ZT admin | Restricts who can even reach `:5173` at the network layer             |

The layers compose: an attacker on the Tailnet still needs the API key, won't
trip the rate limit, AND must originate from an allowlisted host.

## Why no CIDR / subnet auto-allow

Auto-allowing a CIDR range (e.g. Tailscale's `100.64.0.0/10` CGNAT) was
considered and **rejected** because:

1. The same range is used by some cellular CGNAT carriers — not unique to Tailscale
2. WireGuard / ZeroTier use arbitrary user-defined ranges — CIDR auto-allow couldn't cover them all
3. Public OSS — easier to defend an explicit allowlist than a permissive CIDR
4. `software-security` (Cisco CodeGuard) + `patch-advisor` (CWE-1385) skills both recommend explicit Origin matching, NOT CIDR
5. Per-machine `add-origin.sh` is a one-liner

## Setup per VPN backend

### Tailscale

```bash
# 1. Get this Jetson's Tailscale IP
ip -4 addr show tailscale0 | grep -oP 'inet \K[0-9.]+'

# 2. Add operator machines' access URL to the allowlist
./scripts/ops/add-origin.sh http://100.119.153.120:5173

# 3. (Recommended) Restrict who can reach :5173 at the Tailnet layer
# Edit https://login.tailscale.com/admin/acls to add:
#   {"action": "accept", "src": ["tag:operator"], "dst": ["100.119.153.120:5173"]}
# This is your Layer 4 — defense in depth without code change.

# 4. Restart Argos
sudo systemctl restart argos-final
```

### WireGuard

```bash
# 1. Get this host's WireGuard interface IP
ip -4 addr show wg0 | grep -oP 'inet \K[0-9.]+'

# 2. Allow operator origin
./scripts/ops/add-origin.sh http://10.0.0.1:5173

# 3. (Recommended) Tighten the peer's AllowedIPs in your wg0.conf to only
#    cover the subnet operators need. Don't blanket-allow 0.0.0.0/0
#    unless you need split-tunneling, which is a separate decision.

# 4. Restart Argos
sudo systemctl restart argos-final
```

### ZeroTier

```bash
# 1. Get this host's ZeroTier IP
sudo zerotier-cli listnetworks | awk '{print $9}' | grep -oP '[0-9.]+'

# 2. Allow operator origin
./scripts/ops/add-origin.sh http://192.168.193.5:5173

# 3. (Recommended) Configure ZeroTier flow rules in the network controller to
#    restrict which member nodes can hit TCP :5173. See
#    https://docs.zerotier.com/rules — example:
#      drop chr ipprotocol tcp dport 5173 not ipdest 192.168.193.5/32 ;

# 4. Restart Argos
sudo systemctl restart argos-final
```

### Plain LAN (no overlay)

```bash
# 1. Get this host's LAN IP
hostname -I | awk '{print $1}'

# 2. Allow operator origin
./scripts/ops/add-origin.sh http://192.168.1.100:5173

# 3. (Recommended) Front-end firewall (`ufw allow from 192.168.1.0/24 to any port 5173`)
#    or wrap with a reverse proxy that does mTLS.

# 4. Restart Argos
sudo systemctl restart argos-final
```

## Inspecting the current allowlist

```bash
grep ^ARGOS_CORS_ORIGINS /home/jetson2/code/Argos/.env
```

The full effective list = the 4 localhost defaults
(`http://localhost:5173`, `http://127.0.0.1:5173`,
`http://localhost:3000`, `http://127.0.0.1:3000`) + every entry in
`ARGOS_CORS_ORIGINS`.

## Removing an origin

Edit `.env` directly — `add-origin.sh` is append-only by design (deletes
should be a deliberate manual action).

```bash
sudo nano /home/jetson2/code/Argos/.env
# remove the URL from the ARGOS_CORS_ORIGINS line
sudo systemctl restart argos-final
```

## Verifying after change

Replace `<16-byte-base64-nonce>` below with any valid base64-encoded 16-byte value (e.g. `openssl rand -base64 16`).

```bash
# 1. WS upgrade probe from the operator URL — expect HTTP/1.1 101
curl -i -m 5 \
  -H "Origin: http://100.119.153.120:5173" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: <16-byte-base64-nonce>" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://100.119.153.120:5173/terminal-ws

# 2. CORS preflight from the operator URL — expect Access-Control-Allow-Origin echo
curl -i -X OPTIONS -m 5 \
  -H "Origin: http://100.119.153.120:5173" \
  -H "Access-Control-Request-Method: GET" \
  http://100.119.153.120:5173/api/hardware/status
```

## Threat model summary

This setup assumes:

- The VPN/overlay layer is trustworthy (peer auth via Tailscale/WG/ZT keys)
- `ARGOS_API_KEY` is unique per install, never committed, rotated on suspicion
- Operators don't share API keys across machines

It does NOT defend against:

- A compromised peer ON the Tailnet/VPN — that peer can reach `:5173` and,
  with the API key, fully authenticate. Mitigate via Layer 4 (overlay ACLs)
  to restrict which peers can reach the port.
- An attacker who steals the API key (via leak, browser malware, etc.).
  Rotate the key immediately if suspected; see the rotation block in
  `.env.example`.

For internet-exposed deployments (rare for Argos), add mTLS via a Caddy
reverse proxy in front of `:5173` — tracked as a future hardening guide,
not currently implemented.
