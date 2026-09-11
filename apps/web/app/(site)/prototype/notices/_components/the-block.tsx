"use client";

/**
 * PROTOTYPE — Variant A, "El bloque": the three notices as they stand today on
 * the Wall — a heading, three disclosures, each opening to its detail — placed
 * above a mock list so the cost in scroll is visible. The control for the
 * comparison; nothing new here on purpose.
 */

import { WORKERS } from "../../_lib/mock";
import { NOTICES, Row } from "./shared";

export function TheBlock() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="page-heading">Publicaron esta semana</h1>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-medium">Tres cosas claras sobre Recomencemos</h2>
        {NOTICES.map((notice) => (
          <details key={notice.key} className="border-border rounded-md border px-4 py-3">
            <summary className="cursor-pointer">
              <span className="font-medium">{notice.heading}</span>{" "}
              <span className="text-muted-foreground">{notice.lead}</span>
            </summary>
            <p className="text-muted-foreground pt-2 text-sm text-pretty">{notice.detail}</p>
          </details>
        ))}
      </section>
      <div className="ruled-page divide-border divide-y">
        {WORKERS.slice(0, 4).map((worker) => (
          <Row key={worker.slug} worker={worker} />
        ))}
      </div>
    </main>
  );
}
