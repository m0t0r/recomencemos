import { cn } from "@repo/design-system/lib/utils";

describe("cn", () => {
  it("keeps the later of two conflicting Tailwind utilities", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("keeps utilities that do not conflict", () => {
    expect(cn("p-2", "text-sm")).toBe("p-2 text-sm");
  });

  it("drops falsy branches", () => {
    expect(cn("p-2", false, undefined, "text-sm")).toBe("p-2 text-sm");
  });
});
