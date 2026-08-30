# Surface brief: the Admin door

**Target:** `apps/web/app/(admin)/admin/continue/page.tsx` · **Mode:** Operate · **Ticket:**
[#96](https://github.com/m0t0r/recomencemos/issues/96) · **Shaped:** 2026-08-30

The second half of the Admin's sign-in. The first half is an email — requested from the public
`/sign-in`, which answers identically whichever kind of address it is given — and this is where that
link lands. Consuming the link mints **no session**; it sets a short-lived challenge and asks for the
code. Only after the code does a session exist. The mechanism is the spec's, at DD5 → _The Admin door
is passwordless_.

## Job and audience

**One person, once a day, at a desk, who wants to be past this screen.** Confirmed at shape: the
Admin moderates from a desktop almost always, so this is built for a keyboard and not for a thumb.
They have just clicked a link in their own mail and are two seconds from a queue they already know is
waiting. Nothing here is being decided, nothing is being learned, and nobody is being persuaded.

This is the most extreme **Operate** surface in the product. Where `/sign-in` is Operate tuned for a
Worker who has nothing memorised, this is Operate tuned for muscle memory. Success is a session, in
one keystroke sequence, with no reading.

The second audience is the same person on the worst day: the phone is gone, or lost, or wiped, and
the queue is stopped until they get in. That person is not served by a different screen — they are
served by this one telling the truth about what else works.

## Selected direction

**Inside the established world.** No visual-world work was run and none is warranted: this is one
field on the existing token layer, and `new-work`'s concept process is for surfaces where composition
is materially open. It is not. What follows are the four decisions shape actually settled.

1. **One field, and it accepts either code.** Six digits from the authenticator, or one of the ten
   printed backup codes, typed into the same box and told apart by shape. The alternatives were a
   closed disclosure (what the deleted `/admin/sign-in` shipped) and an always-visible second field;
   both put a control on screen for a path taken roughly never. **The field's description names both**
   — _"Los seis dígitos de tu app, o uno de tus códigos de respaldo."_ — which is the half that keeps
   this from recreating the failure DD5 names: a recovery path nobody is told about is not one. The
   person who has lost their phone is not locked out and gets no lockout message; they are simply
   looking at a field with nothing to type, and one line of description is what rescues them.

2. **Backup codes are generated so they always contain a letter, and that is load-bearing here.** It
   is what makes "exactly six characters, all digits" an unambiguous TOTP code, which is what lets the
   form **submit on completion** without a button press. Without the constraint, auto-submit fires on
   the first six characters of a longer backup code and the recovery path is broken by the
   convenience. The button still exists and still works — auto-submit is an accelerator for the
   ordinary case, never the only way through.

3. **The lockout names the wait and names the way past it.** At the ceiling the screen says the
   Account is locked, when it reopens, and that a printed backup code still works now. **That
   sentence is only true if backup codes are counted separately from TOTP**, which is an
   implementation consequence rather than a copy choice: two NFR26 ceilings, not one. It is
   defensible on its own terms — ten printed codes carry far more entropy than six digits, so they do
   not need the same bound — and it is the difference between a fifteen-minute outage of the
   moderation queue and none.

4. **A bad token is a 404, and this page never renders for one.** Expired, spent, unknown, malformed:
   `notFound()`, no message, no resend offer, no "ask for another link". A legible refusal here is an
   oracle for which tokens existed, and the person who legitimately needs another link already knows
   where the door is. This is the one place in the product where being unhelpful is the requirement.

## States

| State               | What it shows                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`              | Heading, one field, one button. The field is autofocused and the description sits under the label, before anything is typed.                                                                                            |
| `loading`           | The button is busy. The field stays readable and stays filled — a code that failed to submit must not have to be retyped.                                                                                               |
| `wrong_code`        | **"El código no es correcto."** and nothing else. Never which factor, never whether the challenge or the Account was the part that failed, never how many attempts remain — a counter is a countdown an attacker reads. |
| `locked`            | The Account is locked, when it reopens, and that a printed backup code still works now. The field stays enabled, because a backup code is still a thing to type.                                                        |
| `failed`            | Something broke on our side. Says so, offers a retry, keeps what was typed.                                                                                                                                             |
| `success`           | No state — `redirect("/admin")`. The screen is never seen in a success condition.                                                                                                                                       |
| `empty`             | n/a. There is nothing to be empty of.                                                                                                                                                                                   |
| `permission_denied` | n/a **on this page**, and deliberately so: no token means 404, not a refusal. The refusal state lives at `/admin`, behind NFR14's 403.                                                                                  |

## Interaction and layout

Single column, centred, a form measure narrower than `/sign-in`'s — there is one field and it should
not look like a form. One `<h1>`. Order: heading → label → description → field → button. No chrome:
`(admin)/layout.tsx` renders none, and this route is pre-session, so there is nothing a header could
truthfully say.

**Keyboard path:** the field is focused on load; `Enter` submits; the button is the only other stop.
That is the whole path, and it is short on purpose — this is the surface where a person's hands
already know what to do.

**Focus on a state change:** the message region is `aria-live="polite"` and focus moves to it on
`wrong_code`, `locked` and `failed`, so what happened is announced before where to fix it. It does
**not** move on `loading`. The field keeps its value in every case.

**Input affordances:** `autocomplete="one-time-code"` and `inputmode="numeric"` are wrong here and
must not be copied from the usual TOTP recipe — the field also accepts an alphanumeric backup code,
and a numeric keypad would make that path untypable on the phone this Admin occasionally uses.
`autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`.

**No JavaScript:** a plain `<form>` posting a Server Action, so the door works before hydration.
Auto-submit is the only thing that needs the client, and it is an accelerator rather than the
mechanism — losing it costs a button press, not the session.

## Constraints a builder must not invent

- **Every string comes from `_lib/messages.ts`**, under `docs/policy/voice.md` — Directness 5, `tú`,
  `es-CO`. No copy at a render site. The Spanish above is indicative, not final.
- **No spec identifier in any string a person reads.** `NFR14`, `DD5`, `#96` belong in the comment
  above the string, never in it.
- **Semantic tokens only** — no colour value, no `dark:` override; `theme-parity` is light only.
- **Registry components only:** `button`, `input`, `label`, `field`. Nothing is hand-rolled; check
  `packages/design-system/src/components/` before writing any element.
- **`noindex`**, inherited from `/admin/:path*` in `lib/gated-routes.ts` with no new row.
- **The Server Action authorizes for itself.** It reads the challenge cookie, not the page that
  rendered its form — Next compiles it to a directly reachable POST endpoint.
- WCAG 2.2 AA, in every state above.

## Anti-goals

- **Nothing that says "admin", "moderación", or "panel".** Not in the heading, not in the title, not
  in the tab. The route is already known to whoever holds the token and to nobody else.
- **No address on screen.** Not the one the link was sent to, not masked, not partial. It confirms
  which account this is to anyone holding a stolen link.
- **No "welcome back", no name, no avatar, no session chrome.** There is no session yet, which is the
  entire point of the screen.
- **No attempt counter, no strength meter, no six separate digit boxes.** The split-box pattern is
  the reflex here and it is wrong twice over: it cannot hold an eight-character hyphenated backup
  code, and a fixed slot count makes the one-field decision above unimplementable.
  **`input-otp` is in the registry and is deliberately not used**, which is worth stating because the
  registry-equivalents review pass exists to catch the opposite mistake. It is the right component
  for a screen that accepts only a TOTP code; this screen accepts either code in one field, and that
  is the decision it cannot express.
- **No "resend link" and no "back to sign in".** Both are routes onward from a page whose refusals
  are supposed to be dead ends.
- **No page-load choreography.** Someone is entering a task.

## Open, and not for a builder to settle

- **The exact ceilings** — attempts and window, per Account, for TOTP and for backup codes
  separately. Named as two NFR26 rows in the spec; the numbers are a `rate_counter.action` constraint
  change and belong to the Build ticket that adds them.
- **The backup-code format** beyond the one constraint above (it contains a letter). Length,
  grouping, and whether it is hyphenated are enrolment's call, because that is the screen a person
  reads them off and writes them down from — see `admin-enrolment.md`.
