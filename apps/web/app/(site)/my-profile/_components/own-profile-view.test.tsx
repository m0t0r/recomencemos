/**
 * The two things a running server cannot show about this view: that every
 * free-text field is rendered as content and never as a URL (DD7's third
 * clause — the `javascript:` sentinel), and that it says who sees what.
 */

import { render, screen } from "@testing-library/react";
import type { OwnProfile } from "@repo/domain/profiles";
import { OwnProfileView } from "./own-profile-view";
import {
  EDIT_LINK,
  HELD_HEADING,
  PHOTO_ABSENT,
  PHOTO_PENDING,
  PUBLISHED_CONFIRMATION,
  SAVED_CONFIRMATION,
  WALL_LINK,
} from "../_lib/messages";

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
};

describe("the view", () => {
  it("renders every free-text field as text and never as a URL", () => {
    const { container } = render(
      <OwnProfileView profile={profile} justPublished={false} justSaved={false} />,
    );

    // Over the HTML rather than the tree: the question is whether the payload
    // ever becomes an attribute, wherever it renders.
    const html = container.innerHTML;
    expect(html).toContain("javascript:alert(1)");

    // The escape hatch case: a URL-valued attribute is not in the
    // accessibility tree, so its absence is asserted over the markup.
    for (const element of container.querySelectorAll("[href], [src], [action]")) {
      for (const attribute of ["href", "src", "action"]) {
        expect(element.getAttribute(attribute) ?? "").not.toContain(PAYLOAD);
      }
    }
  });

  it("shows the phone as a number to read, not as a link", () => {
    render(<OwnProfileView profile={profile} justPublished={false} justSaved={false} />);

    expect(screen.queryByRole("link", { name: /300 123 4567/ })).toBeNull();
  });

  it("renders the confirmation with the Wall linked when she has just published", () => {
    render(<OwnProfileView profile={profile} justPublished justSaved={false} />);

    expect(screen.getByRole("status")).toHaveTextContent(PUBLISHED_CONFIRMATION);
    expect(screen.getByRole("link", { name: WALL_LINK })).toHaveAttribute("href", "/");
  });

  it("renders the saved confirmation, and not publishing's, when she has just saved", () => {
    render(<OwnProfileView profile={profile} justPublished={false} justSaved />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(SAVED_CONFIRMATION);
    expect(status).not.toHaveTextContent(PUBLISHED_CONFIRMATION);
  });

  /**
   * The way into the edit form is a **link**, and asserting the role is the
   * assertion: a control that navigates must announce as one, which is the
   * finding `sign-in-link.tsx` records at length.
   */
  it("offers a link into the edit form", () => {
    render(<OwnProfileView profile={profile} justPublished={false} justSaved={false} />);

    expect(screen.getByRole("link", { name: EDIT_LINK })).toHaveAttribute(
      "href",
      "/my-profile/edit",
    );
  });

  it("renders no confirmation otherwise", () => {
    render(<OwnProfileView profile={profile} justPublished={false} justSaved={false} />);

    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the tiers", () => {
  it("heads the held section by who sees it", () => {
    render(<OwnProfileView profile={profile} justPublished={false} justSaved={false} />);

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
    render(<OwnProfileView profile={pending} justPublished={false} justSaved={false} />);

    expect(screen.getByText(PHOTO_PENDING)).toBeInTheDocument();
  });

  /**
   * **Not flagged.** An `alert` role, a `FieldError`, or anything announcing this
   * as a problem would be the surface telling her something is wrong with her
   * face. The state is a sentence, and a sentence is all it is.
   */
  it("does not announce the wait as a problem", () => {
    render(<OwnProfileView profile={pending} justPublished={false} justSaved={false} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  /** And the absent state says the other cause of the same shape. */
  it("names the initial as what stands in for a photo she has not added", () => {
    render(<OwnProfileView profile={profile} justPublished={false} justSaved={false} />);

    expect(screen.getByText(PHOTO_ABSENT)).toBeInTheDocument();
  });
});
