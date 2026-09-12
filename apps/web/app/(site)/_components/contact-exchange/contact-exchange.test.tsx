/**
 * The Contact Exchange as each party reads it, through the accessibility tree:
 * whose details these are, the three of them as text, the reader's own copy
 * line, and nothing a person could mistake for a way to call or write from here.
 */

import type { ContactExchange, CopyState } from "@repo/domain/exchange";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ContactExchangePanel } from "./contact-exchange";
import { COPIED_FOR_MS } from "./copy-detail";
import { COPY_LINES, EXCHANGE_HEADING, NO_NAME, NO_PHONE } from "./messages";

/** A clipboard the test controls: happy-dom's does not reach the system one. */
function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

const CARLOS = {
  fullName: "Carlos Restrepo",
  phone: "+573105558899",
  email: "carlos.sentinel@recomencemos.test",
};

const ANA = {
  fullName: "Ana María Restrepo Gómez",
  phone: "+573001234567",
  email: "ana.sentinel@recomencemos.test",
};

function exchange(overrides: Partial<ContactExchange> = {}): ContactExchange {
  return {
    offerId: "0192a3b4-0000-7000-8000-000000000003",
    exchangedAt: new Date("2026-09-12T15:00:00Z"),
    side: "worker",
    counterpart: CARLOS,
    own: ANA,
    copy: "sent",
    ...overrides,
  };
}

describe("right after she accepts", () => {
  /** The ticket's keyboard criterion: focus moves to the exchange's heading. */
  it("moves focus to the exchange's heading", () => {
    render(<ContactExchangePanel exchange={exchange()} justAccepted />);

    expect(screen.getByRole("heading", { level: 3, name: EXCHANGE_HEADING.worker })).toHaveFocus();
  });

  /** And the details are announced through a polite live region. */
  it("puts the three details inside a status region once hydrated", () => {
    render(<ContactExchangePanel exchange={exchange()} justAccepted />);

    const status = screen.getByRole("status");
    expect(within(status).getByText(CARLOS.fullName)).toBeInTheDocument();
    expect(within(status).getByText("310 555 8899")).toBeInTheDocument();
    expect(within(status).getByText(CARLOS.email)).toBeInTheDocument();
  });

  it("shows the details once, not once inside the region and once beside it", () => {
    render(<ContactExchangePanel exchange={exchange()} justAccepted />);

    expect(screen.getAllByText(CARLOS.email)).toHaveLength(1);
  });
});

describe("on a later visit", () => {
  it("takes no focus and holds no live region", () => {
    render(<ContactExchangePanel exchange={exchange()} />);

    expect(
      screen.getByRole("heading", { level: 3, name: EXCHANGE_HEADING.worker }),
    ).not.toHaveFocus();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("read by her", () => {
  it("is a region named for whose details these are", () => {
    render(<ContactExchangePanel exchange={exchange()} />);

    expect(screen.getByRole("region", { name: EXCHANGE_HEADING.worker })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: EXCHANGE_HEADING.worker }),
    ).toBeInTheDocument();
  });

  it("shows his name, number and address as text, and links none of them", () => {
    render(<ContactExchangePanel exchange={exchange()} />);

    expect(screen.getByText(CARLOS.fullName)).toBeInTheDocument();
    expect(screen.getByText("310 555 8899")).toBeInTheDocument();
    expect(screen.getByText(CARLOS.email)).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  /** An Offer written before the platform asked senders to name themselves (C4). */
  it("says so when he gave no name and no number, rather than leaving a blank", () => {
    render(
      <ContactExchangePanel
        exchange={exchange({ counterpart: { fullName: null, phone: null, email: CARLOS.email } })}
      />,
    );

    expect(screen.getByText(NO_NAME)).toBeInTheDocument();
    expect(screen.getByText(NO_PHONE)).toBeInTheDocument();
  });

  it("says what she gave, so she knows what he now holds", () => {
    render(<ContactExchangePanel exchange={exchange()} />);

    expect(
      screen.getByText(
        `Quien te envió la propuesta recibió los tuyos: ${ANA.fullName}, 300 123 4567 y ${ANA.email}.`,
      ),
    ).toBeInTheDocument();
  });
});

describe("each detail's Copiar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the detail it copies", () => {
    render(<ContactExchangePanel exchange={exchange()} />);

    for (const name of ["Copiar nombre", "Copiar teléfono", "Copiar correo"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  /** Nothing to copy where he gave nothing. */
  it("offers none for a detail he did not give", () => {
    render(
      <ContactExchangePanel
        exchange={exchange({ counterpart: { fullName: null, phone: null, email: CARLOS.email } })}
      />,
    );

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Copiar correo",
    ]);
  });

  /** He may be abroad: the number reaches a dialler with its country code. */
  it("copies the phone with its country code, though it shows it without", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    render(<ContactExchangePanel exchange={exchange()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar teléfono" }));
    });

    expect(writeText).toHaveBeenCalledWith(CARLOS.phone);
  });

  /** _Copiado_ is a moment: it says the tap worked, then goes back. */
  it("says it copied, then reads Copiar again", async () => {
    vi.useFakeTimers();
    stubClipboard(async () => {});
    render(<ContactExchangePanel exchange={exchange()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar correo" }));
    });
    expect(screen.getByRole("button", { name: "Correo copiado" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(COPIED_FOR_MS);
    });
    expect(screen.getByRole("button", { name: "Copiar correo" })).toBeInTheDocument();
  });

  it("restarts the moment on a second tap", async () => {
    vi.useFakeTimers();
    stubClipboard(async () => {});
    render(<ContactExchangePanel exchange={exchange()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar correo" }));
    });
    act(() => {
      vi.advanceTimersByTime(COPIED_FOR_MS - 100);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Correo copiado" }));
    });
    act(() => {
      vi.advanceTimersByTime(COPIED_FOR_MS - 100);
    });

    expect(screen.getByRole("button", { name: "Correo copiado" })).toBeInTheDocument();
  });

  /** A refused clipboard changes nothing: the text is still there to select. */
  it("stays on Copiar when the browser refuses the clipboard", async () => {
    stubClipboard(async () => {
      throw new Error("refused");
    });
    render(<ContactExchangePanel exchange={exchange()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar correo" }));
    });

    expect(screen.getByRole("button", { name: "Copiar correo" })).toBeInTheDocument();
  });
});

describe("read by him", () => {
  it("is named for her details, and shows her three", () => {
    render(
      <ContactExchangePanel
        exchange={exchange({ side: "hirer", counterpart: ANA, own: CARLOS })}
      />,
    );

    expect(screen.getByRole("region", { name: EXCHANGE_HEADING.hirer })).toBeInTheDocument();
    expect(screen.getByText(ANA.fullName)).toBeInTheDocument();
    expect(screen.getByText("300 123 4567")).toBeInTheDocument();
    expect(screen.getByText(ANA.email)).toBeInTheDocument();
  });
});

describe.each(["sent", "pending", "failed"] as const)("with the copy %s", (copy: CopyState) => {
  /** The details are on screen whatever happened to the mail — that is why they are here. */
  it("says where the copy is, and still shows every detail", () => {
    render(<ContactExchangePanel exchange={exchange({ copy })} />);

    expect(screen.getByText(COPY_LINES[copy])).toBeInTheDocument();
    expect(screen.getByText(CARLOS.email)).toBeInTheDocument();
  });
});
