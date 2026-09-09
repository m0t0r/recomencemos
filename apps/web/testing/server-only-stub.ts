/**
 * What `resolve.alias` in `vitest.config.mts` points the `server-only`
 * specifier at, so a test that loads a server module resolves it. It exists to
 * satisfy resolution and holds nothing.
 *
 * The `undefined` export is here because the file needs one: an `export {}`
 * would say the same thing and `unicorn(require-module-specifiers)` refuses it.
 */
export const SERVER_ONLY_STUB = undefined;
