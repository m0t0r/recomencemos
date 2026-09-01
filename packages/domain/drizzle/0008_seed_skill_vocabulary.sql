-- The Skill vocabulary (DD12).
--
-- Seeded here rather than by application code so that the list seam 2 tests
-- against and the list production serves are the same file. `ON CONFLICT (slug)
-- DO NOTHING` is what makes running it twice a no-op: the slug is the natural
-- key, and re-applying this migration inserts nothing and rewrites nothing.
--
-- **`cuoc_code` is provenance; `label_es` is what she reads.** Every code below
-- is a five-digit CUOC *Ocupación* code — the Clasificación Única de Ocupaciones
-- para Colombia, Decreto 654 de 2021 and Resolución 771 de 2021, maintained by
-- DANE, edition CUOC 2025. CUOC is written in the register of a labour
-- statistician; the person reading the publishing form is a cook deciding
-- whether a phrase describes her, so no label here is CUOC's own title. The test
-- is `docs/policy/voice.md`'s: read the label aloud after *"Sé…"*, and if it does
-- not finish the sentence the way a person would say it, it is still CUOC.
--
-- **CUOC's four-digit groups are not ISCO-08's**, which matters to anyone
-- checking a code by hand: it keeps the pyramid's *structure* to the fourth digit
-- and has 449 primary groups where ISCO-08 has 436, so `733x` and `832x` are real
-- here and absent there. Read a code against DANE's published document, not
-- against ISCO.
--
-- **Two entries may share one code.** The granularity is what a Hirer would type
-- into search, not CUOC's fifth digit — cutting hair and barbering are both
-- 51410, and someone looking for one is not looking for the other.
--
-- **The order of the rows is the order of nothing.** Reads sort by `label_es`;
-- the grouping below is for the person maintaining this file.

INSERT INTO "skill" ("slug", "label_es", "cuoc_code") VALUES
  -- Casa, aseo y ropa
  ('home-cleaning',           'Aseo de casas por días',            '91110'),
  ('office-cleaning',         'Aseo de oficinas y locales',        '91120'),
  ('laundry-and-ironing',     'Lavado y planchado de ropa',        '91210'),
  ('window-cleaning',         'Limpieza de vidrios y ventanas',    '91230'),
  ('vehicle-washing',         'Lavado de carros y motos',          '91220'),
  ('odd-jobs',                'Arreglos y oficios varios',         '96220'),
  ('building-caretaking',     'Portería y cuidado de edificios',   '51530'),

  -- Cocina y comida
  ('home-cooking',            'Cocinar almuerzos y comida casera', '51201'),
  ('traditional-cooking',     'Cocinar comida típica',             '51202'),
  ('fast-food',               'Preparar comidas rápidas',          '94110'),
  ('kitchen-assistance',      'Ayudar en la cocina',               '94120'),
  ('baking-and-pastry',       'Panadería y repostería',            '75121'),
  ('table-service',           'Atender mesas en eventos',          '51310'),
  ('bartending',              'Preparar y servir bebidas',         '51321'),
  ('barista-work',            'Preparar café de especialidad',     '51322'),
  ('street-food-selling',     'Vender comida preparada',           '52120'),
  ('meat-preparation',        'Cortar y preparar carnes',          '75110'),

  -- Cuidado de personas y enseñanza
  ('child-care',              'Cuidar niños por horas',            '53110'),
  ('elder-care',              'Acompañar y cuidar personas mayores', '53220'),
  ('patient-companionship',   'Acompañar pacientes en clínicas',   '53210'),
  ('injections-and-wound-care', 'Inyectología y curaciones',       '53291'),
  ('pet-care',                'Cuidar y pasear mascotas',          '51640'),
  ('school-tutoring',         'Clases de refuerzo escolar',        '23410'),
  ('language-tutoring',       'Clases de inglés',                  '23530'),
  ('dance-classes',           'Clases de baile',                   '23550'),
  ('fitness-training',        'Entrenamiento físico y ejercicio',  '34231'),

  -- Belleza
  ('hairdressing',            'Cortar y peinar el cabello',        '51410'),
  ('barbering',               'Barbería y arreglo de barba',       '51410'),
  ('manicure-and-pedicure',   'Manicura y pedicura',               '51421'),
  ('makeup',                  'Maquillaje para eventos',           '51423'),
  ('beauty-and-massage',      'Masajes y tratamientos de belleza', '51422'),

  -- Construcción y acabados
  ('bricklaying',             'Albañilería y obra gris',           '71120'),
  ('construction-labour',     'Ayudar en obras de construcción',   '93130'),
  ('rough-carpentry',         'Carpintería de obra',               '71150'),
  ('roofing',                 'Arreglar techos y tejados',         '71210'),
  ('tiling',                  'Enchapar baños y cocinas',          '71221'),
  ('floor-installation',      'Instalar pisos',                    '71222'),
  ('plastering',              'Estucar y resanar paredes',         '71230'),
  ('painting',                'Pintar casas y apartamentos',       '71310'),
  ('plumbing',                'Arreglar tuberías y baños',         '71261'),
  ('gas-installation',        'Instalar redes de gas',             '71263'),
  ('electrical-work',         'Instalaciones eléctricas en casas', '74111'),
  ('glass-installation',      'Instalar vidrios y espejos',        '71250'),
  ('welding',                 'Soldadura y trabajos en hierro',    '72120'),
  ('locksmithing',            'Cerrajería y copia de llaves',      '72220'),
  ('refrigeration-repair',    'Arreglar neveras y aires acondicionados', '71270'),

  -- Muebles, costura y textil
  ('furniture-making',        'Hacer y arreglar muebles',          '75220'),
  ('upholstery',              'Tapizar muebles y sillas',          '75340'),
  ('dressmaking',             'Confeccionar ropa a la medida',     '75310'),
  ('clothing-repairs',        'Arreglar y ajustar ropa',           '75330'),
  ('industrial-sewing',       'Coser en máquina industrial',       '81530'),
  ('knitting',                'Tejer a mano',                      '73320'),
  ('shoe-repair',             'Arreglar zapatos y botas',          '75360'),

  -- Transporte, mensajería y carga
  ('motorcycle-delivery',     'Domicilios en moto',                '83210'),
  ('car-driving',             'Conducir carro o camioneta',        '83230'),
  ('taxi-driving',            'Conducir taxi',                     '83240'),
  ('bus-driving',             'Conducir bus o buseta',             '83310'),
  ('truck-driving',           'Conducir camión',                   '83320'),
  ('errands',                 'Hacer mandados y diligencias',      '96211'),
  ('loading-and-moving',      'Trasteos, cargue y descargue',      '93331'),

  -- Campo y jardín
  ('gardening',               'Jardinería y poda de plantas',      '92140'),
  ('coffee-farm-work',        'Trabajo en fincas de café',         '61122'),
  ('harvest-work',            'Recolección de cosecha',            '92110'),
  ('livestock-work',          'Cuidar ganado en la finca',         '92120'),
  ('pest-control',            'Fumigar y controlar plagas',        '75440'),

  -- Reparaciones
  ('vehicle-mechanics',       'Mecánica de carros y motos',        '72310'),
  ('bicycle-repair',          'Arreglar bicicletas',               '72340'),
  ('appliance-repair',        'Arreglar electrodomésticos',        '74210'),
  ('computer-repair',         'Arreglar computadores',             '74210'),
  ('phone-repair',            'Arreglar celulares',                '74222'),
  ('antenna-and-camera-installation', 'Instalar antenas y cámaras', '74221'),

  -- Comercio, oficina, seguridad y eventos
  ('shop-assistance',         'Atender en tienda o almacén',       '52230'),
  ('cashiering',              'Manejar caja y cobrar',             '52300'),
  ('market-selling',          'Vender en puesto de mercado',       '52110'),
  ('warehouse-work',          'Trabajo en bodega y almacén',       '43211'),
  ('bookkeeping',             'Llevar cuentas y facturación',      '33131'),
  ('security-guarding',       'Vigilancia y celaduría',            '54142'),
  ('event-organising',        'Organizar eventos y celebraciones', '33320'),
  ('event-setup',             'Montar y desmontar eventos',        '34353'),
  ('photography',             'Fotografía de eventos',             '34310'),
  ('video-recording',         'Grabar y editar video',             '35211'),
  ('live-music',              'Tocar música en vivo',              '26524'),
  ('local-guiding',           'Guiar recorridos por la ciudad',    '51132'),

  -- Trabajo a distancia. This product introduces people in Risaralda to anyone,
  -- anywhere, and a vocabulary of only on-site work would have quietly narrowed
  -- that to whoever can reach Pereira. Pereira's contact-centre cluster is one of
  -- its largest employers, and every entry below is work a Hirer in Bogotá or
  -- Madrid can buy.
  ('data-entry',              'Digitar datos y documentos',        '41322'),
  ('call-centre-work',        'Atender llamadas de clientes',      '42220'),
  ('administrative-assistance', 'Asistencia administrativa remota', '33431'),
  ('social-media-management', 'Manejar redes sociales',            '24312'),
  ('graphic-design',          'Diseño gráfico y volantes',         '21661'),
  ('transcription',           'Transcribir audios y documentos',   '44140'),
  ('translation',             'Traducir textos',                   '26431'),

  -- Reciclaje
  ('recycling-collection',    'Recoger material reciclable',       '96110')
ON CONFLICT ("slug") DO NOTHING;
