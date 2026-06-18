import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { isLocale, defaultLocale } from "./config";

/**
 * next-intl request config. The locale is sourced from:
 *
 * 1. `requestLocale` — populated by next-intl middleware when present.
 * 2. The `NEXT_LOCALE` cookie — set by the language switcher.
 * 3. The `Accept-Language` request header.
 * 4. The configured `defaultLocale` ("en") as a final fallback.
 *
 * No `[locale]` segment is used, so step 1 is usually `undefined`.
 * We still try it first for forward compatibility with deployments
 * that add a middleware later.
 */
async function pickLocale(requested: string | undefined): Promise<string> {
  if (requested && isLocale(requested)) return requested;

  // Next.js 15 turns `cookies()` and `headers()` into async functions
  // and warns if the value is consumed without `await`. We try each in
  // turn; failures (e.g. outside a request scope) fall through to the
  // next option.
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
    if (cookieLocale && isLocale(cookieLocale)) return cookieLocale;
  } catch {
    // cookies() may not be available; ignore.
  }

  try {
    const headerStore = await headers();
    const accept = headerStore.get("accept-language") ?? "";
    const preferred = accept
      .split(",")
      .map((part: string) => part.split(";")[0].trim().toLowerCase())
      .find((tag: string) => isLocale(tag.split("-")[0]));
    if (preferred) {
      const short = preferred.split("-")[0];
      if (isLocale(short)) return short;
    }
  } catch {
    // headers() may not be available; ignore.
  }

  return defaultLocale;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = await pickLocale(requested ?? undefined);

  let messages: Record<string, unknown> = {};
  try {
    messages = (await import(`../messages/${locale}.json`)).default;
  } catch {
    notFound();
  }

  // next-intl expects an `AbstractIntlMessages` (a tree of strings,
  // arrays, and nested messages). We validated the JSON shape at build
  // time so the cast here is safe.
  return { locale, messages: messages as never };
});
