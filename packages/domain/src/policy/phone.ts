/**
 * A Colombian phone number, as typed, to E.164 as stored.
 *
 * The column is `phone` E.164 (Core entities), and the person typing it is on a
 * phone in Risaralda who will write it the way she says it — `300 123 4567`,
 * `+57 300 123 4567`, `3001234567`, occasionally with the country code and no
 * plus. All of those are one number, and the row should hold it one way so that
 * DD2's duplicate-phone signal — _"N profiles share this number"_ — compares
 * like with like.
 *
 * **Colombian numbers only, and that is a decision rather than a gap.** The
 * product introduces people _in Risaralda_ to anyone anywhere; the Worker is
 * the one whose phone this is, and hers is Colombian. A ten-digit mobile
 * (`3…`) or a ten-digit landline in the national format (`60…`) is accepted,
 * with or without `57`/`+57` in front. Anything else is refused by value and the
 * surface says what shape it expected.
 *
 * Pure, and seam 1's.
 */

export type PhoneVerdict = { readonly ok: true; readonly e164: string } | { readonly ok: false };

const COUNTRY_CODE = "57";

export function normalizeColombianPhone(typed: string): PhoneVerdict {
  const digits = typed.replace(/\D/g, "");

  const national =
    digits.length === 12 && digits.startsWith(COUNTRY_CODE) ? digits.slice(2) : digits;

  if (national.length !== 10) return { ok: false };
  if (!national.startsWith("3") && !national.startsWith("60")) return { ok: false };

  return { ok: true, e164: `+${COUNTRY_CODE}${national}` };
}

/**
 * The stored form, as a person reads it: `300 123 4567`. Used wherever the
 * number is shown back to her — never as a link, per DD7's third clause.
 */
export function formatColombianPhone(e164: string): string {
  const national = e164.startsWith(`+${COUNTRY_CODE}`) ? e164.slice(3) : e164;
  if (national.length !== 10) return e164;
  return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}
