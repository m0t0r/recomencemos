"use client";

/**
 * PROTOTYPE — Variant A, "El enlace": today's door — an address, a link sent
 * to it, and a waiting screen that tells her to open her mail. Built here so
 * the wait state can be compared against the two alternatives beside it.
 * The bet it carries is the spec's: no password, ever.
 */

import { Button } from "@repo/design-system/components/button";
import { Input } from "@repo/design-system/components/input";
import { useState } from "react";
import { Labeled } from "../../_components/labeled";
import { GoogleDoor } from "./shared";

export function TheLink() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
        <h1 className="page-heading">Revisa tu correo</h1>
        <p className="text-pretty">
          Enviamos un enlace a <span className="font-medium">{email}</span>. Ábrelo desde este mismo
          teléfono y entras; no hay nada que copiar.
        </p>
        <p className="text-muted-foreground text-sm text-pretty">
          Si no llega en unos minutos, mira la carpeta de no deseados. El enlace sirve una vez y por
          quince minutos.
        </p>
        <div>
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
        Sin contraseña. Necesitas un correo que puedas abrir desde este teléfono.
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
          Enviarme el enlace
        </Button>
      </form>
      <GoogleDoor />
    </main>
  );
}
