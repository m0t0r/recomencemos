/**
 * **The `<noscript>` rule, which is the whole no-JavaScript story for
 * {@link SessionMenu}.**
 *
 * The registry's `dropdown-menu` cannot open without JavaScript, and #80's
 * acceptance criterion 3 requires _Salir_ to work when it is unavailable. So the
 * menu is hidden and a plain submit button is revealed — a second **trigger** on
 * the one form in `session-menu.tsx`, never a second sign-out path.
 *
 * **It lives beside the menu rather than inside a shell**, because it is the
 * menu's other half: the rule targets `data-slot` attributes that only
 * `session-menu.tsx` renders, and a shell that drew the menu and forgot this
 * would leave _Salir_ unreachable with scripting off — which is the one state
 * nobody looks at. It was in `site-header.tsx` while the site shell was the only
 * caller; `/admin` (#17) is the second, and a copy there would have been a second
 * place to keep the slot names in agreement.
 *
 * `dangerouslySetInnerHTML` rather than JSX children, and it is the safe use of it
 * rather than an exception to the rule: the browser parses `<noscript>` content as
 * *text* when scripting is on, so React would hydrate a text node against the
 * `<style>` element it rendered and mismatch. The string is a compile-time
 * constant built from two identifiers — no interpolation of anything a person
 * typed, which is the property `dangerouslySetInnerHTML` actually asks of a
 * caller.
 *
 * **Why no `!important`:** Tailwind v4 puts `hidden` in the `utilities` cascade
 * layer, and an unlayered rule beats any layered one regardless of order or
 * specificity. This `<style>` is unlayered.
 *
 * **The honest gap, recorded rather than discovered later:** `<noscript>` fires
 * when JavaScript is *disabled*, not while it is *enabled but unhydrated*. In that
 * window the trigger is painted and inert and this fallback is hidden. The Popover
 * API would close it with no fallback at all, and NFR5 rules it out — Baseline
 * April 2024, about two months short of the 30-month Widely Available bar. Worth
 * re-reading in late 2026.
 */

import { SESSION_MENU_FALLBACK_SLOT, SESSION_MENU_SLOT } from "./slots";

const NO_SCRIPT_RULE =
  `<style>` +
  `[data-slot="${SESSION_MENU_SLOT}"]{display:none}` +
  `[data-slot="${SESSION_MENU_FALLBACK_SLOT}"]{display:inline-flex}` +
  `</style>`;

export function SessionMenuNoScript() {
  return <noscript dangerouslySetInnerHTML={{ __html: NO_SCRIPT_RULE }} />;
}
