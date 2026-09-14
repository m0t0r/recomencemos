/**
 * PROTOTYPE — reads `?variant=` for the merged-mailbox lab on `/offers` and
 * falls back to the current production page when the parameter is absent.
 */

export interface MailboxVariant {
  readonly key: string;
  readonly name: string;
  /** One line: what this variant bets on. Shown in the lab strip. */
  readonly bet: string;
}

export function pickVariant(
  raw: string | string[] | undefined,
  variants: readonly MailboxVariant[],
): MailboxVariant | undefined {
  const key = Array.isArray(raw) ? raw[0] : raw;
  return variants.find((variant) => variant.key === key);
}
