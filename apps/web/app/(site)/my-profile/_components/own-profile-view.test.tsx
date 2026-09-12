/**
 * The two things a running server cannot show about this view: that every
 * free-text field is rendered as content and never as a URL (DD7's third
 * clause — the `javascript:` sentinel), and that it says who sees what.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReceivedOffer } from "@repo/domain/offers";
import type { OwnProfile } from "@repo/domain/profiles";
import { urlAttributesIn } from "@/testing/markup";
import { OwnProfileView } from "./own-profile-view";
import {
  CLOSED_HEADING,
  closedLine,
  EDIT_LINK,
  HELD_HEADING,
  NONE_WAITING,
  OFFERS_LINK,
  PAUSE_LIMITS,
  PAUSE_SWITCH_LABEL,
  PAUSED_CONFIRMATION,
  pausedSince,
  PHOTO_ABSENT,
  PHOTO_PENDING,
  PUBLISHED_CONFIRMATION,
  RESUMED_CONFIRMATION,
  SAVED_CONFIRMATION,
  STILL_VISIBLE,
  VISIBLE_LINE,
  WALL_LINK,
  waitingCount,
} from "../_lib/messages";

/**
 * **Both action modules are doubled**, for `photo-field.test.tsx`'s reason: a
 * `"use server"` module is not stripped in a Vitest run, so importing the view
 * would pull `@repo/domain` into happy-dom, where it refuses — correctly. The
 * actions' behaviour verifies at seam 3 against the compiled endpoints.
 */
const { pauseProfile, resumeProfile, changePhoto, createPhotoUpload } = vi.hoisted(() => ({
  pauseProfile: vi.fn(),
  resumeProfile: vi.fn(),
  changePhoto: vi.fn(),
  createPhotoUpload: vi.fn(),
}));

vi.mock("../actions", () => ({ pauseProfile, resumeProfile, changePhoto }));
vi.mock("@/app/(site)/publish/actions", () => ({ createPhotoUpload }));

const PAYLOAD = "javascript:alert(1)";

const profile: OwnProfile = {
  slug: "k7m2p9q4w3x8y1z6",
  firstName: "Ana",
  lastInitial: "R",
  city: "pereira",
  headline: `Cocino almuerzos ${PAYLOAD}`,
  about: `Diez años ${PAYLOAD}`,
  workHistory: [`Panadería ${PAYLOAD}`],
  skills: [{ slug: "home-cooking", labelEs: "Cocinar almuerzos y comida casera" }],
  photoUrl: null,
  photoState: "absent",
  publishedAt: new Date("2026-09-02T12:00:00Z"),
  fullName: `Ana María Restrepo ${PAYLOAD}`,
  phone: "+573001234567",
  email: "ana@example.co",
  pausedAt: null,
  takenDown: false,
};

describe("the view", () => {
  it("renders every free-text field as text and never as a URL", () => {
    // Over the HTML React sends rather than the tree: the question is whether the
    // payload ever becomes an attribute, wherever it renders, and a URL-valued
    // attribute is not something the accessibility tree reports.
    const html = renderToStaticMarkup(
      <OwnProfileView profile={profile} offers={[]} arrival={null} />,
    );
    expect(html).toContain(PAYLOAD);

    const urls = urlAttributesIn(html);
    // Counted, so the loop cannot pass by finding no attribute at all.
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url).not.toContain(PAYLOAD);
  });

  it("shows the phone as a number to read, not as a link", () => {
    render(<OwnProfileView profile={profile} offers={[]} arrival={null} />);

    expect(screen.queryByRole("link", { name: /300 123 4567/ })).toBeNull();
  });

  /**
   * The confirmation is found by its sentence rather than as "the" status
   * region: her photo control carries a progress region of its own, so the page
   * has two, and only one of them is the arrival.
   */
  it("renders the confirmation with the Wall linked when she has just published", () => {
    render(<OwnProfileView profile={profile} offers={[]} arrival="published" />);

    expect(screen.getByText(PUBLISHED_CONFIRMATION)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: WALL_LINK })).toHaveAttribute("href", "/");
  });

  it("renders the saved confirmation, and not publishing's, when she has just saved", () => {
    render(<OwnProfileView profile={profile} offers={[]} arrival="saved" />);

    expect(screen.getByText(SAVED_CONFIRMATION)).toBeInTheDocument();
    expect(screen.queryByText(PUBLISHED_CONFIRMATION)).toBeNull();
  });

  // Each arrival with the row it leaves behind: a confirmation is only said
  // while the row agrees with it (see the two cases under "her Pause").
  it.each([
    ["paused", PAUSED_CONFIRMATION, new Date("2026-09-11T14:00:00Z")],
    ["resumed", RESUMED_CONFIRMATION, null],
  ] as const)("says so when she arrives having %s", (arrival, sentence, pausedAt) => {
    render(<OwnProfileView profile={{ ...profile, pausedAt }} offers={[]} arrival={arrival} />);

    expect(screen.getByText(sentence)).toBeInTheDocument();
  });

  /**
   * The way into the edit form is a **link**, and asserting the role is the
   * assertion: a control that navigates must announce as one, which is the
   * finding `sign-in-link.tsx` records at length.
   */
  it("offers a link into the edit form", () => {
    render(<OwnProfileView profile={profile} offers={[]} arrival={null} />);

    expect(screen.getByRole("link", { name: EDIT_LINK })).toHaveAttribute(
      "href",
      "/my-profile/edit",
    );
  });

  it("renders no confirmation otherwise", () => {
    render(<OwnProfileView profile={profile} offers={[]} arrival={null} />);

    for (const sentence of [
      PUBLISHED_CONFIRMATION,
      SAVED_CONFIRMATION,
      PAUSED_CONFIRMATION,
      RESUMED_CONFIRMATION,
    ]) {
      expect(screen.queryByText(sentence)).toBeNull();
    }
  });
});

describe("her Pause", () => {
  const PAUSED_AT = new Date("2026-09-11T14:00:00Z");

  it("says she is on the Wall, with the switch off", () => {
    render(<OwnProfileView profile={profile} offers={[]} arrival={null} />);

    expect(screen.getByText(VISIBLE_LINE)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: PAUSE_SWITCH_LABEL })).not.toBeChecked();
  });

  it("says since when she is paused, with the same switch on", () => {
    render(
      <OwnProfileView profile={{ ...profile, pausedAt: PAUSED_AT }} offers={[]} arrival={null} />,
    );

    expect(screen.getByText(pausedSince(PAUSED_AT))).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: PAUSE_SWITCH_LABEL })).toBeChecked();
  });

  /**
   * **A tap posts before the page has hydrated** (NFR4). The registry `Switch`
   * is a `<span>` by default and does nothing without JavaScript; what the
   * server sends here has to be a submit button inside the form, so a native
   * tap is the post. Read as the string React sends, because that is the
   * document an unhydrated browser acts on.
   */
  it("is a submit button in its form in the HTML the server sends", () => {
    const html = renderToStaticMarkup(
      <OwnProfileView profile={profile} offers={[]} arrival={null} />,
    );
    const switches = html.match(/<button[^>]*role="switch"[^>]*>/g) ?? [];

    expect(switches).toHaveLength(1);
    expect(switches[0]).toContain('type="submit"');
    expect(html.indexOf("<form")).toBeLessThan(html.indexOf('role="switch"'));
  });

  // The two limits she needs before relying on it are what the switch announces.
  it("names its two limits as the switch's description", () => {
    render(<OwnProfileView profile={profile} offers={[]} arrival={null} />);

    expect(screen.getByRole("switch", { name: PAUSE_SWITCH_LABEL })).toHaveAccessibleDescription(
      PAUSE_LIMITS,
    );
  });

  it("is not offered while the profile is taken down, and claims no state", () => {
    render(
      <OwnProfileView
        profile={{ ...profile, pausedAt: PAUSED_AT, takenDown: true }}
        offers={[]}
        arrival={null}
      />,
    );

    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText(VISIBLE_LINE)).toBeNull();
    expect(screen.queryByText(pausedSince(PAUSED_AT))).toBeNull();
  });

  /**
   * **A redirect is not proof the act happened.** A resume posted while taken
   * down writes nothing and still redirects; the confirmation is only said while
   * the row agrees with it, so she is never told she is back on the Wall when
   * she is not.
   */
  it("does not confirm a resume the row does not show", () => {
    render(
      <OwnProfileView profile={{ ...profile, takenDown: true }} offers={[]} arrival="resumed" />,
    );

    expect(screen.queryByText(RESUMED_CONFIRMATION)).toBeNull();
  });

  it("does not confirm a pause the row does not show", () => {
    render(<OwnProfileView profile={profile} offers={[]} arrival="paused" />);

    expect(screen.queryByText(PAUSED_CONFIRMATION)).toBeNull();
  });

  /**
   * **The ceiling's refusal, and the state it left her in.** The refusal's own
   * sentence carries the count and the wait; the switch adds which state the
   * profile is in now, because only it knows.
   */
  it("says the ceiling's refusal and which state she is in now", async () => {
    const refusal = "Usaste el botón de pausa 10 veces hoy, que es el máximo.";
    pauseProfile.mockResolvedValue({
      serverError: { code: "rate_limited", message: refusal, retryAfter: 720 },
    });

    render(<OwnProfileView profile={profile} offers={[]} arrival={null} />);
    fireEvent.click(screen.getByRole("switch", { name: PAUSE_SWITCH_LABEL }));

    expect(await screen.findByText(refusal)).toBeInTheDocument();
    expect(screen.getByText(STILL_VISIBLE)).toBeInTheDocument();
  });
});

/** One Offer that reached her, in `state`, from somebody who gave `hirerName`. */
function offer(id: string, state: ReceivedOffer["state"], hirerName: string | null) {
  return {
    id,
    state,
    workDescription: `Cocinar para ocho personas ${id}`,
    payTerms: "$120.000 por el día",
    whenText: "El sábado",
    sentAt: new Date("2026-09-10T12:00:00Z"),
    hirerName,
  } satisfies ReceivedOffer;
}

describe("the Offers that reached her", () => {
  it("counts the ones waiting and links the list where she answers them", () => {
    render(
      <OwnProfileView
        profile={profile}
        offers={[offer("a", "delivered", "Carlos Restrepo"), offer("b", "delivered", null)]}
        arrival={null}
      />,
    );

    expect(screen.getByText(waitingCount(2))).toBeInTheDocument();
    expect(screen.getByText("Carlos Restrepo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: OFFERS_LINK })).toHaveAttribute("href", "/offers");
  });

  it("says plainly when none is waiting", () => {
    render(<OwnProfileView profile={profile} offers={[]} arrival={null} />);

    expect(screen.getByText(NONE_WAITING)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: CLOSED_HEADING })).toBeNull();
  });

  it("lists what closed, under its own heading", () => {
    render(
      <OwnProfileView
        profile={profile}
        offers={[offer("c", "accepted", "Carlos Restrepo")]}
        arrival={null}
      />,
    );

    expect(screen.getByRole("heading", { name: CLOSED_HEADING })).toBeInTheDocument();
    expect(screen.getByText(closedLine("Carlos Restrepo", "Aceptada"))).toBeInTheDocument();
  });
});

describe("the tiers", () => {
  it("heads the held section by who sees it", () => {
    render(<OwnProfileView profile={profile} offers={[]} arrival={null} />);

    expect(screen.getByRole("heading", { name: HELD_HEADING })).toBeInTheDocument();
  });
});

/**
 * **Her own photo: described, never flagged.**
 *
 * The criterion is the dignity one -- "her own photo, described as under review,
 * not flagged" -- and the defect found running was its accessibility half:
 * `alt=""` took the image out of the tree entirely, so a screen-reader user got
 * no photo and no state on the one surface whose whole argument is that she sees
 * her own face. The fixture at the top of this file pins `photoState: "absent"`,
 * so nothing here could have caught it.
 *
 * **What this environment can and cannot answer, stated rather than worked
 * around.** `ProfileCard` renders Base UI's `AvatarImage`, which puts no `<img>`
 * in the DOM until the image *loads* -- and nothing loads under happy-dom. So a
 * `getByRole("img", { name: OWN_PHOTO_ALT })` here asserts the environment
 * rather than the component, and the accessible-name half genuinely verifies at
 * seam 3 against a running browser. That is the split `CLAUDE.md` draws, and it
 * was arrived at by writing the role query first and watching it fail for the
 * wrong reason.
 *
 * What is assertable here is the other half of the criterion, and it is the half
 * the copy lives in: the sentence is present, and it is not an alert.
 */
describe("her own photo", () => {
  const pending: OwnProfile = {
    ...profile,
    photoUrl: "https://photos.recomencemos.test/photos/aaaaaaaaaaaaaaaaaaaaa.webp",
    photoState: "pending",
  };

  it("says a person is looking at it", () => {
    render(<OwnProfileView profile={pending} offers={[]} arrival={null} />);

    expect(screen.getByText(PHOTO_PENDING)).toBeInTheDocument();
  });

  /**
   * **Not flagged.** An `alert` role, a `FieldError`, or anything announcing this
   * as a problem would be the surface telling her something is wrong with her
   * face. The state is a sentence, and a sentence is all it is.
   */
  it("does not announce the wait as a problem", () => {
    render(<OwnProfileView profile={pending} offers={[]} arrival={null} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  /** An approved photo is on her card; a sentence saying she has none would be false. */
  it("says nothing about a photo that is approved", () => {
    render(
      <OwnProfileView
        profile={{
          ...profile,
          photoUrl: "https://photos.recomencemos.test/photos/aaaaaaaaaaaaaaaaaaaaa.webp",
          photoState: "approved",
        }}
        offers={[]}
        arrival={null}
      />,
    );

    expect(screen.queryByText(PHOTO_ABSENT)).toBeNull();
  });

  /** And the absent state says the other cause of the same shape. */
  it("names the initial as what stands in for a photo she has not added", () => {
    render(<OwnProfileView profile={profile} offers={[]} arrival={null} />);

    expect(screen.getByText(PHOTO_ABSENT)).toBeInTheDocument();
  });
});
