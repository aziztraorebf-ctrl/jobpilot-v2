"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/app-sidebar";
import { useState } from "react";

interface AppHeaderProps {
  userName?: string;
  userEmail?: string;
  userInitials?: string;
}

export function AppHeader({ userName, userEmail, userInitials }: AppHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="flex h-12 items-center justify-between border-b px-4 shrink-0">
      {/* Mobile hamburger - hidden on desktop */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </Button>

      {/* Spacer for desktop (hamburger hidden, pushes toggle to right) */}
      <div className="hidden md:block" />

      <ThemeToggle />

      {/* Mobile Sheet sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            onNavigate={() => setMobileMenuOpen(false)}
            userName={userName}
            userEmail={userEmail}
            userInitials={userInitials}
          />
        </SheetContent>
      </Sheet>
    </header>
  );
}
