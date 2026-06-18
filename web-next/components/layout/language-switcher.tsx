"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * Language switcher — cycles the cookie used by next-intl. A real
 * release would persist the choice in a cookie and revalidate the
 * layout. This widget is opt-in (drop it into the sidebar).
 */
export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("nav");
  const [isPending, startTransition] = useTransition();

  const next = locale === "en" ? "zh" : "en";
  const label = next === "en" ? "English" : "中文";

  return (
    <Button
      variant="tertiary"
      size="sm"
      disabled={isPending}
      onClick={() => {
        document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
        startTransition(() => router.refresh());
      }}
      aria-label={t("language")}
    >
      {label}
    </Button>
  );
}
