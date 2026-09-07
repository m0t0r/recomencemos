/**
 * **Divergence from registry output, to be re-applied after `shadcn add
 * --overwrite`** (#160). The registry ships the `cva` call and the component in
 * this one file and exports both. That made `import { buttonVariants }` — the way
 * a `<Link>` that must announce as a link gets the button's styling — an import of
 * `@base-ui/react/button` as well, so Base UI's core landed in the bundle of every
 * client route that styled a link.
 *
 * The `cva` call now lives in `./button-variants`, and this file **does not
 * re-export it**: a re-export would leave the old specifier working and the split
 * would be undone by the first person who copied an import from an older file.
 * `packages/design-system/CLAUDE.md` carries the rule.
 */

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@repo/design-system/lib/utils";
import { buttonVariants } from "@repo/design-system/components/button-variants";

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button };
