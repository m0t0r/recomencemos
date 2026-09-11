"use client";

/**
 * PROTOTYPE — Variant B, "El código": an address, then six digits typed here.
 * The mail can be read on another device, by another person, or from a
 * borrowed phone that has no mail app — she only has to carry six digits
 * across. Bet: a link assumes the mail and the browser are on the same
 * phone; a code does not, and that assumption is exactly what a borrowed
 * phone breaks. The Admin door already works this way.
 */

import { Button } from "@repo/design-system/components/button";
import { Input } from "@repo/design-system/components/input";
import { useState } from "react";
import { Labeled } from "../../_components/labeled";
import { CodeField, GoogleDoor } from "./shared";

export function TheCode() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [inside, setInside] = useState(false);

  if (inside) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-12">
        <h1 className="page-heading">Entraste</h1>
        <p className="text-muted-foreground">Como {email}. El código ya no sirve.</p>
      </main>
    );
  }

  if (sent) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
        <h1 className="page-heading">Escribe el código</h1>
        <p className="text-pretty">
          Enviamos seis dígitos a <span className="font-medium">{email}</span>. Puedes leerlos en
          otro teléfono o pedirle a alguien que te los dicte.
        </p>
        <CodeField value={code} onChange={setCode} onComplete={() => setInside(true)} />
        <p className="text-muted-foreground text-sm text-pretty">
          Sirve una vez y por diez minutos. En este prototipo cualquier seis dígitos entran.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setSent(false)}>
            Usar otro correo
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="page-heading">Entrar</h1>
      <p className="text-muted-foreground text-pretty">
        Sin contraseña. Te enviamos un código de seis dígitos al correo y lo escribes aquí.
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (email.includes("@")) setSent(true);
        }}
      >
        <Labeled label="Tu correo">
          {(id) => (
            <Input
              id={id}
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Labeled>
        <Button type="submit" size="lg" disabled={!email.includes("@")}>
          Enviarme el código
        </Button>
      </form>
      <GoogleDoor />
    </main>
  );
}
