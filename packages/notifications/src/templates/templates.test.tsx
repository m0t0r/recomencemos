/**
 * Every template, rendered without sending.
 *
 * DD14: `render()` a template in Node and assert on the string. This is seam 1
 * work, and it is where "no `dangerouslySetInnerHTML`, no `<Markdown>` over
 * user-supplied text, and no `href` built from user text" stops being a rule
 * somebody remembers and becomes a rule that goes red.
 *
 * The table is what makes it a rule rather than three assertions about one
 * template: a template added here without a row is a template no invariant
 * covers, and the row is one line.
 */

import { render } from "@react-email/components";
import { AppError } from "@repo/errors/app-error";
import type { ReactElement } from "react";
import { BaseEmail } from "#templates/base";
import { MAGIC_LINK_SUBJECT, MagicLinkEmail, safeUrl } from "#templates/magic-link";

/**
 * The field a person other than the recipient controls, per template.
 *
 * `scripted` goes in that field; `linked` goes in every URL-valued prop. A
 * template with no user-controlled field still declares one so the escaping
 * assertions run — they cost nothing and they are what catches the day a field
 * becomes user-controlled.
 */
const templates: ReadonlyArray<{
  readonly name: string;
  render(payload: { scripted: string; linked: string }): ReactElement;
}> = [
  {
    name: "base",
    render: ({ scripted }) => (
      <BaseEmail title="Vista previa" preview="Vista previa">
        <p>{scripted}</p>
      </BaseEmail>
    ),
  },
  {
    name: "magic-link",
    render: ({ linked }) => <MagicLinkEmail url={linked} expiresInMinutes={15} />,
  },
];

const SAFE_URL = "https://recomencemos.online/api/auth/magic-link/verify?token=abc";
const SCRIPTED = '<script>alert("xss")</script>';

function benign() {
  return { scripted: "Ana Restrepo", linked: SAFE_URL };
}

describe.each(templates)("$name", (template) => {
  it('sets lang="es" — React Email defaults to English', async () => {
    const html = await render(template.render(benign()));

    expect(html).toContain('lang="es"');
    expect(html).not.toContain('lang="en"');
  });

  // React Email's guidance says `<Preview>` emits one. At the version this
  // repo resolves it does not, which is why the frame emits it — and why this
  // asserts on the output rather than trusting the docs.
  it("emits a <title>", async () => {
    const html = await render(template.render(benign()));

    expect(html).toMatch(/<title>.+<\/title>/);
  });

  it("renders a plain-text alternative", async () => {
    const text = await render(template.render(benign()), { plainText: true });

    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).not.toContain("<");
  });

  // Gmail clips a body over 102 KB. On the Contact Exchange email that would
  // clip the contact details, which is the one thing that email exists to carry.
  it("stays under Gmail's 102 KB clip", async () => {
    const html = await render(template.render(benign()));

    expect(Buffer.byteLength(html, "utf8")).toBeLessThan(102 * 1024);
  });

  // C26's residual rule, made mechanical. Escaping is React's by construction —
  // right up until somebody reaches for `dangerouslySetInnerHTML` to make a line
  // break work.
  it("escapes a scripted payload rather than emitting it", async () => {
    const html = await render(template.render({ scripted: SCRIPTED, linked: SAFE_URL }));

    expect(html).not.toContain("<script>");
    expect(html).not.toContain('alert("xss")');
  });

  // C48, and it is not a restatement of the one above: escaping constrains
  // element content and leaves an attribute alone, so a URL-valued attribute is
  // the one injection this seam still admits.
  it("builds no href from a javascript: payload", async () => {
    const payload = { scripted: "Ana", linked: "javascript:alert(1)" };
    let html = "";

    try {
      html = await render(template.render(payload));
    } catch (error) {
      // Refusing to render is the stronger outcome, and it is what `safeUrl`
      // does. A template with no URL prop renders and must simply carry no such
      // href.
      expect(error).toBeInstanceOf(AppError);
      return;
    }

    expect(html).not.toContain("javascript:");
  });
});

describe("the rules that are absences", () => {
  // Asserted over the source rather than the output, because that is where the
  // rule lives: a `dangerouslySetInnerHTML` whose value happens to be benign
  // today still leaves the seam open tomorrow.
  it("uses neither dangerouslySetInnerHTML nor <Markdown> in any template", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const directory = new URL(".", import.meta.url);
    const files = (await readdir(directory)).filter(
      (file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"),
    );

    expect(files.length).toBeGreaterThan(0);

    const sources = await Promise.all(
      files.map(async (file) => [file, await readFile(new URL(file, directory), "utf8")] as const),
    );

    for (const [file, source] of sources) {
      expect(source, `${file} must not set HTML directly`).not.toContain("dangerouslySetInnerHTML");
      expect(source, `${file} must not render Markdown over supplied text`).not.toContain(
        "<Markdown",
      );
    }
  });
});

describe("safeUrl", () => {
  it("passes an https URL through", () => {
    expect(safeUrl(SAFE_URL, "url")).toBe(SAFE_URL);
  });

  it("passes an http URL through, so a local dev origin still renders", () => {
    expect(safeUrl("http://localhost:3000/verify", "url")).toBe("http://localhost:3000/verify");
  });

  // A whitelist rather than a `javascript:` blocklist: a blocklist means the
  // next scheme somebody invents passes by default.
  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox"])(
    "refuses %s",
    (url) => {
      expect(() => safeUrl(url, "url")).toThrow(AppError);
    },
  );

  it("refuses a string that is not a URL at all", () => {
    expect(() => safeUrl("/verify?token=abc", "url")).toThrow(AppError);
  });

  it("names the field but not the value, so a token never reaches the error", () => {
    const error = (() => {
      try {
        safeUrl("javascript:steal('secret-token')", "url");
      } catch (caught) {
        return caught as AppError;
      }
      return undefined;
    })();

    expect(error?.context).toMatchObject({ field: "url", protocol: "javascript:" });
    expect(JSON.stringify(error?.context)).not.toContain("secret-token");
  });
});

describe("the magic-link email", () => {
  const props = { url: SAFE_URL, expiresInMinutes: 15 };

  it("opens with exactly one h1", async () => {
    const html = await render(<MagicLinkEmail {...props} />);

    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("carries the link as a button and as readable text, both pointing at it", async () => {
    const html = await render(<MagicLinkEmail {...props} />);

    expect(html).toContain(SAFE_URL.replace(/&/g, "&amp;"));
    // Link text names its destination: `docs/policy/voice.md` bans `haz clic
    // aquí`, `aquí` and `más información` outright.
    expect(html).toContain("Entrar a Recomencemos");
    expect(html).not.toContain("haz clic aquí");
  });

  it("says the number it was given rather than one baked into the template", async () => {
    const html = await render(<MagicLinkEmail {...props} expiresInMinutes={7} />);

    expect(html).toContain("7 minutos");
  });

  /**
   * **The amendment, asserted at the surface a reader actually sees.**
   *
   * This case used to assert the opposite — that the frame names a reply-to,
   * because an address a reader cannot see is not an invitation. The sending
   * subdomain is send-only in Resend, so the invitation was a promise nobody
   * could keep, and it was removed rather than reworded.
   *
   * It goes red on the *word*, not on an address, because that is the failure
   * worth catching: someone reintroducing the invitation with a new mailbox in
   * mind, before that mailbox exists. The `mailto:` half is the same rule
   * enforced against a link rather than a sentence.
   */
  it("invites no reply, because there is no mailbox behind the sending domain", async () => {
    const html = await render(<MagicLinkEmail {...props} />);

    expect(html).not.toContain("responder");
    expect(html).not.toContain("mailto:");
  });

  // The Email row of the tone matrix: the subject says what happened. No urgency
  // verb, and `docs/policy/voice.md` bans an exclamation mark in a subject
  // outright.
  it("has a subject that carries no exclamation mark", () => {
    expect(MAGIC_LINK_SUBJECT).toBe("Tu enlace para entrar a Recomencemos");
    expect(MAGIC_LINK_SUBJECT).not.toContain("!");
  });

  it("uses no word from CONTEXT.md's Avoid lists", async () => {
    const text = (await render(<MagicLinkEmail {...props} />, { plainText: true })).toLowerCase();

    for (const banned of [
      "damnificad",
      "víctima",
      "afectad",
      "beneficiari",
      "necesitad",
      "usuario",
      "candidat",
      "hoja de vida",
      "vacante",
      "donación",
    ]) {
      expect(text, `"${banned}" is on a CONTEXT.md Avoid list`).not.toContain(banned);
    }
  });
});
