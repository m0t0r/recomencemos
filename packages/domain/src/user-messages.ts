/**
 * The Spanish strings this package is allowed to put in front of a person.
 *
 * `userMessage` is the only string permitted to reach a browser, and under
 * [ADR-0012](../../../docs/adr/0012-spanish-is-the-interface-english-is-the-code.md)
 * it is the one kind of string here that is Spanish — every identifier around it
 * stays English. Collected in one module rather than written at each throw site
 * so that the same failure reads the same way wherever it is raised, which is
 * the whole reason a person can be told anything useful by a system with several
 * ways of breaking.
 */

/**
 * Everything that means "the database did not answer": a missing connection
 * string, a refused connection, a round trip that failed. They are one event to
 * the reader and the distinction between them is the operator's, which is what
 * `message` carries.
 */
export const SERVICE_UNAVAILABLE =
  "El servicio no está disponible en este momento. Intenta de nuevo en un momento.";
