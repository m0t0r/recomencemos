"use client";

/**
 * PROTOTYPE — pieces the three received-Offer variants share: the exchanged
 * contact block and the confirmation copy. Structure is not shared; each
 * variant owns its layout.
 */

import { Button } from "@repo/design-system/components/button";
import { ME_CONTACT, type MockOffer } from "../../_lib/mock";

export const WHAT_CROSSES_TITLE = "Antes de aceptar, esto es lo que pasa";

export function whatCrosses(offer: MockOffer): readonly string[] {
  return [
    `${offer.hirerName} recibe tu nombre completo, tu teléfono y tu correo.`,
    `Tú recibes su nombre, su teléfono y su correo.`,
    "Los dos reciben lo mismo por correo.",
    "No se puede deshacer: lo que la otra persona ya leyó, ya lo sabe.",
    "Lo que acuerden después — el trabajo, el pago — es entre ustedes. Recomencemos no interviene.",
  ];
}

export function ConfirmAccept({
  offer,
  onConfirm,
  onCancel,
}: {
  readonly offer: MockOffer;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <div className="border-primary bg-secondary flex flex-col gap-4 rounded-lg border p-4">
      <p className="font-heading text-xl leading-7 font-medium">{WHAT_CROSSES_TITLE}</p>
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        {whatCrosses(offer).map((line) => (
          <li key={line} className="text-pretty">
            {line}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onConfirm}>
          Sí, aceptar y compartir mis datos
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Todavía no
        </Button>
      </div>
    </div>
  );
}

function ContactLine({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {href ? (
        <a href={href} className="text-primary underline underline-offset-4">
          {value}
        </a>
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}

/**
 * The Contact Exchange as she sees it: his details, then what he received of
 * hers, so she knows exactly what he holds.
 */
export function ExchangedContact({ offer }: { readonly offer: MockOffer }) {
  const wa = `https://wa.me/${offer.hirerPhone.replaceAll(/\D/g, "")}?text=${encodeURIComponent(
    `Hola ${offer.hirerName.split(" ")[0]}, soy ${ME_CONTACT.fullName.split(" ")[0]}. Acepté tu propuesta en Recomencemos.`,
  )}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="ruled-page gap-4">
        <p className="font-heading text-2xl leading-8 font-medium text-pretty">
          Listo. Ya tienen los datos el uno del otro.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ContactLine label="Contratante" value={offer.hirerName} />
          <ContactLine label="Teléfono" value={offer.hirerPhone} href={`tel:${offer.hirerPhone}`} />
          <ContactLine
            label="Correo"
            value={offer.hirerEmail}
            href={`mailto:${offer.hirerEmail}`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
          >
            Escribirle por WhatsApp
          </a>
          <a
            href={`tel:${offer.hirerPhone}`}
            className="border-input inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
          >
            Llamar
          </a>
        </div>
      </div>

      <div className="border-border flex flex-col gap-2 border-t pt-4">
        <p className="text-muted-foreground text-sm">Lo que {offer.hirerName} recibió de ti:</p>
        <p className="text-sm">
          {ME_CONTACT.fullName} · {ME_CONTACT.phone} · {ME_CONTACT.email}
        </p>
        <p className="text-muted-foreground text-sm text-pretty">
          Te enviamos una copia por correo. A partir de aquí, lo que acuerden es entre ustedes.
        </p>
      </div>
    </div>
  );
}

export function Term({
  label,
  children,
  large = false,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly large?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <p className={large ? "font-heading text-xl leading-7 text-pretty" : "text-pretty"}>
        {children}
      </p>
    </div>
  );
}
