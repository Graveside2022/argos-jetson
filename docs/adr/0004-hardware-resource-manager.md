# ADR 0004 — Hardware resource manager: extensible plugin contract + cooperative preemption

> Status: **ACCEPTED** — 2026-05-27. Captures the de-facto multi-device hardware mutex pattern + makes its extension points explicit.
> Grounded in: the `feat/b205-mutex-preempt` branch work, the consumer-coverage audit (15 services across HACKRF / ALFA / BLUETOOTH / B205), and the cooperative-preempt API extension in `resource-manager.ts:306`.

## Context

Argos integrates SDR + Wi-Fi adapter tools that compete for four physical devices: **HackRF One** (HF/VHF/UHF SDR), **ALFA AWUS036** (Wi-Fi monitor), **USRP B205mini** (wideband SDR), and a reserved **Bluetooth** slot. Fifteen consumer services across `src/lib/server/` claim and release these devices:

- HACKRF: webrx, gsm-evil, gsm-scan, hackrf-tool, sdrpp, trunk-recorder, dragonsync C2, sweep-cycle-init
- ALFA: kismet, sparrow (force-release only)
- B205: bluedragon, gnss-sdr-vnc, gnu-radio-vnc, dragonsync FPV

Before this work, the `HardwareDevice` enum and per-device managers (`b205-manager.ts`, `hackrf-manager.ts`, `alfa-manager.ts`) followed an implicit shape but no explicit contract. Adding a new SDR meant editing `resource-manager.ts`, `resource-scan.ts`, and `resource-refresh.ts` core paths. The B205 mutex also had an asymmetric problem: starting one consumer while another held the lock returned `b205-locked` instead of cooperatively handing off.

## Decision

Three coupled changes, captured in this ADR:

1. **Explicit `HardwareDevicePlugin` contract** (`src/lib/server/hardware/types.ts:34`). Every device adapter exposes `id`, `displayName`, `detect()`, `getBlockingProcesses()`, `killHolders()`.
2. **`DEVICE_PLUGINS` registry** (`src/lib/server/hardware/device-plugins.ts`) that wraps the existing per-device managers into the contract. Adding a new SDR is a three-file change: `HardwareDevice` enum entry → new `<device>-manager.ts` → register in `DEVICE_PLUGINS`. No edits to `resource-manager.ts`.
3. **Cooperative pre-emption API** on `ResourceManager` (`resource-manager.ts:250-325`): `registerPreemptHandler(toolName, device, handler)` lets the current owner promise to release gracefully; `acquireWithPreempt(toolName, device)` invokes the handler on conflict and retries the acquire.

Process-name canonicalization (`src/lib/server/hardware/b205-owner-aliases.ts`) maps bare OS process names (`gnuradio-companion`) to canonical owners (`gnu-radio-vnc`) so the orphan-scan can't overwrite an explicit acquire with a process name. Mirrors the pre-existing `hackrf-owner-aliases.ts` pattern for Docker containers.

## Architecture

### Plugin contract (`types.ts:34`)

```typescript
export type HardwareDevicePlugin = {
	id: HardwareDevice;
	displayName: string;
	detect: () => Promise<boolean>;
	getBlockingProcesses: () => Promise<{ pid: string; name: string }[]>;
	killHolders: () => Promise<void>;
};
```

### Registry (`device-plugins.ts`)

```typescript
export const DEVICE_PLUGINS: Partial<Record<HardwareDevice, HardwareDevicePlugin>> = {
	[HardwareDevice.B205]: b205Plugin,
	[HardwareDevice.HACKRF]: hackrfPlugin,
	[HardwareDevice.ALFA]: alfaPlugin
};
```

`Partial` because `HardwareDevice.BLUETOOTH` is enum-reserved but has no manager yet. Add one when a Bluetooth tool ships.

### Cooperative preempt protocol

```
Tool A: acquire(B205) → success, registerPreemptHandler(A, B205, async () => stopA())
Tool B: acquireWithPreempt(B205)
  → resource-manager finds A's handler, awaits stopA()
  → stopA() calls release(B205)
  → resource-manager retries acquire for B
  → success, returns { success: true, preempted: 'A' }
```

If A has no handler, `acquireWithPreempt` returns the conflict as-is (B handles fallback — e.g., `forceRelease` hammer for legacy holders).

### B205 owner canonicalization (`b205-owner-aliases.ts`)

```typescript
const B205_PROCESS_ALIASES = {
	'gnuradio-companion': 'gnu-radio-vnc'
};
export function canonicalizeB205Owner(owner: string): string {
	return B205_PROCESS_ALIASES[owner] ?? owner;
}
```

Applied in `resource-refresh.ts:56` and `resource-scan.ts` so the 30s periodic refresh + startup orphan scan both produce canonical owner names. Without this, the scan would overwrite a named `gnu-radio-vnc` claim with the bare process name and break preempt-handler lookup.

### Consumer matrix (post-fix, 2026-05-27)

| Consumer            | Device                                 | API used                                                              | Preempt-handler?      |
| ------------------- | -------------------------------------- | --------------------------------------------------------------------- | --------------------- |
| bluedragon          | B205                                   | `acquireWithPreempt`                                                  | Y                     |
| gnss-sdr-vnc        | B205                                   | `acquireWithPreempt`                                                  | Y                     |
| gnu-radio-vnc       | B205                                   | `acquireWithPreempt`                                                  | Y (+ canonical alias) |
| dragonsync FPV      | B205                                   | `acquireWithPreempt` (fixed 2026-05-27, was `acquire`+`forceRelease`) | Y                     |
| kismet              | ALFA                                   | `acquire`                                                             | N                     |
| sparrow             | ALFA (own) + B205 (force-release only) | `acquire` (ALFA)                                                      | N                     |
| dragonsync C2       | HACKRF                                 | `acquire`                                                             | N                     |
| sdrpp               | HACKRF                                 | `acquire`                                                             | N                     |
| gsm-evil / gsm-scan | HACKRF                                 | `acquire` + stale-lock recover via `forceRelease`                     | N                     |
| trunk-recorder      | HACKRF                                 | `acquire`                                                             | N                     |
| webrx-hackrf-claim  | HACKRF                                 | `acquire` + `forceRelease` peer recover                               | N                     |
| sweep-cycle-init    | HACKRF                                 | `acquire`                                                             | N                     |
| hackrf-tool         | HACKRF                                 | (read-only claim checks)                                              | N                     |
| wireshark-vnc       | NONE                                   | n/a                                                                   | n/a                   |
| sightline           | NONE                                   | n/a                                                                   | n/a                   |

Three B205 consumers + dragonsync FPV are cooperatively-preemptible. Single-device claimers (kismet, sdrpp, etc.) use basic `acquire` because no competing tool needs that device at the same time.

## Consequences

**Positive**

- Adding RTL-SDR / BladeRF / Sidekiq / RFNM is a surgical three-file change with no core edits.
- B205 triangle (bluedragon ↔ gnss-sdr ↔ gnu-radio) hands off cleanly instead of erroring.
- Canonical owner naming survives the 30s refresh tick — preempt handlers stay reachable.
- `resource-scan.ts` now scans B205 at startup (previously only HACKRF + ALFA).

**Negative / trade-offs**

- `Partial<Record>` for `DEVICE_PLUGINS` means callers must filter `undefined` when iterating — slightly awkward but typesafe.
- Sparrow's B205 force-release pattern remains asymmetric (sparrow preempts but doesn't acquire). PSU-coordination rationale is plausible but un-documented in code — flagged for follow-up (audit in progress).
- Legacy `forceRelease` paths in dragonsync FPV (now wrapped in `acquireWithPreempt`) + gsm-evil + webrx still exist as fallbacks for handler-less holders. Acceptable until all holders are migrated.

## Status

Accepted. Closes the architectural gap surfaced in observation 6324 (architectural analysis). Companion ADR 0005 captures the noVNC tool standard that pairs with this resource-manager work.

## Related

- ADR 0005 — noVNC Tool Standard (sister ADR covering the VNC stack)
- Plan: `~/.claude/plans/breezy-seeking-seahorse.md` (the 6-phase plan this ADR captures)
- `src/lib/server/hardware/resource-manager.ts:306` — `acquireWithPreempt` API
- `src/lib/server/hardware/types.ts:34` — `HardwareDevicePlugin` contract
- `src/lib/server/hardware/device-plugins.ts` — registry implementation
- `src/lib/server/hardware/b205-owner-aliases.ts` — canonicalization
- `src/lib/server/services/bluedragon/lifecycle.ts:55-78` — canonical preempt-wiring example
