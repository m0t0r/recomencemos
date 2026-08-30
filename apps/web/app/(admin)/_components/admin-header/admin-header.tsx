/**
 * The Admin's chrome — one strip above `/admin` and every route under it.
 *
 * **It is `AppHeader` with three answers instead of the site shell's five**, and
 * the two it does *not* give are the whole of what makes this a different shell:
 * no `accountHref`, and nothing offered to a signed-out reader.
 *
 * **`(admin)/layout.tsx` used to render no chrome at all, and that was one
 * decision too many.** The recorded argument was against reusing `SiteHeader`
 * whole — its wordmark goes to the Wall, its signed-out branch offers the
 * *public* door, and its menu routes into `/account`, which is the Worker's own
 * Account. All three are true, and all three are now props. What none of them
 * justified was `/admin` having no header: a surface with no product name and no
 * way out reads as a detached tool rather than as the same product seen from the
 * operator's side, and the way out was missing outright.
 */

import { AppHeader } from "@/app/_components/app-header/app-header";
import { signOutAdmin } from "@/app/_components/session-menu/actions";
import { QUEUE_LINK_LABEL } from "./messages";

export { AppHeaderPlaceholder as AdminHeaderPlaceholder } from "@/app/_components/app-header/app-header";

export function AdminHeader() {
  return (
    <AppHeader
      /* The queue, not the Wall — this shell's home is `/admin`. */
      homeHref="/admin"
      homeLabel={QUEUE_LINK_LABEL}
      action={signOutAdmin}
      /*
        **No `accountHref` and no `signedOut`.** `/account` is the Worker's own
        Account under a different shell, so from the queue it is a row that
        navigates out of the surface being worked. And the one state this renders
        signed-out in is `/admin/sign-in`, where the reader is already looking at
        a door — the site's *Entrar* would point at the public one.
      */
    />
  );
}
