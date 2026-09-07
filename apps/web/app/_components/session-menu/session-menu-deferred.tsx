"use client";

/**
 * The menu's loader — one module whose whole job is to keep Base UI's popup
 * stack off every route's first load.
 *
 * **What it was costing.** `dropdown-menu` is Base UI's `Menu`, and `Menu` pulls
 * floating-ui with the positioner, the focus guards and the scroll lock. Measured
 * from a production build: 52.6 KB gzip, on the first load of every page under
 * `(site)` and `(admin)` — because `AppHeader` is rendered by a layout, and a
 * layout's cost is paid by every route below it. A signed-out visitor downloaded
 * all of it for a menu behind an avatar she has no session to see.
 *
 * **Why the deferral has to happen here and not in `AppHeader`.** A route's
 * client-reference manifest carries every client module reachable from the server
 * graph, whether the import that reaches it is static or dynamic — so
 * `next/dynamic` written in the Server Component measures identically (65.6 →
 * 66.2 KB, which is noise). Next's own lazy-loading guide says it outright:
 * _"When a Server Component dynamically imports a Client Component, automatic
 * code splitting is currently not supported."_ The split needs a client module on
 * the far side of the boundary, which is what this file is. It is recorded here
 * because it is an afternoon's work to rediscover and nothing about it is visible
 * in a diff.
 *
 * **SSR stays on, and that is not a default left unexamined.** `ssr: false` buys
 * exactly the same bytes and costs the no-JavaScript story: `session-menu.tsx`
 * renders the fallback submit button that the `<noscript>` rule reveals, so a menu
 * that is not server-rendered puts _Salir_ out of reach with scripting disabled —
 * #80's acceptance criterion 3. Prerendered and code-split is strictly better than
 * client-only and code-split here.
 *
 * **Nothing moves when the chunk lands.** The avatar is 40 px inside a header
 * fixed at `h-14` in every state, and React keeps the server-rendered markup in
 * place while a lazy boundary's chunk is still in flight during hydration. The
 * header's height is acceptance criterion 6 of #80 and is `HeaderRow`'s to hold,
 * not this file's.
 */

import dynamic from "next/dynamic";
/**
 * `import type`, so the props do not put a runtime edge back to the module this
 * file exists to defer. It is erased before the bundler ever sees it.
 */
import type { SessionMenuProps } from "./session-menu";

const SessionMenu = dynamic(() => import("./session-menu").then((module) => module.SessionMenu));

/**
 * Named for the mechanism rather than for the menu, deliberately: a reader who
 * met `SessionMenu` imported from a second path would have to open both files to
 * learn which one renders. The one thing this component adds is _when_ its code
 * arrives.
 */
export function DeferredSessionMenu(props: SessionMenuProps) {
  return <SessionMenu {...props} />;
}
