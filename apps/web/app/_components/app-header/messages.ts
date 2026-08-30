/**
 * The one string the shell renders for itself, whichever group it is in.
 *
 * Under `docs/policy/voice.md`, and under ADR-0012: this is a **value**, and every
 * identifier around it stays English.
 */

/**
 * The product's name, which is a name and not copy.
 *
 * **It is here rather than in either shell's own messages module**, because for a
 * while it was in both — `site-header/messages.ts` and `admin-header/messages.ts`
 * each held a `PRODUCT_NAME = "Recomencemos"`, which is exactly the drift the site
 * shell's own comment warned about when it said the name lives in one place "so
 * the header and any later chrome cannot disagree about capitalisation". Two
 * copies of a constant is that disagreement waiting rather than prevented.
 *
 * What stays per-shell is the *label* — where the wordmark goes and what it
 * announces — because that genuinely differs. The name does not.
 */
export const PRODUCT_NAME = "Recomencemos";
