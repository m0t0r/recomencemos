/**
 * The closed sets a Contact Exchange carries, as registries the `CHECK`
 * constraints are generated from (DD2) — beside the Offer's, where every other
 * closed set in this package lives.
 */

/** The two parties to an exchange, named by the role each played in the Offer. */
export type ExchangeSide = "worker" | "hirer";

/**
 * Where one side's copy by email is.
 *
 * **`pending` is written by the transaction and is the enqueue.** The exchange
 * commits first and nothing is sent inside it, so every copy starts here and
 * moves once the send has answered. A row still `pending` long after its
 * `created_at` is a send that never answered — a process that died between the
 * commit and the transport — and it is findable, rather than a copy nobody
 * knows is missing.
 *
 * **`failed` covers a transport fault and a refused send alike.** The kill
 * switch refusing a send is not an incident, and the log line tells the
 * operator which of the two happened; to the person reading the page they are
 * the same fact — no copy is on its way, and the details are on the screen in
 * front of her.
 */
export const COPY_STATES = ["pending", "sent", "failed"] as const;
export type CopyState = (typeof COPY_STATES)[number];

export const INITIAL_COPY_STATE = "pending" satisfies CopyState;

/** Narrow the column's `TEXT` to the registry, or `undefined`. */
export function asCopyState(value: string): CopyState | undefined {
  return (COPY_STATES as readonly string[]).includes(value) ? (value as CopyState) : undefined;
}
