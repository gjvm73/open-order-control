const SHIP_TO_CITY_MAP: Record<string, string> = {
  "AVENIDA ASSIS BRASIL RS BR": "PORTO ALEGRE",
  "RUA ABEL SCUISSIATO PR BR": "COLOMBO",
  "R VIDAL PROCOPIO LOHN SC BR": "SÃO JOSÉ",
  "AV PREFEITO SINCLER SAMBATTI PR BR": "MARINGÁ",
  "RUA VALDEMIRO BELINSKI PARALELA A BR 282 SC BR": "CHAPECÓ",
};

function normalizeShipToKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Converte endereços de Ship To conhecidos em cidades canônicas para que
 * filtros, consolidações, alertas e índices estratégicos usem a mesma filial.
 * Valores não mapeados preservam o texto original apenas com espaços externos removidos.
 */
export function normalizeShipTo(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return SHIP_TO_CITY_MAP[normalizeShipToKey(trimmed)] ?? trimmed;
}

export function getShipToCityMap(): Readonly<Record<string, string>> {
  return SHIP_TO_CITY_MAP;
}

export function getShipToMapKey(value: unknown): string {
  return normalizeShipToKey(value);
}
