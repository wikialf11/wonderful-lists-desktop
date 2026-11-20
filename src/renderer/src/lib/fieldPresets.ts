// ════════════════════════════════════════════════════════════
// Catálogo de PRESETS reusables.
// La IA y la UI usan este mismo catálogo. Cada preset describe
// un paquete de campos personalizados ya configurados con widgets.
// ════════════════════════════════════════════════════════════

export type PresetField = {
  name: string;
  field_type: string;
  icon: string;
  validation?: any;
  options?: string[];
  widgets?: string[];
};

export type FieldPreset = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  // Palabras clave que la IA usa para detectar intent.
  match_keywords: string[];
  fields: PresetField[];
  // Si requiere configuración extra post-instalación (ej: lista destino).
  needs_extra_config?: "list_connection" | "access_grant" | null;
  // true → solo disponible para usuarios con suscripción activa.
  is_premium?: boolean;
};

export const FIELD_PRESETS: FieldPreset[] = [
  {
    id: "local_file",
    label: "Adjuntar archivo / imagen",
    description: "Sube una imagen al ítem y muéstrala como preview.",
    emoji: "📎",
    match_keywords: ["foto", "imagen", "adjuntar", "archivo", "subir", "fichero", "documento"],
    fields: [
      { name: "Adjunto", field_type: "image", icon: "Camera", validation: { maxSizeMB: 10 }, widgets: [] },
    ],
  },
  {
    id: "reviews",
    label: "Reseñas y comentarios",
    description: "Puntuación con estrellas + comentarios acumulables por ítem.",
    emoji: "⭐",
    match_keywords: ["reseña", "review", "valorar", "comentario", "puntuar", "rating", "opinión", "feedback"],
    fields: [
      { name: "Puntuación", field_type: "stars", icon: "Star", validation: { min: 1, max: 5 } },
      { name: "Comentario", field_type: "textarea", icon: "MessageSquare", widgets: [] },
    ],
  },
  {
    id: "form_to_list",
    label: "Formulario → otra lista",
    description:
      "Crea campos de formulario aquí. Cuando se cree (o complete) un ítem, se duplica automáticamente en otra lista.",
    emoji: "🔗",
    match_keywords: ["formulario", "conectar", "duplicar", "trigger", "evento", "automatizar", "workflow", "automático"],
    needs_extra_config: "list_connection",
    fields: [
      { name: "Nombre", field_type: "text", icon: "User", validation: { maxLength: 100 } },
      { name: "Email", field_type: "email", icon: "Mail", widgets: ["copy"] },
      { name: "Teléfono", field_type: "phone", icon: "Phone", widgets: ["call", "copy"] },
      { name: "Mensaje", field_type: "textarea", icon: "MessageSquare", validation: { maxLength: 1000 } },
    ],
  },
  {
    id: "checklist",
    label: "Checklist interna",
    description:
      "Crea una lista de casillas dentro del mismo ítem (capítulos, pasos, episodios…). Añade tantas casillas como necesites.",
    emoji: "☑️",
    match_keywords: ["checklist", "lista", "capitulos", "capítulos", "episodios", "pasos", "subtareas", "items", "ítems", "marcar", "tachar", "serie", "temporada", "tareas internas"],
    fields: [
      { name: "Checklist", field_type: "checklist", icon: "ListChecks", options: ["Elemento 1"] },
    ],
  },
  {
    id: "accessibility",
    label: "Accesibilidad condicional",
    description:
      "Cuando ocurre un evento (completar, marcar checkbox o un valor), añade al usuario asignado a otra lista y/o desbloquea campos ocultos del mismo ítem.",
    emoji: "🔓",
    match_keywords: ["acceso", "permiso", "desbloquear", "membresia", "membresía", "invitar", "ocultar", "revelar", "condicional", "gating", "unlock"],
    needs_extra_config: "access_grant",
    fields: [
      { name: "Estado de acceso", field_type: "checkbox", icon: "Lock" },
      { name: "Notas privadas", field_type: "textarea", icon: "EyeOff", validation: { maxLength: 2000 } },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // PRESETS PREMIUM (requieren suscripción activa)
  // Inspirados en patrones reales creados por usuarios.
  // ════════════════════════════════════════════════════════════
  {
    id: "contact_card_pro",
    label: "Ficha de contacto PRO",
    description: "Tarjeta completa: nombre, teléfono con botón llamar, email, web, dirección con mapa y notas.",
    emoji: "👤",
    is_premium: true,
    match_keywords: ["contacto", "ficha", "cliente", "agenda", "directorio", "crm"],
    fields: [
      { name: "Nombre", field_type: "text", icon: "User", validation: { maxLength: 100 } },
      { name: "Teléfono", field_type: "phone", icon: "Phone", widgets: ["call", "copy"] },
      { name: "Email", field_type: "email", icon: "Mail", widgets: ["copy"] },
      { name: "Web", field_type: "url", icon: "Link", widgets: ["copy", "qr"] },
      { name: "Dirección", field_type: "text", icon: "MapPin", widgets: ["open_map", "copy"] },
      { name: "Notas", field_type: "textarea", icon: "MessageSquare", widgets: [] },
    ],
  },
  {
    id: "media_tracker",
    label: "Tracker de series / películas",
    description: "Carátula, año, género, puntuación, checklist de capítulos y comentarios. Pensado para series, películas o libros.",
    emoji: "🎬",
    is_premium: true,
    match_keywords: ["serie", "pelicula", "película", "libro", "tracker", "media", "ver", "leer", "watchlist"],
    fields: [
      { name: "Carátula", field_type: "image", icon: "Camera", validation: { maxSizeMB: 8 } },
      { name: "Año", field_type: "number", icon: "Calendar", widgets: ["copy"] },
      { name: "Género", field_type: "select", icon: "Tag", options: ["Acción", "Comedia", "Drama", "Terror", "Documental", "Animación", "Otros"] },
      { name: "Puntuación", field_type: "stars", icon: "Star", validation: { min: 1, max: 5 } },
      { name: "Capítulos vistos", field_type: "checklist", icon: "ListChecks", options: ["Capítulo 1"] },
      { name: "Comentario", field_type: "textarea", icon: "MessageSquare", widgets: [] },
    ],
  },
  {
    id: "event_pro",
    label: "Evento / Reserva",
    description: "Fecha y hora con cuenta atrás, ubicación con mapa, enlace de inscripción con QR y estado.",
    emoji: "📅",
    is_premium: true,
    match_keywords: ["evento", "reserva", "cita", "boda", "fiesta", "concierto", "agenda evento"],
    fields: [
      { name: "Fecha y hora", field_type: "datetime", icon: "Calendar", widgets: ["countdown"] },
      { name: "Ubicación", field_type: "text", icon: "MapPin", widgets: ["open_map", "copy"] },
      { name: "Invitados", field_type: "number", icon: "Users", validation: { min: 0 } },
      { name: "Inscripción", field_type: "url", icon: "Link", widgets: ["qr", "copy"] },
      { name: "Estado", field_type: "select", icon: "Activity", options: ["Confirmado", "Pendiente", "Cancelado"] },
    ],
  },
  {
    id: "shop_product",
    label: "Producto / Catálogo",
    description: "Foto, precio, stock, descripción, categoría y enlace de compra con botón Pagar y QR.",
    emoji: "🛍️",
    is_premium: true,
    match_keywords: ["producto", "catalogo", "catálogo", "tienda", "shop", "venta", "ecommerce", "inventario"],
    fields: [
      { name: "Foto", field_type: "image", icon: "Camera", validation: { maxSizeMB: 8 } },
      { name: "Precio", field_type: "currency", icon: "DollarSign", validation: { min: 0, currency: "EUR" } },
      { name: "Stock", field_type: "number", icon: "Package", validation: { min: 0 } },
      { name: "Descripción", field_type: "textarea", icon: "Type", validation: { maxLength: 1000 } },
      { name: "Categoría", field_type: "select", icon: "Tag", options: ["General", "Nuevo", "Oferta", "Agotado"] },
      { name: "Enlace", field_type: "url", icon: "Link", widgets: ["qr", "copy"] },
    ],
  },
  {
    id: "habit_tracker",
    label: "Hábitos y rutinas",
    description: "Checklist diaria, objetivo numérico, racha (puntuación) y notas comentables.",
    emoji: "🔥",
    is_premium: true,
    match_keywords: ["habito", "hábito", "rutina", "diario", "rachas", "habits", "tracker hábitos"],
    fields: [
      { name: "Checklist diaria", field_type: "checklist", icon: "ListChecks", options: ["Beber agua", "Ejercicio", "Leer"] },
      { name: "Objetivo", field_type: "number", icon: "Target", validation: { min: 0 } },
      { name: "Racha (días)", field_type: "number", icon: "Zap", validation: { min: 0 } },
      { name: "Reflexión", field_type: "textarea", icon: "MessageSquare", widgets: [] },
    ],
  },
  {
    id: "delivery_logistics",
    label: "Envío / Logística",
    description: "Destinatario con teléfono, dirección con mapa, número de seguimiento copiable y estado del envío.",
    emoji: "📦",
    is_premium: true,
    match_keywords: ["envio", "envío", "logistica", "logística", "paquete", "delivery", "tracking", "seguimiento", "ruta"],
    fields: [
      { name: "Destinatario", field_type: "text", icon: "User" },
      { name: "Teléfono", field_type: "phone", icon: "Phone", widgets: ["call", "copy"] },
      { name: "Dirección", field_type: "text", icon: "MapPin", widgets: ["open_map", "copy"] },
      { name: "Tracking", field_type: "text", icon: "Hash", widgets: ["copy", "qr"] },
      { name: "Estado", field_type: "select", icon: "Activity", options: ["Pendiente", "En camino", "Entregado", "Devuelto"] },
      { name: "Foto entrega", field_type: "image", icon: "Camera" },
    ],
  },
];

export const findPresetByIntent = (description: string): FieldPreset | null => {
  const text = description.toLowerCase();
  let best: { preset: FieldPreset; score: number } | null = null;
  for (const p of FIELD_PRESETS) {
    const score = p.match_keywords.reduce((s, k) => s + (text.includes(k) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { preset: p, score };
  }
  return best?.preset ?? null;
};
