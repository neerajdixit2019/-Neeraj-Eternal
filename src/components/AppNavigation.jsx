import React from "react";
import { BookOpen, Compass, Home, Sparkles, UserRound, Wind } from "lucide-react";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Today", href: "/today", icon: Sparkles },
  { label: "Calm", href: "/calm", icon: Wind },
  { label: "Compass", href: "/compass", icon: Compass },
  { label: "Me", href: "/me", icon: UserRound }
];

const topNavItems = [
  { label: "Start", href: "/welcome", icon: Compass },
  { label: "Today", href: "/today", icon: Sparkles },
  { label: "Calm", href: "/calm", icon: Wind },
  { label: "Compass", href: "/compass", icon: Compass },
  { label: "Journeys", href: "/journeys", icon: BookOpen },
  { label: "Me", href: "/me", icon: UserRound }
];

function isActiveRoute(currentPath, href) {
  return currentPath === href || (href !== "/" && currentPath.startsWith(href));
}

function handleNavigate(event, href, onNavigate) {
  if (!onNavigate) return;
  event.preventDefault();
  onNavigate(href);
}

export function AppTopNav({ currentPath = "/", onNavigate }) {
  return (
    <header className="sticky top-3 z-20 mb-5 hidden rounded-[1.4rem] border border-white/70 bg-white/72 px-3 py-3 shadow-[0_16px_42px_rgba(88,82,120,0.10)] backdrop-blur-xl sm:block">
      <div className="flex items-center justify-between gap-3">
        <a
          href="/"
          onClick={(event) => handleNavigate(event, "/", onNavigate)}
          className="flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1 transition hover:bg-white/65"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">NE</span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-slate-950">Neeraj Eternal</span>
            <span className="block truncate text-xs font-medium text-slate-500">Local-first emotional sanctuary</span>
          </span>
        </a>

        <nav className="flex items-center gap-1">
          {topNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActiveRoute(currentPath, item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={(event) => handleNavigate(event, item.href, onNavigate)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-2xl px-3 text-sm font-semibold transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                }`}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={2.2} />
                <span className="hidden lg:inline">{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function AppBottomNav({ currentPath = "/", onNavigate }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/82 px-3 py-2 shadow-[0_-12px_38px_rgba(88,82,120,0.12)] backdrop-blur-xl sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(currentPath, item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={(event) => handleNavigate(event, item.href, onNavigate)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold transition ${
                active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={2.2} />
              <span className="mt-1">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
