# Surface brief: `/my-profile/edit`

**Target:** `apps/web/app/(site)/my-profile/edit/page.tsx` · **Mode:** Operate · **Ticket:**
[#142](https://github.com/m0t0r/recomencemos/issues/142) · **Shaped:** 2026-09-02 · **Locked:** —

**Shaped without an interview**, like [`publish.md`](publish.md) and
[`own-profile.md`](own-profile.md): assumptions are marked `[assumed]` and the open decisions are
the human's. The one decision the spec explicitly delegated to this ticket — one form or several —
is answered below as an assumption and settled by `/prototype` UI, not by this document.

**Amended 2026-09-06 with [#181](https://github.com/m0t0r/recomencemos/issues/181): the visual
world changed, the decisions above did not.** This surface takes its treatment from
[`publish.md`](publish.md)'s amendment of the same date and adds nothing of its own, which is the
point rather than an omission: the two forms write the same nine fields through the same shared
groups, so a Worker who publishes and later edits meets one page twice or she meets two products.
The groups become sheets on a **ruled page**, the ruling replaces the `<Separator />`s, the margin
line runs beside them from `sm` up, the legends move into the display face at the 24 px step, and
everything she operates stays in Inter.

**The preview sheet is more honest here than on `/publish`**, and it is the one thing this surface
gets more of. On a first publish the card fills in as she types; here it opens holding **what she
published**, which is exactly the question this page exists to answer — what are they seeing, and
what will they see when I save. It is `ProfileCard`, the same component `/my-profile` renders one
route away, so the sheet she edits and the sheet she then reads are the same object.

**Open decision 3 above is in scope again because of it.** Whether the save control is sticky on a
phone was left to the human; a preview pinned in the thumb zone would carry the action with it, and
that pairing is one of the `?variant=` positions on `prototype/181-ui-variants`. The other two
positions leave the save where it is, at the end of the form.

**Open decisions 1 and 2 are untouched** — this is still one page with every group on it, and
`/my-profile` still offers one _Editar_ control rather than per-section links. A visual amendment
may not settle a routing question.

## Job and audience

The same Worker, some days after publishing. Something on her profile is now wrong or has changed:
a digit in her phone, a Skill she no longer offers or one she has picked up, a headline she would
word better, a city she has moved to. She arrives from `/my-profile`, on the same phone she
published from, wanting to change **one thing** and leave.

The job is not "fill in a profile". It is **find the wrong thing, fix it, and be sure it took.**

## Outcome and proof

**Primary thing to understand:** what she changes is live the moment she saves, and nothing else
about her profile moved — same address, same position on the Wall.

**Product-specific truth:** the address a Hirer already holds keeps resolving (NFR9), and
correcting a typo does not buy her a bump to the top of the Wall. The second half is invisible to
her and is the site keeping a promise to everyone else — story 20 measures the attention spread,
and an edit that moved her would quietly falsify it. **No copy claims either.** Saying "editing
does not move you up" would teach a Worker that moving up is a thing the site does.

**Success state:** back on `/my-profile` with a focused confirmation region — the spec's own
`success` cell for that surface, _Edit saved_ — for the same reason `/publish` redirects there:
the proof that the edit took is the page that shows what people see.

## Selected direction

**Structural thesis `[assumed]`: one form, one action, grouped into the sections `/my-profile`
already uses, reachable per section.** She lands on the group she came to change; she saves once
and the whole profile is written.

**And the alternative is narrower than it looks, which is worth knowing before prototyping.** A
per-section action — four small writes instead of one — is not a layout choice this ticket may
make. The spec's API contract row is a **whole-profile** write:

> `updateProfile` — `publishProfile`'s field set **minus `consentVersion`** → `{ ok } | { fieldErrors }`

A partial update is a different row with a different shape, so it is a spec amendment rather than a
prototype variant. What is left to choose is therefore **entry point and grouping**, which is
exactly what `/prototype` UI is for.

**Focal moment:** the field she came to fix, already on screen and focused, with everything else
present but quiet.

**Implementation consequence:** the page reads the same `OwnProfile` projection `/my-profile`
reads, and the form mounts with her values as defaults. `/publish`'s machine, schemas, copy and
Skill picker are **shared**, not copied — the edit form is that form minus the consent field.

## Two rules this surface needs that publishing did not

**A Skill she already holds stays choosable, even if it has been retired.** `profiles.publish`
refuses any slug that is not in the **active** vocabulary, which is right for a first publish and
wrong for an edit: a Skill retired since she published would refuse every save until she noticed
and dropped it, including a save that only touched her phone number. So on edit the choosable set
is **the active vocabulary plus the Skills she already holds**, and a newly added one must still be
active. Pinned at seam 2, because it is the kind of rule that is obvious once written and invisible
until someone retires a Skill.

**The rejector runs on every free-text field she submits, not every one that is non-empty.** `about`
may be empty and stays optional; an empty field passes because there is nothing in it to object to,
not because it was skipped. This matters because the whole profile is re-submitted on every save,
so "every edited field" and "every submitted field" are the same set here — and the second is the
one that cannot be gamed by not touching a field.

## Scope and boundaries

- **Fidelity:** production.
- **Breadth:** the form, the six states plus the seventh, and the route in and out of it.
- **Untouched:** the **photo** — `attachPhoto` swaps one and lands with #18, and the form says the
  photo is changed elsewhere rather than pretending it is not there. The **slug**, which is not a
  field. **Taking the profile down**, which is a different mechanism (DD8) and not on this surface
  at any strength.
- **Anti-goals:** no autosave — a save is an act she takes, and an autosaved contact-detail refusal
  has nowhere to go. No "unsaved changes" modal `[assumed]`. No completeness meter, no diff view, no
  edit history. No language about verification or about position on the Wall.

## States and ranges

| State               | What it shows                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty`             | n/a — a session with no profile goes to `/publish`, the same answer `/my-profile` gives.                                                                                                                 |
| `loading`           | A skeleton at the form's shape, per group. Never a whole-form spinner — `/publish`'s rule, and the same reason.                                                                                          |
| `partial`           | n/a. The form renders whole; the photo is not on it.                                                                                                                                                     |
| `error`             | Per-field errors **and** a focused form-level summary, exactly as `/publish`: the contact-detail rejection **names the fragment and keeps everything she typed** (NFR12), and a transport fault says so. |
| `permission denied` | Signed out → `/sign-in?returnPath=/my-profile/edit`. No profile → `/publish`. Not the owner → **404, returned** as a framework interrupt, never a thrown `AppError` (C51).                               |
| `success`           | Redirect to `/my-profile`, confirmation region focused, _Edit saved_.                                                                                                                                    |
| `rate limited`      | **The seventh state.** When she may save again, that nothing she typed was lost, and that the profile people can already see is the last version she saved — not a half-applied one.                     |

**Ranges:** one profile; 1–6 Skills; 0–5 work history lines; `about` 0–600 characters.

## Interaction and layout

Single column `[assumed]`, one `<h1>`, groups as `<h2>`s so a screen reader's heading list is the
map. `/my-profile` links into each group, so the heading ids are part of the contract between the
two pages rather than incidental.

**Keyboard path:** heading → the group she was linked to → its fields in visual order → the other
groups → save. On a refusal, focus moves to the summary, count first, then the field — `/publish`'s
`guardSubmit` already owns that move and it is shared rather than reimplemented.

**Without JavaScript** the form posts natively and the action answers (NFR4). Every control is
named, `noValidate` is withheld until hydration, and there are **no hidden inputs** — there is
nothing to bind here, since the consent versions were `/publish`'s only bound argument and this
form has no consent.

## Constraints and open decisions

- `noindex` needs no configuration change: `/my-profile/:path*` is already in NFR8's header table
  and `gated-routes.test.ts` covers it. The page still sets its own `metadata.robots`.
- Semantic tokens only; registry components only (`REVIEW.md`'s blocking pass); every string in a
  `_lib/messages.ts` with the copy test beside it; no spec identifier in any string a person reads.

**Open decisions, for the human — these are the `/prototype` variants:**

1. **One page with all groups** (thesis above) versus **one page per group** reached from
   `/my-profile` (`/my-profile/edit/skills`), each posting the whole profile with the other groups
   as bound arguments. The second is fewer fields on a phone screen; the first is one save and no
   question about what happens if she leaves halfway.
2. **Whether `/my-profile` grows per-section _Cambiar_ links** or one _Editar_ control at the top.
   Per-section is how she finds the wrong thing without reading; one control is one thing to
   explain.
3. **Whether the save control is sticky** on a long form on a phone, or sits at the end. Sticky is
   reachable; at the end it is where the form finishes and cannot cover a field.
