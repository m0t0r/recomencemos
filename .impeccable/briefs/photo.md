# Surface brief: the photo

**Target:** `apps/web/app/(site)/publish/_components/photo-field.tsx` and the three surfaces that
render its result — `/publish`, `/my-profile`, `/admin/photos` · **Mode:** Operate · **Ticket:**
[#18](https://github.com/m0t0r/recomencemos/issues/18) · **Shaped:** 2026-09-08 · **Locked:** —

**Shaped without an interview**, as `publish.md` was and for the same reason: the Build session ran
unattended. Every answer a discovery round would normally settle is marked `[assumed]` and is the
human's to correct before the surface is locked. The spec's UX state table, DD6, ADR-0009 and
[`docs/policy/voice.md`](../../docs/policy/voice.md) answered most of what an interview would have
asked; what they did not is under _Open decisions_.

**A brief of its own rather than three paragraphs added to `publish.md`.** The photo is one object
with one lifecycle read by three different people — the Worker who picks it, the Hirer who does not
see it yet, and the Admin who decides. A decision made in one of those places is wrong if it
contradicts the other two, and a brief per route would have let it.

**Composed at 390 px first**
([#178](https://github.com/m0t0r/recomencemos/issues/178), the owner's own correction). The phone is
the surface she holds, and it is also the device the photo comes off. Desktop is the adaptation.

## Job and audience

**The Worker**, mid-publish, on her own or a borrowed Android, on mobile data. She has no photo
picked out — `publish.md` says so in as many words — so whatever this asks of her, it asks of
someone who is about to open a camera roll for the first time in this flow, standing up, and who
will abandon rather than hunt.

**The Hirer** meets the result and never this control. ADR-0009 removed the loss narrative and named
its replacement in the same breath: _"one line in her own words about what she does, and a face."_
With the damage story deliberately gone, the headline and the face are the entire emotional surface
he meets. That is why the photo is `Must`, and it is the whole reason this brief exists.

**The Admin** meets it a third time, as a decision. Nothing in the queue is about her; it is about
whether one image may become public.

## Outcome and proof

**Primary task:** attach a face, or knowingly not, without either answer delaying the profile.

**Success:** she publishes and the profile is live in seconds, and the photo — if she picked one —
is with a person. She knows both facts and does not confuse them.

**The proof it worked** is that nobody waits: NFR1 says a profile reaches the Wall in seconds and
NFR6 says its photo does not, and both hold at once. A design where the profile waits for the
review has failed even if every pixel is right.

## Selected direction

**The photo never gates the publish, and the copy says which of the two happened.** Publishing is
instant and reviewed by nobody; the photo is reviewed by a person and is not instant. Those are two
different facts about two different things, and the failure mode this whole brief is arranged
against is a screen that lets her read them as one — _"tu perfil está en revisión"_, which the voice
guide names as a banned sentence for exactly this reason: nothing about her profile is in review,
her photo is.

**One shape, two causes, and never a badge.** On every public surface a profile with no approved
photo renders **her initial**. That is the same mark whether she never attached one, whether hers is
with a person right now, or whether it was refused — because a badge distinguishing those cases on a
public card would publish a moderation state about a person to strangers, which is the thing
ADR-0009 gates. The initial is not a placeholder standing in for a missing thing; it is a finished
state.

**Her own view is the one place the photo crosses before approval, and it is the whole of the
dignity argument.** On `/my-profile` she sees **her own photo**, at full size, described in a
sentence beside it — never dimmed, never blurred, never behind a warning triangle, never with a
tint or an overlay that says _pending_. A person's own face rendered as a suspect object is the
exact register this product refuses. The sentence carries the state; the image carries nothing.

**The control is a real file input, and drag-and-drop is not the default.** Two reasons, both
measurable rather than aesthetic. The primary surface is 390 px, where there is nothing to drag
from and the whole value is the camera roll that `<input type="file" accept="image/*">` opens on the
first tap. And the page-weight argument, **which has since inverted and is left here corrected
rather than quietly restated**: this brief was written expecting roughly 17 KB of gzip headroom
against NFR3's 250 KB ceiling. Re-taken with `pnpm page-weight /publish` once the photo step landed,
the route is **293 KB gzip — 43 KB over**. So a drag-and-drop library is not "affordable but
unnecessary"; nothing new is affordable, and something has to come off this route whichever control
wins. That is filed rather than decided here, because the ceiling is a spec number and not a brief's
to move.

`[assumed]` — the control's form is the decision `/prototype` is asked to overturn if a richer one
wins on the real route; the `@kibo-ui/dropzone` registry component is built as one of the variants
so the choice is made against something rather than against a description of something. **Judge the
variants against the real budget**, not the 17 KB this paragraph used to claim.

**She never waits for an upload.** The downscale and the PUT start the moment she picks, and run
beside the rest of the form. If she submits before they finish, the profile publishes without the
photo and `/my-profile` is where she attaches it — because a form that blocks its own submit on a
network transfer over mobile data is a form that loses the profile to save the picture.

## Scope and boundaries

**In:** the picker and its preview on `/publish`; the three non-approved states on `/my-profile`;
the initial on the Wall, on `/profiles` and on the public card; the review rows on `/admin/photos`
and the two decisions there; every refusal any of them can produce.

**Out:** cropping, rotation, filters, more than one photo, a photo on anything that is not a
CapabilityProfile, and any control that lets her ask for a re-review. Also out: the bucket, the
Cloudflare zone and the transformation toggle, which are runbook §3 and a human's step.

**Never in frame, ever:** a photo is `personal` under NFR18 and a recorded artifact is fetched by
whoever holds the link, later. Every capture of this surface uses a generated fixture image, never
a photograph of a person.

## States and ranges

The photo has four states and they are not four screens. `absent`, `pending`, `approved`,
`rejected` — the set the `capability_profile_photo_state_known` constraint already enforces.

| State      | Public surfaces (Wall, `/profiles`, the card) | `/my-profile`                                                                |
| ---------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| `absent`   | Her initial                                   | Her initial, and that she has not added one — said as a fact, not as a to-do |
| `pending`  | Her initial — **identical to `absent`**       | **Her own photo**, and that a person is looking at it                        |
| `approved` | Her photo                                     | Her photo, and nothing else to say                                           |
| `rejected` | Her initial — **identical to `absent`**       | Her initial, that it could not be published, and that she can pick another   |

**The two identical cells are the requirement, not a shortcut.** NFR6 is a statement about what is
reachable, and a public surface that renders `pending` differently from `absent` has published the
moderation state even with the bytes withheld.

**Six more states, each with copy of its own:**

- **Picking** — the moment between the tap and the preview. On a 5 MB phone photo the canvas
  downscale is not free, so this is a real state and not a flash. It says what is happening to the
  picture, not that something is loading.
- **Uploading** — a determinate progress if the transfer reports one, and the form fully usable
  underneath it. Never a modal, never a disabled submit.
- **Too large / wrong kind** — DD6's ceiling refusal, and the criterion is explicit that it says so
  **in her terms**: what was wrong with the picture and what to do about it, never a byte count and
  never a MIME type. A photo that survives the downscale and is still over the cap is a photo we
  could not make small enough, and that is what the sentence says.
- **Refused by the ceiling** — `createPhotoUpload` at 10/day. The sentence's second half is fixed by
  the acceptance criteria: **the profile is already live without the photo**. This is the one
  refusal in the product whose job is to make clear that nothing important was lost.
- **Upload failed** — the network, not her. What failed, and that picking again is the whole retry.
- **Published, photo pending** — the success state on arrival at `/my-profile`. The criterion says
  it explains the pending photo **without a badge**, so it is a sentence in the confirmation region
  she is already being sent to, not a second mark on the card beside it.

## Interaction and layout

**On `/publish`** the photo is the **last** thing in the identity group and it is visibly optional.
It sits after the fields that cannot be skipped, because a control that opens a camera roll is the
single most abandonable thing on the page and it must not stand between her and the submit.

The empty control is a labelled button-shaped target at the 44 px minimum, with the label saying
what it does — the verb of its action, per the voice guide — and a line under it saying the photo is
optional and that a person looks at it before it is public. Once picked, the control is replaced by
**the picture itself** at the size the card will show it, with one way back out. There is no second
"remove" affordance hiding in a corner: pick again is the whole interaction.

**NFR4 is why the field says what it says.** With JavaScript unavailable every other field on this
form works and this one cannot — the downscale is a canvas and the PUT is `fetch`. NFR4 names the
photo as the single documented exception and requires the form to say so **where it appears**, so
the no-JS branch renders the sentence in place of the control rather than rendering a control that
does nothing. That sentence is the exception being honoured, not an apology for it.

**On `/my-profile`** the photo sits in the public tier, inside the card that is the proof of what
she published — with the state's sentence directly beneath it, associated to the image by
`aria-describedby` so it is announced with the image rather than found separately. The pending
sentence is the one existing string this ticket has to **correct**: `PHOTO_PENDING` today says her
initial is shown, and on her own view it is not.

**On `/admin/photos`** a row is the photo, large enough to decide on, plus the two decisions and
nothing else. No name, no headline, no city: the Admin is deciding whether an image may be public,
and every extra field is a fact about a person that the decision does not need. The image is served
from quarantine through a short-lived signed read that only an Admin session can obtain — the object
stays unreachable to everyone else, which is what NFR6 counts.

## Constraints and open decisions

**Constraints, all binding:**

- **WCAG 2.2 AA.** The control is a real `<input type="file">` with a real `<label>` — never a
  `<div>` with a click handler. The preview has an `alt` that says what it shows, in Spanish
  ("tu foto de perfil"), never a description of her or of her circumstances. Every state change is
  announced through a `role="status"` region, because a picture appearing is not an announcement.
- **The voice guide, in full.** Labels and buttons at 5 words, body at 20. _Una persona mira tu
  foto_, never _tu foto está en revisión_. Never _verificado_ in any construction. Never a passive
  hiding who acted.
- **ADR-0012.** Every identifier is English — the route segment, the column, the state values, the
  action names. Only what she reads is Spanish.
- **NFR3's image clause.** No Wall card requests an image more than 2× its rendered CSS width, and
  resizing happens at Cloudflare's edge rather than on the Fly machine.
- **The registry first.** `Avatar`, `Field`, `Input`, `Button`, `Alert`, `Skeleton` and `Empty` are
  already in `packages/design-system`; anything else comes from the shadcn registry before it is
  hand-rolled.

**Open decisions — the human's, not this session's:**

1. `[assumed]` **The control's form.** File input versus a richer drop target. Settled by
   `/prototype` on the real route, against the page-weight number rather than against a preference.
2. `[assumed]` **Whether `rejected` says why.** This brief renders one sentence and no reason,
   because a reason is a message from an Admin to a Worker and this product has no such channel —
   and the alternative, a fixed list of reasons, is an adjudication surface the three refusals
   refuse. If a reason is wanted, it is a spec amendment.
3. `[assumed]` **Whether she may remove an approved photo.** Not built. It is neither in the API
   contract nor in the state table, and inventing it here would be inventing a fifth state.
4. **`motion-policy` is `UNSET`** in `docs/policy/ux.md`. The upload's progress is the only motion
   this surface has; whether a reduced-motion pass is owed is that key's answer, not this brief's.
