import { Button } from "@repo/design-system/components/button";
import { render, screen } from "@testing-library/react";

// `button.tsx` is registry output, so this is not here to test shadcn's code. It
// is the rendering seam's own test: it proves jsdom, the React plugin, Testing
// Library, and the `@repo/design-system/*` path alias all still line up. When a
// Base UI or Tailwind upgrade breaks that wiring, this is what says so.
describe("Button", () => {
  it("renders its children into a real button element", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("applies the variant's classes", () => {
    render(<Button variant="outline">Cancel</Button>);

    expect(screen.getByRole("button", { name: "Cancel" }).className).toContain("border-border");
  });
});
