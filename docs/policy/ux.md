# UX policy

Owner: **Design lead** ([owners.md](owners.md)). Read by `ux-design`.

An `UNSET` value is raised as a flagged concern naming this file and the key. It is never guessed.

**Four keys here are set.** `wcag-level` is committed in `PRODUCT.md`; the three below it come from
the effort 0002 design interview:

| Key                 | Value                                                                                                                                                                            | What it settles                                                                                                                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wcag-level`        | **WCAG 2.2 AA**                                                                                                                                                                  | The accessibility bar every surface clears. Committed in `PRODUCT.md`, so it binds the token layer: any preset applied to `packages/design-system/src/styles/globals.css` must clear AA contrast in both themes                                                                                                                              |
| `browser-support`   | **Baseline Widely Available** — 30 months past the date all four core browsers shipped a feature. Concretely Chrome on Android 10+, Safari on iOS 16+, current evergreen desktop | The floor. Decides whether a CSS feature is available or needs a fallback                                                                                                                                                                                                                                                                    |
| `locales`           | **`es-CO` only**                                                                                                                                                                 | Which languages ship, and whether text can grow 40% without breaking a layout                                                                                                                                                                                                                                                                |
| `rtl-support`       | **no**                                                                                                                                                                           | Whether layouts must mirror                                                                                                                                                                                                                                                                                                                  |
| `theme-parity`      | **light only**                                                                                                                                                                   | Whether every surface must be correct in both light and dark. `PRODUCT.md` records this as an open call, not a rule                                                                                                                                                                                                                          |
| `voice-guide`       | `UNSET`                                                                                                                                                                          | Where the product's voice is written down. Until set, microcopy has no authority and inventing one is worse than naming the gap. **`UNSET` by decision** ([intent Q6](../efforts/0002-profile-to-contact-exchange/intent.md)): a `brand-voice` session sets it, and it blocks the first ticket rendering `es-CO` copy — not Build as a whole |
| `motion-policy`     | `UNSET`                                                                                                                                                                          | Whether `prefers-reduced-motion` is honoured as a hard requirement, and what "reduced" means here                                                                                                                                                                                                                                            |
| `analytics-consent` | `UNSET`                                                                                                                                                                          | Whether a consent gate precedes instrumentation, which changes what the first paint may do                                                                                                                                                                                                                                                   |

## Fixed by this repo

Not `UNSET` — decided, and a spec may not reopen them without an ADR.

| Fact                                                                                                  | Where it comes from                              |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `DESIGN.md` is the visual authority; `globals.css` holds the values it names                          | `DESIGN.md`                                      |
| Visual change goes through semantic tokens, never a hand-edited generated component                   | `PRODUCT.md`, `packages/design-system/CLAUDE.md` |
| Components come from the shadcn registry on Base UI, and stay swappable via a preset                  | `PRODUCT.md`                                     |
| Dark mode is class-based and both themes live in the tokens, so a spec never names a `dark:` override | `DESIGN.md`                                      |

## The state set

Fixed. Every surface a spec introduces names all six, per surface. The state that goes unnamed at
Design time is the one Build invents at 5pm.

| State               | What it must answer                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `empty`             | What would be here, and how to get it. Never a blank region                                                                                                        |
| `loading`           | What the Suspense fallback shows, and whether it holds the layout                                                                                                  |
| `partial`           | Some data arrived, some has not. Distinct from loading, and the state most often missed                                                                            |
| `error`             | What failed, whether retrying helps, and what the user can do instead                                                                                              |
| `permission denied` | Distinguished from `empty` — "you have none" and "you may not see these" are different answers, and conflating them either confuses a user or leaks the difference |
| `success`           | Whether anything is confirmed, and for how long it stays on screen                                                                                                 |
