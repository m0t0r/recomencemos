/**
 * PROTOTYPE — `/prototype`: the UX lab's index. Ten ideas, each a question
 * about the platform's experience, each answered by three or four variants
 * built against mock data, plus one single-file logic prototype served from
 * `public/prototype/`. This page is the table; every row links into the
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
  {
    n: 6,
    title: "Leer un perfil",
    question:
      "¿Cómo lee un Contratante el perfil completo en el teléfono, y dónde encuentra cómo escribirle?",
    path: "/prototype/profile",
    variants: [
      { key: "A", name: "La página" },
      { key: "B", name: "El dossier" },
      { key: "C", name: "Su voz" },
    ],
    today: "Un solo scroll en /profile/[slug] con el formulario en un <details> al pie.",
  },
  {
    n: 7,
    title: "Mi lado de la plataforma",
    question:
      "¿Qué ve una Trabajadora cuando entra: su tarjeta, sus propuestas, o solo lo que hoy necesita de ella?",
    path: "/prototype/my-notebook",
    variants: [
      { key: "A", name: "Una página" },
      { key: "B", name: "Pestañas" },
      { key: "C", name: "Hoy" },
    ],
    today: "/my-profile muestra la tarjeta y el interruptor de pausa; nada sobre propuestas.",
  },
  {
    n: 8,
    title: "Las tres cosas claras",
    question:
      "¿Dónde viven las tres negativas para que quien decide las lea y quien solo mira no las pague en scroll?",
    path: "/prototype/notices",
    variants: [
      { key: "A", name: "El bloque" },
      { key: "B", name: "La franja" },
      { key: "C", name: "En el momento" },
    ],
    today: "Tres desplegables sobre la lista del muro y al pie de cada perfil.",
  },
  {
    n: 9,
    title: "La cola del día",
    question:
      "¿Cómo revisa una sola persona todo lo que espera un humano, sin que lo más viejo envejezca?",
    path: "/prototype/admin-queue",
    variants: [
      { key: "A", name: "La tabla" },
      { key: "B", name: "Una a la vez" },
      { key: "C", name: "Dos paneles" },
    ],
    today: "Cinco secciones separadas en /admin, cada una con la edad de lo más viejo.",
  },
  {
    n: 10,
    title: "La puerta",
    question:
      "¿Cómo entra una Trabajadora desde un teléfono prestado, sin contraseña y quizá sin correo a la mano?",
    path: "/prototype/sign-in",
    variants: [
      { key: "A", name: "El enlace" },
      { key: "B", name: "El código" },
      { key: "C", name: "Tu número" },
    ],
    today: "Un enlace al correo o Google, en /sign-in.",
  },
];

export default function LabIndexPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground font-mono text-xs">prototipo · se borra entero</p>
        <h1 className="page-heading">Laboratorio de experiencia</h1>
        <p className="text-muted-foreground max-w-prose text-pretty">
          Diez preguntas sobre cómo se vive la plataforma, cada una con variantes que se cambian con
          las flechas del teclado o la barra de abajo. Todo es de mentira: nada se guarda y ninguna
          persona aquí existe.
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

      <section className="border-border flex flex-col gap-2 border-t pt-6">
        <p className="text-muted-foreground font-mono text-xs">
          prototipo de lógica · un solo archivo
        </p>
        <h2 className="font-heading text-2xl leading-8 font-medium">
          {/* oxlint-disable-next-line nextjs/no-html-link-for-pages -- a static file under public/, not a page */}
          <a href="/prototype/offer-lifecycle.html" className="hover:text-primary">
            Qué pasa cuando ella reporta
          </a>
        </h2>
        <p className="text-pretty">
          El modelo de estados de una propuesta y de una cuenta, con botones: reportar, bloquear,
          pausar, aceptar, descongelar, irse y volver. Donde el prototipo tuvo que suponer algo, lo
          dice en naranja.
        </p>
      </section>
    </main>
  );
}
