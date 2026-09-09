/**
 * `/publish` — a CapabilityProfile, in one sitting, from a phone.
 *
 * Shaped at `.impeccable/briefs/publish.md`; the state set and the target path
 * are the spec's (`## UX design`, the Publish row). Mode is **Operate**.
 *
 * The layout was chosen by `/prototype` UI — three variants on this real route
 * with the real Server Action behind them; the losing two live on
 * `prototype/16-ui-variants` and `_components/publish-layout.tsx` carries the
 * winner and the argument for it.
 *
 * Two of the surface table's cells are routes rather than renders, and both
 * are decided here before anything paints: **signed out →** `/sign-in` with a
 * way back, and **already has a profile →** `/my-profile`.
 *
 * `noindex`: NFR8 does not list this route, but it has nothing a crawler
 * wants and it is behind a session anyway.
 */

import { CURRENT_CONSENT_VERSIONS } from "@repo/domain/consent";
import { profiles } from "@repo/domain/profiles";
import { skills } from "@repo/domain/skills";
import { Skeleton } from "@repo/design-system/components/skeleton";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireAccountPage } from "@/lib/account";
import { PublishForm } from "./_components/publish-form";
// PROTOTYPE (#18 Act 5). Leaves `dev` with the losing variants; see
// `_components/photo-variants/README.md`.
import { PrototypeSwitcher } from "@/app/_components/prototype-switcher";
import { PHOTO_VARIANTS } from "./_components/photo-variants";
import { PUBLISH_INTRO, PUBLISH_PAGE_TITLE, PUBLISH_TITLE } from "@/app/_lib/profile-form/messages";

export const metadata: Metadata = {
  title: PUBLISH_PAGE_TITLE,
  robots: { index: false, follow: false },
};

/**
 * The dynamic half: the session, whether she already has a profile, the
 * vocabulary, and the Google-door prefill. All uncached, so the boundary is
 * `[stream]` from Cache Components' own menu — the heading paints first.
 */
async function PublishPanel() {
  const session = await requireAccountPage("/publish");

  if (await profiles.has(session.accountId)) redirect("/my-profile");

  const [vocabulary, prefill] = await Promise.all([
    skills.listActive(),
    profiles.prefill(session.accountId),
  ]);

  return (
    <PublishForm
      vocabulary={vocabulary}
      prefill={prefill}
      consentVersions={CURRENT_CONSENT_VERSIONS}
    />
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

/**
 * PROTOTYPE (#18 Act 5). Its own component behind its own `<Suspense>`, because
 * reading `searchParams` in the page body is uncached data outside a boundary
 * and Cache Components refuses to prerender the route — `[stream]` from its own
 * menu, which is the right pick for chrome that is not the page.
 */
async function VariantSwitcher({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const variant = (await searchParams).variant;

  return (
    <PrototypeSwitcher
      variants={PHOTO_VARIANTS}
      current={typeof variant === "string" ? variant : "A"}
    />
  );
}

export default function PublishPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">{PUBLISH_TITLE}</h1>
        <p className="text-muted-foreground text-pretty">{PUBLISH_INTRO}</p>
      </div>

      <Suspense fallback={<PanelSkeleton />}>
        <PublishPanel />
      </Suspense>

      {/* PROTOTYPE (#18 Act 5). Hidden in production builds. */}
      <Suspense fallback={null}>
        <VariantSwitcher searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
