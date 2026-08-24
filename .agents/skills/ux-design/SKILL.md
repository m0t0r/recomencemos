---
name: ux-design
description: The UX lens on a spec — routes the surface to the right tool (impeccable, writing-for-agents, or neither) and owns the Suspense-to-loading-state bridge. Load when writing a spec.md that touches anything a person or an agent consumes.
---

# UX design

This lens is a **router, not a rulebook**. The rulebook already exists and is installed: `impeccable`
owns visual and interaction design at real depth, `DESIGN.md` owns the visual system, and
`docs/policy/ux.md` owns the bar. Restating any of that here would fork it, and the fork always wins
somewhere nobody is looking.

**It runs in the main session, not as a subagent** — unlike the other four lenses. Its third case
interviews the user, and a subagent cannot.

---

## The router

The question is not "is there UI." It is:

> **Who consumes the surface this change adds, and which skill owns that consumer?**

| Case                                                                 | What runs                    | What the spec's **UX design** section says                                       |
| -------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| **1. No consumed surface** — a migration, a cache handler, CI         | Nothing                      | `_No consumed surface._` plus the one-line reason                                |
| **2. Local change to an existing surface** — a field, a state, a step | Nothing at Design            | The surface, its existing brief, and the states this change adds                 |
| **3. New surface or flow**                                            | `/impeccable shape <target>` | The decisions, and a link to the surface brief                                   |
| **4. Agent-facing surface** — a skill, `CLAUDE.md`, a hook            | `writing-for-agents`         | The consumer, its trigger, and the failure mode when it misfires                 |

**The conclusion is always written down.** "This change has no UI" is a finding the section states,
never a silence. A section that is silently absent is indistinguishable from one nobody thought
about — and this is the lens most often skipped on a backend change that turns out to have an error
message.

### Case 2 is the one people get wrong

A section, component, feature, or state **inside an established surface inherits that surface**.
Never turn a local addition into an identity exercise — that is impeccable's own rule, and `shape`
is a discovery interview for a *new* surface. Running it on a new form field is the failure mode.

Those changes reach impeccable at **Build**, through the craft floor and the design detector hook,
not at Design. What Design owes them is the state set (below) and the copy.

Where a case-2 change has a genuine open question about *which* concrete alternative wins, that is
`/prototype` UI, sub-shape A: variants on the real route, against real data and real density,
switchable by `?variant=`. It needs an existing page to sit inside, which is exactly why it belongs
to this case and not to case 3.

### Case 3: running `shape`

`/impeccable shape <target>` returns a confirmed design brief and stops — it writes no code and no
direction contract. For a genuinely new surface it routes through impeccable's own concept round
first, which deals three structurally different compositions and has the user lock one.

**Target naming.** The route does not exist yet, and surface briefs are keyed by target path. Use
the path the spec commits to (`apps/web/app/accounts/page.tsx`), so the brief and the spec name the
same thing and stay linked once the file exists.

**Bound it.** One interview round is the default. `shape` fires on a minority of efforts, and that
is correct — a template that interviewed the user on every spec would be abandoned by the third one.

The brief is the durable artifact. The spec's UX section carries the **decisions** and links the
brief at `.impeccable/briefs/<slug>.md`; it does not copy it. One source of truth per artifact.

---

## What this lens owns at Design time

Everything else is delegated. These three are not, because nobody else holds them at spec time.

### 1. The state set, per surface

The six states are fixed in `docs/policy/ux.md`: **empty, loading, partial, error, permission
denied, success**. Every surface the spec introduces names all six.

The happy path is the state a spec writes without being asked. The state that goes unnamed at Design
time is the one Build invents at 5pm — and `partial` is the one most often missed, because it only
appears once real data arrives in pieces.

### 2. The Suspense fallback is a designed state

Cache Components is on, so uncached data outside a `<Suspense>` boundary fails the build. **Every
boundary the spec implies therefore ships a fallback, and that fallback is a UX decision this lens
owns** — not a spinner picked by whoever writes the component at the end of the ticket.

For each boundary, say **what the fallback shows and whether it holds the layout**. A fallback of a
different shape than the content it replaces is a layout shift the spec has just specified. The
design system ships `skeleton.tsx` for exactly this; a spinner in the middle of content is the
wrong answer here.

This is the bridge nobody else crosses: `system-design` decides where the streaming boundaries go
for latency, and this lens decides what the user looks at while they resolve.

### 3. The actual words

**Write the real copy in the spec**, at least for every error and empty state. Copy deferred to
Build is copy written by whoever is closest to the deadline, and it is the most user-visible part of
the whole change.

Voice comes from `voice-guide` in `docs/policy/ux.md`. Where it is `UNSET`, raise the concern — a
template cannot know how your product sounds, and inventing a voice is worse than naming the gap.
The `ux-writing` and `clarify` skills carry the craft once a voice exists.

---

## Constraints that are already settled

Do not re-derive these; a spec contradicting one is a concern, not a preference.

- **`DESIGN.md` is the visual authority.** A spec names the semantic token (`bg-background`,
  `text-muted-foreground`), never a colour value and never a `dark:` override — both themes already
  live in the tokens.
- **A token that does not exist yet is a change to the design system**, which is the Design lead's
  call, not a line in an implementation ticket.
- **Components come from the shadcn registry, on Base UI.** A spec naming a component the registry
  provides gets the registry one; a spec needing one it does not provide says so, because building
  it is scope the ticket has to carry.
- **WCAG 2.2 AA** is set in `docs/policy/ux.md` and binds the token layer.

Two accessibility questions the spec answers in prose, because no component can:

- **Name the keyboard path** through every new surface, and where focus lands after each action —
  especially after an async state resolves.
- **Say what is announced** when a state changes. A screen-reader user gets nothing from a spinner
  swapping to content unless something says so.

---

**Done when** the spec's UX section states its router case explicitly, every surface names its full
state set, every Suspense fallback says what it shows and whether it holds the layout, every error
and empty state carries its actual copy, and a new surface links its brief rather than restating it.
