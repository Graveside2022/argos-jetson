# ADR 0005 — noVNC Tool Standard: canonical port allocation, shared spawn helpers, stack-leak guard

> Status: **ACCEPTED** — 2026-05-27. Captures the de-facto vnc-common module + makes its public contract explicit.
> Grounded in: the consumer audit of five VNC services (sparrow, wireshark-vnc, sdrpp, gnss-sdr-vnc, gnu-radio-vnc), the live port-collision investigation, and the new stack-leak-guard work (`stack-leak-guard.ts`).

## Context

Argos exposes desktop GUI tools (sparrow-wifi, Wireshark, SDR++, GNSS-SDR with RTKLib, GNU Radio Companion) in the dashboard by spawning each tool inside its own headless X display, rendering the framebuffer over noVNC. Five services live under `src/lib/server/services/`, each spawning the same trio of processes:

1. **Xtigervnc** (X server + VNC server combined) on a unique X display number
2. **websockify** bridging the VNC TCP port to a WebSocket for the dashboard iframe
3. Optional **openbox** window manager for window decorations + EWMH

The five services already shared `src/lib/server/services/vnc-common/spawn-helpers.ts` for the common primitives (`spawnXtigervnc`, `spawnWebsockify`, `createVncShutdownHandler`, `killOrphansByPort`, `waitForStackReady`, etc.). What was missing:

- A **canonical port + display allocation registry** — each `*-vnc-types.ts` declared its own constants and the JSDoc tables drifted out of sync. Live port collisions (gnu-radio + sparrow both claiming `:95`; gnss-sdr + wireshark both claiming wsPort `6083`) were latent until two tools ran simultaneously.
- A **pre-spawn stack-leak guard** — if a prior start failed cleanly only on the websockify side, the Xtigervnc + openbox processes stayed alive bound to the X display. A subsequent start raced a stale `Xtigervnc :<n>` against the new spawn and failed.

## Decision

Three coupled changes:

1. **`VNC_TOOL_ALLOCATION` registry** (`src/lib/server/services/vnc-common/port-allocation.ts`) — single source of truth keyed by `VncToolId`. Frozen at module load via `Object.freeze`. Unit tests guard uniqueness of display, vncPort, wsPort across all rows.
2. **`reapPriorVncStack(tool)` helper** (`src/lib/server/services/vnc-common/stack-leak-guard.ts`) — wraps `killOrphansByPort` with display-argv-aware sweep so prior Xtigervnc + openbox + websockify on the tool's slot are reaped before respawn. Idempotent.
3. **Per-tool migration contract** — each `*-vnc-types.ts` consumes `getVncAllocation('<tool>')` instead of hard-coding display/port numbers. Each `*-vnc-control-service.ts` calls `await reapPriorVncStack('<tool>')` at the head of `start()` before `spawnXtigervnc`.

## Architecture

### Allocation registry (`port-allocation.ts`)

```typescript
export type VncToolId =
  | 'sparrow'
  | 'wireshark-vnc'
  | 'sdrpp'
  | 'gnss-sdr-vnc'
  | 'gnu-radio-vnc';

export const VNC_TOOL_ALLOCATION: Readonly<Record<VncToolId, VncAllocation>> = Object.freeze({
  sparrow:         { display: ':95', vncPort: 5995, wsPort: 6080 },
  'wireshark-vnc': { display: ':96', vncPort: 5996, wsPort: 6081 },
  sdrpp:           { display: ':97', vncPort: 5997, wsPort: 6082 },
  'gnss-sdr-vnc':  { display: ':98', vncPort: 5998, wsPort: 6083 },
  'gnu-radio-vnc': { display: ':99', vncPort: 5999, wsPort: 6084 }
});

export function getVncAllocation(tool: VncToolId): VncAllocation { ... }
```

Display `:99` is the last X server slot before colliding with the host default `:0` and the SSH-X11-forwarding range. A sixth VNC tool requires reusing a freed slot or auditing the host X11 setup.

### Stack-leak guard (`stack-leak-guard.ts`)

```typescript
export async function reapPriorVncStack(tool: VncToolId): Promise<number> {
	const allocation = getVncAllocation(tool);
	await killOrphansByPort(allocation.vncPort, allocation.wsPort);
	const pids = await pidsWithDisplayInArgv(allocation.display);
	let reaped = 0;
	for (const pid of pids) if (await killPid(pid)) reaped += 1;
	return reaped;
}
```

Two-pass reaper: TCP-port kill catches Xtigervnc (binds RFB port) + websockify (binds ws port); display-argv `pgrep` catches openbox + any other process passing `:NN` as an argument that doesn't bind a TCP port. SIGTERM only — escalation to SIGKILL is the per-service `killVncProcess` helper's job at stop time.

### Service contract

Every `*-vnc-control-service.ts` follows this start path:

```
1. registerShutdownHandler()        // idempotent SIGTERM/SIGINT cleanup
2. if (isStackAlive()) return       // idempotent already-running
3. await claimHardware()            // optional, per ADR 0004
4. await reapPriorVncStack(toolId)  // new — closes stack-leak loophole
5. await spawnStackProcesses()      // tool-specific spawn sequence
6. await waitForStackReady()        // probe both VNC + ws ports
7. armCrashWatchdog()               // optional, fires release on managed-child crash
```

### Window-manager pattern (variant per tool)

- **gnu-radio-vnc** ships a custom `etc/openbox-rc.xml` (763 lines) with `<application name="gnuradio-companion">` auto-maximize rule. Spawned via `openbox --sm-disable --config-file /tmp/argos-openbox-rc.xml` (`gnu-radio-vnc-processes.ts:216`).
- **gnss-sdr-vnc** spawns openbox with `--sm-disable` ONLY — no `--config-file`. Openbox falls back to the distro-default `/etc/xdg/openbox/rc.xml` shipped by the `openbox` Debian/Ubuntu package (`gnss-sdr-vnc-processes.ts:262-267`). Window placement is then driven by Qt `-geometry W×H+X+Y` arguments at spawn time (Qt is authoritative when the WM is non-floating). The distro rc.xml provides EWMH atoms so `xdotool windowmove`/`windowsize` still work for post-spawn tiling. **Operational dependency**: if the `openbox` package is missing OR `/etc/xdg/openbox/rc.xml` is moved, gnss-sdr-vnc windows render undecorated. A startup probe (see "Startup checks" below) should verify the file's presence at install time.
- **sparrow / wireshark-vnc / sdrpp** spawn no window manager (single-window Qt apps positioned via `xdotool windowmove` after the Qt app maps).

### Startup checks (distro dependencies)

Install-time / boot-time probes that gate the noVNC stack:

| Path                      | Required by                                        | Probe                            |
| ------------------------- | -------------------------------------------------- | -------------------------------- |
| `/usr/bin/Xtigervnc`      | all 5 services                                     | `which Xtigervnc` non-empty      |
| `/usr/bin/websockify`     | all 5 services                                     | `which websockify` non-empty     |
| `/usr/bin/openbox`        | gnu-radio-vnc + gnss-sdr-vnc                       | `which openbox` non-empty        |
| `/etc/xdg/openbox/rc.xml` | gnss-sdr-vnc (system-default fallback)             | `[ -f /etc/xdg/openbox/rc.xml ]` |
| `/usr/bin/xdotool`        | sparrow + sdrpp + wireshark-vnc (window placement) | `which xdotool` non-empty        |

Missing dependencies should surface a clear "install <package>" message to the operator, not a cryptic spawn failure.

### Migration status (2026-05-27)

| Service       | Current display / vncPort / wsPort | Canonical               | Δ                                       |
| ------------- | ---------------------------------- | ----------------------- | --------------------------------------- |
| gnu-radio-vnc | `:95` / `5995` / `6084`            | `:99` / `5999` / `6084` | display + vncPort change; wsPort stable |
| sparrow       | `:98` / `5998` / `6081`            | `:95` / `5995` / `6080` | **TRIPLE collision** — all three change |
| wireshark-vnc | `:96` / `5996` / `6083`            | `:96` / `5996` / `6081` | wsPort only                             |
| sdrpp         | `:97` / `5997` / `6082`            | `:97` / `5997` / `6082` | no change                               |
| gnss-sdr-vnc  | `:98` / `5998` / `6083`            | `:98` / `5998` / `6083` | no change                               |

Collisions in the CURRENT (pre-migration) state:

- **sparrow vs gnss-sdr-vnc**: both claim display `:98` AND `vncPort 5998` (sparrow-vnc-types.ts:11+14 vs gnss-sdr-vnc-types.ts:25+28). Two tools cannot run simultaneously.
- **sparrow blocks wireshark target**: sparrow currently holds `wsPort 6081` — the canonical wsPort that wireshark needs to move to.
- **gnu-radio vs canonical sparrow**: gnu-radio currently sits on the slot canonical sparrow wants (`:95/5995`), so gnu-radio must vacate before sparrow takes it.

### Migration order (mandatory — server-side, single PR per CLAUDE.md surgical-changes rule)

The renumbering is internally ordered to avoid transient port collisions during the PR's own server restart cycle:

1. **gnu-radio-vnc**: `:95/5995` → `:99/5999`. Frees the `:95/5995` slot for sparrow.
2. **sparrow**: `:98/5998/6081` → `:95/5995/6080`. Frees `:98/5998` for gnss-sdr, frees `6081` for wireshark.
3. **wireshark-vnc**: `wsPort 6083` → `6081`. Fills sparrow's vacated wsPort.

Frontend iframe URLs are server-driven via `vnc-tool-view-helpers.ts:buildWsUrl(wsPort, wsPath)` consuming the control endpoint's `wsPort` field — no hardcoded ports in any of `GnssSdrView`, `GnuRadioView`, `WiresharkView`, `SDRppView`, `SparrowView`. The migration ships server-only constants; the frontend picks up the new wsPort from the next `status`/`start` response automatically.

Migration to `getVncAllocation` + `reapPriorVncStack` is in-flight (task P3c). Backwards-compat shim NOT used per CLAUDE.md surgical-changes rule.

## Consequences

**Positive**

- Adding a sixth VNC tool requires only adding a row to `VNC_TOOL_ALLOCATION` — collision is caught at compile time (typesafe `VncToolId`) and at test time (uniqueness assertions in `port-allocation.test.ts`).
- Stack-leak loophole closed — clicking Start on a tool whose prior stack crashed half-way will now reap the orphans before respawn.
- Frontend iframe URL contract is centralized to the wsPort column of the allocation table.

**Negative / trade-offs**

- Renumbering gnu-radio (`:95` → `:99`) + sparrow (`:98` → `:95`) + wireshark wsPort (`6083` → `6081`) is a coordinated change across server + frontend. Mitigated by single-PR strategy + sentrux gating.
- Five services \* three constants = 15 call-site updates for the migration. Mechanical but spans five files.
- Display `:99` ceiling — sixth VNC tool requires X11 host audit.

## Status

Accepted. Companion to ADR 0004 (Hardware Resource Manager). Migration tracked as task P3c in the gnss-sdr-vnc architecture audit.

## Related

- ADR 0004 — Hardware Resource Manager (cooperative B205 preempt — the sister change)
- Plan: `~/.claude/plans/breezy-seeking-seahorse.md`
- `src/lib/server/services/vnc-common/spawn-helpers.ts` — shared spawn primitives
- `src/lib/server/services/vnc-common/port-allocation.ts` — allocation registry
- `src/lib/server/services/vnc-common/stack-leak-guard.ts` — `reapPriorVncStack`
- `src/lib/server/services/gnu-radio-vnc/etc/openbox-rc.xml` — reference openbox config
- Openbox upstream: https://github.com/danakj/openbox (GPL-2.0-or-later, Jetson uses distro `/usr/bin/openbox` package)
- noVNC upstream: https://github.com/novnc/noVNC (Apache-2.0)
- websockify upstream: https://github.com/novnc/websockify (LGPL-3.0)
- TigerVNC upstream: https://github.com/TigerVNC/tigervnc
