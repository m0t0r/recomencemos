"use client";

/**
 * PROTOTYPE — Variant D, "Grábalo": she says her line instead of typing it.
 * Uses the browser's own speech recognition (Chrome ships it; Safari on iOS
 * does too) with `es-CO`, so nothing leaves the page except what the browser
 * vendor already sends for recognition. The transcript lands in the same
 * headline field she can edit, and the platform proposes Skills from it the
 * way variant B does.
 *
 * Bet: voice notes are how this audience already talks on WhatsApp, and a
 * microphone button lowers the cost of the one line that matters most.
 *
 * What is named on screen: recognition needs a network and a vendor, so it
 * is a convenience over typing, never the only way in.
 */

import { Button } from "@repo/design-system/components/button";
import { Textarea } from "@repo/design-system/components/textarea";
import { useRef, useState, useSyncExternalStore } from "react";
import { Labeled } from "../../_components/labeled";
import { SKILLS } from "../../_lib/mock";
import { type Draft, EMPTY_DRAFT, Published, SkillPicker, WallRowPreview } from "./shared";

interface RecognitionResultEvent {
  readonly results: ArrayLike<ArrayLike<{ readonly transcript: string }>>;
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  addEventListener(type: "result", listener: (event: RecognitionResultEvent) => void): void;
  addEventListener(type: "end" | "error", listener: () => void): void;
  start: () => void;
  stop: () => void;
}

function recognitionFactory(): (() => RecognitionLike) | null {
  const w = globalThis as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? () => new Ctor() : null;
}

const HINTS: Record<string, readonly string[]> = {
  "home-cooking": ["cocin", "almuerzo", "comida"],
  "traditional-cooking": ["típic", "sancocho", "frijol"],
  "home-cleaning": ["aseo", "limpi"],
  "odd-jobs": ["arregl", "todero"],
  plumbing: ["plomer", "tuber"],
  painting: ["pint"],
  "child-care": ["niñ", "bebé"],
  "elder-care": ["mayor", "abuel", "cuid"],
  "motorcycle-delivery": ["moto", "domicilio"],
  hairdressing: ["pelo", "peluquer", "manicure"],
  tutoring: ["clase", "enseñ"],
  spreadsheets: ["excel", "factur"],
  sewing: ["cos", "costura"],
  gardening: ["jardín", "jardin", "poda"],
};

export function SpeakIt() {
  const [draft, setDraft] = useState<Draft>({
    ...EMPTY_DRAFT,
    firstName: "Ana María",
    lastInitial: "R",
    city: "pereira",
  });
  const [listening, setListening] = useState(false);
  /*
    Read once on the client and `null` on the server, so the button's label
    cannot mismatch across hydration and no effect has to set state.
  */
  const supported = useSyncExternalStore(
    () => () => {},
    () => recognitionFactory() !== null,
    () => null,
  );
  const [interim, setInterim] = useState("");
  const [done, setDone] = useState(false);
  const recognition = useRef<RecognitionLike | null>(null);

  function patch(next: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function proposeSkills(text: string) {
    const lower = text.toLocaleLowerCase("es-CO");
    const slugs = SKILLS.filter((skill) =>
      (HINTS[skill.slug] ?? []).some((word) => lower.includes(word)),
    )
      .map((skill) => skill.slug)
      .slice(0, 5);
    if (slugs.length > 0) patch({ skillSlugs: slugs });
  }

  function start() {
    const factory = recognitionFactory();
    if (!factory) return;
    const rec = factory();
    rec.lang = "es-CO";
    rec.interimResults = true;
    rec.continuous = false;
    rec.addEventListener("result", (event) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        parts.push(event.results[i]?.[0]?.transcript ?? "");
      }
      setInterim(parts.join(" "));
    });
    rec.addEventListener("end", () => {
      setListening(false);
      setInterim((text) => {
        if (text.trim()) {
          const sentence = text.trim().replace(/^./, (c) => c.toLocaleUpperCase("es-CO"));
          patch({ headline: sentence.endsWith(".") ? sentence : `${sentence}.` });
          proposeSkills(sentence);
        }
        return "";
      });
    });
    rec.addEventListener("error", () => setListening(false));
    recognition.current = rec;
    setListening(true);
    rec.start();
  }

  function stop() {
    recognition.current?.stop();
  }

  if (done) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col px-4 py-10">
        <Published draft={draft} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">Di qué sabes hacer</h1>
        <p className="text-muted-foreground text-pretty">
          Como un audio de WhatsApp: toca el botón y dilo en una frase. Después lo puedes corregir.
        </p>
      </div>

      <div className="flex flex-col items-start gap-3">
        {supported === false ? (
          <p className="text-muted-foreground text-sm text-pretty">
            Este navegador no reconoce voz. Escribe tu línea abajo; es lo mismo.
          </p>
        ) : (
          <Button
            type="button"
            size="lg"
            variant={listening ? "secondary" : "default"}
            aria-pressed={listening}
            onClick={listening ? stop : start}
            disabled={supported === null}
          >
            {listening ? "Escuchando… toca para terminar" : "Grabar mi línea"}
          </Button>
        )}
        {interim ? (
          <p className="font-heading text-muted-foreground text-xl italic" aria-live="polite">
            {interim}
          </p>
        ) : null}
      </div>

      <Labeled
        label="Tu línea"
        hint="Lo que dijiste, o lo que quieras escribir. Esta es la línea que todos leen primero."
      >
        {(id) => (
          <Textarea
            id={id}
            rows={3}
            value={draft.headline}
            onChange={(event) => patch({ headline: event.target.value })}
            placeholder="Cocino almuerzos caseros para hasta veinte personas y dejo la cocina limpia."
          />
        )}
      </Labeled>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-medium">Tus capacidades</h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {draft.skillSlugs.length > 0
            ? "Marcamos las que reconocimos en lo que dijiste. Corrige lo que quieras."
            : "Elige de la lista."}
        </p>
        <SkillPicker value={draft.skillSlugs} onChange={(skillSlugs) => patch({ skillSlugs })} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-medium">Así te van a ver</h2>
        <div className="ruled-page">
          <WallRowPreview draft={draft} />
        </div>
        <p className="text-muted-foreground text-sm text-pretty">
          Nombre, ciudad y datos privados ya están puestos en este prototipo para que pruebes solo
          la voz.
        </p>
      </section>

      <div>
        <Button
          type="button"
          size="lg"
          disabled={draft.headline.trim().length < 10 || draft.skillSlugs.length === 0}
          onClick={() => setDone(true)}
        >
          Publicar
        </Button>
      </div>
    </main>
  );
}
