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
import { offers } from "@repo/domain/offers";
import { profiles } from "@repo/domain/profiles";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StandingNotices } from "@/app/_components/notices/standing-notices";
import { requireAccountPage } from "@/lib/account";
import { type Arrival, OwnProfileView } from "./_components/own-profile-view";
import { PrototypeSwitcher } from "./_components/prototype/switcher";
import { VariantB } from "./_components/prototype/variant-b";
import { VariantC } from "./_components/prototype/variant-c";
import { variantFrom } from "./_components/prototype/variant-keys";
import { MY_PROFILE_PAGE_TITLE, MY_PROFILE_TITLE } from "./_lib/messages";

export const metadata: Metadata = {
  title: MY_PROFILE_PAGE_TITLE,
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Which redirect she arrived by. Each action sets exactly one flag, so the order
 * here only matters for a hand-typed URL carrying several — and then the first
 * wins rather than two confirmations competing for one region.
 */
function arrivalOf(params: Awaited<SearchParams>): Arrival {
  for (const arrival of ["published", "saved", "paused", "resumed"] as const) {
    if (params[arrival] === "1") return arrival;
  }
  return null;
}

async function ProfilePanel({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAccountPage("/my-profile");

  /**
   * **Her profile and the Offers that reached her, together** (#275). Neither
   * waits on the other, and the Offers read is scoped by profile ownership in its
   * own `where` clause, so it answers an empty list — never somebody else's — for
   * a session that reaches it.
   */
  const [profile, received, params] = await Promise.all([
    profiles.findOwn(session.accountId),
    offers.listReceived(session.accountId),
    searchParams,
  ]);

  if (!profile) redirect("/publish");

  // PROTOTYPE — `?variant=` picks one of three phone-first compositions (#275).
  // The prototype branch only; the pick is folded into `OwnProfileView`.
  const variant = variantFrom(typeof params.variant === "string" ? params.variant : undefined);
  const props = { profile, offers: received, arrival: arrivalOf(params) };

  return (
    <>
      {variant === "B" ? (
        <VariantB {...props} />
      ) : variant === "C" ? (
        <VariantC {...props} />
      ) : (
        <OwnProfileView {...props} />
      )}
      <PrototypeSwitcher />
    </>
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
