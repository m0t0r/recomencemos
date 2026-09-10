/**
 * PROTOTYPE — throwaway mock data for the UX lab under `/prototype`.
 *
 * Nothing here touches `@repo/domain`. Every Worker, Offer and Skill is
 * invented, and the file is deleted with the rest of the lab once each idea
 * has a verdict. Headlines are written the way the publish form asks for them:
 * what she can do, in her own words.
 */

export interface MockSkill {
  readonly slug: string;
  readonly labelEs: string;
  readonly group: string;
}

export const SKILLS: readonly MockSkill[] = [
  { slug: "home-cleaning", labelEs: "Aseo de casas por días", group: "Casa" },
  { slug: "laundry-and-ironing", labelEs: "Lavado y planchado de ropa", group: "Casa" },
  { slug: "window-cleaning", labelEs: "Limpieza de vidrios y ventanas", group: "Casa" },
  { slug: "odd-jobs", labelEs: "Arreglos y oficios varios", group: "Casa" },
  { slug: "home-cooking", labelEs: "Cocinar almuerzos y comida casera", group: "Cocina" },
  { slug: "traditional-cooking", labelEs: "Cocinar comida típica", group: "Cocina" },
  { slug: "kitchen-assistance", labelEs: "Ayudar en la cocina", group: "Cocina" },
  { slug: "baking-and-pastry", labelEs: "Panadería y repostería", group: "Cocina" },
  { slug: "table-service", labelEs: "Atender mesas en eventos", group: "Cocina" },
  { slug: "child-care", labelEs: "Cuidar niños por horas", group: "Cuidado" },
  { slug: "elder-care", labelEs: "Acompañar y cuidar personas mayores", group: "Cuidado" },
  { slug: "patient-companionship", labelEs: "Acompañar pacientes en clínicas", group: "Cuidado" },
  { slug: "masonry", labelEs: "Obra y mampostería", group: "Construcción" },
  { slug: "painting", labelEs: "Pintura de casas y locales", group: "Construcción" },
  { slug: "electrical", labelEs: "Instalaciones eléctricas básicas", group: "Construcción" },
  { slug: "plumbing", labelEs: "Plomería y destapes", group: "Construcción" },
  { slug: "motorcycle-delivery", labelEs: "Domicilios en moto", group: "Transporte" },
  { slug: "driving", labelEs: "Conducir carro particular", group: "Transporte" },
  { slug: "hairdressing", labelEs: "Peluquería y manicure a domicilio", group: "Personal" },
  { slug: "tutoring", labelEs: "Clases particulares a niños", group: "Personal" },
  { slug: "spreadsheets", labelEs: "Manejar Excel y hojas de cálculo", group: "Oficina" },
  { slug: "customer-service", labelEs: "Atención al cliente por teléfono", group: "Oficina" },
  { slug: "sewing", labelEs: "Costura y arreglos de ropa", group: "Oficio" },
  { slug: "gardening", labelEs: "Jardinería y poda", group: "Oficio" },
];

export type MockCity = "pereira" | "dosquebradas" | "santa-rosa";

export const CITY_LABEL: Record<MockCity, string> = {
  pereira: "Pereira",
  dosquebradas: "Dosquebradas",
  "santa-rosa": "Santa Rosa de Cabal",
};

export interface MockWorker {
  readonly slug: string;
  readonly firstName: string;
  readonly lastInitial: string;
  readonly city: MockCity;
  readonly headline: string;
  readonly skillSlugs: readonly string[];
  readonly about: string;
  readonly workHistory: readonly string[];
  readonly publishedDaysAgo: number;
  readonly offersReceived: number;
}

export const WORKERS: readonly MockWorker[] = [
  {
    slug: "ana-maria",
    firstName: "Ana María",
    lastInitial: "R",
    city: "pereira",
    headline: "Cocino almuerzos caseros para hasta veinte personas y dejo la cocina limpia.",
    skillSlugs: ["home-cooking", "traditional-cooking", "kitchen-assistance"],
    about:
      "Trabajé doce años en el restaurante de mi familia en Cuba. Sé organizar una cocina pequeña, comprar en la galería a buen precio y cocinar para grupos sin desperdiciar.\n\nPuedo empezar de inmediato, de lunes a sábado.",
    workHistory: [
      "Restaurante La Esquina del Sabor, Cuba — cocinera principal, 2014 a 2026",
      "Casino de una constructora en Cerritos — ayudante de cocina, 2012 a 2014",
    ],
    publishedDaysAgo: 2,
    offersReceived: 0,
  },
  {
    slug: "jhon-fredy",
    firstName: "Jhon Fredy",
    lastInitial: "M",
    city: "dosquebradas",
    headline: "Hago arreglos de plomería, pintura y electricidad básica en casas y locales.",
    skillSlugs: ["odd-jobs", "plumbing", "painting", "electrical"],
    about:
      "Quince años haciendo mantenimiento de casas en Dosquebradas. Tengo mis propias herramientas y una moto para llegar donde sea.",
    workHistory: ["Conjunto residencial Los Molinos — todero, 2018 a 2026"],
    publishedDaysAgo: 5,
    offersReceived: 1,
  },
  {
    slug: "luz-dary",
    firstName: "Luz Dary",
    lastInitial: "O",
    city: "santa-rosa",
    headline: "Acompaño y cuido personas mayores, de día o de noche, con paciencia y cariño.",
    skillSlugs: ["elder-care", "patient-companionship", "home-cooking"],
    about:
      "Cuidé a mi madre durante seis años y después trabajé con dos familias en Santa Rosa. Sé manejar medicamentos, movilizar a una persona y cocinarle a alguien con dieta.",
    workHistory: [
      "Familia Gómez, Santa Rosa de Cabal — cuidadora de noche, 2022 a 2026",
      "Hogar geriátrico San José — auxiliar, 2020 a 2022",
    ],
    publishedDaysAgo: 1,
    offersReceived: 0,
  },
  {
    slug: "carlos-andres",
    firstName: "Carlos Andrés",
    lastInitial: "V",
    city: "pereira",
    headline: "Manejo Excel, hago facturación y atiendo clientes por teléfono o WhatsApp.",
    skillSlugs: ["spreadsheets", "customer-service"],
    about:
      "Diez años en la parte administrativa de una ferretería del centro. Puedo trabajar desde casa con mi computador.",
    workHistory: ["Ferretería El Tornillo, Pereira — auxiliar administrativo, 2016 a 2026"],
    publishedDaysAgo: 3,
    offersReceived: 2,
  },
  {
    slug: "yesica",
    firstName: "Yesica",
    lastInitial: "T",
    city: "dosquebradas",
    headline: "Corto, peino y hago manicure a domicilio. Llevo mis propios productos.",
    skillSlugs: ["hairdressing"],
    about: "Tenía mi salón en el barrio Santa Mónica. Voy a domicilio en Dosquebradas y Pereira.",
    workHistory: ["Salón Yesi Style, Dosquebradas — dueña, 2019 a 2026"],
    publishedDaysAgo: 6,
    offersReceived: 3,
  },
  {
    slug: "wilmar",
    firstName: "Wilmar",
    lastInitial: "C",
    city: "santa-rosa",
    headline: "Hago obra gris, pego enchape y levanto muros. Tengo cuadrilla de tres.",
    skillSlugs: ["masonry", "painting", "odd-jobs"],
    about:
      "Maestro de obra con veinte años de experiencia. Trabajo con dos ayudantes de confianza.",
    workHistory: ["Constructora Andina — oficial de obra, 2010 a 2026"],
    publishedDaysAgo: 4,
    offersReceived: 0,
  },
  {
    slug: "diana",
    firstName: "Diana",
    lastInitial: "P",
    city: "pereira",
    headline: "Doy clases particulares de matemáticas y lectura a niños de primaria.",
    skillSlugs: ["tutoring", "child-care"],
    about: "Soy normalista. Trabajé ocho años en un colegio privado que cerró después del sismo.",
    workHistory: ["Colegio Los Alpes, Pereira — docente de primaria, 2018 a 2026"],
    publishedDaysAgo: 1,
    offersReceived: 0,
  },
  {
    slug: "esteban",
    firstName: "Esteban",
    lastInitial: "L",
    city: "dosquebradas",
    headline: "Hago domicilios en moto todo el día, conozco cada barrio del área metropolitana.",
    skillSlugs: ["motorcycle-delivery", "driving"],
    about: "Moto propia con papeles al día. Disponible de seis de la mañana a diez de la noche.",
    workHistory: ["Rappi y domicilios de restaurantes — mensajero, 2020 a 2026"],
    publishedDaysAgo: 7,
    offersReceived: 1,
  },
];

export function skillsOf(worker: Pick<MockWorker, "skillSlugs">): readonly MockSkill[] {
  return worker.skillSlugs.flatMap((slug) => SKILLS.filter((skill) => skill.slug === slug));
}

export function displayName(worker: Pick<MockWorker, "firstName" | "lastInitial">): string {
  return `${worker.firstName} ${worker.lastInitial}.`;
}

export function initialOf(firstName: string): string {
  return [...firstName][0]?.toLocaleUpperCase("es-CO") ?? "";
}

/** Offer states a Worker sees on her own inbox. */
export type MockOfferState = "delivered" | "accepted" | "rejected";

export interface MockOffer {
  readonly id: string;
  readonly hirerName: string;
  readonly hirerWhere: string;
  readonly workDescription: string;
  readonly payTerms: string;
  readonly whenText: string;
  readonly receivedDaysAgo: number;
  readonly state: MockOfferState;
  /** What crosses at Contact Exchange. Mock, and never shown before acceptance. */
  readonly hirerPhone: string;
  readonly hirerEmail: string;
}

/** The Offers Ana María (the Worker in every Worker-side idea) has received. */
export const OFFERS: readonly MockOffer[] = [
  {
    id: "of-1",
    hirerName: "Patricia Londoño",
    hirerWhere: "Pereira, barrio Pinares",
    workDescription:
      "Necesito almuerzo para 12 personas el sábado, en mi casa. Comida casera: sancocho o frijoles, arroz, ensalada y jugo. Yo pongo el mercado, tú cocinas y dejas la cocina como estaba.",
    payTerms: "$180.000 por el día, en efectivo al terminar",
    whenText: "Sábado 19 de septiembre, de 8 a.m. a 3 p.m.",
    receivedDaysAgo: 0,
    state: "delivered",
    hirerPhone: "+57 310 555 0142",
    hirerEmail: "patricia.londono@example.com",
  },
  {
    id: "of-2",
    hirerName: "Fundación Café y Vida",
    hirerWhere: "Dosquebradas",
    workDescription:
      "Cocinar el almuerzo de lunes a viernes para 25 personas en nuestro comedor. Menú sencillo, ingredientes los ponemos nosotros. Buscamos alguien por dos meses, con posibilidad de seguir.",
    payTerms: "$1.400.000 al mes, quincenal por transferencia",
    whenText: "Desde el lunes 21 de septiembre, de 7 a.m. a 1 p.m.",
    receivedDaysAgo: 1,
    state: "delivered",
    hirerPhone: "+57 606 555 0199",
    hirerEmail: "comedor@cafeyvida.example.org",
  },
  {
    id: "of-3",
    hirerName: "Miguel Restrepo",
    hirerWhere: "Madrid, España",
    workDescription:
      "Mi mamá vive sola en Pereira y ya no cocina. Quisiera que le prepares almuerzo y comida tres veces por semana en su casa y le dejes porciones para el resto de los días.",
    payTerms: "$90.000 por visita, te consigno cada semana desde España",
    whenText: "Lunes, miércoles y viernes, desde la semana que viene",
    receivedDaysAgo: 2,
    state: "delivered",
    hirerPhone: "+34 612 555 034",
    hirerEmail: "miguel.restrepo@example.es",
  },
  {
    id: "of-0",
    hirerName: "Restaurante Doña Rosa",
    hirerWhere: "Pereira, centro",
    workDescription: "Ayudar en cocina un fin de semana de mucho movimiento.",
    payTerms: "$70.000 por día",
    whenText: "Sábado y domingo pasados",
    receivedDaysAgo: 9,
    state: "rejected",
    hirerPhone: "",
    hirerEmail: "",
  },
];

/** The Worker every Worker-side idea is about. */
export const ME: MockWorker = WORKERS[0] as MockWorker;

export const ME_CONTACT = {
  fullName: "Ana María Rodríguez Pérez",
  phone: "+57 312 555 0107",
  email: "anamaria.rp@example.com",
};

export function daysAgo(days: number): string {
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

/** COP, the way a person writes it: `$180.000`. */
export function formatCop(amount: number): string {
  return `$${amount.toLocaleString("es-CO")}`;
}
