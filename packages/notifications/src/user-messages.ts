/**
 * The Spanish strings this package is allowed to put in front of a person.
 *
 * Same shape and same reason as `@repo/domain/src/user-messages.ts`:
 * `userMessage` is the only string permitted to reach a browser, and under
 * [ADR-0012](../../../docs/adr/0012-spanish-is-the-interface-english-is-the-code.md)
 * it is the one kind of string here that is Spanish. Collected in one module so
 * the same failure reads the same way wherever it is raised.
 */

/**
 * Every way a send can fail: a missing credential, a refused key, a rejected
 * address, a transport that answered with an error. They are one event to the
 * reader; the distinction is the operator's and `message` carries it.
 *
 * Written to `docs/policy/voice.md`: what happened, then what she can do next,
 * in the same breath (Do 3). No _en este momento_ — Don't 4 calls that
 * ambiguity. Active, actor named (Don't 5): *we* could not send it.
 */
export const SEND_FAILED = "No pudimos enviar el correo. Inténtalo de nuevo.";
