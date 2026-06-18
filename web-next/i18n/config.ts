/**
 * next-intl — locale configuration. The Next.js app uses the App
 * Router, so locales are loaded on demand by `i18n/request.ts`.
 */

export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
