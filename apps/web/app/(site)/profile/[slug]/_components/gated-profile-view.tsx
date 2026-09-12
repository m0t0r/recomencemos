/**
 * One Worker's profile, as a signed-in Hirer reads it.
 *
 * **Sync and prop-driven**, which is the shape `own-profile-view.tsx` set and
 * for the same reason: the async page above it cannot be tested under happy-dom,
 * and what is worth pinning is here — that her free-text fields render as
 * **content and never as a URL**, and that the four held fields are absent from
 * the markup whatever the projection did.
 *
 * **Her headline is the `<h1>`.** That is the same hierarchy the row on the Wall
 * argues for — she is described by what she can do — carried through to the page
 * the row leads to. A page whose heading was her name would be a page about a
 * person rather than about a capability, and the one thing this product will not
 * do is describe someone by what happened to her.
 *
 * **Her name is above it on screen, and that is not a contradiction** (#220).
 * The `<h1>` is still her sentence and her name is still a paragraph; what
 * changed is where the eye meets them. A portrait with a name beside it is one
 * object, and a reader takes it in before reading what that person says — which
 * is the order an introduction has. The hierarchy ADR-0009 fixes is about *what
 * describes her*, not about which pixel comes first, and the test that guards it
 * (`heads the page with her own words, not with her name`) is unchanged.
 *
 * **The composition is a page's, not a row's** (#220, brief at
 * `.impeccable/briefs/gated-profile.md`). It used to be `flex gap-4` — a 40 px
 * avatar in a left gutter, everything else in the column beside it — which is
 * correct in a row, where the avatar is a scanning anchor across many people and
 * the headline is a line or two. On a page about one person that gutter is 56 px
 * wide and as tall as the whole block: measured at 390 px it held a 40 px circle
 * over 418 px of nothing, squeezed a 103-character headline into **seven** lines
 * and forced every Skill chip onto its own row, while her name landed 244 px
 * below the words it belongs to. The portrait is `xl` and the measure is the
 * page's, which is one fix for all three symptoms — four lines, two chips a row,
 * and a name beside the face rather than a screen away.
 *
 * **The identity block is inside `ruled-page` with the sections**, so the page
 * is one document rather than a header floating above a ruled one. Chosen from
 * three candidates built and compared running at 390 px; the losing two are in
 * the ticket.
 *
 * **The work history arrives as a promise**, not as an array. The page streams
 * it inside its own Suspense boundary, so this component takes what it can
 * render now and hands the rest to {@link WorkHistorySection}, which suspends on
 * it. Passing the resolved array instead would make that boundary decorative.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/avatar";
import { Skeleton } from "@repo/design-system/components/skeleton";
import { cityLabel } from "@repo/domain/policy";
import type { GatedIdentity } from "@repo/domain/profiles";
import * as React from "react";
import { displayName, initialOf } from "@/app/(site)/_components/profile-card";
import { SkillChips } from "@/app/(site)/_components/profile-list/skill-chips";
import { photoAlt } from "@/app/(site)/_lib/lists/messages";
import { ABOUT_HEADING, NOTHING_MORE, WORK_HISTORY_HEADING } from "../_lib/messages";
import { BackToList } from "./back-to-list";

export interface GatedProfileViewProps {
  readonly profile: GatedIdentity;
  /**
   * Her work history, still in flight. A promise rather than an array so the
   * boundary below it is real — see the class comment.
   */
  readonly workHistory: Promise<readonly string[]>;
}

function Section({
  id,
  heading,
  children,
}: {
  readonly id: string;
  readonly heading: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-border flex flex-col gap-3 border-t py-7 first:border-t-0 first:pt-0"
    >
      {/*
        The 20 px step, and it is a step *down* from `own-profile-view.tsx`'s
        otherwise identical section heading (#220). Her headline is this page's
        `<h1>` at 24 px, and at 24 px these two `<h2>`s were the same face, size,
        weight and colour as it — nothing in the type said which was the page and
        which was a part of it. `/my-profile` keeps 24 px because its `<h1>` is a
        32 px page title, so it has the step this page had to buy.
      */}
      <h2 id={id} className="font-heading text-foreground text-xl leading-7 font-medium">
        {heading}
      </h2>
      {children}
    </section>
  );
}

/**
 * Lines are positional data with no id of their own and never reorder on the
 * client, so a duplicate line is keyed by how many times it has appeared — the
 * same rule `own-profile-view.tsx` states, because it is the same data read from
 * the other side.
 */
function WorkHistoryList({ lines }: { readonly lines: readonly string[] }) {
  const seen = new Map<string, number>();
  return (
    <ul className="text-foreground flex list-disc flex-col gap-2 pl-5">
      {lines.map((line) => {
        const occurrence = (seen.get(line) ?? 0) + 1;
        seen.set(line, occurrence);
        return (
          <li key={`${line}#${occurrence}`} className="text-pretty">
            {line}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The streamed half. `use()` suspends here rather than in the parent, so the
 * heading above it and everything before it paint on the first flush.
 *
 * A profile with no lines renders **nothing at all** rather than an empty
 * section: she published without a work history, which is a complete profile,
 * and a heading over a blank space would read as something that failed to load.
 * {@link NOTHING_MORE} covers the case where she wrote neither field, and it
 * sits with the self-description because that is the section the reader is
 * looking at when both are missing.
 */
function WorkHistorySection({ lines }: { readonly lines: Promise<readonly string[]> }) {
  const history = React.use(lines);
  if (history.length === 0) return null;

  return (
    <Section id="work-history-heading" heading={WORK_HISTORY_HEADING}>
      <WorkHistoryList lines={history} />
    </Section>
  );
}

/**
 * The fallback, at the entry height — the spec's boundary table asks for
 * "skeleton lines at the entry height", and holding the layout is what stops the
 * link at the foot of the page moving under a thumb that is reaching for it.
 *
 * The heading is **in** the fallback rather than above the boundary, because the
 * section may resolve to nothing at all: a heading painted outside it would
 * announce a section that then never arrives.
 */
function WorkHistorySkeleton() {
  return (
    <div className="border-border flex flex-col gap-3 border-t py-7" aria-hidden="true">
      {/* `h-7`, matching the 20 px section heading this stands in for (#220). */}
      <Skeleton className="h-7 w-56" />
      <div className="flex flex-col gap-2 pl-5">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </div>
  );
}

export function GatedProfileView({ profile, workHistory }: GatedProfileViewProps) {
  const name = displayName(profile.firstName, profile.lastInitial);

  return (
    <div className="flex flex-col gap-8">
      {/*
        Story 11's three statements are **not** here. This slot was reserved for
        them before they existed; they landed at the foot of `page.tsx` instead,
        outside the Suspense boundary, so a ceiling refusal or a missing-profile
        response still carries them. Left as a note rather than deleted, because
        "above her own words" was a real proposal and the reason it was not taken
        is that it puts three statements between a reader and the person she came
        to read.
      */}

      <div className="ruled-page">
        <header className="border-border flex flex-col gap-4 border-t py-7 first:border-t-0 first:pt-0">
          {/*
            The nameplate: one object, so the face and the name cannot be read
            apart. `items-center` rather than `items-start` because a two-line
            name and a one-line name must both sit against the middle of the
            circle — aligned to the top, a single line hangs off the crown of a
            64 px portrait.
          */}
          <div className="flex items-center gap-4">
            {/*
              The initial is the approved-photo-absent state and it is also the
              pending state: one shape, two causes, never a badge. `aria-hidden`
              while it holds an initial, because the name is announced anyway.

              **`xl` is the common case, not the flattering one.** Until a human
              approves a photo this circle holds a letter, which is what most
              profiles show — so 64 px had to be the size the composition is
              drawn for with an initial in it, not the size that only works with
              a face.
            */}
            <Avatar
              size="xl"
              className="shrink-0"
              aria-hidden={profile.photoUrl ? undefined : true}
            >
              {profile.photoUrl ? (
                <AvatarImage src={profile.photoUrl} alt={photoAlt(name)} />
              ) : null}
              <AvatarFallback>{initialOf(profile.firstName)}</AvatarFallback>
            </Avatar>

            {/*
              Her name in the **working face**, not the display one. `DESIGN.md`
              reserves Alegreya for headings and for what she wrote; her name is
              neither, and setting it in the display face would put it in visual
              competition with the sentence below that is actually hers.
            */}
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-foreground text-lg leading-6 font-medium">{name}</p>
              <p className="text-muted-foreground text-sm">{cityLabel(profile.city)}</p>
            </div>
          </div>

          {/*
            Her own words, in the display face — the one line nobody else could
            have written, and now on the page's full measure rather than in the
            column a portrait left over.

            **The 24 px step, and `page-heading` is deliberately not used here.**
            That class is 32 px with `text-balance`, drawn for a page *title* of
            two to four words; this `<h1>` is a sentence of up to 120 characters,
            and a title's tooling set it in seven lines on a phone. 24 px is the
            step her words already take in a row and on a card, so one rule now
            holds everywhere: her sentence is 24 px Alegreya wherever it appears,
            and only the composition around it changes. `DESIGN.md` → Typography
            carries the clause this bought.
          */}
          <h1 className="font-heading text-foreground text-2xl leading-8 font-medium text-pretty">
            {profile.headline}
          </h1>

          <SkillChips skills={profile.skills} />
        </header>

        <Section id="about-heading" heading={ABOUT_HEADING}>
          {profile.about ? (
            /*
              `whitespace-pre-line`, because she typed paragraphs and the form
              kept them. Rendered as text and never as markup or a URL — the
              guarantee `gated-profile-view.test.tsx` pins with a `javascript:`
              sentinel.
            */
            <p className="text-foreground whitespace-pre-line text-pretty">{profile.about}</p>
          ) : (
            <p className="text-muted-foreground text-pretty">{NOTHING_MORE}</p>
          )}
        </Section>

        <React.Suspense fallback={<WorkHistorySkeleton />}>
          <WorkHistorySection lines={workHistory} />
        </React.Suspense>
      </div>

      <BackToList />
    </div>
  );
}
