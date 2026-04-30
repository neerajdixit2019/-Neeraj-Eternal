import React from "react";
import { Home, Sparkles, UserRound, Wind } from "lucide-react";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Today", href: "/today", icon: Sparkles },
  { label: "Calm", href: "/calm", icon: Wind },
  { label: "Me", href: "/me", icon: UserRound }
];

export function AppBottomNav({ currentPath = "/", onNavigate }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/82 px-3 py-2 shadow-[0_-12px_38px_rgba(88,82,120,0.12)] backdrop-blur-xl sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.href || (item.href !== "/" && currentPath.startsWith(item.href));
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={(event) => {
                if (!onNavigate) return;
                event.preventDefault();
                onNavigate(item.href);
              }}
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
