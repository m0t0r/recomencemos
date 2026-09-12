/**
 * The copy each side is sent when she accepts: the other side's name, phone and
 * email.
 *
 * **It is a copy, and it says so.** The details are on screen first — on her
 * received row, on his sent one — because a send can fail and the one thing
 * she accepted in order to get must not depend on it. The spec's Contact
 * Exchange row in `docs/policy/voice.md`'s tone matrix asks for exactly this:
 * name the fields, and say the email is a copy of what is already on screen.
 *
 * **One template, two readers.** What differs between her mail and his is who
 * the counterpart is and where the site shows it; the frame, the guidance and
 * the refusal to link a detail are the same, so they are written once.
 *
 * **A detail is text and never a link.** A `tel:` or `mailto:` would be an
 * `href` built from what a stranger typed, which DD14 refuses in every template
 * (C48). She can copy a number as easily as tap it. The one link is built from
 * the app origin and a route, both server-owned, and goes through
 * {@link safeUrl}.
 *
 * **The guidance opens with the standing notices' own headings** — nobody here
 * is verified, no money passes through here — and the rest says what the page
 * says. This package cannot import the app, so the page's sentences are
 * repeated here: a change to `apps/web/app/(site)/_components/contact-exchange/messages.ts`
 * or to the notices is a change to this file too.
 */

import { Button, Heading, Link, Section, Text } from "@react-email/components";
import { BaseEmail } from "#templates/base";
import { safeUrl } from "#templates/magic-link";

/** Which party is reading. The counterpart is the other one. */
export type ContactExchangeRecipient = "worker" | "hirer";

/**
 * The subject, per reader. Email tone, Energy 2→1: what happened, and nothing
 * more — no name, because a name in a notification bar arrives with none of the
 * context that says it is somebody's own claim, and no exclamation mark.
 */
export const CONTACT_EXCHANGE_SUBJECTS: Readonly<Record<ContactExchangeRecipient, string>> = {
  worker: "Aceptaste una propuesta: estos son sus datos",
  hirer: "Aceptó tu propuesta: estos son sus datos",
};

export interface ContactExchangeEmailProps {
  readonly recipientSide: ContactExchangeRecipient;
  /**
   * The other party's three, as they crossed. The Hirer's name and number are
   * `null` on an Offer written before the platform asked senders for them.
   */
  readonly counterpart: {
    readonly fullName: string | null;
    readonly phone: string | null;
    readonly email: string;
  };
  /** Where the site shows the same details. Server-minted from the app origin and a route. */
  readonly url: string;
}

/** The copy that differs by reader. Everything else is shared. */
const COPY: Readonly<
  Record<
    ContactExchangeRecipient,
    {
      readonly heading: string;
      readonly preview: string;
      readonly lead: string;
      readonly nameLabel: string;
      readonly claim: string;
      readonly theirs: string;
      readonly money: string;
      readonly action: string;
    }
  >
> = {
  /**
   * Hers. **The claim sentence is C4's**: his name and number are his own word,
   * exactly as hers are to him, and she reads that beside them rather than in a
   * notice she may never have opened.
   */
  worker: {
    heading: "Estos son los datos de quien te envió la propuesta",
    preview: "Una copia de lo que ya ves en Recomencemos.",
    lead: "Aceptaste su propuesta. Ya ves sus datos en Recomencemos: este correo es una copia.",
    nameLabel: "Nombre",
    claim: "Aquí no verificamos a nadie. Su nombre y su teléfono los escribió esa misma persona.",
    theirs:
      "Quien te envió la propuesta también recibió tu nombre completo, tu teléfono y tu correo.",
    money:
      "Por aquí no pasa el dinero. El pago lo arreglan ustedes dos. Si no te pagan, no podemos devolverte nada.",
    action: "Ver la propuesta en Recomencemos",
  },
  /**
   * His. The Hirer's register is Warmth 3, and the product does not gender her:
   * _aceptó_ and _la persona a quien le escribiste_ say nothing a pronoun would
   * have to guess.
   */
  hirer: {
    heading: "Aceptó tu propuesta",
    preview: "Una copia de lo que ya ves en Recomencemos.",
    lead: "Estos son los datos de la persona a quien le escribiste. Ya los ves en Recomencemos: este correo es una copia.",
    nameLabel: "Nombre completo",
    claim: "Aquí no verificamos a nadie. Estos datos los escribió esa misma persona.",
    theirs: "También recibió los tuyos: tu nombre, tu teléfono y tu correo.",
    money:
      "Por aquí no pasa el dinero. El pago lo arreglan ustedes dos, por fuera de Recomencemos.",
    action: "Ver tus propuestas enviadas",
  },
};

/** What a Hirer who gave no name or number is shown in its place. Only he can be absent. */
const NO_NAME = "No escribió su nombre.";
const NO_PHONE = "No dejó un teléfono.";

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Text className="m-0 mb-[12px] text-[16px] leading-[24px] text-foreground">
      <span className="text-[14px] text-mutedForeground">{label}</span>
      <br />
      <span className="font-semibold">{value}</span>
    </Text>
  );
}

export function ContactExchangeEmail({
  recipientSide,
  counterpart,
  url,
}: ContactExchangeEmailProps) {
  const href = safeUrl(url, "url");
  const copy = COPY[recipientSide];

  return (
    <BaseEmail title={CONTACT_EXCHANGE_SUBJECTS[recipientSide]} preview={copy.preview}>
      <Heading
        as="h1"
        className="m-0 mb-[16px] text-[24px] font-semibold leading-[32px] tracking-[-0.02em] text-foreground"
      >
        {copy.heading}
      </Heading>

      <Text className="m-0 mb-[24px] text-[16px] leading-[24px] text-foreground">{copy.lead}</Text>

      {/*
        The three details, each as plain text under its label. Bordered off so
        they are the first thing an eye lands on, and never a link: a detail is
        what a stranger typed.
      */}
      <Section className="mb-[24px] rounded-[8px] border border-solid border-border px-[16px] pt-[16px] pb-[4px]">
        <Detail label={copy.nameLabel} value={counterpart.fullName ?? NO_NAME} />
        <Detail label="Teléfono" value={counterpart.phone ?? NO_PHONE} />
        <Detail label="Correo" value={counterpart.email} />
      </Section>

      <Text className="m-0 mb-[16px] text-[16px] leading-[24px] text-foreground">{copy.claim}</Text>
      <Text className="m-0 mb-[16px] text-[16px] leading-[24px] text-foreground">
        {copy.theirs}
      </Text>
      <Text className="m-0 mb-[24px] text-[16px] leading-[24px] text-foreground">{copy.money}</Text>

      <Section className="mb-[24px]">
        <Button
          href={href}
          className="box-border rounded-[8px] bg-primary px-[24px] py-[12px] text-[16px] font-semibold text-primaryForeground no-underline"
        >
          {copy.action}
        </Button>
      </Section>

      <Text className="m-0 text-[16px] leading-[24px] text-foreground">
        Si el botón no abre, usa esta dirección:{" "}
        <Link href={href} className="text-primary underline">
          {href}
        </Link>
      </Text>
    </BaseEmail>
  );
}

ContactExchangeEmail.PreviewProps = {
  recipientSide: "worker",
  counterpart: {
    fullName: "Carlos Restrepo",
    phone: "+57 310 555 8899",
    email: "carlos@example.com",
  },
  url: "https://recomencemos.online/offers/0199a1f0-2b3c-7def-8000-0123456789ab",
} satisfies ContactExchangeEmailProps;

export default ContactExchangeEmail;
