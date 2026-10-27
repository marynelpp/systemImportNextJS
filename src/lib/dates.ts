/** Formatos únicos de fecha para la interfaz de la importadora. */
const CARACAS_TIME_ZONE = "America/Caracas";

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

/** Eventos almacenados en UTC, presentados en la hora local de Venezuela. */
export function formatVenezuelanDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short", timeZone: CARACAS_TIME_ZONE }).format(asDate(value));
}

/** Campos SQL DATE: conserva el día operativo registrado, en formato venezolano. */
export function formatVenezuelanDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-VE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(asDate(value));
}

/** Fecha de hoy en Caracas, lista para un input HTML de tipo date. */
export function venezuelanToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CARACAS_TIME_ZONE }).format(new Date());
}

export const VENEZUELA_TIME_ZONE = CARACAS_TIME_ZONE;
