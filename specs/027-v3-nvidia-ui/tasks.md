# Spec 027 — V3 NVIDIA UI · Tasks

8-PR phased delivery, each ≤ ~2000 LOC, each bracketed by sentrux (Rule 6).

## Phase board

| PR | Scope | Status |
|----|-------|--------|
| P1 | Chassis — route subtree, port wiring, `[data-ui='v3']` token system, theme store, shell components | In progress |
| P2 | Card + control kit — V3Card, corner-square, hero/CTA, inputs, table, pill-tab | Pending |
| P3 | Overview + Tools + Settings/Appearance panel (dark/light toggle + 14-accent picker) | Pending |
| P4 | Map page + thin iframe/VNC views (A) | Pending |
| P5 | Thin views (B) + ~13 "unavailable" placeholder routes | Pending |
| P6 | Heavy views — WebTAK, UAS-scan, Wireshark, GNU Radio, trunk-recorder | Pending |
| P7 | Reports (decomposed) + bottom-panel console drawer | Pending |
| P8 | Config UIs (TAK, GlobalProtect) + responsive / a11y polish | Pending |

## P1 — Chassis · `feature/v3-nvidia-chassis`

- [x] V3 worktree + sentrux baseline (quality_signal 6731)
- [x] `[data-ui='v3']` token system — light/dark + 14 accents (`app.css`)
- [x] `v3-theme-store.svelte.ts` — `{mode,palette}`, localStorage `argos-v3-theme`
- [x] Port routing — `hooks.server.ts`, `argos-v3.service`, `install-services.sh`; retire `argos-newui-dev.service`
- [x] Root `+layout.svelte` `isV3` guard + `app.html` FOUC script
- [x] V3 route subtree — `routes/dashboard/v3/`
- [x] V3 shell components — Shell, PrimaryNav, UtilityBar, Breadcrumb, Footer, Button
- [ ] Inter woff2 vendoring — **deferred follow-up**; the token font stack is
      `'Inter', Arial, system-ui`, so Arial (DESIGN.md's documented fallback)
      renders until Inter is vendored
- [ ] P1 verification — `npm run build`, chrome-devtools on :5175, V1/V2 regression diff
- [ ] P1 PR → `dev`
