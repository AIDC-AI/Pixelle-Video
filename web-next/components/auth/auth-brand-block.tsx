"use client";

import Link from "next/link";
import { Film } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/design/cn";

export function AuthBrandBlock({ className }: { className?: string }) {
  const tCommon = useTranslations("common");

  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex items-center gap-3 text-text-heading",
        className,
      )}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary-50 shadow-1 ring-1 ring-brand-primary-100 transition-all duration-200 group-hover:shadow-2 group-hover:ring-brand-primary-200">
        <Film className="h-5 w-5 text-brand-primary-700" aria-hidden />
      </div>
      <span className="text-title font-bold text-gradient">{tCommon("appName")}</span>
    </Link>
  );
}
