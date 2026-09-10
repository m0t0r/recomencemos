/**
 * The Offer form's form-level summary, as data: the one list the layout renders,
 * built from whichever verdict is current — the browser's parse before a submit,
 * or the server's after one.
 *
 * Pure, so it is tested on its own. The ordering is the form's reading order,
 * because the summary is read top to bottom by someone who will then tab into
 * the form top to bottom — **with one exception, the *autorización***, which
 * leads although its checkbox sits last. `ORDER` below says why.
 *
 * **It is this surface's rather than the publishing form's**, and the reason is
 * the field set: `summary.ts` under `_lib/profile-form/` is typed over
 * `PublishFieldName` and knows that one of its fields is an indexed list. Five
 * flat fields need none of that, and widening that module to cover both would
 * have made the work-history branch conditional on a shape no Offer has.
 */

import type { z } from "zod";
import { OFFER_FIELD_LABELS, type OfferFieldName, offerSummaryHeading } from "./offer-messages";

export interface OfferSummaryItem {
  readonly field: OfferFieldName;
  readonly message: string;
}

export interface OfferSummary {
  readonly heading: string;
  readonly items: readonly OfferSummaryItem[];
}

/**
 * The order the summary reads in.
 *
 * **The *autorización* leads**, as it does in the publishing form's summary,
 * although the checkbox sits below the fields. That is the decision that surface
 * made and this one matches: until it is ticked nothing else he typed may be
 * collected, so it is the first thing he is told about rather than the last.
 */
const ORDER: readonly OfferFieldName[] = [
  "consent",
  "hirerName",
  "hirerPhone",
  "workDescription",
  "payTerms",
  "whenText",
];

function isFieldName(value: unknown): value is OfferFieldName {
  return typeof value === "string" && value in OFFER_FIELD_LABELS;
}

function summaryOf(items: OfferSummaryItem[]): OfferSummary | undefined {
  if (items.length === 0) return undefined;

  const sorted = items.toSorted((a, b) => ORDER.indexOf(a.field) - ORDER.indexOf(b.field));

  return { heading: offerSummaryHeading(sorted.length), items: sorted };
}

/** From the browser's own parse: Zod issues, one per field, first message wins. */
export function offerSummaryFromIssues(
  issues: readonly z.core.$ZodIssue[],
): OfferSummary | undefined {
  const seen = new Set<string>();
  const items: OfferSummaryItem[] = [];

  for (const issue of issues) {
    const [field] = issue.path;
    if (!isFieldName(field) || seen.has(field)) continue;

    seen.add(field);
    items.push({ field, message: issue.message });
  }

  return summaryOf(items);
}

/**
 * next-safe-action's formatted shape: `_errors` at each node, nested by key.
 * Read defensively — the type on the wire is the schema's, but this reads what
 * actually arrived.
 */
// `_errors` is next-safe-action's own key for a node's messages, not ours.
// oxlint-disable-next-line no-underscore-dangle
type ErrorNode = { readonly _errors?: readonly string[] } & Record<string, unknown>;

function isNode(value: unknown): value is ErrorNode {
  return typeof value === "object" && value !== null;
}

function firstError(node: unknown): string | undefined {
  // oxlint-disable-next-line no-underscore-dangle -- the library's key
  return isNode(node) ? node._errors?.[0] : undefined;
}

export function offerSummaryFromValidationErrors(errors: unknown): OfferSummary | undefined {
  if (!isNode(errors)) return undefined;

  const items: OfferSummaryItem[] = [];

  for (const field of ORDER) {
    const message = firstError(errors[field]);
    if (message) items.push({ field, message });
  }

  return summaryOf(items);
}

/**
 * The verdict on one field, for the field to render beside itself.
 *
 * **Read off the summary rather than off the raw tree**, which is what lets one
 * source drive both audiences: the list a screen-reader user hears first and the
 * sentence a sighted person reads beside the input are the same sentence, and
 * they cannot come apart. It is also why a browser-side refusal shows per-field
 * messages at all without this form owning a second validation machine.
 */
export function offerFieldError(
  summary: OfferSummary | undefined,
  field: OfferFieldName,
): string | undefined {
  return summary?.items.find((item) => item.field === field)?.message;
}
