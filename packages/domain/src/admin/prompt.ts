/**
 * The enrolment command's one question, and the two ways it can stop having
 * anything to read.
 *
 * **It is a module rather than a function inside the command because the command
 * cannot be tested.** `enrol-cli.ts` runs `await main()` at the top level, so
 * importing it enrols an Admin; this is the part of it with behaviour worth
 * pinning, and it is pinned against a real `readline` interface rather than a
 * double, because what is under test is precisely what `readline` does when its
 * input ends.
 *
 * **One interface for the whole exchange, and that is a fix rather than a
 * preference.** The first version opened and closed a `readline` per prompt,
 * which works exactly once: closing it ends `process.stdin`, so the retry's
 * second prompt never resolved and the command died on an unsettled top-level
 * await. Observed by piping three codes at it, not predicted.
 *
 * **And input can end on its own**, which is what happens the moment this is
 * driven by a pipe rather than by a person — `printf '…' | pnpm admin:enrol …`
 * is a real way to run it, and `readline` closes when its input stream ends.
 * There are two moments it can end, and only one of them announces itself:
 *
 * - **Already ended before the prompt.** `question()` on a closed interface
 *   rejects with `ERR_USE_AFTER_CLOSE`; that is not an error worth a stack
 *   trace, it is "there is nobody there to ask", so it comes back as
 *   `undefined`.
 * - **Ended while the prompt is waiting.** Nothing rejects and nothing resolves —
 *   the promise simply never settles, and the command dies on an unsettled
 *   top-level await with no output at all. `printf '' | pnpm admin:enrol …` is
 *   the shortest way to see it, and it is what an empty pipe or a closed
 *   terminal does. The `close` event is the announcement `question()` does not
 *   make, so it aborts the question and the caller stops asking exactly as it
 *   does in the first case.
 *
 * The listener is removed on the way out rather than left to `once`, because
 * three attempts against one interface would otherwise leave two behind that
 * only ever fire together.
 *
 * **Echoed, unlike the password prompt this replaced, and the difference is the
 * point.** A TOTP code is good for thirty seconds and is worthless the moment it
 * is used, so hiding it buys nothing and costs the person the ability to see
 * that they typed it correctly — which on a six-digit code is the whole
 * interaction.
 */

import type { Interface } from "node:readline/promises";

/** The trimmed answer, or `undefined` where there is nobody left to ask. */
export function promptForCode(rl: Interface, prompt: string): Promise<string | undefined> {
  const ended = new AbortController();
  const abort = () => ended.abort();
  rl.once("close", abort);

  return rl
    .question(prompt, { signal: ended.signal })
    .then(
      (answer) => answer.trim(),
      () => undefined,
    )
    .finally(() => rl.off("close", abort));
}
