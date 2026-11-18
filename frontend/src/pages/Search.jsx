import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import TitleCard from "../components/TitleCard.jsx";

export default function Search() {
  const [params] = useSearchParams();
  const q = (params.get("q") || "").trim();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [genre, setGenre] = useState("all");
  const [year, setYear] = useState("all");
  const [type, setType] = useState("all");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    if (!q) {
      setItems([]);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    const h = setTimeout(() => {
      const typeFilter = type === "all" ? "" : `&type=${encodeURIComponent(type)}`;
      api.get(`/titles?q=${encodeURIComponent(q)}&limit=100${typeFilter}`)
        .then((data) => { if (active) setItems(data); })
        .catch((err) => { if (active) setError(err.message); })
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(h); };
  }, [q, type, retry]);

  const genres = useMemo(() => {
    const set = new Set();
    for (const item of items || []) for (const g of item.genres || []) set.add(g);
    return [...set].sort();
  }, [items]);

  const years = useMemo(() => {
    const set = new Set();
    for (const item of items || []) if (item.year) set.add(String(item.year));
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [items]);

  const visibleItems = useMemo(() => {
    if (!items) return items;
    return items.filter((item) => {
      const matchesGenre = genre === "all" || (item.genres || []).includes(genre);
      const matchesYear = year === "all" || Number(item.year) === Number(year);
      return matchesGenre && matchesYear;
    });
  }, [items, genre, year, type]);

  return (
    <main className="pad-x pb-20 pt-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-volt">Search</p>
          <h1 className="mt-1 break-words font-display text-2xl font-bold sm:text-3xl">{q ? `Results for "${q}"` : "Find your next favorite"}</h1>
        </div>
        {q && items && !loading && !error && <p className="text-sm text-mist">{visibleItems.length} shown</p>}
      </div>

      {items && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by content type">
            {[["all", "All"], ["movie", "Movies"], ["series", "Series"], ["anime", "Anime"]].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)}
                className={`min-h-10 rounded-full border px-4 text-sm transition-colors ${type === value ? "border-volt bg-volt/15 text-white" : "border-line bg-panel text-mist hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-mist">
            <span>Genre</span>
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className="bg-transparent text-snow outline-none">
              <option value="all">All</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-mist">
            <span>Year</span>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-transparent text-snow outline-none">
              <option value="all">All</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          {(genre !== "all" || year !== "all" || type !== "all") && (
            <button type="button" onClick={() => { setGenre("all"); setYear("all"); setType("all"); }} className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-snow hover:border-volt/60">
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && (
        <div aria-label="Loading search results" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="aspect-video animate-pulse rounded-md bg-panel" />)}
        </div>
      )}
      {error && (
        <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="rounded-md border border-red-300/50 px-3 py-1.5 font-bold hover:bg-red-400/10">Retry search</button>
        </div>
      )}
      {!loading && !error && visibleItems && !visibleItems.length && (
        <div className="mt-6 max-w-xl rounded-xl border border-line bg-panel p-6 text-mist">
          <h2 className="font-display text-lg font-bold text-white">{q ? "No matching titles" : "Search movies, series and anime"}</h2>
          <p className="mt-2">{q ? "Try a shorter title, another genre, or clear the filters." : "Use the search field in the navigation bar to get started."}</p>
          {q && <Link to="/" className="mt-4 inline-flex min-h-10 items-center rounded-md bg-volt px-4 font-bold text-white hover:bg-volt-400">Browse titles</Link>}
        </div>
      )}
      {!loading && !error && visibleItems?.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-x-2 gap-y-16 pb-24 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleItems.map((t) => <TitleCard key={t.id} t={t} grid />)}
        </div>
      )}
    </main>
  );
}
