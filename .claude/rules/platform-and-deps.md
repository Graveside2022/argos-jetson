# Platform Constraints, Git Workflow, Dependencies

Loaded into every session (no `paths:` — these constraints apply to every interaction with the repo).

## Platform constraints

- **Primary**: Raspberry Pi 5 (8 GB, ARM Cortex-A76, Kali). **Active port** (`install/jetson-port`): NVIDIA Jetson AGX Orin, Ubuntu 22.04 aarch64. Jetson deltas in `jetson-port-notes.md` (CPU temp via `/sys/class/thermal/thermal_zone*/temp` first; HDMI needs `modprobe nvidia-drm`; TigerVNC patched for snap chromium).
- **OOM risk**: `svelte-check` ~650 MB — never concurrent. `git-quality-gate.sh` runs typecheck pre-commit.
- **Perf budgets**: WS msg <16 ms, initial load <3 s, <200 MB heap, <15 % CPU. Prefer WS over polling.
- **Native execution**: not Dockerised. `src/lib/server/exec.ts` `execFileAsync()` — no shell, argument arrays only.

## Git workflow

- Branch: `feature/NNN-feature-name` or `NNN-feature-name`.
- Commit format: `type(scope): TXXX — description`. One commit per task. Subject lowercase (commitlint enforced).
- Forbidden: WIP commits, mega commits, generic messages, force-push.
- Spec-kit: `spec.md` → `plan.md` → `tasks.md` in `specs/NNN-*/`. CLAUDE.md auto-update is BLOCKED by the SKIP AUTO-UPDATE marker in CLAUDE.md.

## Dependencies

No `npm install` without user approval. Pin exact versions. No ORMs, no CSS frameworks beyond Tailwind, no Redux/Zustand/lodash.

**Native addons stay in `dependencies`, NOT `devDependencies`** — `better-sqlite3`, `node-pty`. `@sveltejs/adapter-node` externalises only `dependencies`; anything in `devDependencies` gets bundled into the ESM server chunk and breaks native addons that need CJS globals (`__filename`, `__dirname`). Symptom: `ReferenceError: __filename is not defined` at server startup.
