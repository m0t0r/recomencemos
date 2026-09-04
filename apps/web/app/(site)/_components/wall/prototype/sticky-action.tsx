/**
 * PROTOTYPE — the one primary action, pinned where the thumb is.
 *
 * On a phone the bottom of the viewport is the only region reached one-handed,
 * so the action lives there and stays there while the page scrolls. It is
 * `sticky` rather than `fixed`, and it is the last child of the variant it
 * belongs to: it holds the bottom edge for as long as the variant is on screen
 * and scrolls away with it, so the sections below are never covered. No
 * JavaScript: a plain link in a plain bar.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import { cn } from "@repo/design-system/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import { TO_PUBLISH } from "../../../_lib/lists/messages";

export function StickyAction({ children }: { children?: ReactNode }) {
  return (
    <div className="bg-background/95 border-border sticky bottom-0 z-10 border-t pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 pt-3">
        {children}
        <Link href="/publish" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
          {TO_PUBLISH}
        </Link>
      </div>
    </div>
  );
}
