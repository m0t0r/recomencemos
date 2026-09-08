"use client";

/**
 * The three controls that narrow `/profiles`.
 *
 * **The URL is the state, and `nuqs` is what writes it.** Every change puts the
 * term in the query string and asks the server for the narrowed list — but as a
 * *soft* navigation rather than a document load, which is the whole reason this
 * is a client component. The first version was a bare `<form method="get">`: it
 * needed no JavaScript at all, and it reloaded the page on every filter change,
 * which is a page load to answer a keystroke.
 *
 * Four options carry that, and each is load-bearing:
 *
 * - **`shallow: false`** — the list is rendered on the server from
 *   `searchParams`, so the server has to see the change. Left at its default the
 *   URL would move and the results would not.
 * - **`startTransition`** — the previous list stays on screen while the new one
 *   streams in, instead of collapsing to a skeleton on every keystroke. That is
 *   also where `isPending` comes from, and it is the only honest busy signal on
 *   this page: the results are a server sibling, so this panel can say *it is
 *   working* and cannot dim them.
 * - **`clearOnDefault`** — a term nobody set leaves no `?q=` behind, so a shared
 *   URL says only what somebody chose. The `GET` form could not do this: a native
 *   submit sends every named control, empty ones included.
 * - **`history: "push"`** — the back button steps back through searches, which is
 *   one of this surface's criteria.
 *
 * **The typed words are debounced and the two pickers are not.** A word is typed
 * a letter at a time and each letter would otherwise be a round trip; a city is
 * chosen once and waiting 300 ms to act on it would read as lag.
 *
 * **The `<form>` is still here, and still `method="get"`.** With JavaScript
 * unavailable it is the whole mechanism — the controls are named, the submit
 * navigates, and the server reads the same query string either way. With
 * JavaScript the submit is prevented, because `nuqs` has already written what it
 * would have sent. That is progressive enhancement in the strict sense: the same
 * markup, one behaviour layered over another.
 *
 * **The Skill options stream in as a prop.** They are a database read and the
 * rest of this panel is not; a `<select>` may only hold `<option>`, so the
 * fallback is an `<option>` and the control is usable before its list arrives.
 */

import { Button } from "@repo/design-system/components/button";
import { buttonVariants } from "@repo/design-system/components/button-variants";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { selectBox } from "@repo/design-system/components/input-variants";
import { CITIES } from "@repo/domain/policy";
import Link from "next/link";
import { debounce, parseAsString, useQueryStates } from "nuqs";
import { type ReactNode, useTransition } from "react";
import { RadioChips } from "@/app/_components/radio-chips";
import { FILTER_KEYS, isNarrowed, MAX_QUERY_LENGTH } from "../_lib/filters";
import {
  FILTER_ANY_CITY,
  FILTER_ANY_SKILL,
  FILTER_CITY_LABEL,
  FILTER_CLEAR,
  FILTER_SEARCHING,
  FILTER_SKILL_LABEL,
  FILTER_SKILLS_LOADING,
  FILTER_SUBMIT,
  FILTER_TEXT_HINT,
  FILTER_TEXT_LABEL,
  FILTER_TEXT_PLACEHOLDER,
  FILTERS_LEGEND,
} from "../_lib/messages";

/**
 * The four parameters this panel writes, in the names the server reads them by.
 *
 * `satisfies` is what holds the two together: `FILTER_KEYS` is the one list of
 * query-string names, and a key added there and forgotten here — or a typo —
 * fails to compile rather than silently writing a parameter nothing reads.
 */
const FILTER_PARSERS = {
  q: parseAsString.withDefault(""),
  skill: parseAsString.withDefault(""),
  city: parseAsString.withDefault(""),
  after: parseAsString.withDefault(""),
} satisfies Record<(typeof FILTER_KEYS)[keyof typeof FILTER_KEYS], unknown>;

/** How long after the last keystroke the URL is written. */
const TYPING_SETTLES_MS = 300;

/**
 * The city, as chips. `Cualquier ciudad` is the first one rather than an absent
 * state: a radio group with nothing selected has no way back to "all of them"
 * once something has been picked.
 */
const CITY_CHIPS = [
  { value: "", label: FILTER_ANY_CITY },
  ...CITIES.map((city) => ({ value: city.id, label: city.label })),
];

export interface BrowseFiltersProps {
  /** The `<option>` list, streamed — see the note above about the fallback. */
  readonly skillOptions: ReactNode;
}

/**
 * **The `nuqs` adapter is not mounted here, and that is deliberate twice over.**
 * The route mounts it — which keeps it off `/` and `/privacy`, for the reason
 * #157 moved the toast region out of the root layout: a provider above every
 * route is paid for by every route. And it leaves this component free of its own
 * context, so a test can render it under `NuqsTestingAdapter` and watch what it
 * writes; a component that mounts its own provider cannot be given a different
 * one.
 */
export function BrowseFiltersForm({ skillOptions }: BrowseFiltersProps) {
  const [isPending, startTransition] = useTransition();
  const [params, setParams] = useQueryStates(FILTER_PARSERS, {
    shallow: false,
    history: "push",
    clearOnDefault: true,
    startTransition,
  });

  /**
   * Any filter change drops the page cursor. A cursor names a row's position in
   * an ordering, and an ordering over a different population is a different
   * ordering — so keeping it would put the reader at row 48 of a list that no
   * longer has 48 rows.
   */
  const narrow = (
    // `null` is how a term is cleared rather than written empty, which is what
    // `clearOnDefault` then takes out of the URL entirely.
    next: Partial<Record<keyof typeof params, string | null>>,
    settle = false,
  ) =>
    void setParams(
      { ...next, after: null },
      settle ? { limitUrlUpdates: debounce(TYPING_SETTLES_MS) } : {},
    );

  const active = { query: params.q, skill: params.skill || null, city: params.city || null };

  return (
    /*
      `<search>` rather than `role="search"` on the form: the element carries the
      role natively and is Baseline Widely Available well inside the browser
      floor. `aria-busy` is the busy signal — the results are a server sibling
      that this panel cannot reach, and a transition deliberately leaves the old
      ones on screen, so without it nothing would say a new list is coming.
    */
    <search aria-label={FILTERS_LEGEND} aria-busy={isPending}>
      <form
        method="get"
        action="/profiles"
        className="flex flex-col gap-5"
        // Already written by the time this fires; without JavaScript it never does.
        onSubmit={(event) => event.preventDefault()}
      >
        <Field>
          <FieldLabel htmlFor="browse-filter-q">{FILTER_TEXT_LABEL}</FieldLabel>
          <Input
            id="browse-filter-q"
            type="search"
            name={FILTER_KEYS.query}
            value={params.q}
            onChange={(event) => narrow({ q: event.target.value || null }, true)}
            maxLength={MAX_QUERY_LENGTH}
            placeholder={FILTER_TEXT_PLACEHOLDER}
            aria-describedby="browse-filter-hint"
            /*
              Off, all three. A capitalised first letter and an autocorrected
              trade name are two ways to search for something nobody published,
              and the fold this search runs on makes the capital pointless.
            */
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <FieldDescription id="browse-filter-hint">{FILTER_TEXT_HINT}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="browse-filter-skill">{FILTER_SKILL_LABEL}</FieldLabel>
          <select
            id="browse-filter-skill"
            name={FILTER_KEYS.skill}
            value={params.skill}
            onChange={(event) => narrow({ skill: event.target.value || null })}
            className={selectBox}
          >
            <option value="">{FILTER_ANY_SKILL}</option>
            {skillOptions}
          </select>
        </Field>

        <FieldSet>
          <FieldLegend variant="label">{FILTER_CITY_LABEL}</FieldLegend>
          <RadioChips
            name={FILTER_KEYS.city}
            chips={CITY_CHIPS}
            value={params.city}
            onValueChange={(city) => narrow({ city: city || null })}
            layout="wrap"
          />
        </FieldSet>

        <div className="flex flex-wrap items-center gap-3">
          {/*
            The submit is the no-JavaScript mechanism, and with JavaScript it is
            the way to act on a half-typed word without waiting out the debounce.
          */}
          <Button type="submit" onClick={() => narrow({ q: params.q || null })}>
            {isPending ? FILTER_SEARCHING : FILTER_SUBMIT}
          </Button>
          {/*
            A link rather than a reset: reset restores the values the document
            arrived with, which on a filtered page are the filters themselves.
            The way out of a narrowed list is the unnarrowed one, and that is a
            URL — so it stays a real link, and works with JavaScript unavailable.
          */}
          {isNarrowed(active) ? (
            <Link href="/profiles" className={buttonVariants({ variant: "ghost" })}>
              {FILTER_CLEAR}
            </Link>
          ) : null}
        </div>
      </form>
    </search>
  );
}

/** What sits in the `<select>` until the vocabulary read answers. */
export function SkillOptionsFallback() {
  return <option disabled>{FILTER_SKILLS_LOADING}</option>;
}
