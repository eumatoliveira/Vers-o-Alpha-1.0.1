export const BASE_CURRENCY = "BRL" as const;

export const SUPPORTED_CURRENCIES = [
  "BRL",
  "USD",
  "EUR",
  "ARS",
  "CLP",
  "COP",
  "MXN",
  "PEN",
  "UYU",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const SUPPORTED_CURRENCY_SET = new Set<SupportedCurrency>(SUPPORTED_CURRENCIES);

export const CURRENCY_LOCALE_MAP: Record<SupportedCurrency, string> = {
  BRL: "pt-BR",
  USD: "en-US",
  EUR: "de-DE",
  ARS: "es-AR",
  CLP: "es-CL",
  COP: "es-CO",
  MXN: "es-MX",
  PEN: "es-PE",
  UYU: "es-UY",
};

export function isSupportedCurrency(value: string | null | undefined): value is SupportedCurrency {
  return SUPPORTED_CURRENCY_SET.has((value ?? "").toUpperCase() as SupportedCurrency);
}
