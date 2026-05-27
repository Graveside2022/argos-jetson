# Ruflo skill catalog — per-plugin enumeration

> Extracted from [`SKILL-ROUTING.md`](../SKILL-ROUTING.md) on 2026-05-27 to slim the auto-loaded startup context. The routing logic + trigger map + tessl skill cards + scan order live in the main file; this file is the **reference catalog** loaded on demand.

**106 ruflo skill cards** across 32 ruflo plugins are installed at user scope (full doc in [`../RUFLO.md`](../RUFLO.md)). **Each skill card is a markdown doc, not an executor.** Whether the work behind the doc actually runs depends on the backing MCP tool — classified per [`../RUFLO.md`](../RUFLO.md) + roman-rr audit + Phase 4 demo.

## Tag legend

| Tag               | Meaning                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| ✅ **REAL**       | Real executor (binary / MCP tool / file I/O / session work). Safe to invoke.             |
| ⚠️ **STUB**       | Bookkeeping only — no executor. Per RUFLO.md audit theater list. Use native alternative. |
| 📝 **GUIDANCE**   | Methodology doc only — relies on you doing the work in the Claude session.               |
| 🎯 **DOMAIN**     | Real but domain-specific (trading / IoT / market data) — out of scope for Argos SDR.     |
| 📦 **DEPRECATED** | Marked deprecated by ruflo upstream.                                                     |

**Tally**: 69 REAL · 16 STUB · 4 GUIDANCE · 16 DOMAIN · 1 DEPRECATED · **106 total**.

## Per-plugin catalog

### `ruflo-adr` (4 skills)

_ADR scaffold + index + drift check. Argos already has docs/adr/; useful for next ADRs._

| Tag     | Skill        | Description                                                                                                                                                                   |
| ------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ REAL | `adr-review` | Review code changes against accepted ADRs for compliance violations                                                                                                           |
| ✅ REAL | `adr-create` | Create a new Architecture Decision Record with sequential numbering and AgentDB registration                                                                                  |
| ✅ REAL | `adr-verify` | Read back adr-patterns + adr-edges namespaces, surface dangling refs / supersede cycles / status mismatches; exit 1 on cycles                                                 |
| ✅ REAL | `adr-index`  | Build or rebuild the ADR index + dependency graph by running scripts/import.mjs (handles v3-style and plugin-style ADR formats; one Bash call vs hundreds of MCP round-trips) |

### `ruflo-agent` (3 skills)

_ALL STUB per RUFLO.md audit (wasm-agent echoes input; managed-agent bypasses Claude billing). SKIP all 3._

| Tag     | Skill           | Description                                                                                                                                           |
| ------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⚠️ STUB | `wasm-agent`    | Create and manage sandboxed WASM agents for isolated code execution                                                                                   |
| ⚠️ STUB | `wasm-gallery`  | Browse, publish, and install WASM agents from the community gallery                                                                                   |
| ⚠️ STUB | `managed-agent` | Run an Anthropic Claude Managed Agent — a cloud agent harness (container + filesystem + tools), the cloud counterpart of the local wasm-agent runtime |

### `ruflo-agentdb` (2 skills)

_Real HNSW + RaBitQ vector layer. Pairs with memory_store/search._

| Tag     | Skill           | Description                                                                                                                                                       |
| ------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ REAL | `agentdb-query` | Query AgentDB through the controller bridge -- semantic routing, hierarchical recall, causal graphs, context synthesis, pattern store/search                      |
| ✅ REAL | `vector-search` | Vector search via embeddings*\* (large-scale HNSW) and ruvllm_hnsw*\* (WASM router for ≤11 hot patterns), with RaBitQ 1-bit quantization for 32× memory reduction |

### `ruflo-aidefence` (2 skills)

_Prompt-injection + PII scanning. Useful for any input touching LLM._

| Tag     | Skill         | Description                                                                                 |
| ------- | ------------- | ------------------------------------------------------------------------------------------- |
| ✅ REAL | `safety-scan` | Scan inputs for prompt injection, unsafe content, and adversarial attacks using AIDefence   |
| ✅ REAL | `pii-detect`  | Detect and flag personally identifiable information (PII) in text, code, and configurations |

### `ruflo-autopilot` (2 skills)

_ALL STUB per RUFLO.md. Use native /loop + ScheduleWakeup instead._

| Tag     | Skill               | Description                                                                                |
| ------- | ------------------- | ------------------------------------------------------------------------------------------ |
| ⚠️ STUB | `autopilot-predict` | Use learned patterns and current state to predict the optimal next action                  |
| ⚠️ STUB | `autopilot-loop`    | Run an autonomous /loop iteration -- check progress, work on next task, schedule next wake |

### `ruflo-browser` (9 skills)

_Real Chrome DevTools session/replay. Argos already uses native chrome-devtools MCP — overlap; prefer native._

| Tag           | Skill                     | Description                                                                                                                                                          |
| ------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ REAL       | `browser-form-fill`       | Fill a web form by mapping field-name → value, with optional template lookup from browser-templates for known forms                                                  |
| ✅ REAL       | `browser-login`           | Drive an authentication flow once, sanitize cookies through AIDefence, and vault a reusable cookie handle in browser-cookies for future sessions                     |
| ✅ REAL       | `browser-replay`          | Replay a recorded session trajectory against the same URL or a mutated variant; uses browser-selectors embedding similarity to recover from DOM drift                |
| 📦 DEPRECATED | `browser-scrape`          | DEPRECATED in v0.2.0 -- use browser-extract instead; this is a thin shim for backward compatibility, removed in v0.3.0                                               |
| ✅ REAL       | `browser-auth-flow`       | Probe a site's authentication flow for redirect leaks, missing CSRF, weak session cookies, and OAuth misconfiguration; produces an auth findings.md                  |
| ✅ REAL       | `browser-extract`         | Extract structured data via stored browser-templates or one-shot DOM queries, with mandatory AIDefence PII + prompt-injection gates before content reaches the model |
| ✅ REAL       | `browser-record`          | Open a named, traced browser session into an RVF cognitive container with a ruvector trajectory recording every action                                               |
| ✅ REAL       | `browser-test`            | UI test recipe -- composes browser-record (capture) + browser-replay (verify) so every test produces a replayable RVF artifact, not an ephemeral run                 |
| ✅ REAL       | `browser-screenshot-diff` | Visual + DOM diff between two recorded sessions at matching trajectory step ids; used for visual regression and replay verification                                  |

### `ruflo-core` (4 skills)

_Plugin install + doctor + witness signing. ruflo-doctor useful for diagnosing the daemon._

| Tag     | Skill              | Description                                                                                                                                                                          |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅ REAL | `discover-plugins` | Discover and recommend ruflo plugins based on your workflow, installed MCP tools, and current task                                                                                   |
| ✅ REAL | `ruflo-doctor`     | Run health checks on the Ruflo installation and fix common issues                                                                                                                    |
| ✅ REAL | `init-project`     | Initialize a new Ruflo project with MCP tools, hooks, and agent configuration                                                                                                        |
| ✅ REAL | `witness`          | Sign, verify, and track fix-marker regressions over time using a deterministic Ed25519 witness manifest. Works in any project — clone the toolkit, run init, register fixes, regen o |

### `ruflo-cost-tracker` (13 skills)

_Reads real session jsonl + computes token spend. Useful but Argos isn't budget-gated._

| Tag     | Skill                  | Description                                                                                                                                            |
| ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅ REAL | `cost-compact-context` | Wrap getTokenOptimizer().getCompactContext() to retrieve compacted ReasoningBank context for cost-analysis queries; report bridge-reported tokensSaved |
| ✅ REAL | `cost-booster-edit`    | Apply a simple code transform via agent-booster's WASM engine — sub-millisecond, deterministic, $0 (no LLM call). Companion to cost-booster-route.     |
| ✅ REAL | `cost-report`          | Generate a cost report showing token usage and USD costs by agent and model                                                                            |
| ✅ REAL | `cost-optimize`        | Analyze token usage patterns and recommend cost optimizations with estimated savings                                                                   |
| ✅ REAL | `cost-benchmark`       | Run the corpus benchmark — booster locally, optional Gemini/Sonnet/Opus baselines — and persist a verifiable measured-vs-claimed table                 |
| ✅ REAL | `cost-federation`      | Consumer-side wiring for ADR-097 Phase 3 federation_spend events — per-peer rolling windows + suspension-threshold check                               |
| ✅ REAL | `cost-budget-check`    | Read accumulated cost-tracking spend + budget config, compute utilization, emit 50/75/90/100% alert ladder                                             |
| ✅ REAL | `cost-conversation`    | Per-conversation cost view — list every session in cost-tracking with started-at, message count, top model, and total cost                             |
| ✅ REAL | `cost-export`          | Export cost-tracking telemetry in Prometheus textfile or webhook JSON formats — for external observability (Grafana, Datadog, custom dashboards)       |
| ✅ REAL | `cost-booster-route`   | Route tasks through hooks_route, partition by Agent Booster availability, and report Tier 1 bypass utilization with $0 cost                            |
| ✅ REAL | `cost-summary`         | Single-shot programmatic dump of all cost data — total spend, per-tier, top session, budget status, federation aggregate. JSON or markdown.            |
| ✅ REAL | `cost-track`           | Auto-capture per-session token usage from the Claude Code session jsonl and persist to the cost-tracking namespace                                     |
| ✅ REAL | `cost-trend`           | Read every docs/benchmarks/runs/\*.json and surface drift in win rate, latency, escalation rate, and LLM-baseline cost over time                       |

### `ruflo-daa` (2 skills)

_STUB per RUFLO.md (bookkeeping). SKIP._

| Tag     | Skill               | Description                                                                  |
| ------- | ------------------- | ---------------------------------------------------------------------------- |
| ⚠️ STUB | `cognitive-pattern` | Define and manage cognitive patterns for agent reasoning and decision-making |
| ⚠️ STUB | `daa-agent`         | Create and adapt Dynamic Agentic Architecture agents that learn and evolve   |

### `ruflo-ddd` (3 skills)

_Bounded-context scaffold. Argos isn't DDD-structured; low fit._

| Tag     | Skill           | Description                                                                                                |
| ------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| ✅ REAL | `ddd-context`   | Create and manage a DDD bounded context with standard directory structure                                  |
| ✅ REAL | `ddd-aggregate` | Scaffold an aggregate root with entity, value objects, repository interface, domain events, and test stubs |
| ✅ REAL | `ddd-validate`  | Validate domain boundaries -- detect cross-context import violations and aggregate invariant issues        |

### `ruflo-docs` (2 skills)

_doc-gen + api-docs. Could complement Argos's manual docs._

| Tag     | Skill      | Description                                                                |
| ------- | ---------- | -------------------------------------------------------------------------- |
| ✅ REAL | `doc-gen`  | Generate and maintain documentation with drift detection                   |
| ✅ REAL | `api-docs` | Generate API documentation from source code with JSDoc and OpenAPI support |

### `ruflo-federation` (3 skills)

_All STUB without peers configured (RUFLO.md: bookkeeping JSON, no live coordination)._

| Tag     | Skill               | Description                                                                 |
| ------- | ------------------- | --------------------------------------------------------------------------- |
| ⚠️ STUB | `federation-status` | Show federation health — peers, sessions, trust levels, and message metrics |
| ⚠️ STUB | `federation-audit`  | Query federation audit logs with compliance filtering                       |
| ⚠️ STUB | `federation-init`   | Initialize federation on this node — generate keypair and configure peers   |

### `ruflo-goals` (5 skills)

_Long-horizon objectives + GOAP planning + deep research synthesis. Useful for multi-session work._

| Tag     | Skill                 | Description                                                                                                                                                          |
| ------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ REAL | `horizon-track`       | Track long-horizon objectives across multiple sessions with milestone checkpoints, progress persistence, and drift detection                                         |
| ✅ REAL | `dossier-collect`     | Build a graph-structured dossier on a seed entity via parallel fan-out + recursive expansion across web, memory, knowledge-graph, codebase, ADR index, and git intel |
| ✅ REAL | `research-synthesize` | Synthesize research findings from memory into structured reports with evidence grading, contradiction resolution, and actionable recommendations                     |
| ✅ REAL | `goal-plan`           | Create and execute Goal-Oriented Action Plans (GOAP) with precondition analysis, cost optimization, and adaptive replanning                                          |
| ✅ REAL | `deep-research`       | Orchestrate multi-phase deep research with web search, memory retrieval, pattern matching, and synthesis into structured findings                                    |

### `ruflo-intelligence` (3 skills)

_3-tier model routing real; neural-train STUB (hardcoded += 100 per RUFLO.md)._

| Tag     | Skill                   | Description                                                                                                                           |
| ------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ REAL | `intelligence-route`    | Route tasks via the 3-tier model selector and learned patterns; emits a routing rationale via hooks_explain                           |
| ✅ REAL | `intelligence-transfer` | Publish or fetch learned patterns across projects via IPFS (Pinata) -- the cross-project pattern transfer that hooks_transfer enables |
| ⚠️ STUB | `neural-train`          | Train SONA + MicroLoRA neural patterns from successful task completions; runs the DISTILL + CONSOLIDATE phases of the 4-step pipeline |

### `ruflo-iot-cognitum` (5 skills)

_DOMAIN — Cognitum Seed IoT devices. Argos = Jetson, not Cognitum. SKIP all 5._

| Tag       | Skill                | Description                                                                        |
| --------- | -------------------- | ---------------------------------------------------------------------------------- |
| 🎯 DOMAIN | `iot-witness-verify` | Verify witness chain integrity and detect provenance gaps                          |
| 🎯 DOMAIN | `iot-register`       | Register a Cognitum Seed device by endpoint and establish agent bridge             |
| 🎯 DOMAIN | `iot-firmware`       | Orchestrate firmware rollouts with canary deployment and anomaly-gated advancement |
| 🎯 DOMAIN | `iot-fleet`          | Create and manage Cognitum Seed device fleets with firmware policies               |
| 🎯 DOMAIN | `iot-anomalies`      | Detect and classify telemetry anomalies on Cognitum Seed devices                   |

### `ruflo-jujutsu` (2 skills)

_Git workflow + diff risk-scoring. Useful for PR review prep._

| Tag     | Skill          | Description                                                                             |
| ------- | -------------- | --------------------------------------------------------------------------------------- |
| ✅ REAL | `git-workflow` | Advanced git workflows with branch management, conflict resolution, and PR lifecycle    |
| ✅ REAL | `diff-analyze` | Analyze git diffs for risk scoring, reviewer recommendations, and change classification |

### `ruflo-knowledge-graph` (2 skills)

_Entity/relation extraction. Could index Argos source as a KG._

| Tag     | Skill         | Description                                                                 |
| ------- | ------------- | --------------------------------------------------------------------------- |
| ✅ REAL | `kg-extract`  | Extract entities and relations from source files to build a knowledge graph |
| ✅ REAL | `kg-traverse` | Pathfinder traversal of the knowledge graph starting from a seed entity     |

### `ruflo-loop-workers` (2 skills)

_Thin wrappers over native /loop + CronCreate. Use native directly._

| Tag     | Skill           | Description                                                            |
| ------- | --------------- | ---------------------------------------------------------------------- |
| ✅ REAL | `loop-worker`   | Run Ruflo background workers using Claude Code native /loop scheduling |
| ✅ REAL | `cron-schedule` | Schedule persistent background workers via CronCreate                  |

### `ruflo-market-data` (2 skills)

_DOMAIN — OHLCV/candlestick. Not relevant to Argos. SKIP all 2._

| Tag       | Skill            | Description                                                            |
| --------- | ---------------- | ---------------------------------------------------------------------- |
| 🎯 DOMAIN | `market-pattern` | Detect and classify candlestick patterns from ingested OHLCV data      |
| 🎯 DOMAIN | `market-ingest`  | Ingest and normalize market data into OHLCV vectors with HNSW indexing |

### `ruflo-migrations` (2 skills)

_SQL migration scaffold. Argos uses better-sqlite3 + custom migration runner — low fit but harvestable._

| Tag     | Skill              | Description                                                                                  |
| ------- | ------------------ | -------------------------------------------------------------------------------------------- |
| ✅ REAL | `migrate-validate` | Validate pending migrations for foreign key consistency, rollback safety, and best practices |
| ✅ REAL | `migrate-create`   | Create a new sequentially numbered database migration with up/down SQL files                 |

### `ruflo-neural-trader` (9 skills)

_DOMAIN — trading signals. Not relevant to Argos SDR. SKIP all 9._

| Tag       | Skill                   | Description                                                                                                                                                                          |
| --------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🎯 DOMAIN | `trader-regime`         | Detect current market regime using npx neural-trader — bull/bear/ranging/volatile classification with recommended strategy                                                           |
| 🎯 DOMAIN | `trader-explain`        | Regulator-grade feature attribution for any LSTM/Transformer signal — single-entry PageRank ranks the top-K features that drove the prediction (ADR-126 Phase 6, ADR-123 single-entr |
| 🎯 DOMAIN | `trader-signal`         | Generate trading signals using npx neural-trader anomaly detection engine with Z-score scoring and neural prediction                                                                 |
| 🎯 DOMAIN | `trader-portfolio-cg`   | Mean-variance portfolio optimization via Conjugate Gradient — 40-60× faster than the legacy Neumann path (ADR-126 Phase 3, ADR-123 Wedge 8)                                          |
| 🎯 DOMAIN | `trader-risk`           | Assess portfolio risk using npx neural-trader — VaR, CVaR, Sharpe, position sizing, circuit breaker status                                                                           |
| 🎯 DOMAIN | `trader-train`          | Train neural models (LSTM, Transformer, N-BEATS) on market data using npx neural-trader with confidence intervals                                                                    |
| 🎯 DOMAIN | `trader-cloud-backtest` | Run a heavy neural-trader job (long walk-forward, big Monte-Carlo, parameter sweep, model training) on the Anthropic Managed Agent cloud runtime instead of locally                  |
| 🎯 DOMAIN | `trader-portfolio`      | Optimize portfolio allocation using npx neural-trader mean-variance engine with risk constraints and rebalancing plan                                                                |
| 🎯 DOMAIN | `trader-backtest`       | Run a historical backtest using npx neural-trader with Rust/NAPI engine (8-19x faster) and walk-forward validation; Ed25519-sign the result for paper→live tamper evidence (ADR-126  |

### `ruflo-observability` (2 skills)

_Span/metric collection. Argos has OTel wired directly — overlap; prefer native._

| Tag     | Skill             | Description                                                                    |
| ------- | ----------------- | ------------------------------------------------------------------------------ |
| ⚠️ STUB | `observe-trace`   | Trace agent execution by collecting spans and building a trace tree for a task |
| ⚠️ STUB | `observe-metrics` | Aggregate and display system metrics with anomaly detection for a time period  |

### `ruflo-plugin-creator` (2 skills)

_Plugin scaffold + validate. Useful if building a Claude Code plugin._

| Tag     | Skill             | Description                                                                                                  |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| ✅ REAL | `create-plugin`   | Scaffold a new Claude Code plugin with proper directory structure, plugin.json, skills, commands, and agents |
| ✅ REAL | `validate-plugin` | Validate a Claude Code plugin structure, frontmatter, and MCP tool references                                |

### `ruflo-rag-memory` (2 skills)

_Real HNSW + ONNX embeddings. Top-tier ruflo capability. USE._

| Tag     | Skill           | Description                                                                                                            |
| ------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ✅ REAL | `memory-search` | SOTA semantic search — hybrid (sparse+dense), Graph RAG multi-hop, MMR diversity reranking, recency weighting          |
| ✅ REAL | `memory-bridge` | Bridge Claude Code auto-memory into AgentDB with ONNX embeddings, deduplicate, and enable unified cross-project search |

### `ruflo-ruvector` (4 skills)

_npx ruvector binary (ONNX 384-dim). Real but separate from memory_store backing._

| Tag     | Skill               | Description                                                                                                                                     |
| ------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ REAL | `vector-embed`      | Generate embeddings via npx ruvector@0.2.25 embed text (ONNX all-MiniLM-L6-v2, 384-dim), normalize, and store in HNSW index                     |
| ✅ REAL | `vector-setup`      | First-run setup for ruvector@0.2.25 — installs ONNX/Brain/SONA add-ons, registers the MCP server, and verifies the install via `doctor`         |
| ✅ REAL | `vector-hyperbolic` | Embed hierarchical data via npx ruvector@0.2.25 embed text and project into the Poincare ball in user code (no --model poincare flag in 0.2.25) |
| ✅ REAL | `vector-cluster`    | Cluster code by graph community detection via npx ruvector@0.2.25 hooks graph-cluster (spectral / Louvain)                                      |

### `ruflo-ruvllm` (2 skills)

_Local LLM inference + chat formatting. Optional alternative to Anthropic API._

| Tag     | Skill         | Description                                                                                       |
| ------- | ------------- | ------------------------------------------------------------------------------------------------- |
| ✅ REAL | `llm-config`  | Configure RuVLLM local inference with model selection, MicroLoRA fine-tuning, and SONA adaptation |
| ✅ REAL | `chat-format` | Format prompts for different LLM providers with chat templates and HNSW-powered context retrieval |

### `ruflo-rvf` (2 skills)

_Session-snapshot persistence. Could complement memory_store for full-state recall._

| Tag     | Skill             | Description                                                                                  |
| ------- | ----------------- | -------------------------------------------------------------------------------------------- |
| ✅ REAL | `session-persist` | Persist and restore agent sessions across conversations with state snapshots                 |
| ✅ REAL | `rvf-manage`      | Manage RVF (Ruflo Vector Format) files for portable agent memory and cross-platform transfer |

### `ruflo-security-audit` (2 skills)

_CVE/dep scan + general scan. Argos already has CodeQL + Dependabot wired — overlap._

| Tag     | Skill              | Description                                                        |
| ------- | ------------------ | ------------------------------------------------------------------ |
| ✅ REAL | `dependency-check` | Scan project dependencies for known vulnerabilities and CVEs       |
| ✅ REAL | `security-scan`    | Run full security scans on the codebase using Ruflo security tools |

### `ruflo-sparc` (3 skills)

_GUIDANCE — methodology docs (specification → architecture → refinement). Not executors._

| Tag         | Skill             | Description                                                                                                                                     |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 📝 GUIDANCE | `sparc-refine`    | Run the SPARC Refinement and Completion phases — review code, improve test coverage, validate against specification, and generate documentation |
| 📝 GUIDANCE | `sparc-spec`      | Run the SPARC Specification phase — gather requirements, define acceptance criteria, identify constraints, and store the spec in memory         |
| 📝 GUIDANCE | `sparc-implement` | Run the SPARC Architecture and Implementation phases — design module boundaries, write pseudocode, implement code, and run tests                |

### `ruflo-swarm` (2 skills)

_swarm-init = STUB. monitor-stream = real Monitor wrapper. Mostly skip._

| Tag     | Skill            | Description                                                                 |
| ------- | ---------------- | --------------------------------------------------------------------------- |
| ⚠️ STUB | `swarm-init`     | Initialize a multi-agent swarm with anti-drift configuration                |
| ✅ REAL | `monitor-stream` | Stream live swarm events using the Monitor tool for real-time observability |

### `ruflo-testgen` (2 skills)

_tdd-workflow = GUIDANCE. test-gaps = real coverage analysis. Useful for ongoing test work._

| Tag         | Skill          | Description                                                           |
| ----------- | -------------- | --------------------------------------------------------------------- |
| 📝 GUIDANCE | `tdd-workflow` | TDD London School workflow -- mock-first, outside-in test development |
| ✅ REAL     | `test-gaps`    | Detect missing test coverage and generate test suggestions            |

### `ruflo-workflows` (2 skills)

_STUB without executor backing. SKIP._

| Tag     | Skill             | Description                                                                       |
| ------- | ----------------- | --------------------------------------------------------------------------------- |
| ⚠️ STUB | `workflow-create` | Create reusable workflow templates with steps, conditions, and parallel execution |
| ⚠️ STUB | `workflow-run`    | Execute, pause, resume, and cancel running workflows                              |

## Argos-relevance summary

**HIGH-fit plugins** (real executors + Argos-applicable work): `ruflo-rag-memory`, `ruflo-agentdb`, `ruflo-ruvector`, `ruflo-cost-tracker`, `ruflo-adr`, `ruflo-jujutsu`, `ruflo-knowledge-graph`, `ruflo-plugin-creator`, `ruflo-goals`, `ruflo-testgen` (test-gaps), `ruflo-aidefence`, `ruflo-rvf`, `ruflo-core`.

**MEDIUM-fit / overlap with native** (prefer native MCP): `ruflo-browser` (use native chrome-devtools), `ruflo-observability` (use native OTel), `ruflo-security-audit` (use CodeQL + Dependabot), `ruflo-loop-workers` (use native /loop + CronCreate), `ruflo-migrations` (Argos has custom runner), `ruflo-docs`, `ruflo-ddd`, `ruflo-intelligence`, `ruflo-ruvllm`.

**SKIP entirely** (STUB or DOMAIN per RUFLO.md): `ruflo-agent` (wasm-agent echoes, managed-agent bypasses billing), `ruflo-autopilot`, `ruflo-daa`, `ruflo-federation` (without peers), `ruflo-swarm/swarm-init`, `ruflo-workflows`, `ruflo-intelligence/neural-train`, `ruflo-iot-cognitum` (5 skills), `ruflo-market-data` (2 skills), `ruflo-neural-trader` (9 skills), `ruflo-sparc` (guidance only — execute methodology in session, don't invoke as executor).

## Ruflo ↔ tessl overlap (top pairs)

| Ruflo skill                             | Tag | Tessl counterpart                 | When to use which                                                                  |
| --------------------------------------- | --- | --------------------------------- | ---------------------------------------------------------------------------------- |
| `ruflo-rag-memory/memory-search`        | ✅  | None                              | UNIQUE — cross-session vector recall. USE.                                         |
| `ruflo-agentdb/vector-search`           | ✅  | None                              | UNIQUE — HNSW + RaBitQ. USE.                                                       |
| `ruflo-adr/adr-create`                  | ✅  | None                              | UNIQUE — ADR scaffold. USE for new ADRs.                                           |
| `ruflo-testgen/test-gaps`               | ✅  | `tessl__lint-and-validate`        | ruflo = coverage detection; tessl = lint/tsc/audit gate. Complementary.            |
| `ruflo-sparc/sparc-spec`                | 📝  | `tessl__simple-typescript`        | ruflo = workflow methodology; tessl = code-style preferences.                      |
| `ruflo-jujutsu/diff-analyze`            | ✅  | None                              | UNIQUE — PR risk-scoring. Optional pre-review.                                     |
| `ruflo-aidefence/pii-detect`            | ✅  | `tessl__software-security`        | tessl = broad CodeGuard; ruflo = focused PII pattern scan. Stack both.             |
| `ruflo-security-audit/dependency-check` | ✅  | None (use CodeQL + Dependabot)    | Native CodeQL + Dependabot rule is canonical for Argos. SKIP ruflo dup.            |
| `ruflo-browser/browser-record`          | ✅  | None (use native chrome-devtools) | Argos already wires native chrome-devtools MCP. Prefer native; skip ruflo overlap. |
| `ruflo-observability/observe-trace`     | ⚠️  | None (use native OTel)            | Argos has OTel wired at runtime. Skip ruflo.                                       |
| `ruflo-swarm/swarm-init`                | ⚠️  | None                              | STUB. Use native `Agent` tool with `subagent_type` labels.                         |
| `ruflo-loop-workers/loop-worker`        | ✅  | None                              | Thin wrapper over native /loop. Prefer native /loop directly.                      |

## Honesty note

The original "~50 ruflo skills" note was wrong — actual is 106 skill cards across 32 plugins. Of those, 69 have real executors, 16 are bookkeeping stubs per RUFLO.md theater list, 16 are domain-specific (trading/IoT/market not relevant to Argos), 4 are pure methodology guidance, and 1 is deprecated. Combined with the 13 tessl skills, the practical Argos-relevant invocation surface is ~50-60 skills — not 119.
