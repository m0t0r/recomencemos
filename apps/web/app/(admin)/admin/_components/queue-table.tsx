"use client";

/**
 * The Admin queue as one table: every source in one list, oldest first, a row
 * opened in full before anything on it can be decided, and a keyboard that
 * moves and decides.
 *
 * **The shadcn data-table shape — the registry's `table` for the markup and
 * TanStack Table for the model.** TanStack owns the row model, the source filter
 * and which rows are expanded; this file owns the markup, the focus and the keys,
 * which is the split the library is built around. It is v9's `useTable` with its
 * features registered explicitly, so the bundle carries expanding and filtering
 * and nothing else.
 *
 * **Nothing is decided unread, and that is structural rather than a habit.**
 * A collapsed row's detail is `hidden`, so its decision buttons are not in the
 * accessibility tree and no key, tab or screen-reader path reaches them. The
 * detail is still *mounted*, which is what lets a decided row keep saying what
 * happened when the Admin comes back to it rather than offering its buttons again
 * against a state the server has already moved.
 *
 * **The keys are WCAG 2.2 SC 2.1.4's "active only on focus" form.** The handler
 * sits on the list's own group, so a key does nothing unless focus is inside the
 * queue — and it does nothing inside a field, where _j_ is a letter somebody is
 * typing. **A decision key acts only on the row that holds focus**: focusing a
 * row's control selects it, and `a`/`r` pressed anywhere but inside the selected
 * row do nothing. They press a button the row marked with `data-queue-key`, so a
 * key is that button pressed, never a second route to the decision.
 */

import { Kbd } from "@repo/design-system/components/kbd";
import { selectBox } from "@repo/design-system/components/input-variants";
import { Label } from "@repo/design-system/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/table";
import { cn } from "@repo/design-system/lib/utils";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  type ExpandedState,
  rowExpandingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  type ComponentType,
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { OfferRow } from "./offer-row";
import { PhotoRow } from "./photo-row";
import { PastBandMarker } from "./queue";
import { SkillRequestRow } from "./skill-request-row";
import {
  AGE_COLUMN,
  FILTER_ALL,
  FILTER_LABEL,
  filterOption,
  KEYS_DECIDE,
  KEYS_MOVE,
  KEYS_NOT_FOR_SKILLS,
  KEYS_SCOPE,
  oldestItemHours,
  QUEUE_LIST_LABEL,
  ROW_DECIDED,
  SOURCE_COLUMN,
  SUMMARY_COLUMN,
} from "../_lib/messages";
import type { QueueFilter, QueueItem, QueueRow } from "../_lib/queue-sources";
import { QUEUE_ANCHOR, QUEUE_FOCUSABLE_LINE, QueueHandoff } from "../_lib/use-queue-row";

/**
 * How each source's row opens, and whether the keys can decide it.
 *
 * **One entry per source, so a source is one edit.** `keys` is `false` for a row
 * decided by typing — a Skill request is promoted by writing an identifier and a
 * name, which no single key can stand in for — and the hint says so when such a
 * row is in the list. A source with no entry opens into its summary and nothing
 * to press.
 */
const SOURCE_ROWS: Readonly<
  Record<
    string,
    { readonly Row: ComponentType<{ readonly item: QueueItem }>; readonly keys: boolean }
  >
> = {
  offers: { Row: OfferRow, keys: true },
  photos: { Row: PhotoRow, keys: true },
  skillRequests: { Row: SkillRequestRow, keys: false },
};

/**
 * Whether the source filter keeps a row. Anything but a source key — nothing
 * chosen, or the empty "everything" option — keeps them all.
 *
 * Filtered on the key rather than the label the cell shows: the key is the
 * identifier, and a label reworded in `messages.ts` must not break the filter.
 */
function keptBy(value: unknown, row: QueueRow): boolean {
  return typeof value !== "string" || value === "" || row.sourceKey === value;
}

/**
 * The two features this table uses, and no others.
 *
 * **Module scope, because TanStack reads identity**: a feature set or column list
 * rebuilt per render invalidates every model derived from it.
 */
const features = tableFeatures({
  rowExpandingFeature,
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
});

const column = createColumnHelper<typeof features, QueueRow>();

const columns = column.columns([
  column.accessor("sourceLabel", {
    id: "source",
    header: SOURCE_COLUMN,
    filterFn: (row, _columnId, value) => keptBy(value, row.original),
  }),
  column.accessor((row) => row.item.summary, { id: "summary", header: SUMMARY_COLUMN }),
  column.accessor("ageHours", { id: "age", header: AGE_COLUMN }),
]);

/** Where a single-key shortcut must never fire (SC 2.1.4): somebody is typing. */
const TYPING = "input, textarea, select, [contenteditable]";

/** Marks both of a row's table rows, so a key can tell which row holds focus. */
const ROW_KEY = "data-row-key";

export function QueueTable({
  rows,
  filters,
}: {
  rows: readonly QueueRow[];
  filters: readonly QueueFilter[];
}) {
  /**
   * **The row the Admin is on, and the row they just decided.** Both are open:
   * the selection because it is what is being read, the decided row because its
   * outcome is still being announced when the keyboard moves on. Any selection
   * the Admin makes themselves closes the decided one — by then it has been said.
   */
  const [selected, setSelected] = useState<string | null>(rows[0]?.key ?? null);
  const [lastDecided, setLastDecided] = useState<string | null>(null);

  /**
   * Rows decided on this screen. A ref as well as state, because a handoff reads
   * it from inside a row's effect, which can run before this component has
   * re-rendered with the previous decision.
   */
  const [decided, setDecided] = useState<ReadonlySet<string>>(() => new Set());
  const decidedRef = useRef<ReadonlySet<string>>(decided);

  const toggles = useRef(new Map<string, HTMLButtonElement>());
  const details = useRef(new Map<string, HTMLElement>());

  /**
   * What to focus once the next render has shown it. A ref and an effect rather
   * than a focus call where the decision is made, because the row being focused
   * is `hidden` until that render lands and a hidden element cannot take focus.
   */
  const pendingFocus = useRef<{ readonly key: string; readonly onto: "anchor" | "toggle" } | null>(
    null,
  );

  const baseId = useId();
  const hintId = `${baseId}-keys`;
  const filterId = `${baseId}-filter`;

  const data = useMemo(() => [...rows], [rows]);

  const expanded = useMemo<ExpandedState>(
    () => ({
      ...(lastDecided ? { [lastDecided]: true } : {}),
      ...(selected ? { [selected]: true } : {}),
    }),
    [selected, lastDecided],
  );

  function select(key: string, focus?: "anchor" | "toggle") {
    setSelected(key);
    setLastDecided(null);
    if (focus) pendingFocus.current = { key, onto: focus };
  }

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.key,
    getRowCanExpand: () => true,
    // Refreshed data must not collapse the row an Admin is reading.
    autoResetExpanded: false,
    state: { expanded },
    /**
     * `expanded` is controlled, so the table's own expanding API writes back
     * through here: a row it opens becomes the selection.
     */
    onExpandedChange: (updater) => {
      const next = typeof updater === "function" ? updater(expanded) : updater;
      if (next === true || expanded === true) return;
      const opened = Object.keys(next).find((key) => next[key] && !expanded[key]);
      if (opened) select(opened);
    },
  });

  const visible = table.getRowModel().rows;
  const sourceFilter = table.getColumn("source");
  const filterValue = sourceFilter?.getFilterValue();
  const shownSource = typeof filterValue === "string" ? filterValue : "";

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;

    const anchor =
      target.onto === "anchor"
        ? details.current.get(target.key)?.querySelector<HTMLElement>(`[${QUEUE_ANCHOR}]`)
        : null;
    (anchor ?? toggles.current.get(target.key))?.focus();
  });

  /**
   * `useQueueRow`'s rule, with the list supplying the *where*: the next row still
   * waiting, below the decided one, in the order the Admin is looking at.
   *
   * It reads the row model when it is called rather than closing over this
   * render's, because it is called from a row's effect — after the decision
   * landed, which may be a render or two after this function was made.
   */
  function handOn(key: string): boolean {
    const nowDecided = new Set(decidedRef.current).add(key);
    decidedRef.current = nowDecided;
    setDecided(nowDecided);

    const rowsNow = table.getRowModel().rows;
    const at = rowsNow.findIndex((row) => row.id === key);
    const next = rowsNow.slice(at + 1).find((row) => !nowDecided.has(row.id));
    if (!next) return false;

    setSelected(next.id);
    setLastDecided(key);
    pendingFocus.current = { key: next.id, onto: "anchor" };
    return true;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!(event.target instanceof Element) || event.target.closest(TYPING)) return;

    if (event.key === "j" || event.key === "k") {
      const at = visible.findIndex((row) => row.id === selected);
      const to = Math.min(Math.max(at + (event.key === "j" ? 1 : -1), 0), visible.length - 1);
      const next = visible[to];
      if (!next) return;
      event.preventDefault();
      select(next.id, "toggle");
      return;
    }

    if (event.key === "a" || event.key === "r") {
      // The row holding focus, and only when it is the selected one — a key must
      // never decide a row other than the one the Admin is on.
      const focusedRow = event.target.closest<HTMLElement>(`[${ROW_KEY}]`)?.dataset.rowKey;
      if (!selected || focusedRow !== selected) return;

      const button = details.current
        .get(selected)
        ?.querySelector<HTMLButtonElement>(`[data-queue-key="${event.key}"]`);
      if (!button || button.disabled) return;
      event.preventDefault();
      button.click();
    }
  }

  function onFilter(value: string) {
    sourceFilter?.setFilterValue(value === "" ? undefined : value);

    // The row being read may be one the filter just hid; the first row the
    // filter keeps is the one to open instead.
    const kept = rows.filter((row) => keptBy(value, row));
    if (!kept.some((row) => row.key === selected) && kept[0]) select(kept[0].key);
  }

  const everything = filters.reduce((sum, filter) => sum + filter.total, 0);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p id={hintId} className="text-muted-foreground max-w-prose text-xs leading-5 text-pretty">
          <Kbd>j</Kbd> <Kbd>k</Kbd> {KEYS_MOVE} · <Kbd>a</Kbd> <Kbd>r</Kbd> {KEYS_DECIDE}{" "}
          {KEYS_SCOPE}
          {rows.some((row) => SOURCE_ROWS[row.sourceKey]?.keys === false)
            ? ` ${KEYS_NOT_FOR_SKILLS}`
            : null}
        </p>

        <div className="flex items-center gap-2">
          <Label htmlFor={filterId}>{FILTER_LABEL}</Label>
          {/*
            **The platform's `<select>` in the registry's box (`selectBox`), not
            the registry's `Select`.** It is a short, flat list of options, and the
            Base UI popup would bring floating-ui onto this route for it; the
            native control also takes the keyboard's own list behaviour, which the
            `TYPING` guard above already leaves alone.
          */}
          <select
            id={filterId}
            className={cn(selectBox, "w-auto")}
            value={shownSource}
            onChange={(event) => onFilter(event.target.value)}
          >
            <option value="">{filterOption(FILTER_ALL, everything)}</option>
            {filters.map((filter) => (
              <option key={filter.key} value={filter.key}>
                {filterOption(filter.label, filter.total)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/*
        The listener is delegation, not an affordance: the keys act on the rows'
        own buttons, which are the interactive elements, and the group itself
        takes no focus.
      */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        // `<fieldset>` is the rule's suggestion and it groups form controls; this
        // groups a table, and its job is to be the one place the keys work.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="group"
        aria-label={QUEUE_LIST_LABEL}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        className="border-border bg-card rounded-lg border"
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "text-muted-foreground text-xs",
                      header.column.id === "age" && "text-right",
                    )}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {visible.map((row) => {
              const open = row.getIsExpanded();
              const isDecided = decided.has(row.id);
              const Detail = SOURCE_ROWS[row.original.sourceKey]?.Row;
              const detailId = `${baseId}-${row.id}`;

              return (
                <Fragment key={row.id}>
                  <TableRow
                    data-row-key={row.id}
                    data-state={row.id === selected ? "selected" : undefined}
                  >
                    {row.getAllCells().map((cell) => {
                      if (cell.column.id === "summary") {
                        return (
                          // The row's header cell: its summary is what names the
                          // row, and the control that opens it.
                          <TableHead
                            key={cell.id}
                            scope="row"
                            className="w-full max-w-0 py-0 font-normal"
                          >
                            {/*
                              **A plain `<button>`, not the registry's `Button`.**
                              It is the row's header text doing double duty as its
                              disclosure control, so it has to truncate and read
                              as the line it names; `Button`'s fixed height,
                              padding and centred inline-flex are a control's
                              shape, and the column would stop scanning as text.
                            */}
                            <button
                              type="button"
                              ref={(element) => {
                                if (element) toggles.current.set(row.id, element);
                                else toggles.current.delete(row.id);
                              }}
                              aria-expanded={open}
                              aria-controls={detailId}
                              onClick={() => select(row.id)}
                              // Focus selects: a decision key acts on the row that
                              // holds focus, so arriving on a row by Tab has to
                              // make it the row the keys decide.
                              onFocus={() => {
                                if (row.id !== selected) select(row.id);
                              }}
                              className={cn(
                                QUEUE_FOCUSABLE_LINE,
                                "block w-full truncate py-3 text-left",
                                isDecided && "text-muted-foreground",
                              )}
                            >
                              {row.original.item.summary}
                            </button>
                          </TableHead>
                        );
                      }

                      if (cell.column.id === "age") {
                        return (
                          <TableCell key={cell.id} className="w-24 text-right align-middle">
                            <span className="flex flex-col items-end gap-0.5 text-xs">
                              <span className="tabular-nums">
                                {oldestItemHours(row.original.ageHours)}
                              </span>
                              {row.original.late ? <PastBandMarker /> : null}
                              {isDecided ? (
                                <span className="text-muted-foreground">{ROW_DECIDED}</span>
                              ) : null}
                            </span>
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell
                          key={cell.id}
                          className="text-muted-foreground w-28 text-xs whitespace-normal"
                        >
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  {/*
                    **Mounted, and `hidden` until open** — see the file comment for
                    both halves. `hidden` removes it from the accessibility tree as
                    well as the page, which is what makes a collapsed row's
                    decisions unreachable rather than merely out of sight.
                  */}
                  <TableRow
                    id={detailId}
                    data-row-key={row.id}
                    hidden={!open}
                    ref={(element) => {
                      if (element) details.current.set(row.id, element);
                      else details.current.delete(row.id);
                    }}
                    className="hover:bg-transparent"
                  >
                    <TableCell
                      colSpan={columns.length}
                      className="px-4 pt-1 pb-5 whitespace-normal"
                    >
                      <RowHandoff rowKey={row.id} handOn={handOn}>
                        {Detail ? (
                          <Detail item={row.original.item} />
                        ) : (
                          <p className="text-foreground text-sm leading-5">
                            {row.original.item.summary}
                          </p>
                        )}
                      </RowHandoff>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * One row's handoff, bound to its key.
 *
 * **A component of its own so the context value comes from a hook rather than
 * an arrow written inline in the Provider.** `handOn` is a new function each time
 * the table renders — it has to be, because it reads the row model when it is
 * called — so this does not make the value stable across table renders, and it
 * is not trying to: a row's `useQueueRow` deliberately does not re-run on a new
 * handoff, so a changed function costs nothing but the Provider's own re-render.
 */
function RowHandoff({
  rowKey,
  handOn,
  children,
}: {
  rowKey: string;
  handOn: (key: string) => boolean;
  children: ReactNode;
}) {
  const value = useCallback(() => handOn(rowKey), [handOn, rowKey]);

  return <QueueHandoff.Provider value={value}>{children}</QueueHandoff.Provider>;
}
