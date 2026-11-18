import { Home, Search, Bookmark, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/my-list", label: "My List", icon: Bookmark },
  { to: "/settings", label: "Profile", icon: UserRound },
];

export default function MobileTabBar() {
  return (
    <nav aria-label="Mobile navigation" className="mobile-tab-bar fixed inset-x-0 bottom-0 z-50 border-t border-line/80 bg-ink/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[11px] transition-colors ${isActive ? "font-bold text-volt" : "text-mist hover:text-white"}`}>
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
