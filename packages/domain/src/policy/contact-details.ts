/**
 * The contact-detail rejector (DD3, NFR12), and what it honestly is.
 *
 * ADR-0008 requires free-text fields to refuse phone numbers and email addresses
 * _"so the consent step cannot be routed around"_: her phone crosses only at
 * Contact Exchange, and a headline that carries it crosses it on the Wall. The
 * forms DD3 names are the ones this catches — `+57 300 123 4567`, `3001234567`,
 * `300-123-4567`, `300 123 45 67`, an `@` address in any spacing, and the
 * messaging URLs the security lens added, because `wa.me/57…` is a phone number
 * wearing a different hat and is simultaneously the phishing vector against the
 * Hirer.
 *
 * **It is a speed bump, not a control.** It will not catch a number spelled in
 * words, a number split across two sentences, or a handle a person recognises
 * and a regex does not. NFR12's second half is that admission: human review of
 * every Offer is the control, and no copy on either side claims otherwise.
 *
 * **The negatives matter as much as the positives.** A rule that rejects
 * _"llámame el 15 a las 3"_, a price, a date or a street address has broken the
 * publishing form for everyone, so the phone pattern demands ten to fifteen
 * digits in one run and `contact-details.test.ts` holds a fixture of ordinary
 * Spanish that must pass.
 *
 * **It names the fragment**, which is NFR12's first half and `docs/policy/voice.md`
 * Do 4 — _"quote the product's own evidence back"_. The fragment returned is
 * exactly what matched, trimmed, so the sentence she reads can carry it in
 * guillemets and she can find it in her own text.
 */

export type ContactDetailKind = "phone" | "email" | "messaging_url";

export type ContactDetailVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly kind: ContactDetailKind; readonly fragment: string };

/**
 * A run of digits with the separators people actually type between them —
 * spaces, hyphens, dots, parentheses — optionally led by `+`. The run is then
 * counted: a Colombian number is ten digits, an international one up to
 * fifteen, and anything shorter is a date, a price or a house number.
 */
const DIGIT_RUN = /\+?\(?\d(?:[\s().-]*\d)+\)?/g;

const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

/**
 * Deliberately shallow, like `/sign-in`'s own address rule: something, an `@`,
 * something, a dot, something. A stricter grammar would let `ana@correo` past
 * and a looser one would refuse `@` used as a preposition in nothing this
 * product's audience writes.
 */
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/**
 * Messaging and link-shortener hosts, with whatever follows them. A shortener is
 * here because it is the way a phone number or an off-platform address hides
 * inside a sentence, and the Hirer reading the profile cannot see where it goes.
 */
const MESSAGING_URL =
  /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.me|m\.me|bit\.ly|tinyurl\.com|t\.co|cutt\.ly|is\.gd|rb\.gy|shorturl\.at|goo\.gl|tiny\.one)(?:\/\S*)?/i;

function digitCount(value: string): number {
  return value.replace(/\D/g, "").length;
}

export function rejectContactDetails(text: string): ContactDetailVerdict {
  const url = MESSAGING_URL.exec(text);
  if (url) return { ok: false, kind: "messaging_url", fragment: url[0].trim() };

  const email = EMAIL.exec(text);
  if (email) return { ok: false, kind: "email", fragment: email[0].trim() };

  for (const run of text.matchAll(DIGIT_RUN)) {
    const digits = digitCount(run[0]);
    if (digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS) {
      return { ok: false, kind: "phone", fragment: run[0].trim() };
    }
  }

  return { ok: true };
}
