"use client";

/**
 * The signed-in half of the shell: who she is, where her account lives, and the
 * way out.
 *
 * **The trigger is the avatar and nothing else** — chosen at `/prototype` from
 * three variants running on the real route (variant B; the losers are on
 * `prototype/80-header-variants`). The address is not in the row at all: it is
 * inside the menu, where it is never truncated, and in the trigger's accessible
 * name, where a screen reader always gets it in full.
 *
 * **What that trade costs, stated rather than glossed:** the borrowed-Android
 * check DD5 makes at sign-in — _"on a borrowed Android it may be the phone
 * owner's"_ — is no longer continuous. She taps once to see whose account she is
 * in. What it buys is a 40 px target that never competes with the product name
 * for room on a 360 px screen, and an address that is never shown as
 * `maria.rest…`, which is the form in which it answers nothing.
 *
 * **One form, one action, two triggers.** The `<form>` lives here and carries an
 * `id`; the menu item and the `<noscript>` fallback in `site-header.tsx` are both
 * `<button type="submit" form={SIGN_OUT_FORM_ID}>`. A submit button needs no
 * ancestor form when it names one by id, which keeps the unhydrated path from
 * becoming a *second sign-out path* with its own logic to keep in agreement — it
 * is a second button on the same form.
 *
 * That matters structurally as well as tidily: the menu's content is **portalled
 * to the document body**, so a `<form>` wrapping the item would not be the form
 * the header renders, and a submit inside a menu item that closes on click races
 * its own submit. Naming the form by id sidesteps both.
 *
 * **Why this is a Client Component at all**, given ADR-0015 keeps auth on the
 * server: the menu is, and only the menu. Nothing here holds an auth client,
 * reads a cookie or knows Better Auth exists — it holds an address the server
 * gave it and a reference to a Server Action.
 */

import { Avatar, AvatarFallback } from "@repo/design-system/components/avatar";
import { Button } from "@repo/design-system/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/dropdown-menu";
import { IdCardIcon, LogOutIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import type { signOut } from "./actions";
import { ACCOUNT, SIGN_OUT, SIGNED_IN_AS, sessionMenuLabel } from "./messages";
import { SESSION_MENU_FALLBACK_SLOT, SESSION_MENU_SLOT, SIGN_OUT_FORM_ID } from "./slots";

/**
 * The shape both shells' sign-out actions have.
 *
 * **Taken from one of them rather than written out**, because next-safe-action's
 * `SafeStateActionFn` is not something a hand-rolled structural annotation
 * satisfies — a narrower parameter type fails contravariantly, and spelling the
 * wider one out here would be this file restating a vendor type it cannot keep in
 * agreement. `signOut` and `signOutAdmin` are built identically in `./actions`, so
 * either names the type and both satisfy it.
 *
 * `import type`, so nothing from a `"use server"` module reaches this client
 * bundle — the import is erased.
 */
export type SignOutAction = typeof signOut;

type SignOutResult = Awaited<ReturnType<SignOutAction>>;

/**
 * next-safe-action's own result shape, and `{}` is the library's "nothing has
 * happened yet" — so `idle` is not a state this surface invents and then has to
 * keep in agreement with the library's.
 */
const INITIAL: SignOutResult = {};

export interface SessionMenuProps {
  readonly email: string;
  /**
   * The sign-out action, passed in rather than imported.
   *
   * **The two shells end a session at the same place and land in different
   * ones** — the Wall for a Worker, `/sign-in` for an Admin — and that
   * destination is the only thing that differs between them. Both actions are
   * three lines over the one `endSession` body in `lib/end-session.ts`, so the
   * independent authorization, the revocation and the cookie clearing stay in
   * one place while the landing does not have to.
   *
   * A Server Action reference is an ordinary prop to a Client Component: nothing
   * here holds an auth client, reads a cookie, or knows Better Auth exists
   * (ADR-0015).
   */
  readonly action: SignOutAction;
  /**
   * Where "Tu cuenta" goes, or **absent to omit the row entirely**.
   *
   * That absence is the one genuine difference between the two shells' menus.
   * `/account` is the *Worker's* own Account, under `(site)`'s shell — useful
   * chrome on the public product, and a row that navigates out of the queue when
   * it is the Admin reading it. Everything else the menu does is wanted in both
   * places, which is why this is a prop and not a second component.
   */
  readonly accountHref?: string;
  /**
   * Her profile row, or absent to omit it — the same shape as `accountHref`,
   * for the same reason: `(site)`'s shell has one, `(admin)`'s does not. The
   * label is the caller's because it depends on what she has: _Tu perfil_ once
   * it exists, _Publica lo que sabes hacer_ until then.
   */
  readonly profile?: { readonly href: string; readonly label: string };
}

/**
 * Her initial, for the avatar.
 *
 * The first character of the address, uppercased — there is no name to take one
 * from until a CapabilityProfile exists. It is decorative: the address is in the
 * trigger's accessible name and in the open menu, so a reader loses nothing if
 * this is a digit or a diacritic.
 */
function initialOf(email: string): string {
  return [...email][0]?.toLocaleUpperCase("es-CO") ?? "";
}

export function SessionMenu({ email, action, accountHref, profile }: SessionMenuProps) {
  const [result, formAction, pending] = useActionState(action, INITIAL);

  /**
   * Only a *returned* refusal reaches here. A success redirects, so this state
   * is never the happy path resolving — it is always the sentence that says the
   * session is still open.
   */
  const problem = result.serverError?.message;

  return (
    <div className="flex items-center gap-2">
      {/*
        The form itself renders nothing. Both triggers name it by id, and React
        puts its own hidden action fields inside it — which is what makes the
        unhydrated submit work.
      */}
      <form id={SIGN_OUT_FORM_ID} action={formAction} />

      {/*
        The wrapper exists to give the `<noscript>` rule something to hide.
        `DropdownMenu` is Base UI's `Menu.Root`, which renders no element of its
        own, and the trigger already carries its own `data-slot` from the
        registry — so neither is a place to hang one.
      */}
      <div className="flex" data-slot={SESSION_MENU_SLOT}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                /*
                  **The avatar is the button, at the avatar's own size.** `size`
                  is not one of the registry's steps here because none of them is
                  a circle: `icon` is `size-9` with a rounded-*md* corner, so an
                  avatar inside it reads as a small circle floating in a square.
                  `size-10` matches `Avatar size="lg"` exactly and `rounded-full`
                  makes the focus ring and the hover wash follow the avatar's own
                  edge.

                  40 px is the target. WCAG 2.2 AA asks 24, so this clears it
                  with margin — the number is chosen for a thumb on a phone,
                  which is the device this is mostly read on, not for the floor.
                */
                className="size-10 rounded-full border-0 p-0"
                aria-label={sessionMenuLabel(email)}
              />
            }
          >
            <Avatar size="lg" aria-hidden="true">
              {/* Her initial in ink: a filled shape is what marks "signed in" here, not a hue on a badge. */}
              <AvatarFallback className="bg-primary text-primary-foreground text-base font-medium">
                {initialOf(email)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="min-w-56">
            {/*
              **The address, untruncated — and with this variant it is the only
              place it is visible.** That makes this block load-bearing rather
              than a courtesy header on a menu: it is the answer to "whose
              account am I in", which on a borrowed phone is the question the
              whole shared-device session exists around.

              `break-all` because a long address must wrap rather than ellipse
              here; ellipsing it would defeat the one job this block has.

              `aria-hidden` because the trigger's accessible name already
              announces the address — announcing it again on open is noise, not
              information.
            */}
            <div className="px-2 py-1.5" aria-hidden="true">
              <p className="text-muted-foreground text-xs">{SIGNED_IN_AS}</p>
              <p className="text-sm font-medium break-all">{email}</p>
            </div>

            <DropdownMenuSeparator />

            {/* Her profile first: it is the thing she came here to do. */}
            {profile ? (
              <DropdownMenuItem
                render={
                  <Link href={profile.href}>
                    <IdCardIcon aria-hidden="true" />
                    {profile.label}
                  </Link>
                }
              />
            ) : null}

            {/*
              **The way to `/account`, and the only navigation the shell offers —
              where a caller asks for it.**

              #80 shipped without it because the page did not exist yet and the
              ticket said *link only what exists*; story 12 built it, so this is
              that deferral closing rather than a new decision.

              **Absent for the Admin's shell** (#17), which is the one difference
              between the two menus and the reason `accountHref` is a prop rather
              than this being two components. `/account` is the *Worker's* own
              Account, under `(site)`'s shell; from the queue it is a row that
              navigates out of the surface being worked. The separator goes with
              it — a divider above nothing is a rule with one side.

              **It renders as a `<Link>` and announces as a menu item, which is
              not the contradiction `sign-in-link.tsx` warns about.** There the
              objection was `role="button"` stamped onto an `<a>` by a control
              that had no business doing it. Here `role="menuitem"` is the
              primitive's own doing and is what the ARIA menu pattern asks for —
              a person navigating this menu is moving through menu items with
              arrow keys, not through a list of links. The `href` is real either
              way, so a middle-click and a long-press still open it in a tab.

              `Link` rather than a bare `<a>`, so the navigation is the client
              router's and not a fresh document — the shell above it is already
              painted and has no reason to be fetched again.
            */}
            {accountHref ? (
              <>
                <DropdownMenuItem
                  render={
                    <Link href={accountHref}>
                      {/*
                        Decorative, so `aria-hidden` — the same rule as the icon
                        below, and the reason both rows carry one: a leading icon
                        is what makes a list of rows scannable, which is exactly
                        what this menu became the moment it held more than one.
                      */}
                      <UserRoundIcon aria-hidden="true" />
                      {ACCOUNT}
                    </Link>
                  }
                />

                <DropdownMenuSeparator />
              </>
            ) : null}

            {/*
              The text sits inside the `render` element rather than as the item's
              children: Base UI merges either, but only this shape lets a reader —
              human or `jsx-a11y` — see that the control has a label without
              resolving the render prop first.
            */}
            <DropdownMenuItem
              /*
                **`nativeButton` is required, not decorative.** A menu item
                defaults to a non-button element, so Base UI otherwise layers
                its own `role` and `aria-disabled` onto a real `<button>` —
                which it warns about, and which puts attributes into the
                accessibility tree that nothing here asked for. A real
                `<button type="submit">` is not negotiable: it is what carries
                the unhydrated submit.
              */
              nativeButton
              render={
                <button type="submit" form={SIGN_OUT_FORM_ID} disabled={pending} className="w-full">
                  {/*
                    Decorative, so `aria-hidden`: the word beside it carries the
                    meaning, and the voice guide's rule against meaning carried
                    by anything but words is the same rule seen from the
                    accessibility side. The registry item already ships `gap-2`
                    and sizes a leading `svg` to `size-4`, so nothing here sets
                    either.
                  */}
                  <LogOutIcon aria-hidden="true" />
                  {SIGN_OUT}
                </button>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/*
        **The unhydrated trigger.** Hidden by default and revealed by the
        `<noscript>` rule in `site-header.tsx`, so with JavaScript unavailable
        this is the visible control and the menu above is not. Same form, same
        action.
      */}
      <Button
        type="submit"
        form={SIGN_OUT_FORM_ID}
        variant="outline"
        size="lg"
        className="hidden"
        data-slot={SESSION_MENU_FALLBACK_SLOT}
      >
        <LogOutIcon aria-hidden="true" data-icon="inline-start" />
        {SIGN_OUT}
      </Button>

      {/*
        Sign-out failed and the session is still live.

        **One element, seen and announced.** The first draft had a `sr-only`
        live region *and* a visible paragraph holding the same sentence, which
        put it in the accessibility tree twice — heard once as an announcement
        and met again as static text. A sighted screen-reader user got it twice;
        nobody got anything the single element does not give.

        It is always rendered, never conditional, because a live region has to
        exist *before* its content arrives — a region inserted together with its
        message is frequently not announced at all. `empty:hidden` is what keeps
        an empty one from painting a strip of background.

        Polite rather than assertive: she is not mid-task, and the sentence is
        the same one whether she hears it now or on her next tab stop.

        `<output>` rather than `<div role="status">` — the element carries that
        role implicitly, and oxlint's `prefer-tag-over-role` is right that the
        tag is the better carrier: a role can be typed onto the wrong element, a
        tag cannot.
      */}
      <output
        aria-live="polite"
        className="text-destructive bg-background absolute inset-x-0 top-full block px-4 py-2 text-sm empty:hidden"
      >
        {problem}
      </output>
    </div>
  );
}
