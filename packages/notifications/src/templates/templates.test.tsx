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
import * as React from "react";
import { BaseEmail } from "#templates/base";
import { CONTACT_EXCHANGE_SUBJECTS, ContactExchangeEmail } from "#templates/contact-exchange";
import { MAGIC_LINK_SUBJECT, MagicLinkEmail, safeUrl } from "#templates/magic-link";
import { OFFER_DELIVERED_SUBJECT, OfferDeliveredEmail } from "#templates/offer-delivered";

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
  render(payload: { scripted: string; linked: string }): React.ReactElement;
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
  {
    /**
     * Her first name is the user-controlled field here — she typed it on her own
     * profile, and it reaches this template unaltered. The Offer's terms are
     * deliberately not in the mail at all, so the field with the widest exposure
     * is the one this row puts the scripted payload in.
     */
    name: "offer-delivered",
    render: ({ scripted, linked }) => <OfferDeliveredEmail firstName={scripted} url={linked} />,
  },
  /**
   * **All three of the counterpart's details are user-controlled** — each typed
   * by the other party — and they are the whole point of this mail, so the
   * scripted payload goes in every one of them, for each side.
   */
  ...(["worker", "hirer"] as const).map((side) => ({
    name: `contact-exchange (to the ${side})`,
    render: ({ scripted, linked }: { scripted: string; linked: string }) => (
      <ContactExchangeEmail
        recipientSide={side}
        counterpart={{ fullName: scripted, phone: scripted, email: scripted }}
        url={linked}
      />
    ),
  })),
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

describe.each(["worker", "hirer"] as const)("the Contact Exchange email, to the %s", (side) => {
  const counterpart = {
    fullName: "SENTINEL_FULL_NAME",
    phone: "+573105558899",
    email: "sentinel@recomencemos.test",
  };
  const props = {
    recipientSide: side,
    counterpart,
    url: "https://recomencemos.online/offers/0199a1f0-2b3c-7def-8000-0123456789ab",
  };

  /** The one thing this mail exists to carry — the other side's three details. */
  it("carries each of the other side's three details", async () => {
    const text = await render(<ContactExchangeEmail {...props} />, { plainText: true });

    for (const detail of Object.values(counterpart)) expect(text).toContain(detail);
  });

  /**
   * **The screen is the original and this is the copy** — the tone matrix's
   * Contact Exchange row, and the reason a failed send loses nothing.
   */
  it("says it is a copy of what the site already shows", async () => {
    const text = await render(<ContactExchangeEmail {...props} />, { plainText: true });

    expect(text).toContain("este correo es una copia");
  });

  /** The standing guidance and the no-money notice, in the standing notices' words. */
  it("says nobody here is verified and that no money passes through here", async () => {
    const text = await render(<ContactExchangeEmail {...props} />, { plainText: true });

    expect(text).toContain("Aquí no verificamos a nadie");
    expect(text).toContain("Por aquí no pasa el dinero");
  });

  /**
   * **A detail is text, never a link.** A `tel:` or `mailto:` built from what a
   * stranger typed is an `href` derived from user text, which DD14 refuses in
   * every template.
   */
  it("builds no link from a detail somebody typed", async () => {
    const html = await render(<ContactExchangeEmail {...props} />);

    expect(html).not.toContain("tel:");
    expect(html).not.toContain("mailto:");
  });

  it("opens with exactly one h1", async () => {
    const html = await render(<ContactExchangeEmail {...props} />);

    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("has a subject that carries no exclamation mark and names nobody", () => {
    expect(CONTACT_EXCHANGE_SUBJECTS[side]).not.toContain("!");
    expect(CONTACT_EXCHANGE_SUBJECTS[side]).not.toContain(counterpart.fullName);
  });

  it("uses no word from CONTEXT.md's Avoid lists", async () => {
    const text = (
      await render(<ContactExchangeEmail {...props} />, { plainText: true })
    ).toLowerCase();

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
      "oferta",
      "empleo",
      "match",
      "contrat",
    ]) {
      expect(text, `"${banned}" is on a CONTEXT.md Avoid list`).not.toContain(banned);
    }
  });
});

/** An Offer written before the platform asked senders to name themselves (C4). */
it("says so when the Hirer gave no name and no number, rather than leaving a blank", async () => {
  const text = await render(
    <ContactExchangeEmail
      recipientSide="worker"
      counterpart={{ fullName: null, phone: null, email: "sentinel@recomencemos.test" }}
      url="https://recomencemos.online/offers/0199a1f0-2b3c-7def-8000-0123456789ab"
    />,
    { plainText: true },
  );

  expect(text).toContain("No escribió su nombre.");
  expect(text).toContain("No dejó un teléfono.");
  expect(text).toContain("sentinel@recomencemos.test");
});

describe("the delivered-Offer email", () => {
  const props = {
    firstName: "Ana María",
    url: "https://recomencemos.online/offers/0199a1f0-2b3c-7def-8000-0123456789ab",
  };

  it("has a subject that carries no exclamation mark and names nobody", () => {
    expect(OFFER_DELIVERED_SUBJECT).toBe("Te llegó una propuesta de trabajo");
    expect(OFFER_DELIVERED_SUBJECT).not.toContain("!");
  });

  /**
   * **The whole reason this template is short.** The Offer's three fields are
   * `personal` and the mail is not where they are read — a mailbox may be a
   * shared phone, it sits in a provider's storage, and it reaches a vendor on the
   * way. The site is the durable channel; this says something arrived.
   */
  it("carries none of the Offer's terms", async () => {
    const terms = {
      workDescription: "SENTINEL_WORK_DESCRIPTION",
      payTerms: "SENTINEL_PAY_TERMS",
      whenText: "SENTINEL_WHEN_TEXT",
    };

    // The props cannot carry them at all, which is the strongest form of this:
    // the assertion below is over the rendered mail, and the type is what stops
    // a caller passing them in the first place.
    const html = await render(<OfferDeliveredEmail {...props} />);

    for (const sentinel of Object.values(terms)) expect(html).not.toContain(sentinel);
  });

  /**
   * His name is self-asserted and reaches her badged as declared rather than
   * verified. A notification bar has no room for that badge, so it does not go
   * there.
   */
  it("names nobody but her", async () => {
    const html = await render(<OfferDeliveredEmail {...props} />);

    expect(html).toContain("Ana María");
    expect(OFFER_DELIVERED_SUBJECT).not.toContain("Ana");
  });

  /**
   * The one sentence this email carries beyond the link, and the sentence the
   * platform's actual work is in. Do 1: present tense, actor visible.
   */
  it("says a person read it first", async () => {
    const text = await render(<OfferDeliveredEmail {...props} />, { plainText: true });

    expect(text).toContain("Una persona la leyó antes de que te llegara");
  });

  /** Doing nothing is a complete answer, and the mail says so (Do 3). */
  it("says she does not have to answer", async () => {
    const text = await render(<OfferDeliveredEmail {...props} />, { plainText: true });

    expect(text).toContain("no tienes que hacer nada");
  });

  it("uses no word from CONTEXT.md's Avoid lists", async () => {
    const text = (
      await render(<OfferDeliveredEmail {...props} />, { plainText: true })
    ).toLowerCase();

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
      "oferta",
      "empleo",
    ]) {
      expect(text, `"${banned}" is on a CONTEXT.md Avoid list`).not.toContain(banned);
    }
  });
});
