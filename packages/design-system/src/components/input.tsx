import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { inputBox, inputFileSlot } from "@repo/design-system/components/input-variants";
import { cn } from "@repo/design-system/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputBox, inputFileSlot, className)}
      {...props}
    />
  );
}

export { Input };
