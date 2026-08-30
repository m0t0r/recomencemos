/**
 * The site shell's signed-out half.
 *
 * **It is the site shell's and not the session menu's**, which is why it has a
 * file of its own since #17: `(admin)` renders no sign-in link at all — a person
 * on `/admin/sign-in` is already looking at the door, and a link to the *public*
 * door would be the wrong one. The menu below the signed-in branch is shared; this
 * is not, and the split of the tests follows the split of the components.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";

/**
 * `vi.hoisted` so the imports below stay static: `vi.mock` is lifted above every
 * `const` in the file, and a factory closing over a plain `const pathname =
 * vi.fn()` would read it in its temporal dead zone the moment the mocked module
 * is imported.
 */
const { pathname } = vi.hoisted(() => ({ pathname: vi.fn(() => "/") }));

vi.mock("next/navigation", () => ({ usePathname: pathname }));

import { SignInLink } from "./sign-in-link";
import { SIGN_IN } from "./messages";

beforeEach(() => {
  pathname.mockReturnValue("/");
});

describe("the signed-out link", () => {
  it("offers Entrar, pointing at the sign-in surface", () => {
    render(<SignInLink />);

    expect(screen.getByRole("link", { name: SIGN_IN })).toHaveAttribute("href", "/sign-in");
  });

  /**
   * A link to the page you are on is worse than no link, and `/sign-in` is the
   * one route where the destination and the origin are the same.
   */
  it("says nothing on /sign-in itself", () => {
    pathname.mockReturnValue("/sign-in");
    render(<SignInLink />);

    expect(screen.queryByRole("link", { name: SIGN_IN })).toBeNull();
  });
});

/**
 * **ADR-0015, asserted over this shell's own source.**
 *
 * The session menu's suite makes the same assertion over the shared components;
 * this covers what stayed behind. Reading the files beats any runtime check here:
 * the failure it catches is an `import`, and an import that is never executed
 * still ships the client bundle it pulls in.
 */
describe("no auth client reaches the browser", () => {
  it("imports nothing from better-auth anywhere in the site shell", () => {
    const directory = import.meta.dirname;

    const sources = readdirSync(directory)
      .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
      .map((name) => ({ name, text: readFileSync(join(directory, name), "utf8") }));

    // The suite is worthless if it read nothing, so the count is asserted too.
    expect(sources.length).toBeGreaterThanOrEqual(2);

    for (const { name, text } of sources) {
      expect(text, `${name} imports better-auth`).not.toMatch(/from\s+["']better-auth/);
    }
  });
});
