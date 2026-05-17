"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, Users, LayoutDashboard, Settings, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import type { User } from "firebase/auth";
import { useAdminLang } from "@/lib/admin-i18n";

export function AdminSidebar({ user }: { user: User | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t, locale, setLocale } = useAdminLang();

  const navItems = [
    { href: "/admin", label: t.dashboard, icon: LayoutDashboard },
    { href: "/admin/calendar", label: t.calendar, icon: Calendar },
    { href: "/admin/clients", label: t.clients, icon: Users },
    { href: "/admin/settings", label: t.settings, icon: Settings },
  ];

  const nav = (
    <>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t.adminPanel}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {user && (
          <p className="text-xs text-muted-foreground truncate mt-1">
            {user.email}
          </p>
        )}
      </div>

      <Separator />

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn("w-full justify-start gap-2")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="p-2 space-y-1">
        <div className="flex items-center gap-2 px-3 py-1">
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">{t.theme}</span>
        </div>
        <div className="flex items-center gap-1 px-3 py-1">
          <Button
            variant={locale === "uk" ? "default" : "ghost"}
            size="sm"
            className="text-xs px-2 py-1 h-7"
            onClick={() => setLocale("uk")}
          >
            UA
          </Button>
          <Button
            variant={locale === "en" ? "default" : "ghost"}
            size="sm"
            className="text-xs px-2 py-1 h-7"
            onClick={() => setLocale("en")}
          >
            EN
          </Button>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          {t.signOut}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b bg-card">
        <h2 className="text-lg font-semibold">{t.admin}</h2>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile slide-out drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card flex flex-col transition-transform duration-200 md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {nav}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r bg-card flex-col">
        {nav}
      </aside>
    </>
  );
}
