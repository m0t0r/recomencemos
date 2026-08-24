import { readTraceContext } from "@repo/observability/trace-context";
import * as Sentry from "@sentry/nextjs";

describe("readTraceContext", () => {
  it("contributes nothing when there is no active span — the no-DSN path", () => {
    expect(readTraceContext()).toEqual({});
  });

  it("reads the identifiers off the active span", () => {
    const fields = Sentry.startSpan({ name: "probe" }, () => readTraceContext());

    expect(Object.keys(fields).toSorted()).toEqual(["span_id", "trace_id"]);
  });

  it("reports the identifiers of the span that is actually active", () => {
    const { fields, span } = Sentry.startSpan({ name: "probe" }, (active) => ({
      fields: readTraceContext(),
      span: Sentry.spanToJSON(active),
    }));

    expect(fields.trace_id).toBe(span.trace_id);
    expect(fields.span_id).toBe(span.span_id);
  });

  it("uses snake_case, because that is how spanToJSON spells it and nothing maps it", () => {
    const fields = Sentry.startSpan({ name: "probe" }, () => readTraceContext());

    expect(fields.trace_id).toMatch(/^[0-9a-f]{32}$/);
    expect(fields.span_id).toMatch(/^[0-9a-f]{16}$/);
  });

  /**
   * The mixin runs on **every** emit, so a throw here takes the logger down —
   * and it would do it during the incident the logger exists for. Correlation is
   * a nice-to-have on a line; the line is not.
   */
  it("contributes nothing rather than throwing when the span cannot be read", () => {
    const hostile = {
      spanContext() {
        throw new Error("async context was lost after an await");
      },
    } as unknown as Sentry.Span;

    expect(() => readTraceContext(() => hostile)).not.toThrow();
    expect(readTraceContext(() => hostile)).toEqual({});
  });

  it("drops an all-zero identifier, which correlates to nothing", () => {
    const nonRecording = {
      spanContext: () => ({
        traceId: "00000000000000000000000000000000",
        spanId: "0000000000000000",
        traceFlags: 0,
      }),
    } as unknown as Sentry.Span;

    expect(readTraceContext(() => nonRecording)).toEqual({});
  });
});
