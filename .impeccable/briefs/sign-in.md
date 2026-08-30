# Surface brief: `/sign-in`

**Target:** `apps/web/app/(site)/(auth)/sign-in/page.tsx` · **Mode:** Operate · **Ticket:**
[#12](https://github.com/m0t0r/recomencemos/issues/12) · **Shaped:** 2026-08-27

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

`empty` and `permission denied` are `n/a` on this surface, per the spec's own table.

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
