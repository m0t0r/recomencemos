"use client";

/**
 * Her words, shown back to her: the card a stranger will see, built from what
 * the form is holding right now.
 *
 * **It is `ProfileCard` and not a second card.** That component already carries
 * the hierarchy the Wall row carries — her own line first and in the display
 * face, then who and where, then the Skills as chips — and `/my-profile`
 * renders it one route away as the proof of what she published. A preview drawn
 * to its own recipe would be a second description of the same person, and the
 * first time the two drifted the preview would be a promise the product does
 * not keep.
 *
 * **Nothing held is on it, and that is the argument for showing it at all.**
 * The card takes her first name, last initial, city, headline and Skills; her
 * full name, her phone and her email have no slot on it. The disclosure rule
 * the field groups state in words is visible here as an absence.
 *
 * **Before there is a line there is no card.** The headline is the card's
 * title and the whole of its hierarchy, so an empty one would render a card
 * with a hole where the only line nobody else could have written belongs. Until
 * then the sheet says what will appear and why — which on `/publish` is the
 * state she opens in, and on `/my-profile/edit` is a state she cannot reach,
 * because a published profile has a headline by construction.
 *
 * **It works with JavaScript unavailable**, and differently on each surface,
 * honestly: the subscription renders from whatever the form opened with, which
 * is her published profile on an edit and nothing at all on a first publish.
 */

import type { VocabularyEntry } from "@repo/domain/skills";
import { ProfileCard } from "@/app/(site)/_components/profile-card";
import { PREVIEW_EMPTY } from "@/app/_lib/profile-form/messages";
import type { ProfileFieldsForm } from "@/app/_lib/profile-form/use-profile-fields";
import { CITY_LABELS } from "./fields";

export interface ProfilePreviewProps {
  readonly form: ProfileFieldsForm;
  /** The same entries the picker offers, so a chosen Skill reads the same in both. */
  readonly vocabulary: readonly VocabularyEntry[];
}

export function ProfilePreview({ form, vocabulary }: ProfilePreviewProps) {
  return (
    <form.Subscribe
      selector={(state) => ({
        firstName: state.values.firstName,
        lastInitial: state.values.lastInitial,
        city: state.values.city,
        headline: state.values.headline,
        skillSlugs: state.values.skillSlugs,
      })}
    >
      {(values) => {
        if (values.headline.trim().length === 0) {
          return <p className="text-muted-foreground text-sm text-pretty">{PREVIEW_EMPTY}</p>;
        }

        /*
          An unrecognised city renders as no city rather than as the raw
          identifier: `city` is a free string until the boundary parse has run,
          and `santa_rosa_de_cabal` is not a place name anyone should be shown.
        */
        const city = CITY_LABELS[values.city as keyof typeof CITY_LABELS] ?? "";

        return (
          <ProfileCard
            firstName={values.firstName}
            lastInitial={values.lastInitial}
            cityLabel={city}
            headline={values.headline}
            skills={vocabulary.filter((entry) => values.skillSlugs.includes(entry.slug))}
          />
        );
      }}
    </form.Subscribe>
  );
}
