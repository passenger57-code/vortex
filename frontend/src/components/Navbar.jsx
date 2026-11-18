import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Search, Settings2, X } from "lucide-react";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import { useModal } from "../lib/modal.jsx";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/series", label: "Series" },
  { to: "/movies", label: "Movies" },
  { to: "/anime", label: "Anime" },
  { to: "/browse-by", label: "Browse by" },
  { to: "/my-list", label: "My List" },
  { to: "/history", label: "History" },
];

function Avatar({ profile, size = 32 }) {
  return (
    <span className="grid shrink-0 place-items-center rounded font-display font-bold text-white"
      style={{ background: profile?.color || "#1f8bff", width: size, height: size }}>
      {(profile?.name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export default function Navbar() {
  const { profile, profiles, profileId, selectProfile, logout, user } = useAuth();
  const { open } = useModal();
  const nav = useNavigate();
  const loc = useLocation();
  const adminLink = user?.is_admin ? { to: "/admin", label: "Admin" } : null;
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(null);
  const [searching, setSearching] = useState(loc.pathname === "/search");
  const [q, setQ] = useState(new URLSearchParams(loc.search).get("q") || "");
  const [suggestions, setSuggestions] = useState([]);
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vortex_recent_searches") || "[]"); } catch { return []; }
  });
  const [searchFocused, setSearchFocused] = useState(false);
  const [newEpisodeCount, setNewEpisodeCount] = useState(0);
  const inputRef = useRef(null);
  const wrap = useRef(null);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const close = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setMenu(null); };
    const onKey = (e) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    setMenu(null);
    setSearching(loc.pathname === "/search");
    setQ(new URLSearchParams(loc.search).get("q") || "");
  }, [loc.pathname, loc.search]);
  useEffect(() => { if (searching) inputRef.current?.focus(); }, [searching]);

  useEffect(() => {
    if (!profileId) return;
    api.get("/me/notifications/new-episodes")
      .then((result) => setNewEpisodeCount(result.count || 0))
      .catch((error) => console.error("Could not load new episode notifications.", error));
  }, [profileId]);

  useEffect(() => {
    if (!searching || !searchFocused) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      const query = q.trim();
      api.get(`/titles?limit=5${query ? `&q=${encodeURIComponent(query)}` : ""}`)
        .then((items) => { if (active) setSuggestions(items); })
        .catch(() => { if (active) setSuggestions([]); });
    }, q.trim() ? 220 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [q, searching, searchFocused]);

  const rememberSearch = (value) => {
    const next = [value.trim(), ...recentSearches.filter((item) => item !== value.trim())].filter(Boolean).slice(0, 5);
    setRecentSearches(next);
    try { localStorage.setItem("vortex_recent_searches", JSON.stringify(next)); } catch { /* storage may be disabled */ }
  };

  const onSearch = (v) => {
    setQ(v);
    setSearchFocused(true);
    if (v.trim()) nav(`/search?q=${encodeURIComponent(v)}`, { replace: loc.pathname === "/search" });
    else if (loc.pathname === "/search") nav("/");
  };

  const linkClass = ({ isActive }) =>
    `relative py-2 transition-colors hover:text-white focus-visible:rounded-sm ${
      isActive
        ? "font-bold text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-volt"
        : "text-snow/70"
    }`;
  return (
    <nav ref={wrap} className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${solid || menu ? "border-line/60 bg-ink/95 backdrop-blur" : "border-transparent bg-gradient-to-b from-black/80 to-transparent"}`}>
      <div className="pad-x flex h-16 items-center gap-6">
        <Link to="/" aria-label="Vortex home" className="flex shrink-0 items-center gap-2">
          <img src="/logo-emblem.png" alt="" className="h-9 w-auto" />
          <img src="/logo-wordmark.png" alt="Vortex" className="hidden h-6 w-auto sm:block" />
        </Link>

        <div className="hidden items-center gap-5 text-sm md:flex">
          {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>)}
          {adminLink && <NavLink to={adminLink.to} className={linkClass}>{adminLink.label}</NavLink>}
        </div>

        <div className={`relative ml-auto flex items-center gap-2 md:gap-4 ${searching ? "max-md:absolute max-md:left-4 max-md:right-4 max-md:top-[4.25rem] max-md:z-40" : ""}`}>
          <div className={`flex min-w-0 items-center rounded-full border transition-all ${searching ? "w-full border-snow/70 bg-ink/95 pl-2 shadow-xl md:w-auto md:bg-ink/80 md:pl-3" : "border-transparent"}`}>
            <button type="button" aria-label={searching ? "Close search" : "Search"} aria-expanded={searching}
              onClick={() => {
                if (searching) {
                  setSearching(false);
                  setSearchFocused(false);
                  if (loc.pathname === "/search") nav("/");
                } else {
                  setSearching(true);
                  setSearchFocused(true);
                }
              }} className="rounded-full p-2 focus-visible:ring-2 focus-visible:ring-cyan-glow">
              <Search size={20} />
            </button>
            {searching && (
              <>
                <input ref={inputRef} value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Titles, genres, anime"
                  onFocus={() => setSearchFocused(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && q.trim()) {
                      rememberSearch(q);
                      setSearchFocused(false);
                    }
                    if (event.key === "Escape") setSearchFocused(false);
                  }}
                  aria-label="Search titles" className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-mist md:w-56" />
                {q && <button type="button" aria-label="Clear search" onClick={() => onSearch("")} className="p-2 text-mist hover:text-white"><X size={16} /></button>}
              </>
            )}
          </div>
          {searching && searchFocused && (
            <div className="absolute right-0 top-full z-[60] mt-2 max-h-[min(70vh,32rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-line bg-panel p-3 shadow-2xl">
              {!q.trim() && recentSearches.length > 0 && (
                <section className="mb-3">
                  <h2 className="px-2 pb-1 text-xs font-bold uppercase tracking-wider text-mist">Recent searches</h2>
                  {recentSearches.map((item) => <button key={item} type="button" onClick={() => { onSearch(item); rememberSearch(item); }}
                    className="block w-full rounded-md px-2 py-2 text-left text-sm text-snow hover:bg-raised">{item}</button>)}
                </section>
              )}
              <h2 className="px-2 pb-1 text-xs font-bold uppercase tracking-wider text-mist">{q.trim() ? "Results" : "Trending"}</h2>
              {suggestions.map((item) => (
                <button key={item.id} type="button" onClick={() => { setSearchFocused(false); open(item.id); }}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-raised">
                  <img src={item.poster_url || item.backdrop_url} alt="" className="h-14 w-10 rounded object-cover" loading="lazy" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-white">{item.title}</span>
                    <span className="block text-xs capitalize text-mist">{item.type}{item.year ? ` · ${item.year}` : ""}</span>
                  </span>
                </button>
              ))}
              {q.trim() && !suggestions.length && <p className="px-2 py-3 text-sm text-mist">No matching titles yet.</p>}
            </div>
          )}

          <div className="relative">
            <button type="button" onClick={() => setMenu(menu === "profile" ? null : "profile")}
              className="relative flex items-center gap-1 rounded focus-visible:ring-2 focus-visible:ring-cyan-glow" aria-label={`Profile menu${newEpisodeCount ? `, ${newEpisodeCount} new episodes` : ""}`} aria-expanded={menu === "profile"} aria-controls="profile-menu">
              <Avatar profile={profile} />
              <ChevronDown size={16} className={`transition-transform ${menu === "profile" ? "rotate-180" : ""}`} />
              {newEpisodeCount > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-volt px-1 text-[10px] font-bold text-white">{newEpisodeCount}</span>}
            </button>
            {menu === "profile" && (
              <div id="profile-menu" className="absolute right-0 top-11 z-50 max-h-[calc(100vh-5rem)] w-[min(14rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-line bg-panel py-2 shadow-xl">
                {newEpisodeCount > 0 && <p role="status" className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-volt"><Bell size={14} /> {newEpisodeCount} new episodes this visit</p>}
                {profiles.filter((p) => p.id !== profile?.id).map((p) => (
                  <button key={p.id} type="button" onClick={() => { selectProfile(p.id); nav("/"); }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-raised">
                    <Avatar profile={p} size={26} /> {p.name}
                  </button>
                ))}
                <Link to="/profiles" className="block border-t border-line px-4 py-2 text-sm hover:bg-raised">Manage profiles</Link>
                <Link to="/browse-by" className="block px-4 py-2 text-sm hover:bg-raised">Browse by genre, year, or studio</Link>
                <Link to="/history" className="block px-4 py-2 text-sm hover:bg-raised">Watch history</Link>
                <Link to="/settings" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-raised"><Settings2 size={15} /> Settings</Link>
                {adminLink && <Link to={adminLink.to} className="block px-4 py-2 text-sm hover:bg-raised">Admin dashboard</Link>}
                <button type="button" onClick={() => { logout(); nav("/auth"); }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-raised">
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export { Avatar };
