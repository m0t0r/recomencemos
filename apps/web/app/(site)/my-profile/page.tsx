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
import { StandingNotices } from "@/app/_components/notices/standing-notices";
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

  return (
    <OwnProfileView
      profile={profile}
      justPublished={params.published === "1"}
      justSaved={params.saved === "1"}
    />
  );
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
      <h1 className="page-heading">{MY_PROFILE_TITLE}</h1>
      <Suspense fallback={<PanelSkeleton />}>
        <ProfilePanel searchParams={searchParams} />
      </Suspense>
      {/*
        Story 11's three standing notices, at the foot rather than at the head,
        which is the one placement decision this surface takes for itself.

        The page above is already an honest account of who sees what — *lo que ve
        todo el mundo*, *lo que ve quien abra tu perfil*, *lo que ve solo quien tú
        aceptes* — and these three continue it: who checked (nobody), what we hold
        (no money), and what refusing somebody actually reaches. Put at the head
        they would push her own profile below the fold on a phone to tell her
        something she is not, at that moment, deciding.

        Outside the `<Suspense>` above, so a failed read of her profile still
        leaves them on screen. Same rule as the two lists, different boundary.
      */}
      <StandingNotices treatment="expanded" />
    </main>
  );
}
