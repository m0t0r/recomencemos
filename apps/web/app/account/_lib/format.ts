/**
 * When a session started and when it ends, in the words and formats the voice
 * guide fixes: _hoy_, _hace 6 días_, _27 de septiembre_, _8:40 p. m._ — never
 * `27/09/2026`, which reads as September in one country and as nothing in
 * another.
 *
 * **Every function takes the clock rather than reading it**, for two reasons
 * that both bite here. It makes these assertable without freezing time. And
 * `apps/web` runs with Cache Components on, where reading the current time in a
 * component that prerenders fails the build with `blocking-prerender-current-time`
 * — so the clock is read once, at the dynamic boundary, and passed down.
 *
 * **Everything formats in `America/Bogota`, explicitly.** The server runs in UTC
 * on Fly, so a session started at 8 p.m. in Pereira would otherwise be rendered
 * as one in the morning the following day. The reader is in Risaralda; the
 * process is not.
 */

/** The one timezone this product renders in. Three municipalities, one offset. */
export const COLOMBIA_TIME_ZONE = "America/Bogota";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: COLOMBIA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: COLOMBIA_TIME_ZONE,
  day: "numeric",
  month: "long",
});

const timeFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: COLOMBIA_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/**
 * Whole days between two instants, counted as **calendar days in Bogotá**.
 *
 * Not `(b - a) / 86_400_000`: that answers "how many 24-hour spans", which is a
 * different question and gets _ayer_ wrong for anything late in the evening. The
 * `en-CA` locale is used only because it renders as `YYYY-MM-DD`, which sorts
 * and subtracts cleanly; nothing reads it.
 */
function calendarDaysBetween(from: Date, to: Date): number {
  const start = Date.parse(`${dayFormat.format(from)}T00:00:00Z`);
  const end = Date.parse(`${dayFormat.format(to)}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/** _27 de septiembre_. */
export function onDate(date: Date): string {
  return dateFormat.format(date);
}

/** _8:40 p. m._ */
export function atTime(date: Date): string {
  return timeFormat.format(date);
}

/**
 * When this session started, as she would say it.
 *
 * Sessions live at most 30 days (NFR13), so the relative form never has to
 * stretch into weeks or months — past a few days the date is more use than a
 * count anyway.
 */
export function startedLabel(createdAt: Date, now: Date): string {
  const days = calendarDaysBetween(createdAt, now);

  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return `el ${onDate(createdAt)}`;
}

/**
 * When this session ends on its own.
 *
 * **The same-day case says the hour and that is the point.** A shared-device
 * session runs 8 hours (NFR13), so it is the one whose expiry a person may
 * actually be counting on — telling her _se cierra hoy a las 8:40 p. m._ is the
 * product being honest about a promise it already made her at sign-in.
 */
export function expiresLabel(expiresAt: Date, now: Date): string {
  const days = calendarDaysBetween(now, expiresAt);

  if (days <= 0) return `se cierra hoy a las ${atTime(expiresAt)}`;
  if (days === 1) return `se cierra mañana a las ${atTime(expiresAt)}`;
  return `se cierra el ${onDate(expiresAt)}`;
}
