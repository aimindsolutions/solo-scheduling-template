"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, Users, LayoutDashboard, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "firebase/auth";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/calendar", label: "Calendar", icon: Calendar },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ user }: { user: User | null }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      <div className="p-4">
        <h2 className="text-lg font-semibold">Admin Panel</h2>
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
            <Link key={item.href} href={item.href}>
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

      <div className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
