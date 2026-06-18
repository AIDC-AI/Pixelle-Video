// @ts-check
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Next.js config for the Pixelle-Video web client.
 *
 * The browser talks to the FastAPI backend directly. Set
 * `NEXT_PUBLIC_API_BASE_URL` (e.g. `http://localhost:8001` in dev or
 * the public origin in prod) so the axios client and the SSE
 * `EventSource` both know where to call. The `NEXT_PUBLIC_*` prefix
 * is required for the value to land in the client bundle.
 *
 * Locale routing strategy: we keep flat URLs (`/login`, `/signup`,
 * `/generate/standard`, etc.) and let next-intl pick the locale from
 * the `NEXT_LOCALE` cookie (set by the language switcher) or the
 * `Accept-Language` header. No `[locale]` segment and no middleware
 * redirect, so the existing routes don't need to move.
 */

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
