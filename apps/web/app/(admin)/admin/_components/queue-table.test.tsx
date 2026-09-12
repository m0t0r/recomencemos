/**
 * The one list (#277): every source, oldest first, a row opened in full before
 * it can be decided, and a keyboard that moves and decides without ever firing
 * inside a field.
 *
 * **The real row components render inside it**, with only the Server Actions
 * doubled — the handoff from one row to the next is a property of the list and
 * the row together, and either alone can satisfy it vacuously.
 *
 * **Queried by role.** A queue worked by keyboard is exactly where a control that
 * never told the accessibility tree it exists would hide, and a collapsed row's
 * decision buttons being *absent from the tree* is the assertion that nothing is
 * decided unread.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueueTable } from "./queue-table";
import {
  DELIVER_OFFER_SUBMIT,
  FILTER_LABEL,
  KEYS_MOVE,
  offerDelivered,
  OFFER_PAY_FIELD,
  OFFER_WHEN_FIELD,
  OFFER_WORK_FIELD,
  OFFERS_LABEL,
  PAST_BAND_MARKER,
  PHOTO_APPROVE,
  PHOTO_APPROVED,
  PHOTOS_LABEL,
  PROMOTE_SLUG_LABEL,
  QUEUE_LIST_LABEL,
  REJECT_OFFER_SUBMIT,
  ROW_DECIDED,
  SKILL_REQUESTS_LABEL,
} from "../_lib/messages";
import type { QueueItem, QueueRow } from "../_lib/queue-sources";

/** Every action a row can reach, each carrying the `bind` the rows call. */
const actions = vi.hoisted(() => {
  // It captures nothing, and it cannot move out: `vi.hoisted` is lifted above
  // every statement in the file, so a helper at module scope would be read in its
  // temporal dead zone.
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const withBind = () => {
    const action = vi.fn();
    Object.assign(action, { bind: () => action });
    return action;
  };

  return {
    deliverOffer: withBind(),
    rejectOffer: withBind(),
    approvePhoto: withBind(),
    rejectPhoto: withBind(),
    promoteSkill: withBind(),
  };
});

vi.mock("../actions", () => actions);

const NOW = new Date("2026-09-12T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

const anOffer = (id: string, hirer: string, worker: string, hours: number): QueueItem => ({
  id,
  summary: `De ${hirer} (nombre sin comprobar) para ${worker}.`,
  fields: [
    { label: OFFER_WORK_FIELD, value: `Trabajo de ${hirer}` },
    { label: OFFER_PAY_FIELD, value: "$120.000 por el día" },
    { label: OFFER_WHEN_FIELD, value: "Sábado desde las 7" },
  ],
  arrivedAt: hoursAgo(hours),
});

const aRow = (sourceKey: string, sourceLabel: string, item: QueueItem, late = false): QueueRow => ({
  key: `${sourceKey}:${item.id}`,
  sourceKey,
  sourceLabel,
  ageHours: Math.floor((NOW.getTime() - item.arrivedAt.getTime()) / 3_600_000),
  late,
  item,
});

const SKILL = aRow("skillRequests", SKILL_REQUESTS_LABEL, {
  id: "s1",
  summary: "Reparo máquinas de coser industriales",
  arrivedAt: hoursAgo(40),
});
const OFFER_A = aRow("offers", OFFERS_LABEL, anOffer("o1", "Carlos", "Ana M", 30), true);
const OFFER_B = aRow("offers", OFFERS_LABEL, anOffer("o2", "Lucía", "Marta R", 20));
const PHOTO = aRow("photos", PHOTOS_LABEL, {
  id: "p1",
  summary: "Esperando desde el 11 de septiembre de 2026",
  arrivedAt: hoursAgo(12),
  imageUrl: "https://photos.example.test/quarantine/p1.jpg",
  photoKey: "quarantine/p1.jpg",
});

const ROWS = [SKILL, OFFER_A, OFFER_B, PHOTO];

const FILTERS = [
  { key: "offers", label: OFFERS_LABEL, total: 2 },
  { key: "photos", label: PHOTOS_LABEL, total: 1 },
  { key: "skillRequests", label: SKILL_REQUESTS_LABEL, total: 1 },
];

const aQueue = () => render(<QueueTable rows={ROWS} filters={FILTERS} />);

/** The control that opens a row: its summary, as a button in the row's header cell. */
const toggleFor = (row: QueueRow) => screen.getByRole("button", { name: row.item.summary });

/** The table row whose header cell names this item. */
const rowFor = (row: QueueRow) => {
  const found = screen
    .getAllByRole("row")
    .find((each) => within(each).queryByRole("rowheader", { name: row.item.summary }) !== null);
  if (found === undefined) throw new Error(`No row is headed "${row.item.summary}".`);
  return found;
};

beforeEach(() => {
  for (const action of Object.values(actions)) action.mockReset();
  actions.deliverOffer.mockResolvedValue({ data: { workerFirstName: "Ana" } });
  actions.rejectOffer.mockResolvedValue({ data: { offerId: "o1" } });
  actions.approvePhoto.mockResolvedValue({ data: { photoState: "approved" } });
});

/**
 * **One list across every source, oldest first** — the owner's choice in the UX
 * lab, and the reason there are no sections: nothing old hides behind a section
 * nobody opened. The fixture interleaves the sources, so a table that grouped
 * them would fail here.
 */
it("lists every source in one table, oldest first", () => {
  aQueue();

  expect(screen.getAllByRole("rowheader").map((header) => header.textContent)).toEqual(
    ROWS.map((row) => row.item.summary),
  );
});

/**
 * Each row says where it came from and how long it has waited, and a late one
 * says so **in words** — WCAG 2.2 AA 1.4.1, and the queue's own rule that the
 * marker is text and the colour is the redundant half.
 */
it("shows each row's source and age, and marks a late one in words", () => {
  aQueue();

  const late = within(rowFor(OFFER_A));
  expect(late.getByText(OFFERS_LABEL)).toBeInTheDocument();
  expect(late.getByText("30 h")).toBeInTheDocument();
  expect(late.getByText(PAST_BAND_MARKER)).toBeInTheDocument();

  expect(within(rowFor(OFFER_B)).queryByText(PAST_BAND_MARKER)).toBeNull();
});

/**
 * **Nothing is decided unread.** A collapsed row's decisions are not merely
 * hidden from the eye but absent from the accessibility tree, so no keyboard or
 * screen-reader path reaches *Entregar* on an Offer nobody opened.
 */
it("offers no decision on a row until it is open in full", async () => {
  const user = userEvent.setup();
  aQueue();

  expect(screen.queryByRole("button", { name: DELIVER_OFFER_SUBMIT })).toBeNull();

  await user.click(toggleFor(OFFER_A));

  expect(toggleFor(OFFER_A)).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Trabajo de Carlos")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: DELIVER_OFFER_SUBMIT })).toHaveLength(1);
});

/**
 * **No bulk decision**, here or anywhere on the queue: the one open row carries
 * its own two decisions and nothing outside the rows decides anything.
 */
it("offers no control that decides more than one row", async () => {
  const user = userEvent.setup();
  aQueue();

  await user.click(toggleFor(OFFER_A));

  expect(screen.getAllByRole("button", { name: DELIVER_OFFER_SUBMIT })).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: REJECT_OFFER_SUBMIT })).toHaveLength(1);
});

it("tells a keyboard user which keys it takes", () => {
  aQueue();

  expect(screen.getByRole("group", { name: QUEUE_LIST_LABEL })).toHaveAccessibleDescription(
    expect.stringContaining(KEYS_MOVE),
  );
});

describe("the keys", () => {
  /** `j`/`k` move the open row and the keyboard together. */
  it("move the selection with j and k", async () => {
    const user = userEvent.setup();
    aQueue();

    await user.click(toggleFor(SKILL));
    await user.keyboard("j");

    expect(toggleFor(OFFER_A)).toHaveFocus();
    expect(toggleFor(OFFER_A)).toHaveAttribute("aria-expanded", "true");
    expect(toggleFor(SKILL)).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("k");

    expect(toggleFor(SKILL)).toHaveFocus();
    expect(toggleFor(SKILL)).toHaveAttribute("aria-expanded", "true");
  });

  /**
   * **A key presses the row's own button**, so it is the same decision by the
   * same path as a click — the button is the decision and the key is an
   * accelerator for it.
   */
  it("decide the open row with a and r, through its own buttons", async () => {
    const user = userEvent.setup();
    aQueue();

    await user.click(toggleFor(OFFER_A));
    expect(screen.getByRole("button", { name: DELIVER_OFFER_SUBMIT })).toHaveAttribute(
      "aria-keyshortcuts",
      "a",
    );

    await user.keyboard("a");

    expect(await screen.findByText(offerDelivered("Ana"))).toBeInTheDocument();
    expect(actions.deliverOffer).toHaveBeenCalledTimes(1);
    expect(actions.rejectOffer).not.toHaveBeenCalled();
  });

  /**
   * **WCAG 2.2 SC 2.1.4, and the half of it that bites.** A Skill request is
   * promoted by typing into fields, and a single-key shortcut that fired there
   * would move the cursor under the Admin's hands on every _j_ in a word.
   */
  it("do nothing while the Admin is typing", async () => {
    const user = userEvent.setup();
    aQueue();

    await user.click(toggleFor(SKILL));
    const slug = screen.getByRole("textbox", { name: PROMOTE_SLUG_LABEL });
    await user.type(slug, "jar");

    expect(slug).toHaveValue("jar");
    expect(toggleFor(SKILL)).toHaveAttribute("aria-expanded", "true");
    expect(toggleFor(OFFER_A)).toHaveAttribute("aria-expanded", "false");
  });

  /** SC 2.1.4's other half: a key is active only while focus is in the queue. */
  it("do nothing while focus is outside the list", async () => {
    const user = userEvent.setup();
    aQueue();

    await user.keyboard("ja");

    expect(toggleFor(SKILL)).toHaveAttribute("aria-expanded", "true");
    expect(toggleFor(OFFER_A)).toHaveAttribute("aria-expanded", "false");
    expect(actions.deliverOffer).not.toHaveBeenCalled();
  });
});

describe("after a decision", () => {
  /**
   * **Twenty decisions is twenty keystrokes, not twenty re-orientations.** The
   * next row still waiting opens and takes the keyboard — on the line an Admin
   * reads, never on a control — and the row just decided stays open saying what
   * happened, so its outcome is still in front of a screen-reader user.
   */
  it("opens the next row waiting and says what happened", async () => {
    const user = userEvent.setup();
    aQueue();

    await user.click(toggleFor(OFFER_A));
    await user.click(screen.getByRole("button", { name: DELIVER_OFFER_SUBMIT }));

    expect(await screen.findByText(offerDelivered("Ana"))).toBeInTheDocument();
    // Waited for rather than read at once: the decided row drops its buttons in
    // one render and the table moves focus in the next, so the outcome can be on
    // screen a render before the keyboard has moved.
    await waitFor(() =>
      expect(screen.getByText(OFFER_B.item.summary, { selector: "p" })).toHaveFocus(),
    );
    expect(toggleFor(OFFER_B)).toHaveAttribute("aria-expanded", "true");
    expect(toggleFor(OFFER_A)).toHaveAttribute("aria-expanded", "true");
    expect(within(rowFor(OFFER_A)).getByText(ROW_DECIDED)).toBeInTheDocument();
  });

  /** A row already decided is stepped over, not handed back. */
  it("steps over a row already decided", async () => {
    const user = userEvent.setup();
    aQueue();

    await user.click(toggleFor(OFFER_B));
    await user.click(screen.getByRole("button", { name: DELIVER_OFFER_SUBMIT }));
    await screen.findByText(offerDelivered("Ana"));

    await user.click(toggleFor(OFFER_A));
    await user.click(screen.getByRole("button", { name: DELIVER_OFFER_SUBMIT }));

    // The photo has no line to read before the image, so its row's own control
    // takes the keyboard.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: PHOTO.item.summary })).toHaveFocus(),
    );
  });

  /** The last row has nowhere onward, so focus stays on its outcome. */
  it("keeps focus on the outcome when nothing is left below", async () => {
    const user = userEvent.setup();
    aQueue();

    await user.click(toggleFor(PHOTO));
    await user.click(screen.getByRole("button", { name: PHOTO_APPROVE }));

    const outcome = await screen.findByText(PHOTO_APPROVED);
    await waitFor(() => expect(outcome).toHaveFocus());
  });
});

/**
 * **The filter replaces the five routes, and it is the Admin's choice rather
 * than the page's default** — the list opens on everything, and narrowing it is
 * something done on purpose and visible in the control.
 */
it("narrows the list to one source when asked", async () => {
  const user = userEvent.setup();
  aQueue();

  await user.selectOptions(screen.getByRole("combobox", { name: FILTER_LABEL }), "photos");

  expect(screen.getAllByRole("rowheader").map((header) => header.textContent)).toEqual([
    PHOTO.item.summary,
  ]);
});
