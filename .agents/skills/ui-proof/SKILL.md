---
name: ui-proof
description: >
  Capture proof that a change to what a person sees actually works — before/after
  video, stills, or an accessibility-tree diff — so a reviewer can check the
  seam-3 leg instead of taking the agent's word for it. Use during a Build
  session that touches a rendered surface, and before opening the PR.
---

# ui-proof

`next-dev-loop` verifies a change at runtime. This captures what it saw, so the
Evidence table's seam-3 row names an artifact the way its other rows name a test.

**The rule this serves is in `docs/policy/build.md`; this is only the craft.** How
long an artifact lives, and whether one is required at all, are answers that file
gives. Do not decide either here.

## preflight

Three checks, in this order. The first one is the one sessions get wrong.

1. **`ffmpeg` must be on `PATH` before `record start`.** `agent-browser` shells
   out to it for video and not for screenshots, and the failure surfaces at
   **`record stop`** — after the flow has been driven and with nothing saved:

   ```
   ✓ Recording started: ./before.webm      ← start reports success
   ✗ ffmpeg not found or failed to execute ← stop, one flow later
   ```

   ```bash
   command -v ffmpeg >/dev/null || { echo "brew install ffmpeg"; exit 1; }
   ```

   If it is missing, say so and fall back to stills for this session. Never drive
   a flow hoping the recorder is live.

2. **`next dev` is running and is yours.** A worktree shares port 3000 with every
   other tree. `apps/web/.next/dev/lock` names the PID; `lsof -i :3000` settles it
   otherwise.

3. **One session id, exported once**, exactly as `next-dev-loop` does it — the
   capture and the verification are the same browser:

   ```bash
   SESSION="$(agent-browser session id --scope worktree --prefix next-dev-loop)"
   export AGENT_BROWSER_SESSION="$SESSION" AGENT_BROWSER_RESTORE="$SESSION"
   ```

## the before is taken first

**Take the "before" immediately after the worktree opens and before the first
edit.** A fresh worktree is already at `origin/<default>`, so the before-state is
sitting there for free. Reconstructed at PR time it costs a second checkout, a
second `next dev` on another port, and a shared database that may have moved
underneath it.

Where the ticket is a bug fix, the before **is the reproduction** — capture it
while diagnosing rather than staging it again afterwards.

If you reach the end of a session with no before, say so in the PR body. Do not
fabricate one by reverting the change and re-running: that captures a tree nobody
reviewed.

## pin the pair, or the diff is noise

A before/after pair that differs in viewport, theme, data or motion diffs on
things nobody changed, and a reviewer stops looking. Pin all four, on both
captures:

```bash
agent-browser set viewport 390 844      # phone-first; the product's floor
agent-browser set media light           # theme-parity is light only
```

- **Same seeded fixtures.** Same rows, same order, same names.
- **Same route and same entry path.** Arrive the same way both times.
- **Reduced motion** (`agent-browser set media light reduced-motion`) when the
  change is not itself about motion. When it is, capture both.

Keep a flow under ~30 seconds and use `--fps 15` unless the point is a
transition; the file is smaller and every frame still lands.

## which proof

Keyed on **what changed**, never on how big the ticket is. Size is a proxy a
session can argue itself out of.

| The change is in…                                                                                                     | Capture                       | Why                                                                                    |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| **Time** — a flow across screens, focus order, tab sequence, loading → loaded → error, an optimistic update, a submit | **Video**, before and after   | A still cannot show a sequence                                                         |
| **Space** — the same screen in the same state: layout, spacing, colour, type, copy, an icon                            | **Before/after still pair**   | One frame answers it completely. Most bug fixes land here                               |
| **Neither** — identical pixels, changed accessibility tree: a role, an accessible name, an announcement                | **`diff snapshot`, as text**  | Free, greppable, permanent, and it is the thing the review passes actually care about |

A change can be in two rows at once — a re-laid-out form whose focus order also
moved wants the pair *and* the clip. Capture both rather than picking the larger.

**When in doubt between a still and a video, ask what the reviewer would have to
do to disbelieve you.** If they would have to watch something happen, record it.

## capture recipes

**Stills.**

```bash
agent-browser screenshot ./.artifacts/ui-proof/before-publish.png
agent-browser screenshot --full ./.artifacts/ui-proof/before-publish-full.png
```

**Video.** `record start` accepts a URL and will navigate; omit it to record from
where the browser already is. Always `record stop` before `close`, or the file is
never flushed.

```bash
agent-browser record start ./.artifacts/ui-proof/after-publish.webm --fps 15
# …drive the flow…
agent-browser record stop
```

**Accessibility-tree diff.** Save the baseline before the edit, diff after it, and
paste the unified output into the PR body in a fenced block:

```bash
agent-browser snapshot > ./.artifacts/ui-proof/before.snapshot     # before the edit
agent-browser diff snapshot --baseline ./.artifacts/ui-proof/before.snapshot
```

**Pixel diff** (`agent-browser diff screenshot --baseline <png>`) reports a
mismatch percentage and paints changed pixels red. It answers "did anything move"
and never "is the new thing right", so it supports a still pair rather than
replacing one.

Everything lands under `.artifacts/ui-proof/`, which is gitignored — an artifact
is published, never committed.

## what is never recorded

- **`/admin/enrol/[token]`.** A recording captures the address bar, and that route
  carries a live credential in a path segment. There is no cropping exception and
  no "it expires anyway": an artifact is fetched by whoever holds the link, later.
  Verify that surface without a camera running.
- **Real or realistic personal data.** Seeded fixtures only — a name, a phone
  number or a photograph in a published artifact is an egress, and a Worker's full
  identity is gated.
- **Anything typed into a password or one-time-code field**, even a fixture's.

If a flow cannot be captured without one of these in frame, capture the part that
can and say in the PR body which part could not, and why. A narrowed artifact is
worth more than none; a leaked one is worth less.

## naming, so the pipeline can pair them

`<state>-<surface>.<ext>`, where `<state>` is `before` or `after` and `<surface>`
is the route or component under review — `before-publish-form.webm`,
`after-publish-form.webm`. Pairing is by suffix, so the two halves of a comparison
differ only in their first word.

## gotchas

- **`record stop` before `close`.** `close` saves cookies; it does not flush a
  recording.
- **A blank read or `about:blank` right after `open` is a dropped session**, not a
  broken route — reopen with `--session` and `--restore` before concluding
  anything about the change.
- **Do not narrate the recording in the PR body frame by frame.** The artifact is
  the evidence; the prose says which criterion it proves and nothing more.
- **Two captures, one browser.** Re-using `next-dev-loop`'s session is what keeps
  the login state, the viewport and the theme identical across the pair.
