"use client";

/**
 * PROTOTYPE — Variant C, "Tu número": no email at the door. Her phone number,
 * a six-digit code by WhatsApp or SMS, and she is in. The email is asked for
 * later, once, at the moment it is actually needed — the copy of a Contact
 * Exchange — and it is optional until then. Bet: for the person this product
 * is for, the phone number is the identity and the email is the obstacle.
 *
 * What it costs is named on the screen rather than hidden: a WhatsApp or SMS
 * sender is a new processor under the privacy notice, and a number-first
 * Account changes what deletion frees. Neither is this lab's to decide.
 */

import { Button } from "@repo/design-system/components/button";
import { Input } from "@repo/design-system/components/input";
import { useState } from "react";
import { Labeled } from "../../_components/labeled";
import { CodeField, GoogleDoor } from "./shared";

export function TheNumber() {
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [inside, setInside] = useState(false);

  const ok = phone.replaceAll(/\D/g, "").length >= 10;

  if (inside) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-12">
        <h1 className="page-heading">Entraste</h1>
        <p className="text-muted-foreground text-pretty">
          Con el número {phone}. Cuando aceptes una propuesta te pediremos un correo, una sola vez,
          para enviarte la copia. Hasta entonces no hace falta.
        </p>
      </main>
    );
  }

  if (sent) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
        <h1 className="page-heading">Escribe el código</h1>
        <p className="text-pretty">
          Te llegó por {channel === "whatsapp" ? "WhatsApp" : "mensaje de texto"} al{" "}
          <span className="font-medium">{phone}</span>.
        </p>
        <CodeField value={code} onChange={setCode} onComplete={() => setInside(true)} />
        <p className="text-muted-foreground text-sm">
          En este prototipo cualquier seis dígitos entran.
        </p>
        <div>
          <Button type="button" variant="ghost" onClick={() => setSent(false)}>
            Usar otro número
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="page-heading">Entrar</h1>
      <p className="text-muted-foreground text-pretty">
        Sin contraseña y sin correo. Te enviamos un código al número que uses todos los días.
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ok) setSent(true);
        }}
      >
        <Labeled label="Tu número de celular">
          {(id) => (
            <Input
              id={id}
              type="tel"
              inputMode="tel"
              placeholder="312 555 0107"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          )}
        </Labeled>
        <fieldset className="flex gap-2">
          <legend className="sr-only">Por dónde te enviamos el código</legend>
          {(["whatsapp", "sms"] as const).map((option) => (
            <label
              key={option}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                channel === option ? "border-primary bg-secondary" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="channel"
                className="sr-only"
                checked={channel === option}
                onChange={() => setChannel(option)}
              />
              {option === "whatsapp" ? "Por WhatsApp" : "Por mensaje de texto"}
            </label>
          ))}
        </fieldset>
        <Button type="submit" size="lg" disabled={!ok}>
          Enviarme el código
        </Button>
      </form>
      <p className="text-muted-foreground text-sm text-pretty">
        Tu número no se muestra a nadie. Solo lo recibe la persona cuya propuesta aceptes.
      </p>
      <GoogleDoor />
    </main>
  );
}
