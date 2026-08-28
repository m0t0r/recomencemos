"use client";

/**
 * The signed-in half of the shell: who she is, and the way out.
 *
 * **One form, one action, two triggers.** The `<form>` lives here and carries an
 * `id`; the menu item and the `<noscript>` fallback in `site-header.tsx` are both
 * `<button type="submit" form={SIGN_OUT_FORM_ID}>`. A submit button needs no
 * ancestor form when it names one by id, which is what keeps the unhydrated path
 * from becoming a *second sign-out path* with its own logic to keep in
 * agreement — it is a second button on the same form.
 *
 * That matters here for a structural reason as well as a tidiness one: the menu's
 * content is **portalled to the document body**, so a `<form>` wrapping the item
 * would not be the form the header renders, and a submit inside a menu item that
 * closes on click races its own submit. Naming the form by id sidesteps both.
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
import { ChevronDownIcon } from "lucide-react";
import { useActionState } from "react";
import { signOut } from "./actions";
import { SESSION_MENU_FALLBACK_SLOT, SESSION_MENU_SLOT, SIGN_OUT_FORM_ID } from "./slots";
import { SIGN_OUT, SIGNED_IN_AS, sessionMenuLabel } from "./messages";

/**
 * next-safe-action's own result shape, and `{}` is the library's "nothing has
 * happened yet" — so `idle` is not a state this surface invents and then has to
 * keep in agreement with the library's.
 */
type SignOutResult = Awaited<ReturnType<typeof signOut>>;

const INITIAL: SignOutResult = {};

/**
 * Her initial, for the avatar.
 *
 * The first character of the address, uppercased — there is no name to take one
 * from until a CapabilityProfile exists. It is decorative: the address itself is
 * beside it and in the accessible name, so a reader loses nothing if this is a
 * digit or a diacritic.
 */
function initialOf(email: string): string {
  return [...email][0]?.toLocaleUpperCase("es-CO") ?? "";
}

export function SessionMenu({ email }: { email: string }) {
  const [result, formAction, pending] = useActionState(signOut, INITIAL);

  /**
   * Only a *returned* refusal reaches here. A success redirects, so this state
   * is never the happy path resolving — it is always the sentence that says the
   * session is still open.
   */
  const problem = result.serverError?.message;

  return (
    <div className="flex min-w-0 items-center gap-2">
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
      <div className="flex min-w-0" data-slot={SESSION_MENU_SLOT}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="lg"
                /*
                  `max-w` before `truncate` on the child, and `min-w-0` on both this
                  and its flex parent: without it the address refuses to shrink and
                  pushes the product name off a 360 px screen instead of ellipsing.
                */
                className="min-w-0 max-w-[9.5rem] sm:max-w-[16rem]"
                aria-label={sessionMenuLabel(email)}
              />
            }
          >
            <Avatar size="sm" aria-hidden="true">
              <AvatarFallback>{initialOf(email)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{email}</span>
            <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="min-w-56">
            {/*
              The **untruncated** address. The trigger ellipses it on a narrow
              phone, so this is where the borrowed-phone question is actually
              answerable — one tap, and the whole thing is on screen.

              Not a `DropdownMenuLabel`: this is two lines with different emphasis
              rather than a group heading, and the registry's label styles a
              heading. It is `aria-hidden` because the trigger's accessible name
              already announces the address, and announcing it a second time on
              open is noise rather than information.
            */}
            <div className="px-2 py-1.5" aria-hidden="true">
              <p className="text-muted-foreground text-xs">{SIGNED_IN_AS}</p>
              <p className="text-sm break-all">{email}</p>
            </div>

            <DropdownMenuSeparator />

            {/*
              The text sits inside the `render` element rather than as the item's
              children: Base UI merges either, but only this shape lets a reader —
              human or `jsx-a11y` — see that the control has a label without
              resolving the render prop first.
            */}
            <DropdownMenuItem
              render={
                <button type="submit" form={SIGN_OUT_FORM_ID} disabled={pending} className="w-full">
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
        {SIGN_OUT}
      </Button>

      {/*
        Sign-out failed and the session is still live. Polite rather than
        assertive: she is not mid-task, and the sentence is the same one whether
        she hears it now or on her next tab stop.

        `<output>` rather than `<div role="status">` — the element carries that
        role implicitly, and oxlint's `prefer-tag-over-role` is right that the
        tag is the better carrier: a role can be typed onto the wrong element,
        a tag cannot.
      */}
      <output aria-live="polite" className="sr-only">
        {problem}
      </output>

      {problem ? (
        <p className="text-destructive absolute inset-x-0 top-full bg-background px-4 py-2 text-sm">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
