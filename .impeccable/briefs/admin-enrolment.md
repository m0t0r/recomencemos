# Surface brief: Admin enrolment

**Target:** `apps/web/app/(admin)/admin/enrol/[token]/page.tsx` · **Mode:** Operate · **Ticket:**
[#96](https://github.com/m0t0r/recomencemos/issues/96) · **Shaped:** 2026-08-30

The page `pnpm admin:enrol`'s setup link opens. It shows the TOTP QR and the ten backup codes, and it
**takes no input at all** — the six digits that prove the authenticator works are typed back into the
terminal, which verifies them over the direct connection and only then sets the grant. The mechanism
is the spec's, at DD5 → _The Admin door is passwordless_, and the procedure is runbook §6.

## Job and audience

**One person, once, mid-command, with a terminal open behind the browser.** They ran `admin:enrol`,
it printed a link and is now waiting on a prompt. They are at a desktop (confirmed at shape), phone in
hand for the camera. This is not a page anybody browses to and not one they will ever see twice
without deliberately starting over.

The job is two acts and neither is on the screen: **get the QR into a phone camera**, and **get ten
codes somewhere they will survive**. The screen's whole purpose is to make both easy and then get out
of the way. It is **Operate**, and the closest thing this product has to a wizard step.

**The stakes are asymmetric and worth stating plainly.** The QR is recoverable — a person who fails to
scan it just runs the command again. The codes are the thing with no second chance in the ordinary
flow, and they are the only way back in when the phone is gone (C43).

## Selected direction

**Inside the established world.** No visual-world work; this is a display page on the existing token
layer.

1. **QR leads, codes follow, and the codes section is unmissable rather than merely present.** This is
   the order of the acts and runbook §6's own order. The risk it carries is real and named: scan,
   switch to the terminal, never scroll, lose the codes. So the codes are not a subordinate section —
   they carry their own heading, their own bounded region, and the "shown once" sentence **above**
   them rather than below, where it would be read after the decision it is trying to inform.

2. **A clipboard button, and nothing else.** Settled at shape. It copies all ten codes as plain
   newline-separated text with no header or decoration, so it pastes cleanly into whatever holds them.
   **No print view and no download** — both were considered and neither was chosen.
   **The consequence is recorded rather than hidden:** this points the codes at a password manager,
   and runbook §6 is amended to match, carrying the condition that keeps C43 intact — the codes must
   not live in the same vault as the mailbox credential, because the mailbox is the other factor and
   one unlock would hold both. That sentence belongs on this screen, not only in the runbook.

3. **The manual-entry secret sits beside the QR.** A camera fails, a screen glares, an authenticator
   refuses a QR, or the Admin is on the phone that would have to photograph itself. The base32 secret
   in mono, selectable, is the fallback that costs one line and removes a whole class of dead end.

4. **A refresh re-renders the same values until the CLI confirms.** The token stays valid for its
   short window; verification in the terminal is what closes it, not the first render. It is no less
   safe — the token is unguessable and short-lived either way — and it removes a way to lose ten codes
   to a stray `⌘R`. **A bad token is still a 404**, exactly as at the door: expired, spent, unknown,
   malformed, no message.

5. **The backup-code format is this screen's call, because this is where they are read.** Ten codes,
   each **eight characters in two hyphenated groups of four**, from a reduced alphabet that excludes
   `0`/`O` and `1`/`l`/`I`, and **always containing at least one letter** — that last part is not
   cosmetic, it is what makes "six characters, all digits" unambiguously a TOTP code at the door, and
   therefore what lets that field accept both. Grouped and unambiguous because somebody will read one
   off a screen at speed on the worst day they have had.

## States

| State               | What it shows                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ready`             | The only real state: QR, manual secret, the "shown once" sentence, ten codes, one copy button. Rendered in one pass or not at all.                                              |
| `copied`            | The button confirms, in place, and the confirmation is announced. A clipboard control with no feedback is the classic way this fails silently.                                  |
| `copy_failed`       | The clipboard API can refuse — permissions, insecure context, an old browser. Says so and says the codes are selectable, which is the actual fallback.                          |
| `failed`            | Enrolment broke on our side. Says so plainly **and says the command can simply be run again**, which is true and is the whole reassurance needed: nothing has been granted yet. |
| `loading`           | n/a — no skeleton and no streamed section. A half-rendered enrolment screen is worse than a slower whole one.                                                                   |
| `empty`             | n/a.                                                                                                                                                                            |
| `permission_denied` | n/a on this page. No token, or a bad one, is a **404**.                                                                                                                         |

## Interaction and layout

Single column, centred, wider than the door's measure because ten grouped codes need room to breathe.
No chrome — `(admin)/layout.tsx` renders none, and there is no session yet to describe.

Order: `<h1>` → QR with its manual secret beside it → **codes heading** → the shown-once sentence →
the ten codes → copy button → the one-line instruction about where they may and may not live.

**The codes are a `<ul>`, not a paragraph or a `<pre>`.** Ten discrete items is what they are, it is
what a screen reader should announce, and it is what lets each one be selected without dragging
through its neighbours.

**Keyboard path:** `<h1>` → the manual secret (selectable, focusable) → copy button. Short, because
there is nothing to fill in. Focus never moves on its own; nothing here is async.

**Announcement:** the copy confirmation is `aria-live="polite"`. The QR carries a real Spanish `alt`
naming what it is for, and the manual secret is announced as the alternative to it rather than as a
loose string.

**Cache Components:** the page reads a route param and must not be cached across requests — it renders
per-token secrets. `export const instant = false` rather than a Suspense boundary, for the reason
`/admin` already uses it: there is nothing on this page worth painting before the values arrive, and a
streamed shell would be a 200 on the wire before the token has been judged.

**No JavaScript:** everything except the copy button renders server-side and is fully usable — the QR
is an image, the secret and the codes are text. Losing the client costs the button, not the enrolment.

## Constraints a builder must not invent

- **Every string comes from `_lib/messages.ts`**, under `docs/policy/voice.md` — Directness 5, `tú`,
  `es-CO`. The shown-once sentence is the one string on this surface where Directness 5 is doing real
  work: state the absence first, plainly, before the codes rather than after them.
- **No spec identifier in any string a person reads.** `C43`, `DD5`, `#96` go in the comment above.
- **The QR is generated server-side from the TOTP URI** with `uqr`, already a dependency. The existing
  `qr-code.tsx` component moves here from the deleted `/admin/sign-in` rather than being rewritten.
- **The secret and the codes cross the boundary exactly once and are never readable again.** They are
  returned to this render and nothing logs them, ever — every value on this page is a credential.
- **Semantic tokens only.** Registry components only: `button`, `card`, `separator`. Check
  `packages/design-system/src/components/` before writing any element.
- **`noindex`**, inherited from `/admin/:path*` with no new row.
- WCAG 2.2 AA, in every state above. The codes must clear contrast in mono at their rendered size —
  this is the surface where a person is transcribing character by character.

## Anti-goals

- **No "admin", no "panel", no product chrome.** Same reasoning as the door.
- **No email address on screen**, and no account name. The link's holder already knows; nobody else
  should be told.
- **No print button and no download button.** Deliberately absent per the decision above, not
  forgotten — a later reviewer should read this line before adding one.
- **No `beforeunload` guard.** It was considered and rejected: re-running the command is a real
  recovery, so the nag would buy nothing and would fire on the ordinary way of leaving.
- **No confetti, no celebration, no "you're all set".** Nothing has been set — the grant happens in
  the terminal, after this page, and a page that congratulates the user before the act is a page that
  lies.
- **No countdown timer on the token.** It would be a clock on a credential and would push a person to
  hurry through the one screen they should read.
- **No masking or blurring of the codes behind a reveal.** They are on the operator's own screen at
  their own desk; a reveal control adds a step and protects nothing.

## Open, and not for a builder to settle

- **The setup token's TTL.** Short, and the number belongs with the door's ceilings in the Build
  ticket that adds them.
- **Whether the CLI polls or the page signals it.** An implementation choice with no visible
  consequence on this surface — the screen looks the same either way.
