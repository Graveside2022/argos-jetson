# InlineNotification — Accessibility

The Carbon InlineNotification primitive (wrapped at `src/lib/components/chassis/forms/InlineNotification.svelte`) is built to meet WCAG 2.2 Level AA for the live-region status pattern. This document records exactly which obligations Carbon owns vs which the consumer must fulfil.

## WCAG 2.2 success criteria covered

| SC                           | Level | How Carbon satisfies it                                                                                                                                          |
| ---------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 Non-text Content       | A     | Status icon carries `<title>` with `statusIconDescription` (defaults to `` `${kind} icon` `` in the chassis); close-X has `aria-label`.                          |
| 1.3.1 Info and Relationships | A     | Title and subtitle in semantic `<p>` elements with structural class names; severity conveyed via `role` + visual + icon (not color alone).                       |
| 1.4.1 Use of Color           | A     | Each kind has a distinct icon shape (Error vs Warning vs Checkmark vs Information). Color is supplementary, not the sole status indicator.                       |
| 1.4.3 Contrast (Minimum)     | AA    | Title / subtitle text ≥ 4.5:1 against per-kind tinted background; low-contrast variant uses `--bg-1` + `--ink` ≥ 4.5:1.                                          |
| 1.4.11 Non-text Contrast     | AA    | Border-left strip and status icon target ≥ 3:1 against the container.                                                                                            |
| 2.1.1 Keyboard               | A     | Close-X button reachable by Tab; activated by Enter or Space.                                                                                                    |
| 2.2.1 Timing Adjustable      | A     | When `timeout > 0`, the consumer is responsible for offering a way to extend / disable the timeout (per WCAG; sticky=0 is the safer default).                    |
| 2.4.7 Focus Visible          | AA    | Close-X carries Carbon's standard 2px focus ring using `$focus` token (mapped to `var(--accent)`).                                                               |
| 4.1.2 Name, Role, Value      | A     | `role="alert"` (error/warning/warning-alt) or `role="status"` (success/info/info-square) auto-derived; close-X has accessible name via `closeButtonDescription`. |
| 4.1.3 Status Messages        | AA    | `role="alert"` / `role="status"` ensures assistive tech announces the notification without moving focus when it appears.                                         |

## ARIA — Carbon owns vs consumer owes

| Attribute                 | Owner    | Notes                                                                                                                                             |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role`                    | Chassis  | Auto-derived: `'alert'` for `error` / `warning` / `warning-alt`; `'status'` otherwise (`InlineNotification.svelte:36-39`). Consumer can override. |
| `kind` (HTML attr)        | Carbon   | Set on the root for CSS hooks; not a standard ARIA attribute but harmless.                                                                        |
| Status icon `<title>`     | Carbon   | Wired to `statusIconDescription`. Chassis defaults to `` `${kind} icon` `` when not supplied.                                                     |
| Close-X `aria-label`      | Carbon   | Wired to `closeButtonDescription` (default `'Close notification'`).                                                                               |
| `title` / `subtitle` text | Consumer | Must be plain strings (no slot). Keep titles short and verb-led; subtitles state cause + remediation.                                             |
| `aria-live` semantics     | Implicit | Both `role="alert"` and `role="status"` imply `aria-live` (assertive vs polite respectively); Carbon does NOT additionally set `aria-live`.       |

## Keyboard interactions

| Key                          | Behaviour                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab`                        | Move focus to the close-X button (when `hideCloseButton={false}`). Tab past for next page focusable.                                      |
| `Shift + Tab`                | Move focus to the previous page focusable.                                                                                                |
| `Enter` / `Space` on close-X | Dismiss the notification; fires `onClose(false)` (false because not from timeout).                                                        |
| `Escape`                     | **Not handled by Carbon InlineNotification.** Unlike Modal, an inline notification does not trap focus, so Escape has no special meaning. |

## Focus management

InlineNotification does **not** trap focus and does **not** auto-focus on appear. This is correct per WCAG 4.1.3 Status Messages — surfacing a notification must not interrupt the user's current task by stealing focus.

**Close-button focus on dismiss**:

1. If the user clicks the close-X, focus is released; the previously focused element (if any) regains focus naturally.
2. If the notification dismisses via `timeout`, focus is unaffected.
3. If the consumer programmatically sets `open = false`, focus is unaffected.

**Consumer obligation** — when an inline notification appears in a region that the user just navigated away from (e.g. form submitted, focus moved to a confirmation page), the consumer must ensure the notification is rendered inside a region that screen readers will read. Best practice: render the notification adjacent to the trigger element so the implicit live region is announced near the user's current focus context.

## Screen reader behaviour

| `role`          | Announcement timing   | Use case                                                                                        |
| --------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| `role="alert"`  | Immediate (assertive) | Error states, validation failures, hardware disconnects — auto-derived for error/warning kinds. |
| `role="status"` | Polite (when idle)    | Success confirmations, informational updates — auto-derived for success/info kinds.             |

When a notification mounts, screen readers announce in order: title, then subtitle. The status icon's `<title>` is announced only when the user navigates into the icon (via screen-reader cursor mode, not Tab).

## Common a11y pitfalls

1. **Color-only status** — relying on the colored border-left to communicate severity fails SC 1.4.1 for color-blind users. The icon and text title carry the burden; never strip them.
2. **Mute timeout without alternative** — passing `timeout={3000}` without giving the user a way to re-display the notification (toast log, history panel) violates SC 2.2.1. Either keep `timeout=0` (sticky) for important messages or pair short timeouts with a persistent log.
3. **Wrong `role` override** — overriding `role="status"` on an error notification suppresses the assertive announcement; users may miss critical failures. Trust the chassis auto-derive unless you have a specific reason.
4. **Empty `title`** — passing `title=""` produces an empty `<p>` that screen readers announce as silence, then the subtitle. Always supply a title; if the message is single-line, put it in `title` and leave `subtitle` blank.
5. **Re-rendering the same notification** — toggling `open` from `true` → `false` → `true` with the same title does not always re-announce in screen readers. For repeat events (e.g. "Connection lost" firing twice), append a counter or timestamp to `title` to force re-announcement.
6. **Hidden close-X with no auto-dismiss** — combining `hideCloseButton={true}` with `timeout={0}` strands the notification permanently for keyboard users. Always pair `hideCloseButton` with a non-zero `timeout` OR a programmatic `bind:open` controller.
7. **Notification inside a hidden region** — placing an InlineNotification inside an element with `display: none` or `aria-hidden="true"` suppresses the live-region announcement. Mount the notification outside collapsed sections.
