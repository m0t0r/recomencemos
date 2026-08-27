/**
 * The product's frame. Every template this product sends sits inside it.
 *
 * Four things it fixes so no later template has to remember them:
 *
 * - **`lang="es"`.** React Email's `<Html>` defaults to `lang="en"`; `es-CO` is
 *   this product's only language, and a screen reader announcing Spanish with an
 *   English voice is NFR20's failure rather than a cosmetic one.
 * - **A monitored reply-to in the footer.** The `from` address is a real address
 *   and is not `noreply@` (DD14) — a woman who replies to an Offer notification
 *   must reach a person. The footer says so, because an address a reader cannot
 *   see is not an invitation.
 * - **`pixelBasedPreset`**, no flexbox, no grid, no media queries, no `dark:`.
 *   None of them survive the clients this product's readers are on.
 * - **One `<Container>`**, which carries React Email's own `max-width`. A second
 *   one nested inside would halve it.
 *
 * There is no `<Img>` here and that is deliberate rather than pending: a logo
 * needs a CDN origin nothing in this repo has yet, and an image that fails to
 * load is worse than a wordmark that cannot.
 */

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";
import type { ReactNode } from "react";
import { FONT_STACK, palette } from "#palette";

export interface BaseEmailProps {
  /**
   * The document title, and it is the **subject line** rather than a third
   * string invented here.
   *
   * React Email's own accessibility guidance says `<Preview>` emits a `<title>`;
   * it does not at `@react-email/preview@0.0.14`, which is what
   * `@react-email/components@1.0.12` resolves to — verified by rendering, not
   * recalled. So the frame emits one. It matters for the web view an inbox opens
   * a message in, where the title is the accessible name of the document.
   */
  readonly title: string;
  /**
   * The inbox preview line. Distinct from the subject on purpose — it is the
   * second sentence a reader gets before opening, so repeating the subject here
   * spends it.
   */
  readonly preview: string;
  /** Where a reply reaches a person. Server-owned; see `#config`. */
  readonly replyTo: string;
  readonly children: ReactNode;
}

export function BaseEmail({ title, preview, replyTo, children }: BaseEmailProps) {
  return (
    <Html lang="es" dir="ltr">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: palette,
              fontFamily: { sans: FONT_STACK.split(", ") },
            },
          },
        }}
      >
        <Head>
          <title>{title}</title>
        </Head>
        <Body className="bg-muted font-sans" style={{ fontFamily: FONT_STACK }}>
          <Preview>{preview}</Preview>
          <Container className="mx-auto my-[24px] w-full max-w-[560px] rounded-[8px] border border-solid border-border bg-background p-[32px]">
            <Text className="m-0 mb-[24px] text-[14px] font-semibold tracking-[-0.01em] text-primary">
              Recomencemos
            </Text>

            {children}

            <Hr className="my-[24px] border-none border-t border-solid border-border" />

            <Section>
              {/*
                The two footer lines are the frame's whole content obligation.
                The first is DD14's monitored reply-to, said as an invitation
                rather than printed as metadata. The second is what this email
                is, so a reader who does not remember asking for it can tell
                whether it concerns her — `docs/policy/voice.md`, Do 1: present
                tense, actor visible.
              */}
              <Text className="m-0 text-[14px] leading-[20px] text-mutedForeground">
                Puedes responder a este correo escribiendo a {replyTo}. Te contesta una persona.
              </Text>
              <Text className="m-0 mt-[8px] text-[14px] leading-[20px] text-mutedForeground">
                Te escribimos desde Recomencemos porque tienes una cuenta aquí.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default BaseEmail;
