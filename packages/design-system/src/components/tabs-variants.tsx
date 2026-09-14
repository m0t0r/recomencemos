/**
 * The tabs' styling contract, and nothing else — `button-variants.tsx` for the
 * tabs, split out for the same shape of reason.
 *
 * **It exists so a link can wear the registry's tab.** `tabs.tsx` is
 * `"use client"` and imports `@base-ui/react/tabs`, and a value exported from a
 * `"use client"` file is a client-reference proxy in a Server Component, not a
 * function it can call. The Offers folders are the case: each is an address
 * (`?box=sent`) a redirect lands on and a browser without JavaScript follows, so
 * they are `next/link`s in a Server Component, not tabs that switch a panel in
 * place — and before this split the only way to give them the registry's look
 * was to copy the strings or to take another component's.
 *
 * **The classes key on attributes, not only on names.** A caller that is not
 * the Base UI primitive has to put down what it would: `group/tabs` and
 * `data-orientation` on the wrapper, `data-variant` on the list, and
 * `data-active` on the current trigger. Without `data-active` the current one
 * renders like the rest.
 *
 * **`.tsx` despite holding no JSX**, because the package's `exports` map is
 * `"./components/*": "./src/components/*.tsx"` — the extension is the subpath's,
 * not this file's opinion.
 *
 * Taken verbatim from the registry's `tabs.tsx`; `tabs.tsx` now imports it
 * rather than restating it, so `shadcn add --overwrite` on that file is a
 * divergence to re-apply. See `packages/design-system/CLAUDE.md`.
 */

import { cva } from "class-variance-authority";

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const tabsTriggerVariants = cva([
  "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
  "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
  "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
]);

export { tabsListVariants, tabsTriggerVariants };
