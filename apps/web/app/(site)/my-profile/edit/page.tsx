/**
 * `/my-profile/edit` — change what a published profile says.
 *
 * Shaped at `.impeccable/briefs/edit-profile.md`; the state set is the spec's
 * (`## UX design`, the Own profile row). Mode is **Operate**.
 *
 * Two cells are routes, decided before anything paints: **signed out →**
 * `/sign-in` with a way back, and **a session with no profile →** `/publish`,
 * which is the same answer `/my-profile` gives, because this page has nothing
 * to show and that is the useful thing to do with her. The third,
 * **not the owner → 404**, cannot arise while the owner *is* the session; the
 * action asks independently anyway, which is where a direct POST is refused.
 *
 * `noindex`, both halves: `/my-profile/:path*` is already on NFR8's header
 * list, so this only has to set the `<meta>`.
 */

import { profiles } from "@repo/domain/profiles";
import { skills } from "@repo/domain/skills";
import { Skeleton } from "@repo/design-system/components/skeleton";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PrototypeSwitcher } from "@/app/_components/prototype-switcher";
import type { VocabularyEntry } from "@/app/_components/profile-form/skill-picker";
import { treatmentFor, VARIANT_KEYS, VARIANTS } from "@/app/_components/profile-form/variants";
import { requireAccountPage } from "@/lib/account";
import { EditForm } from "./_components/edit-form";
import { EDIT_INTRO, EDIT_PAGE_TITLE, EDIT_TITLE } from "./_lib/messages";

export const metadata: Metadata = {
  title: EDIT_PAGE_TITLE,
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * **What she may choose from: the active vocabulary plus what she already
 * holds.**
 *
 * The picker has to offer a retired Skill she holds or she could not keep it,
 * and `profiles.update` admits exactly this set for the same reason — one
 * retirement must not freeze every profile holding that Skill. The merge is
 * here rather than in the domain because it is what this *surface* renders;
 * the domain enforces it whatever the surface offers.
 *
 * Sorted by the label, which is the order `listActiveSkills` already renders in.
 */
function choosable(
  vocabulary: readonly VocabularyEntry[],
  held: readonly VocabularyEntry[],
): VocabularyEntry[] {
  const bySlug = new Map(vocabulary.map((entry) => [entry.slug, entry]));
  for (const entry of held) if (!bySlug.has(entry.slug)) bySlug.set(entry.slug, entry);

  return [...bySlug.values()].toSorted((a, b) => a.labelEs.localeCompare(b.labelEs, "es-CO"));
}

async function EditPanel({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAccountPage("/my-profile/edit");
  const profile = await profiles.findOwn(session.accountId);

  if (!profile) redirect("/publish");

  const [vocabulary, params] = await Promise.all([skills.listActive(), searchParams]);

  return (
    <>
      <EditForm
        treatment={treatmentFor(params.variant)}
        vocabulary={choosable(vocabulary, profile.skills)}
        defaults={{
          fullName: profile.fullName,
          firstName: profile.firstName,
          lastInitial: profile.lastInitial,
          city: profile.city,
          headline: profile.headline,
          about: profile.about,
          phone: profile.phone,
          skillSlugs: profile.skills.map((skill) => skill.slug),
          workHistory: [...profile.workHistory],
        }}
      />
      {params.clean === "1" ? null : (
        <PrototypeSwitcher
          variants={VARIANT_KEYS.map((key) => ({ key, name: VARIANTS[key].name }))}
          current={String(params.variant ?? "")}
        />
      )}
    </>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

export default function EditProfilePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">{EDIT_TITLE}</h1>
        <p className="text-muted-foreground text-pretty">{EDIT_INTRO}</p>
      </div>

      <Suspense fallback={<PanelSkeleton />}>
        <EditPanel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
