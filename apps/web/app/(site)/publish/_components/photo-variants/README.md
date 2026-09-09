# The photo control, three ways — ticket #18, Act 5

**Throwaway.** These live on `prototype/18-ui-variants` and never on `dev`. One
gets folded into `photo-field.tsx` properly, rewritten rather than copied; the
other two stay here as the primary source for why.

> Three variants of the `/publish` photo step, switchable via `?variant=`, on the
> existing `/publish` route.

## The question

`.impeccable/briefs/photo.md` marks the control's form **`[assumed]`**. The brief
picked a plain file input for two stated reasons, and **one of them has since
inverted**, which is why this is worth building rather than deciding on paper:

| The brief said                                                                                                                                      | Now                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| The primary surface is 390 px, where there is nothing to drag from and the whole value is the camera roll `accept="image/*"` opens on the first tap | **Unchanged.** This is still the strongest argument, and it is the one to judge C against                                      |
| `/publish` has ~17 KB of gzip headroom against NFR3's 250 KB, which a drag-and-drop library is a real fraction of                                   | **Wrong, and the wrong way.** Re-taken: **293 KB gzip, 43 KB over** ([#234](https://github.com/m0t0r/recomencemos/issues/234)) |

So the budget argument no longer says "a dropzone is affordable but
unnecessary". It says nothing new is affordable at all, and something has to come
off this route whichever variant wins. C is built anyway — partly because the
plan named it, and partly because **the only honest way to price it is to
install it and measure**, which is what the table at the bottom is for.

## The variants

### A — the label and the picture (what ships today)

A `<label>` styled as a button in front of an `sr-only` `<input type="file">`,
with the preview appearing above it once she picks. The remove affordance is a
third control beside the two.

The conservative answer, and the incumbent. Its weakness is the one the Spec
review found: **the brief describes B, not A** — _"the control is replaced by the
picture itself… There is no second 'remove' affordance"_ — so A is either the
right call and the brief is stale, or the brief was right and A drifted.

### B — the picture is the control

One circle. Empty, it is the affordance: a dashed ring with her initial and the
verb underneath, sized as a tap target rather than as a button. Filled, it is the
photo, and tapping it opens the camera roll again to replace. No second button,
no separate preview, no remove — removing is choosing nothing, which the ceiling
copy already says costs her nothing.

This is what the brief actually describes. It is also the smallest thing on a
390 px screen: one target instead of three, and the control and its result are
the same object rather than two things that have to be read together.

The risk is discoverability — a circle with no button chrome may not read as
tappable to someone who has never seen the pattern — which is exactly the sort of
thing that is decided by looking rather than by arguing.

### C — the dropzone (`@kibo-ui/dropzone`)

The shadcn ecosystem's answer, and the one the plan comment named. The official
`@shadcn` registry has no dropzone — only `input-file`, which is `Input
type="file"` plus a `Label` — so this is the nearest real registry component.

A bordered drop target that also accepts a click, with drag state, file-type and
size rejection surfaced by the component rather than by our copy.

**It is desktop-shaped on a surface whose primary form is 390 px**, where there
is nothing to drag from and the drop affordance is dead chrome. Judge it on the
desktop adaptation, and then ask whether the desktop adaptation is worth what it
costs the phone — which is the question the table below is for.

## The cost, measured

Taken on this branch with `pnpm build && pnpm page-weight /publish`, three
builds with one variable pinned each time — never quoted from memory, which is
how three documents once carried numbers 39 KB too high.

| Build                                          | scripts | `/publish` gzip | vs NFR3's 250 KB |
| ---------------------------------------------- | ------- | --------------- | ---------------- |
| Shipped `/publish`, no prototype               | 17      | **293 KB**      | +43              |
| A only (+ the switcher's ~2 KB of scaffolding) | 17      | **295 KB**      | +45              |
| A + B                                          | 17      | **295 KB**      | +45              |
| A + B + C                                      | 18      | **302 KB**      | +52              |

**B is free. C costs +7 KB and one more chunk**, on a route already 43 KB over.

**A measurement gotcha worth keeping**, because it nearly produced a wrong
number: the first A+B build still read **301 KB**, because `index.ts` is a barrel
and re-exporting `VariantC` from it pulls `react-dropzone` in whether or not
anything renders C. Pinning a variant means cutting it out of the **barrel** as
well as the branch. A 1 KB delta for a drag-and-drop library was the tell.

## What the measurement does and does not settle

It settles the arithmetic and nothing else: **7 KB is what C costs, and B costs
nothing**. It does not say which control is better, and the budget is not the
only axis — if C is plainly the better control, 7 KB is a price worth arguing
about rather than a veto, and #234 has to be answered either way.

Three things came out of building C that are not on the scale, and each is a
real cost of taking it:

1. `shadcn add` also wrote a package literally called **`cn`** into the design
   system's manifest, beside the repo's own `cn` in `lib/utils`.
2. It asked to **overwrite `button.tsx`** and was declined. `avatar.tsx`'s header
   already records a divergence to re-apply after exactly this, so taking C means
   hand-merging its `button` dependency or losing that.
3. The registry's output **fails this repo's `--max-warnings 0`** — it constructs
   its context value inline. The file carries a scoped disable and a note saying
   so, and a patched registry component is one `shadcn add` from being silently
   reverted.

And one thing about its fit rather than its price: the component's own filled
state shows **a file name, not a face**, so C still needs our own preview beside
it. On the surface whose whole argument is that she sees her own photo, that is
the component disagreeing with the brief.

## How to drive it

```sh
pnpm dev
# then, signed in:
#   /publish?variant=A
#   /publish?variant=B
#   /publish?variant=C
```

← and → cycle, and the floating bar is hidden in production builds.

The interesting answer is usually not one of the three. _"B's circle with A's
help line"_ is a real outcome and the right one to say out loud.
