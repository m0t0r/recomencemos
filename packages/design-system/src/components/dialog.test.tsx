import { Button } from "@repo/design-system/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/dialog";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

// Like button.test.tsx this covers the seam rather than shadcn's code, and it is
// the reason the environment is happy-dom rather than the jsdom Next's docs
// prescribe: a portal plus a real user-event click is where a DOM environment
// actually breaks, and this product's surfaces reach Dialog, Popover and Select
// long before anything stresses Button. If happy-dom ever stops handling Base UI,
// this says so.

describe("Dialog", () => {
  it("opens into a portal", async () => {
    render(
      <Dialog>
        <DialogTrigger render={<Button>Open</Button>} />
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
  });
});
