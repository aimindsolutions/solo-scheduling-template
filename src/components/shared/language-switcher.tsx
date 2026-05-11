"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";

const localeLabels: Record<Locale, string> = {
  uk: "UA",
  en: "EN",
};

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  function handleSwitch(locale: Locale) {
    router.replace(pathname, { locale });
  }

  return (
    <div className="flex gap-1">
      {locales.map((locale) => (
        <Button
          key={locale}
          variant={locale === currentLocale ? "default" : "ghost"}
          size="sm"
          onClick={() => handleSwitch(locale)}
          className="text-xs px-2 py-1 h-7"
        >
          {localeLabels[locale]}
        </Button>
      ))}
    </div>
  );
}
