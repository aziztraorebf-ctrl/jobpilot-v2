"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Settings,
  Compass,
  LogOut,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  labelKey: "dashboard" | "jobs" | "applications" | "careerChat" | "settings";
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

function getNavItems(locale: string): NavItem[] {
  return [
    {
      labelKey: "dashboard",
      icon: LayoutDashboard,
      href: `/${locale}/dashboard`,
    },
    {
      labelKey: "jobs",
      icon: Briefcase,
      href: `/${locale}/jobs`,
    },
    {
      labelKey: "applications",
      icon: FileText,
      href: `/${locale}/applications`,
    },
    {
      labelKey: "careerChat",
      icon: MessageSquare,
      href: `/${locale}/career-chat`,
    },
    {
      labelKey: "settings",
      icon: Settings,
      href: `/${locale}/settings`,
    },
  ];
}

interface SidebarContentProps {
  onNavigate?: () => void;
  userName?: string;
  userEmail?: string;
  userInitials?: string;
}

export function SidebarContent({ onNavigate, userName, userEmail, userInitials }: SidebarContentProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const navItems = getNavItems(locale);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(`/${locale}/login`);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-6">
        <Compass className="size-7 text-primary" />
        <span className="text-xl font-bold tracking-tight">JobPilot</span>
      </div>

      <div className="mx-4 border-b" />

      {/* Navigation */}
      <nav className="flex-1 px-4 pt-6">
        <ul className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.labelKey}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="size-5" />
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User info + logout at bottom */}
      <div className="border-t px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {(userInitials ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{userName ?? ""}</span>
              <span className="text-xs text-muted-foreground truncate">
                {userEmail ?? ""}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="ml-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title={tAuth("logout")}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface AppSidebarProps {
  userName?: string;
  userEmail?: string;
  userInitials?: string;
}

export function AppSidebar({ userName, userEmail, userInitials }: AppSidebarProps) {
  return (
    <aside className="hidden w-64 flex-shrink-0 border-r bg-sidebar text-sidebar-foreground md:block">
      <SidebarContent userName={userName} userEmail={userEmail} userInitials={userInitials} />
    </aside>
  );
}
