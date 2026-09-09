/**
 * What `resolve.alias` in `vitest.config.mts` points the `server-only`
 * specifier at, so a module carrying the marker can be imported statically by a
 * test. It exists to satisfy resolution and holds nothing.
 *
 * The `undefined` export is here because the file needs one: an `export {}`
 * would say the same thing and `unicorn(require-module-specifiers)` refuses it.
 */
export const SERVER_ONLY_STUB = undefined;
