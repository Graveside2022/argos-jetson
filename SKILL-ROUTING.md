# SKILL-ROUTING — which tessl skill for which situation

Decision reference for the 13 tessl skills installed for the Argos v1 audit + ongoing work. **Before planning or doing any code task, match the work to a skill below and invoke it via the Skill tool.** Same discipline as the MCP-PREFLIGHT walk: route deliberately, don't guess. Skills are _guidance/knowledge overlays_ — they tell you what good looks like; the measurement engines are native MCP (sentrux / codegraph / chrome-devtools+Lighthouse / CodeQL / Sentry).

All 13 are quality-gated (≥75%, prefer 85/90), security-Passed, non-thin-wrapper. Bar + provenance live in the `project_v1_audit_skill_toolkit` memory.

## Quick trigger map

| Situation / file pattern                                                              | Skill                        | Skill tool name                       |
| ------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------- |
| Writing/reviewing ANY code for security (pre-write, secure-by-default)                | software-security (cisco)    | `tessl__software-security`            |
| A confirmed vuln finding (CWE + location) → emit the fix                              | patch-advisor                | `tessl__patch-advisor`                |
| `better-sqlite3` / `.db` / pragmas / migrations / SQLITE_BUSY / slow query data-layer | sqlite-node-best-practices   | `tessl__sqlite-node-best-practices`   |
| `ws`/SSE/`EventSource` — transport choice, reconnect, heartbeat, backpressure         | realtime-web-patterns        | `tessl__realtime-web-patterns`        |
| Server call to DB/API/cache/3rd-party — timeout/fallback/retry/circuit-breaker        | graceful-degradation         | `tessl__graceful-degradation`         |
| Component that fetches/displays data — loading/error/empty states, boundaries         | frontend-error-handling      | `tessl__frontend-error-handling`      |
| Reasoning about runtime errors (null-deref, OOB, overflow, div-by-zero) on a function | abstract-state-analyzer      | `tessl__abstract-state-analyzer`      |
| After every edit — run lint/tsc/audit gate                                            | lint-and-validate            | `tessl__lint-and-validate`            |
| Authoring TS/JS — class-vs-fn, helper-vs-inline, error shape, type-vs-interface       | simple-typescript            | `tessl__simple-typescript`            |
| HTTP endpoint/page perf — pagination, N+1, compression, bundle, images                | web-performance              | `tessl__web-performance`              |
| Any UI component — semantic HTML, ARIA, keyboard, focus, live regions, contrast       | web-accessibility-essentials | `tessl__web-accessibility-essentials` |
| Session lifecycle — cookies, token rotation, server-side verify (SSR)                 | ssr-auth-session-management  | `tessl__ssr-auth-session-management`  |
| Protecting state-changing endpoints — CSRF token, SameSite, Origin check              | csrf-protection              | `tessl__csrf-protection`              |

## Disambiguation — the decisive splits

**software-security vs patch-advisor** (same CodeGuard corpus, different phase): no finding yet, writing/reviewing → **software-security (PREVENT)**. Have a CWE + location, want the minimal fix diff → **patch-advisor (REMEDIATE)**. Neither subsumes the other.

**software-security vs ssr-auth-session-management** (auth): "is my auth code secure?" (principles: no hardcoded creds, strong crypto) → **software-security**. "Wire SSR session cookies/rotation" → **ssr-auth** — but ssr-auth is **Supabase-coupled** (depends on `@supabase/ssr` + PKCE). Argos auth is **custom middleware**, so **harvest ssr-auth's patterns** (httpOnly/secure/sameSite cookie hygiene, `getUser()`-style verify-every-request, atomic token rotation, 401 route-guard) — do **not** invoke it as a drop-in.

**ssr-auth vs csrf-protection** (complementary, overlap = SameSite flag only): establishing/refreshing/verifying _who you are_ → **ssr-auth**. Preventing forged state-changing requests on an existing session → **csrf-protection**. A full auth feature needs both. (csrf-protection itself: auth ≠ CSRF defense.)

**abstract-state-analyzer vs lint-and-validate** (reason vs run): if `tsc`/eslint can decide it → **lint-and-validate** (cheap, deterministic, run after every edit — ALWAYS first). If it needs tracking value-ranges/null-ness across control flow (types pass but runtime can still throw) → **abstract-state-analyzer**, on a _specific suspect function_, never repo-wide, never as a substitute for the gate.

**graceful-degradation vs frontend-error-handling** (call-site vs screen): the code _making_ the external call (`+server.ts`, `load`, `ws` handler) — timeouts/retries/circuit-breakers/partial responses → **graceful-degradation**. The component _displaying_ the result — loading/error/empty/toast/rollback → **frontend-error-handling**. Both mention retry/backoff: server transient-retry = graceful-degradation; client refetch-on-button = frontend-error-handling.

**realtime-web-patterns vs graceful-degradation** (persistent vs one-shot): dead/flapping _long-lived_ connection (WS/SSE reconnect, heartbeat, backpressure, WS→polling fallback) → **realtime-web-patterns** (self-contained, no second skill needed). Flaky _one-shot_ dependency (HTTP/DB/3rd-party call) → **graceful-degradation**.

**web-performance vs realtime-web-patterns** (throughput vs connection-health): make an HTTP endpoint fast/cheap (pagination, compression, N+1) → **web-performance**. Pick/tune a transport or keep a live WS/SSE healthy → **realtime-web-patterns**.

**web-performance vs sqlite-node-best-practices** (access-pattern vs engine): designing the API/endpoint ("paginated? N+1?") → **web-performance**. Writing the actual `better-sqlite3` layer (pragmas, prepared statements, transactions, schema DDL) → **sqlite-node-best-practices**. FK-index advice is in both — sqlite's is authoritative (SQLite doesn't auto-index FKs).

**simple-typescript vs lint-and-validate** (taste vs mechanics): judgment tools can't decide (class vs fn, inline vs extract, error shape) → **simple-typescript**, while authoring. Binary pass/fail (format, unused, type errors, audit) → **lint-and-validate**, after. simple-typescript's tagged-union _return shape_ vs graceful-degradation's fallback _behavior_ are complementary (the type vs what to do on failure).

**No skill fully subsumes another** — each owns a distinct axis. Closest kin is software-security ⊃ patch-advisor (shared corpus, prevent-vs-remediate phases) — keep both.

## Per-skill cards (condensed)

### software-security (cisco, 84%) — security PREVENT

Broad secure-coding guardrail (Project CodeGuard) applied while writing/reviewing. Covers: no hardcoded creds, modern crypto, cert validation, SQLi→parameterized, per-language rules, 3-phase pre/secure/post workflow. Not: remediating a found CWE, framework auth wiring, CSRF mechanics. Stack: strong, language-agnostic (Python-leaning examples).

### patch-advisor (santosomar, 92%) — security REMEDIATE

CWE→CodeGuard-rule→fix dispatch; emits minimal diff + rule ID + test-plan line for an already-located finding. Table covers CWE-89/78/79/502/611/22/798/327/862. Not: detection, framework wiring. Stack: language-agnostic; CWE-862 (authz) maps to Argos custom middleware, CWE-89 to better-sqlite3.

### sqlite-node-best-practices (tessl-labs, 98%) — DB layer

`better-sqlite3` production patterns: WAL/foreign_keys/busy_timeout/synchronous pragmas, single shared connection + graceful `db.close()`, STRICT tables, sequential migrations w/ `_migrations`, FK indexing (not auto-indexed!), `db.transaction()` + bulk-insert, prepared-statement caching, `:memory:` test DB. Not: async `sqlite3`, Postgres/MySQL, ORMs, EXPLAIN-plan reading. Stack: excellent (Argos runs better-sqlite3); wire `db.close()` into prod-server shutdown not Express.

### realtime-web-patterns (tessl-labs, 98%) — WS/SSE reliability

Transport decision matrix; SSE (event IDs, Last-Event-ID replay, heartbeat); WS reconnection (backoff+jitter+cap+dispose guard), ping/pong dead-conn detection, backpressure (`bufferedAmount`), message ordering/dedup, connection-state UI, WS→polling degradation, state recovery on reconnect. Not: event source/business logic, broker infra (Redis/Kafka), horizontal scaling, SvelteKit SSE wiring. Stack: strong (Argos uses `ws`+SSE); raw-WS §4/§6/§7 + SSE §2 are portable; React hook §5 + Socket.IO §3 need translation to Svelte/raw-ws.

### graceful-degradation (tessl-labs, 90%) — server resilience

Every external call: timeout (`AbortSignal.timeout`, DB pool/`busy_timeout`), fallback (stale cache/default/`Promise.allSettled` partial), retry (exp backoff+jitter, transient-only), circuit breaker per dependency, per-dep isolation, structured failure logging. Not: UI rendering, static bug-finding, lint/types. Stack: strong, Node/TS-first; applies to `+server.ts`, `ws` handlers, DB access.

### frontend-error-handling (tessl-labs, 84%) — UI states ⚠️ React-framed

Four states (loading/error/empty/success), fetch wrapper (network+HTTP+parse), error boundaries, global `window`/`unhandledrejection` handlers, form validation + `role="alert"`, optimistic rollback, client retry, message mapping, toast vs page. Not: server resilience, static analysis, lint. Stack: **principles port to Svelte 5 runes + `<svelte:boundary>`, but code samples are React/vanilla — translate, don't paste**. Route "report to error service" → Sentry (already wired).

### abstract-state-analyzer (ArabelaTso, 92%) — runtime-error reasoning

Abstract interpretation by reasoning (interval/sign/null/type domains) to flag OOB, null-deref, div-by-zero, overflow, type-inconsistency without executing. Per-operation: location + abstract state + severity + fix. Not: running tools, resilience, UI, whole-repo sweeps. Stack: good, has explicit JS section; reasoning-based (model-dependent, not an AST engine) — pairs with `tsc`, doesn't replace it.

### lint-and-validate (jbvc, 89%) — mechanical gate

Run after every edit: Node/TS `eslint --fix` + `tsc --noEmit` + `npm audit --audit-level=high` (Python: ruff/bandit/mypy); write→audit→analyze→fix loop; ships `lint_runner.py`/`type_coverage.py` (audited safe — list-arg subprocess, no shell/net/cred). Not: deciding what code should look like, runtime reasoning beyond configured tools. Stack: strong; **defer to project `npm run verify` / RTK wrapper rather than raw commands**.

### simple-typescript (idrevnii, 88%) — authoring taste

Direct/functional style: avoid needless classes/factories/wrappers, inline trivial helpers, extract only real domain concepts; `type` by default (`interface` for extensible public contracts); `schemas.ts`/`types.ts` placement; tagged-union recoverable errors (throw only for programmer errors, never bare null); validate untrusted data at boundaries. Not: running tools, bug-finding, resilience, UI. Stack: strong overlay for all Argos TS; pairs with karpathy-guidelines (global).

### web-performance (tessl-labs, 77%) — HTTP/endpoint perf ⚠️ partly React-framed

API pagination, N+1 prevention + FK indexes, gzip/brotli compression, route code-splitting, image optimization (lazy/srcset/dims/WebP), bundle hygiene (no barrels, tree-shake), app caching, async side-effects, resource cleanup, Web Vitals. Not: DB internals (→sqlite tile), HTTP cache headers, React memo detail, CDN/infra. Stack: code-splitting/re-render sections are React/Next — under SvelteKit routing/splitting is automatic. High-value for Argos: pagination, N+1/FK indexes, compression, bundle hygiene, cleanup. **Perf is best MEASURED via native chrome-devtools + Lighthouse; this skill is the guidance layer.**

### web-accessibility-essentials (tessl-labs, 90%) — a11y

Semantic landmarks + skip link + heading hierarchy, forms (label/aria-required/invalid/describedby/role=alert), button-vs-link, icon `aria-label`, image alt, keyboard nav (Tab/Enter/Space/Esc, `:focus-visible`), modals (role=dialog/focus-trap/Esc/return-focus), live regions (polite/assertive/role=status), tables (caption/th scope), contrast (4.5:1, never color-alone). Not: automated a11y CI (axe/Lighthouse runs), WCAG audit reports, complex ARIA widgets, i18n. Stack: HTML/ARIA carries to Svelte 5 unchanged; for Argos's map/SDR dashboard the live-regions/keyboard/modal/button-label/contrast sections matter most (form bulk is lower-frequency).

### ssr-auth-session-management (g14wxz, 94%) — session lifecycle ⚠️ Supabase-coupled

SSR session: `AUTH_COOKIE_OPTIONS` (httpOnly/secure/sameSite:lax), `@supabase/ssr` setup, `getUser()` JWT-verify every request (never bare `getSession()`), atomic access+refresh rotation, 401 route-guard. Not: non-Supabase auth (hard-coupled to `@supabase/ssr` + PKCE), CSRF mechanics, login UI. Stack: **weakest fit — Argos auth is custom, not Supabase. Harvest the patterns (cookie hygiene, verify-every-request, rotation, 401 guard); do not invoke as drop-in.**

### csrf-protection (secondsky, 89%) — request-forgery defense ⚠️ Express-framed

Synchronizer token (server-validated hidden field), double-submit cookie, SameSite; token gen (`crypto.randomBytes`) + `timingSafeEqual`; Origin/Referer validation, ~1h expiration, never-GET-for-mutations, layered defense. Not: authentication itself, session rotation, non-CSRF vulns. Stack: Express-coded — SvelteKit has built-in form-action CSRF + `csrf.checkOrigin`; transferable bit for Argos `ws` = **Origin-header validation on upgrade**.

## Argos-specific caveats (apply to all)

- **Svelte 5, not React**: frontend-error-handling, web-performance (re-render), realtime (client hook) ship React/JSX — translate to runes / `<svelte:boundary>`, never paste.
- **Custom auth, not Supabase**: ssr-auth patterns only, not its `@supabase/ssr` machinery.
- **Sentry is wired**: route any "report to error tracking" to Sentry.
- **RTK + `npm run verify`**: lint-and-validate defers to the project wrapper, not raw shell.
- **Perf measurement is native**: chrome-devtools/Lighthouse measure; web-performance only guides.
- **Out of scope**: Rust tactical (blue-dragon) — these skills are JS/TS/web; use cargo clippy/audit for that.

## Ruflo skill catalog (2026-05-26 — full enumeration with honesty tags)

**106 ruflo skill cards** across 32 ruflo plugins are installed at user scope (full doc in [`RUFLO.md`](./RUFLO.md)). Counts below replace the earlier "~50" estimate. **Each skill card is a markdown doc, not an executor.** Whether the work behind the doc actually runs depends on the backing MCP tool — classified per [RUFLO.md](./RUFLO.md) + roman-rr audit + Phase 4 demo.

### Tag legend

| Tag | Meaning |
|---|---|
| ✅ **REAL** | Real executor (binary / MCP tool / file I/O / session work). Safe to invoke. |
| ⚠️ **STUB** | Bookkeeping only — no executor. Per RUFLO.md audit theater list. Use native alternative. |
| 📝 **GUIDANCE** | Methodology doc only — relies on you doing the work in the Claude session. |
| 🎯 **DOMAIN** | Real but domain-specific (trading / IoT / market data) — out of scope for Argos SDR. |
| 📦 **DEPRECATED** | Marked deprecated by ruflo upstream. |

**Tally**: 69 REAL · 16 STUB · 4 GUIDANCE · 16 DOMAIN · 1 DEPRECATED · **106 total**.

### Skill scan order — RUFLO PRIMARY, TESSL COMBINATION (INVERTED 2026-05-26)

Per user directive 2026-05-26 (post PR #251 + #252), the prior tessl-first scan order is INVERTED. All Argos tasks route through ruflo FIRST. Tessl skills layer on TOP as combinations, NOT as primary or alternative scan.

Apply BEFORE running `mcp__tessl__search` or installing new tiles:

1. **Ruflo memory recall** — `mcp__ruflo__memory_search` (namespace=`argos-decisions` + `argos-phaseN-scope`) + `mcp__ruflo__agentdb_pattern-search` for prior context. "Did we already solve this? What was the methodology last time? What were the findings?"
2. **Ruflo scope store + swarm-vs-single decision** — `mcp__ruflo__memory_store` task scope + goals in `argos-<task-name>-scope` namespace BEFORE any code action. Decide: parallel/swarm? Spawn native `Agent` workers using ruflo's 60+ `subagent_type` labels. Single? Proceed inline.
3. **Ruflo skill match** — scan the per-plugin tables below; skip ⚠️ STUB / 🎯 DOMAIN / 📦 DEPRECATED / 📝 GUIDANCE tags. Invoke matched ruflo skills via `Skill(...)` tool.
4. **Tessl combination layer** — match work to the 13 tessl skills via the trigger map above; invoke as COMBINATION on top of the ruflo flow (e.g. `tessl__sqlite-node-best-practices` invoked INSIDE a ruflo `test-gaps` + `memory_store` flow, not as a parallel scan).
5. **Gap → search** — only if NEITHER catalog covers, run `mcp__tessl__search`.
6. **Gap → install** — only if a relevant new tile surfaces, gate by 5-check safe-install protocol from CLAUDE.md.
7. **Findings persist** — `agentdb_pattern-store` each finding as it lands; `memory_store` decisions/pivots in `argos-decisions`; `agentdb_pattern-store` completion record at task end (score, deferred items, PR number).

See [`RUFLO.md`](./RUFLO.md) §Per-phase ruflo workflow pattern for the full 5-step task lifecycle. Hook `~/.claude/hooks/ruflo-task-routing-gate.sh` mechanically enforces this scan order.

### Per-plugin catalog

#### `ruflo-adr` (4 skills)

_ADR scaffold + index + drift check. Argos already has docs/adr/; useful for next ADRs._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `adr-review` | Review code changes against accepted ADRs for compliance violations |
| ✅ REAL | `adr-create` | Create a new Architecture Decision Record with sequential numbering and AgentDB registration |
| ✅ REAL | `adr-verify` | Read back adr-patterns + adr-edges namespaces, surface dangling refs / supersede cycles / status mismatches; exit 1 on cycles |
| ✅ REAL | `adr-index` | Build or rebuild the ADR index + dependency graph by running scripts/import.mjs (handles v3-style and plugin-style ADR formats; one Bash call vs hundreds of MCP round-trips) |

#### `ruflo-agent` (3 skills)

_ALL STUB per RUFLO.md audit (wasm-agent echoes input; managed-agent bypasses Claude billing). SKIP all 3._

| Tag | Skill | Description |
|---|---|---|
| ⚠️ STUB | `wasm-agent` | Create and manage sandboxed WASM agents for isolated code execution |
| ⚠️ STUB | `wasm-gallery` | Browse, publish, and install WASM agents from the community gallery |
| ⚠️ STUB | `managed-agent` | Run an Anthropic Claude Managed Agent — a cloud agent harness (container + filesystem + tools), the cloud counterpart of the local wasm-agent runtime |

#### `ruflo-agentdb` (2 skills)

_Real HNSW + RaBitQ vector layer. Pairs with memory_store/search._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `agentdb-query` | Query AgentDB through the controller bridge -- semantic routing, hierarchical recall, causal graphs, context synthesis, pattern store/search |
| ✅ REAL | `vector-search` | Vector search via embeddings_* (large-scale HNSW) and ruvllm_hnsw_* (WASM router for ≤11 hot patterns), with RaBitQ 1-bit quantization for 32× memory reduction |

#### `ruflo-aidefence` (2 skills)

_Prompt-injection + PII scanning. Useful for any input touching LLM._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `safety-scan` | Scan inputs for prompt injection, unsafe content, and adversarial attacks using AIDefence |
| ✅ REAL | `pii-detect` | Detect and flag personally identifiable information (PII) in text, code, and configurations |

#### `ruflo-autopilot` (2 skills)

_ALL STUB per RUFLO.md. Use native /loop + ScheduleWakeup instead._

| Tag | Skill | Description |
|---|---|---|
| ⚠️ STUB | `autopilot-predict` | Use learned patterns and current state to predict the optimal next action |
| ⚠️ STUB | `autopilot-loop` | Run an autonomous /loop iteration -- check progress, work on next task, schedule next wake |

#### `ruflo-browser` (9 skills)

_Real Chrome DevTools session/replay. Argos already uses native chrome-devtools MCP — overlap; prefer native._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `browser-form-fill` | Fill a web form by mapping field-name → value, with optional template lookup from browser-templates for known forms |
| ✅ REAL | `browser-login` | Drive an authentication flow once, sanitize cookies through AIDefence, and vault a reusable cookie handle in browser-cookies for future sessions |
| ✅ REAL | `browser-replay` | Replay a recorded session trajectory against the same URL or a mutated variant; uses browser-selectors embedding similarity to recover from DOM drift |
| 📦 DEPRECATED | `browser-scrape` | DEPRECATED in v0.2.0 -- use browser-extract instead; this is a thin shim for backward compatibility, removed in v0.3.0 |
| ✅ REAL | `browser-auth-flow` | Probe a site's authentication flow for redirect leaks, missing CSRF, weak session cookies, and OAuth misconfiguration; produces an auth findings.md |
| ✅ REAL | `browser-extract` | Extract structured data via stored browser-templates or one-shot DOM queries, with mandatory AIDefence PII + prompt-injection gates before content reaches the model |
| ✅ REAL | `browser-record` | Open a named, traced browser session into an RVF cognitive container with a ruvector trajectory recording every action |
| ✅ REAL | `browser-test` | UI test recipe -- composes browser-record (capture) + browser-replay (verify) so every test produces a replayable RVF artifact, not an ephemeral run |
| ✅ REAL | `browser-screenshot-diff` | Visual + DOM diff between two recorded sessions at matching trajectory step ids; used for visual regression and replay verification |

#### `ruflo-core` (4 skills)

_Plugin install + doctor + witness signing. ruflo-doctor useful for diagnosing the daemon._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `discover-plugins` | Discover and recommend ruflo plugins based on your workflow, installed MCP tools, and current task |
| ✅ REAL | `ruflo-doctor` | Run health checks on the Ruflo installation and fix common issues |
| ✅ REAL | `init-project` | Initialize a new Ruflo project with MCP tools, hooks, and agent configuration |
| ✅ REAL | `witness` | Sign, verify, and track fix-marker regressions over time using a deterministic Ed25519 witness manifest. Works in any project — clone the toolkit, run init, register fixes, regen o |

#### `ruflo-cost-tracker` (13 skills)

_Reads real session jsonl + computes token spend. Useful but Argos isn't budget-gated._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `cost-compact-context` | Wrap getTokenOptimizer().getCompactContext() to retrieve compacted ReasoningBank context for cost-analysis queries; report bridge-reported tokensSaved |
| ✅ REAL | `cost-booster-edit` | Apply a simple code transform via agent-booster's WASM engine — sub-millisecond, deterministic, $0 (no LLM call). Companion to cost-booster-route. |
| ✅ REAL | `cost-report` | Generate a cost report showing token usage and USD costs by agent and model |
| ✅ REAL | `cost-optimize` | Analyze token usage patterns and recommend cost optimizations with estimated savings |
| ✅ REAL | `cost-benchmark` | Run the corpus benchmark — booster locally, optional Gemini/Sonnet/Opus baselines — and persist a verifiable measured-vs-claimed table |
| ✅ REAL | `cost-federation` | Consumer-side wiring for ADR-097 Phase 3 federation_spend events — per-peer rolling windows + suspension-threshold check |
| ✅ REAL | `cost-budget-check` | Read accumulated cost-tracking spend + budget config, compute utilization, emit 50/75/90/100% alert ladder |
| ✅ REAL | `cost-conversation` | Per-conversation cost view — list every session in cost-tracking with started-at, message count, top model, and total cost |
| ✅ REAL | `cost-export` | Export cost-tracking telemetry in Prometheus textfile or webhook JSON formats — for external observability (Grafana, Datadog, custom dashboards) |
| ✅ REAL | `cost-booster-route` | Route tasks through hooks_route, partition by Agent Booster availability, and report Tier 1 bypass utilization with $0 cost |
| ✅ REAL | `cost-summary` | Single-shot programmatic dump of all cost data — total spend, per-tier, top session, budget status, federation aggregate. JSON or markdown. |
| ✅ REAL | `cost-track` | Auto-capture per-session token usage from the Claude Code session jsonl and persist to the cost-tracking namespace |
| ✅ REAL | `cost-trend` | Read every docs/benchmarks/runs/*.json and surface drift in win rate, latency, escalation rate, and LLM-baseline cost over time |

#### `ruflo-daa` (2 skills)

_STUB per RUFLO.md (bookkeeping). SKIP._

| Tag | Skill | Description |
|---|---|---|
| ⚠️ STUB | `cognitive-pattern` | Define and manage cognitive patterns for agent reasoning and decision-making |
| ⚠️ STUB | `daa-agent` | Create and adapt Dynamic Agentic Architecture agents that learn and evolve |

#### `ruflo-ddd` (3 skills)

_Bounded-context scaffold. Argos isn't DDD-structured; low fit._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `ddd-context` | Create and manage a DDD bounded context with standard directory structure |
| ✅ REAL | `ddd-aggregate` | Scaffold an aggregate root with entity, value objects, repository interface, domain events, and test stubs |
| ✅ REAL | `ddd-validate` | Validate domain boundaries -- detect cross-context import violations and aggregate invariant issues |

#### `ruflo-docs` (2 skills)

_doc-gen + api-docs. Could complement Argos's manual docs._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `doc-gen` | Generate and maintain documentation with drift detection |
| ✅ REAL | `api-docs` | Generate API documentation from source code with JSDoc and OpenAPI support |

#### `ruflo-federation` (3 skills)

_All STUB without peers configured (RUFLO.md: bookkeeping JSON, no live coordination)._

| Tag | Skill | Description |
|---|---|---|
| ⚠️ STUB | `federation-status` | Show federation health — peers, sessions, trust levels, and message metrics |
| ⚠️ STUB | `federation-audit` | Query federation audit logs with compliance filtering |
| ⚠️ STUB | `federation-init` | Initialize federation on this node — generate keypair and configure peers |

#### `ruflo-goals` (5 skills)

_Long-horizon objectives + GOAP planning + deep research synthesis. Useful for multi-session work._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `horizon-track` | Track long-horizon objectives across multiple sessions with milestone checkpoints, progress persistence, and drift detection |
| ✅ REAL | `dossier-collect` | Build a graph-structured dossier on a seed entity via parallel fan-out + recursive expansion across web, memory, knowledge-graph, codebase, ADR index, and git intel |
| ✅ REAL | `research-synthesize` | Synthesize research findings from memory into structured reports with evidence grading, contradiction resolution, and actionable recommendations |
| ✅ REAL | `goal-plan` | Create and execute Goal-Oriented Action Plans (GOAP) with precondition analysis, cost optimization, and adaptive replanning |
| ✅ REAL | `deep-research` | Orchestrate multi-phase deep research with web search, memory retrieval, pattern matching, and synthesis into structured findings |

#### `ruflo-intelligence` (3 skills)

_3-tier model routing real; neural-train STUB (hardcoded += 100 per RUFLO.md)._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `intelligence-route` | Route tasks via the 3-tier model selector and learned patterns; emits a routing rationale via hooks_explain |
| ✅ REAL | `intelligence-transfer` | Publish or fetch learned patterns across projects via IPFS (Pinata) -- the cross-project pattern transfer that hooks_transfer enables |
| ⚠️ STUB | `neural-train` | Train SONA + MicroLoRA neural patterns from successful task completions; runs the DISTILL + CONSOLIDATE phases of the 4-step pipeline |

#### `ruflo-iot-cognitum` (5 skills)

_DOMAIN — Cognitum Seed IoT devices. Argos = Jetson, not Cognitum. SKIP all 5._

| Tag | Skill | Description |
|---|---|---|
| 🎯 DOMAIN | `iot-witness-verify` | Verify witness chain integrity and detect provenance gaps |
| 🎯 DOMAIN | `iot-register` | Register a Cognitum Seed device by endpoint and establish agent bridge |
| 🎯 DOMAIN | `iot-firmware` | Orchestrate firmware rollouts with canary deployment and anomaly-gated advancement |
| 🎯 DOMAIN | `iot-fleet` | Create and manage Cognitum Seed device fleets with firmware policies |
| 🎯 DOMAIN | `iot-anomalies` | Detect and classify telemetry anomalies on Cognitum Seed devices |

#### `ruflo-jujutsu` (2 skills)

_Git workflow + diff risk-scoring. Useful for PR review prep._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `git-workflow` | Advanced git workflows with branch management, conflict resolution, and PR lifecycle |
| ✅ REAL | `diff-analyze` | Analyze git diffs for risk scoring, reviewer recommendations, and change classification |

#### `ruflo-knowledge-graph` (2 skills)

_Entity/relation extraction. Could index Argos source as a KG._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `kg-extract` | Extract entities and relations from source files to build a knowledge graph |
| ✅ REAL | `kg-traverse` | Pathfinder traversal of the knowledge graph starting from a seed entity |

#### `ruflo-loop-workers` (2 skills)

_Thin wrappers over native /loop + CronCreate. Use native directly._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `loop-worker` | Run Ruflo background workers using Claude Code native /loop scheduling |
| ✅ REAL | `cron-schedule` | Schedule persistent background workers via CronCreate |

#### `ruflo-market-data` (2 skills)

_DOMAIN — OHLCV/candlestick. Not relevant to Argos. SKIP all 2._

| Tag | Skill | Description |
|---|---|---|
| 🎯 DOMAIN | `market-pattern` | Detect and classify candlestick patterns from ingested OHLCV data |
| 🎯 DOMAIN | `market-ingest` | Ingest and normalize market data into OHLCV vectors with HNSW indexing |

#### `ruflo-migrations` (2 skills)

_SQL migration scaffold. Argos uses better-sqlite3 + custom migration runner — low fit but harvestable._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `migrate-validate` | Validate pending migrations for foreign key consistency, rollback safety, and best practices |
| ✅ REAL | `migrate-create` | Create a new sequentially numbered database migration with up/down SQL files |

#### `ruflo-neural-trader` (9 skills)

_DOMAIN — trading signals. Not relevant to Argos SDR. SKIP all 9._

| Tag | Skill | Description |
|---|---|---|
| 🎯 DOMAIN | `trader-regime` | Detect current market regime using npx neural-trader — bull/bear/ranging/volatile classification with recommended strategy |
| 🎯 DOMAIN | `trader-explain` | Regulator-grade feature attribution for any LSTM/Transformer signal — single-entry PageRank ranks the top-K features that drove the prediction (ADR-126 Phase 6, ADR-123 single-entr |
| 🎯 DOMAIN | `trader-signal` | Generate trading signals using npx neural-trader anomaly detection engine with Z-score scoring and neural prediction |
| 🎯 DOMAIN | `trader-portfolio-cg` | Mean-variance portfolio optimization via Conjugate Gradient — 40-60× faster than the legacy Neumann path (ADR-126 Phase 3, ADR-123 Wedge 8) |
| 🎯 DOMAIN | `trader-risk` | Assess portfolio risk using npx neural-trader — VaR, CVaR, Sharpe, position sizing, circuit breaker status |
| 🎯 DOMAIN | `trader-train` | Train neural models (LSTM, Transformer, N-BEATS) on market data using npx neural-trader with confidence intervals |
| 🎯 DOMAIN | `trader-cloud-backtest` | Run a heavy neural-trader job (long walk-forward, big Monte-Carlo, parameter sweep, model training) on the Anthropic Managed Agent cloud runtime instead of locally |
| 🎯 DOMAIN | `trader-portfolio` | Optimize portfolio allocation using npx neural-trader mean-variance engine with risk constraints and rebalancing plan |
| 🎯 DOMAIN | `trader-backtest` | Run a historical backtest using npx neural-trader with Rust/NAPI engine (8-19x faster) and walk-forward validation; Ed25519-sign the result for paper→live tamper evidence (ADR-126  |

#### `ruflo-observability` (2 skills)

_Span/metric collection. Argos has OTel wired directly — overlap; prefer native._

| Tag | Skill | Description |
|---|---|---|
| ⚠️ STUB | `observe-trace` | Trace agent execution by collecting spans and building a trace tree for a task |
| ⚠️ STUB | `observe-metrics` | Aggregate and display system metrics with anomaly detection for a time period |

#### `ruflo-plugin-creator` (2 skills)

_Plugin scaffold + validate. Useful if building a Claude Code plugin._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `create-plugin` | Scaffold a new Claude Code plugin with proper directory structure, plugin.json, skills, commands, and agents |
| ✅ REAL | `validate-plugin` | Validate a Claude Code plugin structure, frontmatter, and MCP tool references |

#### `ruflo-rag-memory` (2 skills)

_Real HNSW + ONNX embeddings. Top-tier ruflo capability. USE._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `memory-search` | SOTA semantic search — hybrid (sparse+dense), Graph RAG multi-hop, MMR diversity reranking, recency weighting |
| ✅ REAL | `memory-bridge` | Bridge Claude Code auto-memory into AgentDB with ONNX embeddings, deduplicate, and enable unified cross-project search |

#### `ruflo-ruvector` (4 skills)

_npx ruvector binary (ONNX 384-dim). Real but separate from memory_store backing._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `vector-embed` | Generate embeddings via npx ruvector@0.2.25 embed text (ONNX all-MiniLM-L6-v2, 384-dim), normalize, and store in HNSW index |
| ✅ REAL | `vector-setup` | First-run setup for ruvector@0.2.25 — installs ONNX/Brain/SONA add-ons, registers the MCP server, and verifies the install via `doctor` |
| ✅ REAL | `vector-hyperbolic` | Embed hierarchical data via npx ruvector@0.2.25 embed text and project into the Poincare ball in user code (no --model poincare flag in 0.2.25) |
| ✅ REAL | `vector-cluster` | Cluster code by graph community detection via npx ruvector@0.2.25 hooks graph-cluster (spectral / Louvain) |

#### `ruflo-ruvllm` (2 skills)

_Local LLM inference + chat formatting. Optional alternative to Anthropic API._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `llm-config` | Configure RuVLLM local inference with model selection, MicroLoRA fine-tuning, and SONA adaptation |
| ✅ REAL | `chat-format` | Format prompts for different LLM providers with chat templates and HNSW-powered context retrieval |

#### `ruflo-rvf` (2 skills)

_Session-snapshot persistence. Could complement memory_store for full-state recall._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `session-persist` | Persist and restore agent sessions across conversations with state snapshots |
| ✅ REAL | `rvf-manage` | Manage RVF (Ruflo Vector Format) files for portable agent memory and cross-platform transfer |

#### `ruflo-security-audit` (2 skills)

_CVE/dep scan + general scan. Argos already has CodeQL + Dependabot wired — overlap._

| Tag | Skill | Description |
|---|---|---|
| ✅ REAL | `dependency-check` | Scan project dependencies for known vulnerabilities and CVEs |
| ✅ REAL | `security-scan` | Run full security scans on the codebase using Ruflo security tools |

#### `ruflo-sparc` (3 skills)

_GUIDANCE — methodology docs (specification → architecture → refinement). Not executors._

| Tag | Skill | Description |
|---|---|---|
| 📝 GUIDANCE | `sparc-refine` | Run the SPARC Refinement and Completion phases — review code, improve test coverage, validate against specification, and generate documentation |
| 📝 GUIDANCE | `sparc-spec` | Run the SPARC Specification phase — gather requirements, define acceptance criteria, identify constraints, and store the spec in memory |
| 📝 GUIDANCE | `sparc-implement` | Run the SPARC Architecture and Implementation phases — design module boundaries, write pseudocode, implement code, and run tests |

#### `ruflo-swarm` (2 skills)

_swarm-init = STUB. monitor-stream = real Monitor wrapper. Mostly skip._

| Tag | Skill | Description |
|---|---|---|
| ⚠️ STUB | `swarm-init` | Initialize a multi-agent swarm with anti-drift configuration |
| ✅ REAL | `monitor-stream` | Stream live swarm events using the Monitor tool for real-time observability |

#### `ruflo-testgen` (2 skills)

_tdd-workflow = GUIDANCE. test-gaps = real coverage analysis. Useful for ongoing test work._

| Tag | Skill | Description |
|---|---|---|
| 📝 GUIDANCE | `tdd-workflow` | TDD London School workflow -- mock-first, outside-in test development |
| ✅ REAL | `test-gaps` | Detect missing test coverage and generate test suggestions |

#### `ruflo-workflows` (2 skills)

_STUB without executor backing. SKIP._

| Tag | Skill | Description |
|---|---|---|
| ⚠️ STUB | `workflow-create` | Create reusable workflow templates with steps, conditions, and parallel execution |
| ⚠️ STUB | `workflow-run` | Execute, pause, resume, and cancel running workflows |

### Argos-relevance summary

**HIGH-fit plugins** (real executors + Argos-applicable work): `ruflo-rag-memory`, `ruflo-agentdb`, `ruflo-ruvector`, `ruflo-cost-tracker`, `ruflo-adr`, `ruflo-jujutsu`, `ruflo-knowledge-graph`, `ruflo-plugin-creator`, `ruflo-goals`, `ruflo-testgen` (test-gaps), `ruflo-aidefence`, `ruflo-rvf`, `ruflo-core`.

**MEDIUM-fit / overlap with native** (prefer native MCP): `ruflo-browser` (use native chrome-devtools), `ruflo-observability` (use native OTel), `ruflo-security-audit` (use CodeQL + Dependabot), `ruflo-loop-workers` (use native /loop + CronCreate), `ruflo-migrations` (Argos has custom runner), `ruflo-docs`, `ruflo-ddd`, `ruflo-intelligence`, `ruflo-ruvllm`.

**SKIP entirely** (STUB or DOMAIN per RUFLO.md): `ruflo-agent` (wasm-agent echoes, managed-agent bypasses billing), `ruflo-autopilot`, `ruflo-daa`, `ruflo-federation` (without peers), `ruflo-swarm/swarm-init`, `ruflo-workflows`, `ruflo-intelligence/neural-train`, `ruflo-iot-cognitum` (5 skills), `ruflo-market-data` (2 skills), `ruflo-neural-trader` (9 skills), `ruflo-sparc` (guidance only — execute methodology in session, don't invoke as executor).

### Ruflo ↔ tessl overlap (top pairs)

| Ruflo skill | Tag | Tessl counterpart | When to use which |
|---|---|---|---|
| `ruflo-rag-memory/memory-search` | ✅ | None | UNIQUE — cross-session vector recall. USE. |
| `ruflo-agentdb/vector-search` | ✅ | None | UNIQUE — HNSW + RaBitQ. USE. |
| `ruflo-adr/adr-create` | ✅ | None | UNIQUE — ADR scaffold. USE for new ADRs. |
| `ruflo-testgen/test-gaps` | ✅ | `tessl__lint-and-validate` | ruflo = coverage detection; tessl = lint/tsc/audit gate. Complementary. |
| `ruflo-sparc/sparc-spec` | 📝 | `tessl__simple-typescript` | ruflo = workflow methodology; tessl = code-style preferences. |
| `ruflo-jujutsu/diff-analyze` | ✅ | None | UNIQUE — PR risk-scoring. Optional pre-review. |
| `ruflo-aidefence/pii-detect` | ✅ | `tessl__software-security` | tessl = broad CodeGuard; ruflo = focused PII pattern scan. Stack both. |
| `ruflo-security-audit/dependency-check` | ✅ | None (use CodeQL + Dependabot) | Native CodeQL + Dependabot rule is canonical for Argos. SKIP ruflo dup. |
| `ruflo-browser/browser-record` | ✅ | None (use native chrome-devtools) | Argos already wires native chrome-devtools MCP. Prefer native; skip ruflo overlap. |
| `ruflo-observability/observe-trace` | ⚠️ | None (use native OTel) | Argos has OTel wired at runtime. Skip ruflo. |
| `ruflo-swarm/swarm-init` | ⚠️ | None | STUB. Use native `Agent` tool with `subagent_type` labels. |
| `ruflo-loop-workers/loop-worker` | ✅ | None | Thin wrapper over native /loop. Prefer native /loop directly. |

### Honesty note

The original "~50 ruflo skills" note was wrong — actual is 106 skill cards across 32 plugins. Of those, 69 have real executors, 16 are bookkeeping stubs per RUFLO.md theater list, 16 are domain-specific (trading/IoT/market not relevant to Argos), 4 are pure methodology guidance, and 1 is deprecated. Combined with the 13 tessl skills, the practical Argos-relevant invocation surface is ~50-60 skills — not 119.
