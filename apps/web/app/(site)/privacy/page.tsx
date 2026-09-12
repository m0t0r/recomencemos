/**
 * `/privacy` — the *aviso de privacidad*, and the text every Consent row points
 * at.
 *
 * **It ships before the form it protects, which is the whole ordering argument of
 * this ticket.** Deployment is continuous from the first ticket, so shipping the
 * publishing form first and the notice second would collect a displaced person's
 * phone number in production with no *autorización* behind it.
 *
 * **The route segment is English and everything rendered is `es-CO`**
 * ([ADR-0012](../../../../../docs/adr/0012-spanish-is-the-interface-english-is-the-code.md)).
 * The spec's own draft routed this product in Spanish and a human caught it; the
 * rule is identifier versus value, and a URL is an identifier.
 *
 * **Indexable, deliberately.** Every gated surface in this app carries `noindex`;
 * this one must not. It is the page a *titular* looks for when she wants to know
 * who holds her data, and the page a regulator looks for first — a privacy notice
 * nobody can find is a privacy notice in name.
 *
 * **The reading path is the design.** One `h1`, `h2` for each section with no
 * level skipped, in the order a person asks the questions: who answers for this,
 * what is held, what for, who else touches it, what can be done about it, and
 * finally the exact text being agreed to. The processors are a description list
 * rather than a table — six rows of three columns is unreadable at 360 px, and a
 * `dl` announces the pairing a table would only imply.
 *
 * **The two places the *responsable* is named are dynamic, and the rest of the
 * page prerenders.** `[stream]` from Cache Components' own menu, and the reason
 * is NFR24 rather than latency: the *responsable*'s name and mailbox are runtime
 * configuration set with `fly secrets`, so a prerender would bake whatever the
 * build machine happened to hold into static HTML and serve it until the next
 * deploy. `await connection()` is the same boundary `app/api/health/route.ts`
 * draws for the same reason, and `pnpm build` is what found this — the first
 * version of this page had no boundary, prerendered, and failed the build with
 * `blocking-prerender-crypto` when the unset-configuration refusal minted a
 * request id.
 *
 * `[block]` was the alternative and was not taken: the notice is long, most of it
 * depends on nothing, and a person on a slow connection should have the whole
 * text while two lines resolve.
 */

import { Skeleton } from "@repo/design-system/components/skeleton";
import { CURRENT_CONSENT_VERSIONS } from "@repo/domain/consent";
import type { Metadata } from "next";
import { connection } from "next/server";
import * as React from "react";
import {
  AUTHORIZATION_ANCHOR,
  AuthorizationText,
} from "@/app/_components/consent/authorization-text";
import {
  contactLine,
  DATA_ITEMS,
  NOTICE_COPY,
  NOTICE_TITLE,
  noticeVersionLine,
  responsibleLine,
  RIGHTS_ITEMS,
  rightsHowLine,
} from "@/app/_lib/consent/messages";
import { PROCESSORS } from "@/app/_lib/consent/processors";
import { responsibleParty } from "@/lib/responsible-party";

export const metadata: Metadata = {
  title: "Aviso de privacidad — Recomencemos",
  description:
    "Qué datos guarda Recomencemos, para qué, quién responde por ellos y qué puedes hacer con ellos.",
};

/**
 * A section, so the heading level and the spacing cannot drift between them.
 *
 * `id` is optional because exactly one section needs one — the *autorización*,
 * which a form links straight to. `scroll-mt-6` rides with it so an anchored
 * arrival does not put the heading under the top edge.
 */
function Section({
  heading,
  id,
  children,
}: {
  heading: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5">
      {items.map((item) => (
        <li key={item} className="text-pretty">
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Two lines of body text, so the fallback holds two lines and nothing moves. */
function LinesSkeleton({ lines }: { lines: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => `line-${index}`).map((key) => (
        <Skeleton key={key} className="h-5 w-full" />
      ))}
    </div>
  );
}

/** Who answers for this data, and where a *consulta* or a *reclamo* reaches them. */
async function ResponsibleParty() {
  await connection();
  const { name, email } = responsibleParty();

  return (
    <>
      <p className="text-pretty">{responsibleLine(name)}</p>
      <p className="text-pretty">{contactLine(email)}</p>
    </>
  );
}

/** The same mailbox, said where she has just read what she can ask for. */
async function RightsContact() {
  await connection();
  const { email } = responsibleParty();

  return <p className="text-pretty">{rightsHowLine(email)}</p>;
}

export default function PrivacyNoticePage() {
  return (
    <main className="mx-auto flex max-w-prose flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="page-heading">{NOTICE_TITLE}</h1>
        <p className="text-lg text-pretty">{NOTICE_COPY.INTRO}</p>
        <p className="text-muted-foreground text-sm">
          {noticeVersionLine(CURRENT_CONSENT_VERSIONS.notice)}
        </p>
      </header>

      <Section heading={NOTICE_COPY.RESPONSIBLE_HEADING}>
        <React.Suspense fallback={<LinesSkeleton lines={2} />}>
          <ResponsibleParty />
        </React.Suspense>
      </Section>

      <Section heading={NOTICE_COPY.DATA_HEADING}>
        <p className="text-pretty">{NOTICE_COPY.DATA_INTRO}</p>
        <Bullets items={DATA_ITEMS} />
      </Section>

      <Section heading={NOTICE_COPY.PURPOSE_HEADING}>
        <p className="text-pretty">{NOTICE_COPY.PURPOSE_INTRO}</p>
        <p className="text-pretty">{NOTICE_COPY.PURPOSE_LIMIT}</p>
      </Section>

      <Section heading={NOTICE_COPY.PROCESSORS_HEADING}>
        <p className="text-pretty">{NOTICE_COPY.PROCESSORS_INTRO}</p>
        <p className="text-pretty">{NOTICE_COPY.PROCESSORS_TRANSMISSION}</p>

        {/*
          Name, country and purpose per recipient — the three things Ley 1581
          asks a notice to disclose about a transmission. `dt`/`dd` rather than a
          table so the pairing survives a narrow screen and is announced rather
          than inferred from a column position.
        */}
        <dl className="flex flex-col gap-4">
          {PROCESSORS.map((processor) => (
            <div key={processor.name} className="flex flex-col gap-1">
              <dt className="font-medium">
                {processor.name} · {processor.country}
              </dt>
              <dd className="text-muted-foreground text-pretty">{processor.purpose}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section heading={NOTICE_COPY.RIGHTS_HEADING}>
        <p className="text-pretty">{NOTICE_COPY.RIGHTS_INTRO}</p>
        <Bullets items={RIGHTS_ITEMS} />
        <React.Suspense fallback={<LinesSkeleton lines={1} />}>
          <RightsContact />
        </React.Suspense>
      </Section>

      {/*
        The anchor a form links to, and the reason this section exists on a public
        page at all: the Consent row stores a version, and the version has to name
        text somebody can read.
      */}
      <Section heading={NOTICE_COPY.AUTHORIZATION_HEADING} id={AUTHORIZATION_ANCHOR}>
        <p className="text-pretty">{NOTICE_COPY.AUTHORIZATION_INTRO}</p>
        <AuthorizationText />
        <p className="text-muted-foreground text-sm">
          {noticeVersionLine(CURRENT_CONSENT_VERSIONS.authorization)}
        </p>
      </Section>
    </main>
  );
}
