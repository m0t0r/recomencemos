/**
 * PROTOTYPE — `/prototype`: the UX lab's index. Five ideas, each a question
 * about the platform's experience, each answered by two or three variants
 * built against mock data. This page is the table; every row links into the
 * variant it names. Throwaway, with everything under this folder.
 */

import Link from "next/link";

interface Idea {
  readonly n: number;
  readonly title: string;
  readonly question: string;
  readonly path: string;
  readonly variants: readonly { key: string; name: string }[];
  readonly today: string;
}

const IDEAS: readonly Idea[] = [
  {
    n: 1,
    title: "Decidir una propuesta",
    question:
      "¿Cómo lee y decide una Trabajadora sus propuestas desde el teléfono, y qué ve en el intercambio de contacto?",
    path: "/prototype/offers",
    variants: [
      { key: "A", name: "El cuaderno" },
      { key: "B", name: "Una a la vez" },
      { key: "C", name: "Lado a lado" },
    ],
    today: "No existe todavía: la tabla de superficies lo nombra y la ruta no está.",
  },
  {
    n: 2,
    title: "Publicar desde el teléfono",
    question: "¿Qué forma hace más liviano publicar en una sentada, sin documento?",
    path: "/prototype/publish",
    variants: [
      { key: "A", name: "Paso a paso" },
      { key: "B", name: "Cuéntalo" },
      { key: "C", name: "Escribe en la tarjeta" },
    ],
    today: "Un formulario de una página en /publish.",
  },
  {
    n: 3,
    title: "Encontrar a alguien",
    question: "¿Debería un Contratante empezar por lo que necesita, no por una lista?",
    path: "/prototype/browse",
    variants: [
      { key: "A", name: "¿Qué necesitas?" },
      { key: "B", name: "El índice" },
      { key: "C", name: "Sus palabras" },
    ],
    today: "Una lista con filtros de capacidad y ciudad en /profiles.",
  },
  {
    n: 4,
    title: "Escribir una propuesta concreta",
    question: "¿Qué forma lleva a términos que ella pueda aceptar tal cual?",
    path: "/prototype/offer-writer",
    variants: [
      { key: "A", name: "El espejo" },
      { key: "B", name: "El constructor" },
      { key: "C", name: "La carta" },
    ],
    today: "Tres campos de texto al pie del perfil, en un <details> cerrado.",
  },
  {
    n: 5,
    title: "La pregunta de los siete días",
    question: "¿Cuál es la forma más liviana y honesta de preguntar si se hizo y si le pagaron?",
    path: "/prototype/check-in",
    variants: [
      { key: "A", name: "Dos toques" },
      { key: "B", name: "La última línea" },
      { key: "C", name: "Un correo" },
    ],
    today: "No existe: es la única medida de éxito que nombra el producto.",
  },
];

export default function LabIndexPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground font-mono text-xs">prototipo · se borra entero</p>
        <h1 className="page-heading">Laboratorio de experiencia</h1>
        <p className="text-muted-foreground max-w-prose text-pretty">
          Cinco preguntas sobre cómo se vive la plataforma, cada una con variantes que se cambian
          con las flechas del teclado o la barra de abajo. Todo es de mentira: nada se guarda y
          ninguna persona aquí existe.
        </p>
      </div>

      <ol className="ruled-page divide-border divide-y">
        {IDEAS.map((idea) => (
          <li key={idea.n} className="flex flex-col gap-3 py-6">
            <div className="flex items-baseline gap-3">
              <span aria-hidden="true" className="font-heading text-primary text-3xl leading-none">
                {idea.n}
              </span>
              <h2 className="font-heading text-2xl leading-8 font-medium">
                <Link href={idea.path} className="hover:text-primary">
                  {idea.title}
                </Link>
              </h2>
            </div>
            <p className="text-pretty">{idea.question}</p>
            <p className="text-muted-foreground text-sm">Hoy: {idea.today}</p>
            <ul className="flex flex-wrap gap-2">
              {idea.variants.map((variant) => (
                <li key={variant.key}>
                  <Link
                    href={`${idea.path}?variant=${variant.key}`}
                    className="border-border hover:bg-secondary inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                  >
                    <span className="font-mono">{variant.key}</span>
                    {variant.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </main>
  );
}
