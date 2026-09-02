/**
 * The two things a running server cannot show about this view: that every
 * free-text field is rendered as content and never as a URL (DD7's third
 * clause — the `javascript:` sentinel), and that each variant says who sees
 * what.
 */

import { render, screen } from "@testing-library/react";
import type { OwnProfile } from "@repo/domain/profiles";
import { OWN_PROFILE_VARIANT_KEYS, OwnProfileView } from "./own-profile-view";
import { HELD_HEADING, PUBLISHED_CONFIRMATION, VISIBILITY_HELD, WALL_LINK } from "../_lib/messages";

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

describe.each(OWN_PROFILE_VARIANT_KEYS)("variant %s", (variant) => {
  it("renders every free-text field as text and never as a URL", () => {
    const { container } = render(
      <OwnProfileView profile={profile} justPublished={false} variant={variant} />,
    );

    // Tabs hide inactive panels from the tree, so the check is over the HTML
    // rather than over what is currently visible: the question is whether the
    // payload ever becomes an attribute, wherever it renders.
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
    render(<OwnProfileView profile={profile} justPublished={false} variant={variant} />);

    expect(screen.queryByRole("link", { name: /300 123 4567/ })).toBeNull();
  });

  it("renders the confirmation with the Wall linked when she has just published", () => {
    render(<OwnProfileView profile={profile} justPublished variant={variant} />);

    expect(screen.getByRole("status")).toHaveTextContent(PUBLISHED_CONFIRMATION);
    expect(screen.getByRole("link", { name: WALL_LINK })).toHaveAttribute("href", "/");
  });

  it("renders no confirmation otherwise", () => {
    render(<OwnProfileView profile={profile} justPublished={false} variant={variant} />);

    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the tiers variant", () => {
  it("heads the held section by who sees it", () => {
    render(<OwnProfileView profile={profile} justPublished={false} variant="A" />);

    expect(screen.getByRole("heading", { name: HELD_HEADING })).toBeInTheDocument();
  });
});

describe("the ledger variant", () => {
  it("marks the three held rows", () => {
    render(<OwnProfileView profile={profile} justPublished={false} variant="B" />);

    expect(screen.getAllByText(VISIBILITY_HELD)).toHaveLength(3);
  });
});
