"use client";

/**
 * PROTOTYPE — the Google door and the six-slot code field, shared by the
 * sign-in variants. The code field is the registry's `InputOTP`.
 */

import { Button } from "@repo/design-system/components/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@repo/design-system/components/input-otp";

export function GoogleDoor() {
  return (
    <div className="border-border flex flex-col gap-3 border-t pt-5">
      <Button type="button" variant="outline" size="lg">
        Entrar con Google
      </Button>
      <p className="text-muted-foreground text-sm">Un toque, si ya tienes Google en el teléfono.</p>
    </div>
  );
}

export function CodeField({
  value,
  onChange,
  onComplete,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onComplete: () => void;
}) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      inputMode="numeric"
      aria-label="Código de seis dígitos"
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}
