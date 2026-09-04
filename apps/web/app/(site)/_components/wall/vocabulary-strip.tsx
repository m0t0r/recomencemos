/**
 * The platform's Skill vocabulary, drifting across the cover.
 *
 * **It is the one authored motion in the product** (`DESIGN.md` → Motion), and
 * it is real content rather than an illustration: every chip is an active entry
 * of the vocabulary a Worker publishes against, read from the database at
 * request time. A landing that showed capabilities nobody could actually pick
 * would be the kind of claim `PRODUCT.md` refuses.
 *
 * **Why it moves, and how it stops.** Ninety-odd verb phrases do not fit in a
 * viewport, and a strip that scrolls slowly shows a reader the breadth of what
 * people here do without asking her to scroll for it. The track holds the list
 * twice so the loop is seamless; the second copy is `aria-hidden` and hidden
 * under `prefers-reduced-motion`, where the first copy wraps into a static block
 * instead. The keyframes are `--animate-drift` in `globals.css`, so no
 * JavaScript is involved and nothing here counts against NFR3. Hovering pauses
 * it, which is what a person does when a phrase catches her eye.
 *
 * **The list a screen reader walks is the list on screen — in both states, and
 * they are not the same length.** Drifting, it is the whole vocabulary; stilled,
 * it is the first twelve, because the alternative to a wrapped block of ninety
 * chips is not a shorter block but a screenful of them. Nothing is shown to one
 * reader and withheld from the other: the truncation is `display: none`, so the
 * eye and the accessibility tree agree within each state, and the label promises
 * *algunas de las cosas* rather than all of them. What a reduced-motion reader
 * does not get is a teaser's remainder, and `/profiles` is where the vocabulary
 * is browsable in full. Written down because an asymmetry between two media
 * queries reads like an oversight, and this one is a decision.
 *
 * **The order is deterministic and mixed.** The vocabulary arrives alphabetical,
 * which reads as _Arreglar, Arreglar, Arreglar_; a stable key from the slug
 * spreads the verbs without making two renders disagree.
 *
 * The read is uncached by design (ADR-0011), so the page holds this inside a
 * `<Suspense>` boundary and `connection()` marks it request-time — the same
 * reason `page.tsx` gives for the list.
 */

import { Badge } from "@repo/design-system/components/badge";
import { skills, type VocabularyEntry } from "@repo/domain/skills";
import { connection } from "next/server";
import { VOCABULARY_LABEL } from "../../_lib/wall/messages";

/**
 * A rank for the shuffle, derived from the slug so that every render agrees.
 * Any prime modulus spreads the ranks; 100 003 is just large enough that two
 * of ninety slugs rarely tie, and a tie falls back to the sort's stability.
 */
function shuffleRank(slug: string): number {
  let rank = 0;
  for (const char of slug) rank = (rank * 31 + char.codePointAt(0)!) % 100_003;
  return rank;
}

function shuffled(entries: readonly VocabularyEntry[]): VocabularyEntry[] {
  return entries.toSorted((a, b) => shuffleRank(a.slug) - shuffleRank(b.slug));
}

function Chips({
  entries,
  hidden = false,
}: {
  entries: readonly VocabularyEntry[];
  hidden?: boolean;
}) {
  return (
    <ul
      // oxlint-disable-next-line no-redundant-roles -- see profile-list.tsx.
      role="list"
      aria-label={hidden ? undefined : VOCABULARY_LABEL}
      aria-hidden={hidden || undefined}
      className={
        hidden
          ? "flex shrink-0 gap-2 pr-2 motion-reduce:hidden"
          : // Still: twelve chips wrapped inside the page's gutter, rather than ninety-one rows of them.
            "flex shrink-0 gap-2 pr-2 motion-reduce:mx-auto motion-reduce:w-full motion-reduce:max-w-5xl motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:px-4 motion-reduce:[&>li:nth-child(n+13)]:hidden"
      }
    >
      {entries.map((entry) => (
        <li key={entry.slug}>
          {/*
            The registry's chip, as `skill-chips.tsx` uses it, at the cover's
            size and in the cover's ink: a Skill is rendered the same way on
            every surface, and only its colour follows the ground it sits on.
          */}
          <Badge
            variant="outline"
            className="border-ink-muted/40 bg-ink-foreground/8 text-ink-foreground h-auto px-3 py-1.5 text-sm"
          >
            {entry.labelEs}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export async function VocabularyStrip() {
  await connection();

  const entries = shuffled(await skills.listActive());

  if (entries.length === 0) return <VocabularyStripPlaceholder />;

  return (
    <div className="overflow-hidden">
      <div className="animate-drift flex w-max hover:[animation-play-state:paused] motion-reduce:w-full">
        <Chips entries={entries} />
        <Chips entries={entries} hidden />
      </div>
    </div>
  );
}

/**
 * Holds the strip's height while the read is in flight — one row of chips —
 * so the cover does not grow when the vocabulary arrives.
 */
export function VocabularyStripPlaceholder() {
  return <div className="h-9" aria-hidden="true" />;
}
