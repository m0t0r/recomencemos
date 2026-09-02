/**
 * `/my-profile` — what she published, tiered by who sees it.
 *
 * Shaped at `.impeccable/briefs/own-profile.md`; the state set is the spec's
 * (`## UX design`, the Own profile row). Mode is **Operate**. The layout was
 * chosen by `/prototype` UI on this route; the losers live on
 * `prototype/16-ui-variants`.
 *
 * Three cells are routes or interrupts, decided before anything paints:
 * **signed out →** `/sign-in` with a way back; **a session with no profile →**
 * `/publish`, because this page has nothing to show and that is the useful
 * thing to do with her; **not the owner →** a 404 by `notFound()`, which is a
 * framework interrupt of the same class as `redirect()` and `/admin`'s
 * `forbidden()` — it costs no Sentry event and is not a thrown `AppError`,
 * which is what C51 asks for. Today the owner is the session, so the third
 * cannot arise; it is written so the page says what it does when it can.
 *
 * `noindex`, both halves: `/my-profile*` is on NFR8's list, so the header is
 * already configured in `next.config.ts` and this sets the `<meta>`.
 */

import { Skeleton } from "@repo/design-system/components/skeleton";
import { profiles } from "@repo/domain/profiles";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireAccountPage } from "@/lib/account";
import { OwnProfileView } from "./_components/own-profile-view";
import { MY_PROFILE_PAGE_TITLE, MY_PROFILE_TITLE } from "./_lib/messages";

export const metadata: Metadata = {
  title: MY_PROFILE_PAGE_TITLE,
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function ProfilePanel({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAccountPage("/my-profile");
  const [profile, params] = await Promise.all([profiles.findOwn(session.accountId), searchParams]);

  if (!profile) redirect("/publish");

  return <OwnProfileView profile={profile} justPublished={params.published === "1"} />;
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

export default function MyProfilePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <h1 className="text-foreground text-2xl leading-8 font-semibold tracking-tight">
        {MY_PROFILE_TITLE}
      </h1>
      <Suspense fallback={<PanelSkeleton />}>
        <ProfilePanel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
