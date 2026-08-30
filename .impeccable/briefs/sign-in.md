# Surface brief: `/sign-in`

**Target:** `apps/web/app/(site)/(auth)/sign-in/page.tsx` · **Mode:** Operate · **Ticket:**
[#12](https://github.com/m0t0r/recomencemos/issues/12) · **Shaped:** 2026-08-27 · **Amended:**
2026-08-30 ([#96](https://github.com/m0t0r/recomencemos/issues/96))

## Job and audience

A Worker on a phone, possibly borrowed, possibly on mobile data, who wants to reach her account and
has nothing memorised. A Hirer arrives here too — signed out, one click from a profile he wants to
read — but he is not who this surface is tuned for. Success is a session, in as few decisions as the
two doors allow. This is not a page anybody wants to spend time on; it is Operate, and the brand
lives in the precision of the details rather than in expression.

## Selected direction

Three decisions taken at shape, each with the alternative it beat:

1. **Google leads; email is fully present below it.** DD5's argument for adding Google is that the
   magic link was the _only_ door and carries every risk this product cannot yet measure — Colombian
   inbox deliverability, a cold domain capped at 50–100 sends a day, a hard bounce that locks her out
   with no password to fall back on. On an Android phone Google removes all of it in one tap. The
   email door is not hidden behind a disclosure; it is the second half of the page. **When Google is
   not configured** — a fresh clone, CI, any environment without both credentials — the email form is
   simply the whole page, with no dead button and no empty divider.
2. **The shared-device checkbox sits in its own row below both doors.** It governs both in the
   implementation, so it must not sit inside the email form, where it would read as an email-door
   setting while silently shortening a Google session too. Directness 5 refuses that mismatch.
3. **The sent state keeps the form.** The confirmation renders above a form that still holds her
   address, so a link a scanner ate is one tap from a resend and the Google door is still on screen
   at exactly the moment the email door may have failed her silently.

## States

The spec's six plus `rate limited`, and the two this surface adds from the ticket:

| State           | What it shows                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idle`          | Both doors. The email precondition sentence is above the field, **before** she types.                                                                    |
| `loading`       | **Per door.** The two buttons are busy independently and the form stays readable — no whole-page spinner, no disabled fieldset.                          |
| `sent`          | Confirmation above the kept form; the resend button replaces the send button.                                                                            |
| `field_error`   | The address is wrong-shaped. Named on the field, and the address is kept.                                                                                |
| `failed`        | Send failed. Address kept, retry available, the Google door still there.                                                                                 |
| `rate_limited`  | The `userMessage` and the `retryAfter`, in her terms, and the Google door named as still open.                                                           |
| `google_failed` | Arrives back as `?error=`. The email door is still offered — never a dead end.                                                                           |
| `link_consumed` | Arrives back as `?error=INVALID_TOKEN`. Offers an immediate resend, and is **not** written as an error: a scanner opening her link first is our problem. |

| `signed_in` | **Never rendered.** A request carrying a live session is redirected before this page draws — to its `returnPath` when `safeReturnPath` accepts it, else `/`. Amended with #96. |

`empty` and `permission denied` are `n/a` on this surface, per the spec's own table.

## Amended 2026-08-30 with #96 — one door, two outcomes, and a guard

**This surface is now the Admin's door too, and nothing about it may show that.** The Admin's
password door at `/admin/sign-in` is deleted; the Admin asks for a link from this form like anybody
else. If the address holds the Admin grant the email carries an Admin link, which lands on a
token-gated route and demands a TOTP code before any session exists; otherwise it carries the
ordinary magic link. See [`admin-door.md`](admin-door.md).

Three consequences for this brief, and the first two are anti-goals:

1. **The copy, the shape, the status and the timing are identical in both cases.** No second field,
   no "are you an operator?" affordance, no different confirmation. The `sent` state already says
   "check your email" **whether or not the address exists**, because the honest reply and the
   enumeration-safe reply are the same one — that property now also carries "and whether or not this
   is the Admin's address", which is a stronger thing for it to carry and needs no new mechanism.
2. **Nothing on this page ever mentions `/admin`.** Not in copy, not in a link, not in a comment that
   could reach a rendered string. A door that advertises the other door undoes the reason the other
   door has no page of its own.
3. **A live session is redirected rather than shown the form.** The state table gains `signed_in`
   above. It is a redirect and not a message, because there is nothing to tell somebody about a
   problem they do not have; the target is `returnPath` when safe and `/` otherwise, reusing
   `safeReturnPath` rather than a second rule. It applies to every session equally — an Admin session
   is not sent to `/admin`, because this page has no business knowing what kind of session it turned
   away.

## Interaction and layout

Single column, `max-w` around a comfortable form measure, vertically centred with room to grow. One
`<h1>`. Order: heading → Google button + its account notice → `o` separator → email precondition →
field → send → separator → shared-device row. Feedback lands **above** the form in a live region so a
screen reader hears the outcome without hunting for it.

**Keyboard path:** heading → Google → email field → send → shared-device checkbox. On a returned
error, focus moves to the message region, not to the field, so what happened is heard before where to
fix it. On `sent`, focus moves to the confirmation. Both regions are `aria-live="polite"`.

**No JavaScript:** the email door is a plain `<form>` posting a Server Action, so it works before
hydration (NFR4's discipline, though NFR4 binds `/publish`). The Google button needs the client.

## Constraints a builder must not invent

- Every string comes from `app/sign-in/messages.ts`, under `docs/policy/voice.md`. No copy is written
  at a render site.
- Semantic tokens only — `bg-background`, `text-muted-foreground`, `border-border`. No colour value,
  no `dark:` override; `theme-parity` is light only.
- Registry components only: `button`, `input`, `label`, `field`, `checkbox`, `separator`. Nothing new
  is built here; the Skill picker and the two standing notices are other tickets' scope.
- `/sign-in` is `noindex`.
- WCAG 2.2 AA, `es-CO`, including every state above.

## Anti-goals

No illustration, no hero, no testimonial, no "welcome back", no social proof, no marketing. Nothing on
this page describes the person reading it. No modal. No page-load choreography — she is entering a
task, not watching it arrive.
