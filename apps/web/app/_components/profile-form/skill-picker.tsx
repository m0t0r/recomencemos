"use client";

/**
 * The Skill picker — product, not a design-system primitive (spec, Components),
 * which is why it lives here and composes the registry rather than joining it.
 *
 * **Registry checkboxes, named for the form.** Every entry is the registry's
 * `Checkbox` with `name="skillSlugs"` and its slug as `value`. Base UI renders
 * a hidden native `<input type="checkbox">` beside the styled control, carrying
 * the name, the value and the `id` the label pairs with — so a tap on the label
 * ticks the native input with no JavaScript at all and the form posts exactly
 * what a hydrated one does (NFR4). `authorization.tsx` relies on the same
 * pairing; seam 3 verifies it with scripting off.
 *
 * **The list is one tab stop, not ninety-one.** The vocabulary is 91 entries;
 * as plain checkboxes that is 91 tab stops between the Skills group and the
 * next field, measured in Chrome. So once hydrated the entries are a composite
 * widget with a **roving tab stop**: exactly one entry is tabbable, arrows and
 * Home/End move between them, Space toggles. Unhydrated there is no script to
 * move focus, so every entry keeps its own tab stop and Tab is the only thing
 * that has to work — which is why the roving index is applied only when
 * `hydrated` is true rather than rendered into the server's HTML.
 *
 * **The maximum is spoken, never greyed out.** Disabling the other 85 entries
 * at six stranded focus on an inert control: Space did nothing, and the next
 * Tab left the group with no way back to what she had picked (measured, not
 * assumed). Every entry stays enabled and a seventh pick is refused with a
 * sentence instead, so nothing she can reach is silently inert.
 *
 * **"Not on the list" is here and reachable.** Its action is story 3's; today
 * it reveals a sentence saying so and pointing at the closest entry. A control
 * that promised a request nobody can yet make would be a dead end.
 *
 * **The chosen entries are echoed above the list** as badges, so she never has
 * to scroll to count them.
 */

import { Badge } from "@repo/design-system/components/badge";
import { Button } from "@repo/design-system/components/button";
import { Checkbox } from "@repo/design-system/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/field";
import { Input } from "@repo/design-system/components/input";
import { cn } from "@repo/design-system/lib/utils";
import { type KeyboardEvent, useId, useState } from "react";
import {
  SKILL_FILTER_LABEL,
  SKILL_NOT_LISTED_HELP,
  SKILL_NOT_LISTED_LABEL,
  SKILL_NOT_LISTED_NO_SCRIPT,
  SKILL_REQUEST_BUTTON,
  SKILL_REQUEST_HELP,
  SKILL_REQUEST_LABEL,
  SKILLS_AT_MAXIMUM,
  SKILLS_HELP,
  SKILLS_LABEL,
  skillsChosen,
  skillsNoneMatch,
} from "@/app/_lib/profile-form/messages";
import { LIMITS } from "@/app/_lib/profile-form/schema";
import { useSkillRequest } from "@/app/_lib/profile-form/use-skill-request";
import { CURRENT, type FormTreatment } from "./treatment";

export interface VocabularyEntry {
  readonly slug: string;
  readonly labelEs: string;
}

export interface SkillPickerProps {
  readonly id: string;
  readonly vocabulary: readonly VocabularyEntry[];
  readonly selected: readonly string[];
  readonly onChange: (selected: string[]) => void;
  readonly onBlur?: () => void;
  readonly error?: string | undefined;
  /** Whether the page has hydrated: the filter box and the roving tab stop exist only then. */
  readonly hydrated: boolean;
  /** The entries as a scrolling list, or as a wrapping grid of chips. */
  readonly layout?: "list" | "grid";
  /**
   * How far the notebook world is taken here. It defaults to what `dev`
   * renders so a caller that has no opinion — a test, a prototype variant
   * asking for the control — gets the untreated control rather than a crash.
   */
  readonly treatment?: FormTreatment;
}

const MOVEMENT_KEYS = new Set(["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"]);

function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

export function SkillPicker({
  id,
  vocabulary,
  selected,
  onChange,
  onBlur,
  error,
  hydrated,
  layout = "list",
  treatment = CURRENT,
}: SkillPickerProps) {
  const helpId = useId();
  const errorId = useId();
  const countId = useId();
  const filterId = useId();
  const entryId = useId();
  const notListedId = useId();
  const notListedHelpId = useId();
  const [query, setQuery] = useState("");
  const [notListed, setNotListed] = useState(false);
  /** Which entry holds the tab stop. A slug rather than an index, so filtering cannot strand it. */
  const [active, setActive] = useState<string | undefined>(undefined);
  /**
   * How many times a pick has been refused for being the seventh. A count
   * rather than a flag because the sentence never changes, and an unchanged
   * `alert` that is already mounted is announced once and never again — so the
   * count is the `key` that makes the second refusal a second announcement.
   */
  const [refusals, setRefusals] = useState(0);

  const atMaximum = selected.length >= LIMITS.skills;
  const needle = fold(query.trim());
  const shown = needle
    ? vocabulary.filter((entry) => fold(entry.labelEs).includes(needle))
    : vocabulary;
  const chosen = vocabulary.filter((entry) => selected.includes(entry.slug));

  /**
   * The tab stop: where she left it if that entry is still shown, else the
   * first chosen entry that is, else the first. Derived rather than stored, so
   * narrowing the list can never point it at an entry that is not rendered.
   */
  const rovingSlug = shown.some((entry) => entry.slug === active)
    ? active
    : (shown.find((entry) => selected.includes(entry.slug)) ?? shown[0])?.slug;

  function toggle(slug: string, checked: boolean) {
    setActive(slug);

    if (checked && !selected.includes(slug) && atMaximum) {
      setRefusals((count) => count + 1);
      return;
    }

    setRefusals(0);
    onChange(checked ? [...selected, slug] : selected.filter((candidate) => candidate !== slug));
  }

  /**
   * Arrow keys move between the entries; Home and End jump. Nothing inside is
   * ever disabled, so every step lands on something focusable.
   *
   * On the fieldset, in the capture phase, because Base UI's `Checkbox` neither
   * forwards a `keyDown` handler to its control nor lets the event bubble past
   * it — and it acts on Home and End itself, so the native event is stopped
   * outright once handled (all three measured, not assumed). Only the entries
   * carrying `data-skill-entry` take part: the "not on the list" control below
   * the list is a checkbox too, and it is not a place End should land.
   */
  function moveFocus(event: KeyboardEvent<HTMLFieldSetElement>) {
    if (!MOVEMENT_KEYS.has(event.key)) return;

    const boxes = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-skill-entry]")];
    const current = boxes.indexOf(document.activeElement as HTMLElement);
    if (current === -1) return;

    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();

    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? boxes.length - 1
          : forward
            ? Math.min(current + 1, boxes.length - 1)
            : Math.max(current - 1, 0);

    const target = boxes[next];
    if (!target) return;
    setActive(target.dataset.skillEntry);
    target.focus();
  }

  const describedBy = [helpId, countId, error ? errorId : undefined].filter(Boolean).join(" ");

  return (
    <FieldSet
      id={id}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      className="gap-3"
      /*
        On the fieldset, in the capture phase, because Base UI's `Checkbox`
        neither forwards a `keyDown` handler to its control nor lets the event
        bubble past it (measured, not assumed). The handler only moves focus
        between the checkboxes inside, each of which is itself interactive; the
        fieldset is not made interactive by it.
      */
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
      onKeyDownCapture={moveFocus}
      onBlur={onBlur}
    >
      <FieldLegend>{SKILLS_LABEL}</FieldLegend>
      <FieldDescription id={helpId}>{SKILLS_HELP}</FieldDescription>

      {/*
        The count and the chosen labels, as a polite live region: the number
        changes on every tick and is the fact she would otherwise scroll to
        confirm.
      */}
      <div id={countId} aria-live="polite" className="flex flex-col gap-2 text-sm">
        <p>{skillsChosen(selected.length)}</p>
        {chosen.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {chosen.map((entry) => (
              <li key={entry.slug}>
                <Badge variant="secondary">{entry.labelEs}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/*
        The seventh pick, refused out loud. Keyed by the refusal count so a
        second attempt is announced again rather than sitting mounted and
        silent; `alert` rather than the polite region above because she has
        just asked for something and this is the answer.
      */}
      {refusals > 0 && atMaximum ? (
        // `prefer-tag-over-role` asks for `<output>`, which is a live region
        // for a calculated result, not for a refusal that should interrupt.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        <p key={refusals} role="alert" className="text-destructive text-sm">
          {SKILLS_AT_MAXIMUM}
        </p>
      ) : null}

      {hydrated ? (
        <Field>
          <FieldLabel htmlFor={filterId}>{SKILL_FILTER_LABEL}</FieldLabel>
          <Input
            id={filterId}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
      ) : null}

      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">{skillsNoneMatch(query.trim())}</p>
      ) : (
        <div
          className={cn(
            layout === "grid" && "flex flex-wrap gap-2",
            layout === "list" && "border-border max-h-80 overflow-y-auto rounded-md border",
            /*
              Ninety-one things a person can do is a list, and `DESIGN.md` says
              a list here is separated by the ruling rather than by a gap. The
              container keeps its border because that border is the boundary of
              a *scrolling region* rather than a card — without it there is
              nothing saying the list continues past the fold.
            */
            layout === "list" && treatment.sheets && "divide-border divide-y",
            layout === "list" && !treatment.sheets && "flex flex-col gap-1 p-2",
          )}
        >
          {shown.map((entry) => {
            const checked = selected.includes(entry.slug);
            const boxId = `${entryId}-${entry.slug}`;
            return (
              <FieldLabel
                key={entry.slug}
                htmlFor={boxId}
                className={cn(
                  "font-normal",
                  layout === "grid"
                    ? "border-border rounded-full border px-3 py-1.5 text-sm"
                    : "w-full px-3 py-2.5 text-sm",
                  layout === "list" && !treatment.sheets && "rounded-md",
                  treatment.inkControls &&
                    "has-data-checked:border-primary has-data-checked:bg-primary/10",
                )}
              >
                <Checkbox
                  id={boxId}
                  data-skill-entry={entry.slug}
                  name="skillSlugs"
                  value={entry.slug}
                  checked={checked}
                  /*
                    The roving tab stop, and only once there is script to move
                    it: unhydrated, every entry keeps its own tab stop because
                    Tab is then the only way to reach any of them.
                  */
                  tabIndex={hydrated ? (entry.slug === rovingSlug ? 0 : -1) : undefined}
                  onCheckedChange={(next) => toggle(entry.slug, next === true)}
                />
                {entry.labelEs}
              </FieldLabel>
            );
          })}
        </div>
      )}

      {error ? <FieldError id={errorId}>{error}</FieldError> : null}

      <Field>
        <FieldLabel htmlFor={notListedId} className="font-normal">
          <Checkbox
            id={notListedId}
            checked={notListed}
            onCheckedChange={(checked) => setNotListed(checked === true)}
            aria-describedby={notListed ? notListedHelpId : undefined}
          />
          {SKILL_NOT_LISTED_LABEL}
        </FieldLabel>
        {notListed ? (
          <FieldDescription id={notListedHelpId}>
            {hydrated ? SKILL_NOT_LISTED_HELP : SKILL_NOT_LISTED_NO_SCRIPT}
          </FieldDescription>
        ) : null}
        {notListed && hydrated ? <SkillRequest /> : null}
      </Field>
    </FieldSet>
  );
}

/**
 * The request itself: one field, one button, and an answer that does not move
 * her off the page.
 *
 * **It is not a `<form>`, and it cannot be** — this sits inside the publishing
 * form and HTML does not nest one. The button is `type="button"` so it cannot
 * submit the form around it, and the machine dispatches its own `FormData`. A
 * `formAction` pointing at this action would have been the other shape and is
 * worse in the one case it exists for: unhydrated, it would post her entire draft
 * to an action that knows nothing about publishing.
 *
 * **It renders only once hydrated**, which is why the sentence above it changes.
 * NFR4 binds publishing and the profile edit, not this — and an affordance that
 * looked live with no script behind it would be the dead end the option was
 * written to remove, one turn further in.
 *
 * **The answer is announced, not merely shown.** She is at the bottom of a long
 * form on a phone; a sentence that appears silently below the fold is a sentence
 * she does not know arrived. The refusal interrupts (`alert`) because she asked
 * for something and this is the answer; the confirmation is polite, because
 * nothing is waiting on her reading it.
 */
function SkillRequest() {
  const machine = useSkillRequest();
  const fieldId = useId();
  const helpId = useId();
  const errorId = useId();

  return (
    <div className="border-border mt-2 flex flex-col gap-3 rounded-md border p-3">
      <Field>
        <FieldLabel htmlFor={fieldId}>{SKILL_REQUEST_LABEL}</FieldLabel>
        <FieldDescription id={helpId}>{SKILL_REQUEST_HELP}</FieldDescription>
        {/*
          Controlled by the machine, because *landing* is what empties it: the
          request is in the queue and a field still holding it invites a second
          copy of the same request.
        */}
        <Input
          id={fieldId}
          value={machine.text}
          maxLength={LIMITS.skillRequest}
          aria-describedby={machine.fieldError ? `${helpId} ${errorId}` : helpId}
          aria-invalid={machine.fieldError ? true : undefined}
          onChange={(event) => machine.setText(event.target.value)}
        />
        {machine.fieldError ? <FieldError id={errorId}>{machine.fieldError}</FieldError> : null}
      </Field>

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={machine.pending}
          onClick={() => machine.send()}
        >
          {SKILL_REQUEST_BUTTON}
        </Button>
      </div>

      {/*
        One region, two tones. Keyed by the message so a second identical answer
        is announced again rather than sitting mounted and silent — the same
        mechanism the maximum-Skills refusal above uses, and for the same reason.
      */}
      {machine.notice ? (
        <p
          key={machine.notice.message}
          role={machine.notice.refused ? "alert" : "status"}
          className={cn("text-sm", machine.notice.refused && "text-destructive")}
        >
          {machine.notice.message}
        </p>
      ) : null}
    </div>
  );
}
