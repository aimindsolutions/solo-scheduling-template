import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function LandingPage() {
  const t = useTranslations();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">{t("common.appName")}</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-lg space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {t("landing.hero.title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("landing.hero.subtitle")}
          </p>
          <Link href="/book">
            <Button size="lg" className="text-lg px-8 py-6">
              {t("landing.hero.cta")}
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
