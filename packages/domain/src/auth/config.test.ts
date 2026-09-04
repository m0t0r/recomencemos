/**
 * Seam 1: the origin this app is configured at, which is a pure read of the
 * environment and needs no database.
 *
 * It is one function rather than three reads because `baseURL`, `trustedOrigins`
 * and the base the Admin link is built against must be the same origin, and it
 * has a test of its own because a named local proxy now supplies that origin in
 * development — see ADR-0018.
 */

import { AppError } from "@repo/errors/app-error";
import { authBaseUrl, BASE_URL_VARIABLE, PROXY_URL_VARIABLE } from "#auth/config";

const CONFIGURED = "http://localhost:3000";
const PROXIED = "https://ticket-124-add-widget.web.recomencemos.localhost";

describe("authBaseUrl", () => {
  it("reads the configured variable when no proxy is in front of this process", () => {
    expect(authBaseUrl({ [BASE_URL_VARIABLE]: CONFIGURED })).toBe(CONFIGURED);
  });

  it("prefers the proxy's origin outside production, because that is the origin the browser reaches", () => {
    expect(authBaseUrl({ [BASE_URL_VARIABLE]: CONFIGURED, [PROXY_URL_VARIABLE]: PROXIED })).toBe(
      PROXIED,
    );
  });

  it("ignores the proxy in production, so nothing in a deployed environment can move the origin", () => {
    expect(
      authBaseUrl({
        [BASE_URL_VARIABLE]: CONFIGURED,
        [PROXY_URL_VARIABLE]: PROXIED,
        NODE_ENV: "production",
      }),
    ).toBe(CONFIGURED);
  });

  it("ignores an empty proxy value rather than configuring an empty origin", () => {
    expect(authBaseUrl({ [BASE_URL_VARIABLE]: CONFIGURED, [PROXY_URL_VARIABLE]: "  " })).toBe(
      CONFIGURED,
    );
  });

  it("still refuses when neither is set, so a missing origin fails loudly", () => {
    expect(() => authBaseUrl({})).toThrow(AppError);
  });

  it("does not let the proxy stand in for a missing configured origin in production", () => {
    expect(() => authBaseUrl({ [PROXY_URL_VARIABLE]: PROXIED, NODE_ENV: "production" })).toThrow(
      AppError,
    );
  });
});
