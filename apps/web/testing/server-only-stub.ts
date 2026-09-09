/**
 * What `resolve.alias` in `vitest.config.mts` points the `server-only`
 * specifier at, so a test that loads a server module resolves it. It exists to
 * satisfy resolution and holds nothing.
 *
 * **A second copy of `packages/domain/src/testing/server-only-stub.ts`, because
 * sharing one would mean widening `@repo/domain`'s `exports` map** — which is
 * the boundary ADR-0010 makes a resolution error rather than a review comment.
 * Nine lines is the cheaper of the two, on ADR-0013's own precedent for
 * duplicating the server-only backstop rather than sharing it.
 *
 * The `undefined` export is here because the file needs one: an `export {}`
 * would say the same thing and `unicorn(require-module-specifiers)` refuses it.
 */
export const SERVER_ONLY_STUB = undefined;
