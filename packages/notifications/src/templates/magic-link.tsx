/**
 * The link that is the only way into an account without Google.
 *
 * This template ships with the seam; **#12 owns the flow** — Better Auth, the
 * 5/hour ceiling, the `/sign-in` surface — and consumes this rather than writing
 * it. What is here is the email, and the email is what the seam needed in order
 * to be demonstrable at all.
 *
 * **The `href` is the one injection this seam still admits.** React escapes
 * element content by construction, which is what dissolved DD7's "email is the
 * one path where escaping does not apply" — but escaping constrains content and
 * leaves an attribute alone, so a `javascript:` fragment in a URL-valued
 * attribute would sail through it (DD14's third clause, C48). {@link safeUrl} is
 * the mechanism rather than the discipline: a URL that is not `http:`/`https:`
 * throws at render, before an inbox.
 */

import { Button, Heading, Link, Section, Text } from "@react-email/components";
import { AppError } from "@repo/errors/app-error";
import { BaseEmail } from "#templates/base";
import { SEND_FAILED } from "#user-messages";

/**
 * The only protocols a URL in any template of this product may carry.
 *
 * A whitelist rather than a `javascript:` blocklist, for
 * [ADR-0003](../../../../docs/adr/0003-no-tojson-on-cross-boundary-types.md)'s
 * reason one level down: a blocklist means the next scheme somebody invents
 * passes by default. `data:` and `vbscript:` are not enumerated here because
 * they do not need to be.
 */
const ALLOWED_URL_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

/**
 * Refuse any URL that is not plainly a web address.
 *
 * Exported because every future template with a link uses it, and because a rule
 * enforced in one template is a rule the second template forgets.
 */
export function safeUrl(url: string, field: string): string {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new AppError({
      code: "template_url_unparseable",
      status: 500,
      message:
        `An email template was given a ${field} that is not a URL, so no href can be built ` +
        "from it. Every URL in every template is built from server-owned values — " +
        "the app origin, a route constant, an entity id (DD14).",
      userMessage: SEND_FAILED,
      context: { field },
    });
  }

  if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
    throw new AppError({
      code: "template_url_protocol_refused",
      status: 500,
      message:
        `An email template was given a ${field} with protocol "${parsed.protocol}", which is ` +
        "not http: or https:. React escapes element content, not attributes, so this is the " +
        "one injection an email template still admits (DD14).",
      userMessage: SEND_FAILED,
      context: { field, protocol: parsed.protocol },
    });
  }

  return parsed.toString();
}

/**
 * The subject line, beside its template rather than at the call site.
 *
 * A subject is copy, and copy this product ships answers to
 * `docs/policy/voice.md`. Left as an argument at the call site it would be
 * written by whoever wires the Server Action, which is how a voice guide stops
 * governing the strings it exists to govern. The seam still *takes* a subject —
 * it must, being channel-agnostic — and #12 passes this.
 *
 * No exclamation mark and no urgency verb: the Email tone row forbids both, and
 * *Tu enlace para entrar* says what happened, which is all a subject owes.
 */
export const MAGIC_LINK_SUBJECT = "Tu enlace para entrar a Recomencemos";

export interface MagicLinkEmailProps {
  /** The sign-in URL. Server-minted; never built from anything a person typed. */
  readonly url: string;
  /** How long the link lasts, in minutes. The flow owns the number (#12). */
  readonly expiresInMinutes: number;
}

/**
 * Copy per `docs/policy/voice.md`, Email row of the tone matrix (Energy 2→1).
 *
 * Every sentence is under twenty words and the button is three; the subject line
 * carries no urgency verb and no exclamation mark; the button says the verb of
 * its action rather than *Continuar*; the fallback line names its destination
 * rather than saying *haz clic aquí*. The last paragraph is Do 3 — what she can
 * do next, in the same breath as what happened — and it says what a Block-style
 * absence says elsewhere: doing nothing is a complete answer.
 */
export function MagicLinkEmail({ url, expiresInMinutes }: MagicLinkEmailProps) {
  const href = safeUrl(url, "url");

  return (
    <BaseEmail title={MAGIC_LINK_SUBJECT} preview={`El enlace dura ${expiresInMinutes} minutos.`}>
      <Heading
        as="h1"
        className="m-0 mb-[16px] text-[24px] font-semibold leading-[32px] tracking-[-0.02em] text-foreground"
      >
        Tu enlace para entrar
      </Heading>

      <Text className="m-0 mb-[24px] text-[16px] leading-[24px] text-foreground">
        Pediste un enlace para entrar a Recomencemos. Ábrelo desde este mismo teléfono.
      </Text>

      <Section className="mb-[24px]">
        <Button
          href={href}
          className="box-border rounded-[8px] bg-primary px-[24px] py-[12px] text-[16px] font-semibold text-primaryForeground no-underline"
        >
          Entrar a Recomencemos
        </Button>
      </Section>

      <Text className="m-0 mb-[16px] text-[16px] leading-[24px] text-foreground">
        El enlace sirve una sola vez y dura {expiresInMinutes} minutos. Si el botón no abre, usa
        esta dirección:{" "}
        <Link href={href} className="text-primary underline">
          {href}
        </Link>
      </Text>

      <Text className="m-0 text-[16px] leading-[24px] text-foreground">
        Si no pediste este enlace, no hagas nada. Sin abrirlo, nadie entra a tu cuenta.
      </Text>
    </BaseEmail>
  );
}

MagicLinkEmail.PreviewProps = {
  url: "https://recomencemos.online/api/auth/magic-link/verify?token=preview-token",
  expiresInMinutes: 15,
} satisfies MagicLinkEmailProps;

export default MagicLinkEmail;
