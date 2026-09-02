/**
 * The form-level summary, as data: the one list every layout renders, built
 * from whichever verdict is current — the browser's parse before a submit, or
 * the server's `validationErrors` after one.
 *
 * Pure, so it is tested on its own. The ordering is the form's reading order,
 * because the summary is read top to bottom by someone who will then tab into
 * the form top to bottom.
 */

import type { z } from "zod";
import { FIELD_LABELS, type PublishFieldName, summaryHeading } from "./messages";

export interface SummaryItem {
  readonly field: PublishFieldName;
  /** Which line, when the field is the work history. */
  readonly index?: number;
  readonly message: string;
}

export interface Summary {
  readonly heading: string;
  readonly items: readonly SummaryItem[];
}

/** The reading order of the fields, which is also the order of the summary. */
const ORDER: readonly PublishFieldName[] = [
  "consent",
  "skillSlugs",
  "headline",
  "firstName",
  "lastInitial",
  "city",
  "fullName",
  "phone",
  "about",
  "workHistory",
];

function isFieldName(value: unknown): value is PublishFieldName {
  return typeof value === "string" && value in FIELD_LABELS;
}

function sorted(items: SummaryItem[]): SummaryItem[] {
  return items.toSorted((a, b) => {
    const byField = ORDER.indexOf(a.field) - ORDER.indexOf(b.field);
    if (byField !== 0) return byField;
    return (a.index ?? -1) - (b.index ?? -1);
  });
}

function summaryOf(items: SummaryItem[]): Summary | undefined {
  if (items.length === 0) return undefined;
  return { heading: summaryHeading(items.length), items: sorted(items) };
}

/** From the browser's own parse: Zod issues, one per field, first message wins. */
export function summaryFromIssues(issues: readonly z.core.$ZodIssue[]): Summary | undefined {
  const seen = new Set<string>();
  const items: SummaryItem[] = [];

  for (const issue of issues) {
    const [field, index] = issue.path;
    if (!isFieldName(field)) continue;

    const at = typeof index === "number" ? index : undefined;
    const key = `${field}:${at ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push(
      at === undefined
        ? { field, message: issue.message }
        : { field, index: at, message: issue.message },
    );
  }

  return summaryOf(items);
}

/**
 * next-safe-action's formatted shape: `_errors` at each node, nested by key,
 * with a work-history line under its index. Read defensively — the type on the
 * wire is the schema's, but this reads what actually arrived.
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

export function summaryFromValidationErrors(errors: unknown): Summary | undefined {
  if (!isNode(errors)) return undefined;
  const items: SummaryItem[] = [];

  for (const field of ORDER) {
    const node = errors[field];
    if (!isNode(node)) continue;

    const own = firstError(node);
    if (own) items.push({ field, message: own });

    if (field === "workHistory") {
      for (const [key, line] of Object.entries(node)) {
        if (key === "_errors") continue;
        const message = firstError(line);
        if (message) items.push({ field, index: Number(key), message });
      }
    }
  }

  return summaryOf(items);
}

/** The server's verdict on one field, for the field to render beside itself. */
export function serverFieldError(
  errors: unknown,
  field: PublishFieldName,
  index?: number,
): string | undefined {
  if (!isNode(errors)) return undefined;
  const node = errors[field];
  if (!isNode(node)) return undefined;
  if (index === undefined) return firstError(node);
  return firstError(node[String(index)]);
}
