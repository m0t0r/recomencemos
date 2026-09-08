/**
 * What a Worker is sent when a person has read an Offer and let it through.
 *
 * **It carries no terms, and that is the design rather than brevity.** The
 * Offer's three fields are what one person wrote to another and are `personal`;
 * an email is delivered to a mailbox that may be read on a shared phone, may sit
 * in a provider's storage for years, and reaches a vendor on the way. So the mail
 * says that something arrived and where to read it, and the site is where it is
 * read — the same split story 9's Contact Exchange takes, where the screen is the
 * durable channel and the email is a copy.
 *
 * **It carries nothing about who sent it either.** His name is self-asserted and
 * she is about to read it in context, badged as declared rather than verified; a
 * name in a subject line arrives with none of that context and reads as a
 * vouched-for identity.
 *
 * **The one link is built from the app origin and the Offer's id**, both
 * server-owned, and it goes through {@link safeUrl} for the reason that function
 * exists: React escapes element content and leaves attributes alone, so a URL is
 * the one injection an email template still admits (DD14, C48).
 */

import { Button, Heading, Link, Section, Text } from "@react-email/components";
import { safeUrl } from "#templates/magic-link";
import { BaseEmail } from "#templates/base";

/**
 * The subject, beside its template for the reason `MAGIC_LINK_SUBJECT` gives: a
 * subject is copy, and copy answers to `docs/policy/voice.md` rather than to
 * whoever wires the Server Action.
 *
 * Email tone, Energy 2→1: it says what happened and nothing more. No urgency
 * verb, no exclamation mark, no count, and no name — *una propuesta* rather than
 * *¡Nueva propuesta de Carlos!*, which would put a stranger's asserted name in a
 * notification bar and make a decision she has not made yet feel already begun.
 */
export const OFFER_DELIVERED_SUBJECT = "Te llegó una propuesta de trabajo";

export interface OfferDeliveredEmailProps {
  /** Her first name, as she wrote it on her own profile. */
  readonly firstName: string;
  /** Where to read it. Server-minted from the app origin and the Offer's id. */
  readonly url: string;
}

/**
 * Copy per `docs/policy/voice.md` — Email row (Energy 2→1), and the *Reading an
 * Offer* row's rule that nothing nudges: no countdown, no highlighted answer,
 * and no verb that assumes she will say yes.
 *
 * The second paragraph is the one sentence this email exists to carry beyond the
 * link: **a person read it first**, which is the platform's actual work and the
 * thing that makes an Offer from a stranger something other than an unfiltered
 * message. Do 1 — present tense, actor visible.
 *
 * The last line is Do 3 and the boundary rule together: what she can do next is
 * *nothing*, said plainly, because deciding is hers and no answer is a complete
 * answer.
 */
export function OfferDeliveredEmail({ firstName, url }: OfferDeliveredEmailProps) {
  const href = safeUrl(url, "url");

  return (
    <BaseEmail
      title={OFFER_DELIVERED_SUBJECT}
      preview="Alguien te escribió por un trabajo. Puedes leerla cuando quieras."
    >
      <Heading
        as="h1"
        className="m-0 mb-[16px] text-[24px] font-semibold leading-[32px] tracking-[-0.02em] text-foreground"
      >
        Te llegó una propuesta
      </Heading>

      <Text className="m-0 mb-[24px] text-[16px] leading-[24px] text-foreground">
        Hola {firstName}. Alguien te escribió por un trabajo.
      </Text>

      <Text className="m-0 mb-[24px] text-[16px] leading-[24px] text-foreground">
        Una persona la leyó antes de que te llegara. Dice qué es el trabajo, cuánto pagan y cuándo.
      </Text>

      <Section className="mb-[24px]">
        <Button
          href={href}
          className="box-border rounded-[8px] bg-primary px-[24px] py-[12px] text-[16px] font-semibold text-primaryForeground no-underline"
        >
          Leer la propuesta
        </Button>
      </Section>

      <Text className="m-0 mb-[16px] text-[16px] leading-[24px] text-foreground">
        Si el botón no abre, usa esta dirección:{" "}
        <Link href={href} className="text-primary underline">
          {href}
        </Link>
      </Text>

      <Text className="m-0 text-[16px] leading-[24px] text-foreground">
        Tu teléfono y tu correo siguen aquí. Solo salen si tú aceptas. Si no quieres responder, no
        tienes que hacer nada.
      </Text>
    </BaseEmail>
  );
}

OfferDeliveredEmail.PreviewProps = {
  firstName: "Ana María",
  url: "https://recomencemos.online/offers/0199a1f0-2b3c-7def-8000-0123456789ab",
} satisfies OfferDeliveredEmailProps;

export default OfferDeliveredEmail;
