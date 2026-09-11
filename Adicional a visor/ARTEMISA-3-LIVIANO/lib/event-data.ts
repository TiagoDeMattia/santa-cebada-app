// ============================================
// DATOS DEL EVENTO - ARTEMISA #3
// Edita estos datos para actualizar la pantalla
// ============================================

export const eventInfo = {
  title: "ARTEMISA",
  edition: "#3",
  date: "18.04",
  time: "16hs a 03am",
  venue: "TEMPLO RECOLETA",
  address: "Av. Córdoba 2001",
  tagline: "El templo sagrado de la birra",
  highlights: ["ARTE", "DJs sets", "Tragos de autor", "Birritas", "Morfi", "Stands de arte"],
};

// Horarios de DJs - Formato 24hs
// startTime y endTime en formato "HH:MM"
export const lineupSchedule = {
  tarde: {
    label: "HORARIO TARDE",
    sets: [
      { dj: "LULI", startTime: "16:00", endTime: "17:30" },
      { dj: "BAUTI B2B", startTime: "17:30", endTime: "19:00" },
      { dj: "SEBASTIAN CAMPOS", startTime: "19:00", endTime: "20:30" },
    ],
  },
  noche: {
    label: "HORARIO NOCHE",
    sets: [
      { dj: "EMABENDER", startTime: "21:00", endTime: "22:30" },
      { dj: "GONZA CAMPILLO", startTime: "22:30", endTime: "00:00" },
      { dj: "JESÚS MACIAS", startTime: "00:00", endTime: "01:30" },
      { dj: "EMI FIGUEROA", startTime: "01:30", endTime: "03:00" },
    ],
  },
};

// Los elegidos de esta misa - Vendors/Expositores
export const vendors = [
  { name: "In collection", description: "Accesorios plata y acero" },
  { name: "Le art du parfum", description: "Perfumes" },
  { name: "Reblend store", description: "Perfumos premium" },
  { name: "M de woman", description: "Bodysuits" },
  { name: "Coco boreal", description: "Cerámica" },
  { name: "Kami kaze", description: "Stickers e ilustraciones" },
  { name: "Life map", description: "Astrología" },
  { name: "Artulia", description: "Actividad artística" },
];

// Sponsors / Marcas acompañantes
export const sponsors = [
  { name: "Santa Cebada", logo: "/sponsors/santa-cebada-logo.svg" },
  { name: "MUR", logo: "/sponsors/mur-logo.png" },
  { name: "SirHopper", logo: "/sponsors/sirhopper-logo.webp" },
  { name: "Minga", logo: "/sponsors/minga-logo.png" },
  { name: "Baba", logo: "/sponsors/baba-logo.png" },
];

// Videos de Instagram (URLs o paths locales)
export const instagramVideos = [
  { id: "1", url: "/videos/reel01.mp4", fallback: "Reel 1" },
  { id: "2", url: "/videos/reel02.mp4", fallback: "Reel 2" },
  { id: "3", url: "/videos/reel03.mp4", fallback: "Reel 3" },
  { id: "4", url: "/videos/reel04.mp4", fallback: "Reel 4" },
  { id: "5", url: "/videos/reel05.mp4", fallback: "Reel 5" },
  { id: "6", url: "/videos/reel06.mp4", fallback: "Reel 6" },
  { id: "7", url: "/videos/reel07.mp4", fallback: "Reel 7" },
  { id: "8", url: "/videos/reel08.mp4", fallback: "Reel 8" },
  { id: "9", url: "/videos/reel09.mp4", fallback: "Reel 9" },
];

export const produceIdeal = {
  name: "Produce Ideal Ambiente",
  instagramUrl: "https://www.instagram.com/p/DHM5m5KR4X9/",
  instagramHandle: "produce.idealambiente",
  logo: "/partners/produce-ideal-logo.png",
};

// ============================================
// CONFIGURACIÓN DE ROTACIÓN DE PANTALLA
// Tiempos en milisegundos (1000ms = 1 segundo)
// ============================================
export const rotationConfig = {
  // Tiempo que se muestra cada slide principal
  mainSlideInterval: 16000,
  // Tiempo que se muestra cada sponsor
  sponsorRotationInterval: 3000,
  // Tiempo que se muestra cada video
  videoRotationInterval: 8000,
  // Slides a mostrar en orden
  slideOrder: ["hero", "schedule", "nowPlaying", "videos", "produceIdeal", "vendors", "sponsors"] as const,
};

// Mensaje final cuando termina el evento
export const closingMessage = {
  title: "Gracias por venir",
  subtitle: "Nos vemos en la próxima misa",
};
