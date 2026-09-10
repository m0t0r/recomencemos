/**
 * PROTOTYPE — reads `?variant=` for a lab page and falls back to the first key.
 */

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface LabVariant {
  readonly key: string;
  readonly name: string;
  /** One line: what this variant bets on. Shown in the lab frame. */
  readonly bet: string;
}

export async function readVariant(
  searchParams: SearchParams,
  variants: readonly LabVariant[],
): Promise<LabVariant> {
  const params = await searchParams;
  const raw = params.variant;
  const key = Array.isArray(raw) ? raw[0] : raw;
  return variants.find((variant) => variant.key === key) ?? (variants[0] as LabVariant);
}
