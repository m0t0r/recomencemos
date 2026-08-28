"use client";

/**
 * PROTOTYPE — throwaway. Ticket #80.
 *
 * **The question:** at 360 px, how should the signed-in identity compose? Three
 * variants on the real `/` route, with the real session read above them,
 * switchable with `?variant=`. They disagree about structure, not colour: one
 * control with a menu, one icon control with a menu, two controls and no menu.
 *
 * Nothing here is production code — no tests, no error states, no live region.
 * The winner gets rewritten into `session-menu.tsx`; the rest goes to the
 * throwaway branch.
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
import { signOut } from "../actions";
import { SIGN_OUT, SIGNED_IN_AS, sessionMenuLabel } from "../messages";

const FORM_ID = "sign-out-prototype";

function initialOf(email: string): string {
  return [...email][0]?.toLocaleUpperCase("es-CO") ?? "";
}

function useSignOutForm() {
  const [, formAction, pending] = useActionState(signOut, {});
  return { formAction, pending };
}

function MenuBody({ email, pending }: { email: string; pending: boolean }) {
  return (
    <DropdownMenuContent align="end" className="min-w-56">
      <div className="px-2 py-1.5" aria-hidden="true">
        <p className="text-muted-foreground text-xs">{SIGNED_IN_AS}</p>
        <p className="text-sm break-all">{email}</p>
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        render={
          <button type="submit" form={FORM_ID} disabled={pending} className="w-full">
            {SIGN_OUT}
          </button>
        }
      />
    </DropdownMenuContent>
  );
}

/**
 * **A — avatar + address + chevron, one control.** What the tracer bullet ships.
 * The address is on screen at every width and ellipses when it has to; the menu
 * holds the untruncated copy and _Salir_.
 */
export const VariantA = { name: "Address in the trigger", render: RenderA };

function RenderA({ email }: { email: string }) {
  const { formAction, pending } = useSignOutForm();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <form id={FORM_ID} action={formAction} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="lg"
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
        <MenuBody email={email} pending={pending} />
      </DropdownMenu>
    </div>
  );
}

/**
 * **B — avatar alone, address only in the menu.** The trigger is a 40 px circle
 * and nothing else, so the product name gets the whole row and there is no
 * truncation anywhere. The borrowed-phone check costs one tap instead of being
 * continuous — which is the trade this variant exists to make visible.
 */
export const VariantB = { name: "Avatar only, address in the menu", render: RenderB };

function RenderB({ email }: { email: string }) {
  const { formAction, pending } = useSignOutForm();
  return (
    <div className="flex items-center gap-2">
      <form id={FORM_ID} action={formAction} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label={sessionMenuLabel(email)} />}
        >
          <Avatar size="sm" aria-hidden="true">
            <AvatarFallback>{initialOf(email)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <MenuBody email={email} pending={pending} />
      </DropdownMenu>
    </div>
  );
}

/**
 * **C — no menu at all: address as text, _Salir_ as its own button.** One
 * interaction to sign out instead of two, and it needs no `<noscript>` rule
 * because there is nothing to open — the whole thing works unhydrated as plain
 * HTML. The cost is that it has nowhere to put `/account`, `/my-profile` and her
 * Offers when those land, so #13 and stories 2 and 8 would each have to
 * redesign this strip rather than add a row to a menu.
 */
export const VariantC = { name: "No menu — address plus a Salir button", render: RenderC };

function RenderC({ email }: { email: string }) {
  const { formAction, pending } = useSignOutForm();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <form id={FORM_ID} action={formAction} />
      <Avatar size="sm" aria-hidden="true">
        <AvatarFallback>{initialOf(email)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-sm" title={email}>
        {email}
      </span>
      <Button type="submit" form={FORM_ID} variant="outline" size="lg" disabled={pending}>
        {SIGN_OUT}
      </Button>
    </div>
  );
}

export const VARIANTS = { A: VariantA, B: VariantB, C: VariantC } as const;
export type VariantKey = keyof typeof VARIANTS;
