import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useList } from "../lib/list.jsx";
import Billboard from "../components/Billboard.jsx";
import Row from "../components/Row.jsx";

export default function Browse({ type }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [genre, setGenre] = useState("all");
  const [year, setYear] = useState("all");
  const [retry, setRetry] = useState(0);
  const list = useList();

  useEffect(() => {
    let active = true;
    setRows(null);
    setError("");
    const q = type ? `?type=${type}` : "";
    Promise.all([api.get(`/browse${q}`), api.get("/me/continue").catch(() => []), api.get("/me/list").catch(() => [])])
      .then(([browse, cont, mine]) => {
        const f = (a) => (type ? a.filter((t) => t.type === type) : a);
        const top = [
          { key: "continue", label: "Continue watching", items: f(cont) },
          { key: "mylist", label: "My List", items: f(mine) },
        ];
        if (active) setRows([...top, ...browse]);
      })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [type, list.version, retry]);

  const allTitles = useMemo(() => (rows || []).flatMap((row) => row.items), [rows]);
  const genres = useMemo(() => {
    const set = new Set();
    for (const item of allTitles) {
      for (const g of item.genres || []) set.add(g);
    }
    return [...set].sort();
  }, [allTitles]);
  const years = useMemo(() => {
    const set = new Set();
    for (const item of allTitles) {
      if (item.year) set.add(String(item.year));
    }
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [allTitles]);

  const filteredRows = useMemo(() => {
    if (!rows) return rows;
    return rows.map((row) => ({
      ...row,
      items: row.items.filter((item) => {
        const matchesGenre = genre === "all" || (item.genres || []).includes(genre);
        const matchesYear = year === "all" || Number(item.year) === Number(year);
        return matchesGenre && matchesYear;
      }),
    }));
  }, [rows, genre, year]);

  return (
    <>
      <Billboard type={type} />
      <div className="relative z-10 -mt-28 space-y-7 pb-16 sm:space-y-9">
        <div className="pad-x mb-4 flex flex-wrap gap-3 pt-4">
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
          {(genre !== "all" || year !== "all") && (
            <button type="button" onClick={() => { setGenre("all"); setYear("all"); }} className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-snow hover:border-brand/60">
              Clear filters
            </button>
          )}
        </div>

        {error && (
          <div className="pad-x flex flex-wrap items-center gap-3 text-red-300" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="btn-secondary min-h-10 border-red-300/50 px-3 text-sm text-red-100 hover:bg-red-400/10">Retry</button>
          </div>
        )}
        {!filteredRows && !error && (
          <div className="pad-x space-y-7" aria-label="Loading titles">
            {[0, 1].map((row) => (
              <section key={row}>
                <div className="skeleton-block mb-3 h-6 w-40 bg-panel" />
                <div className="flex gap-2 overflow-hidden">
                  {[0, 1, 2, 3].map((card) => <div key={card} className="skeleton-block aspect-video w-[44vw] shrink-0 bg-panel sm:w-[250px]" />)}
                </div>
              </section>
            ))}
          </div>
        )}
        {filteredRows && filteredRows.every((r) => !r.items.length) && (
          <div className="pad-x rounded-xl border border-line bg-panel p-6 text-mist">
            <h2 className="font-display text-lg font-bold text-white">Your library is empty</h2>
            <p className="mt-2">Add movies, series or anime from the admin dashboard to see them here.</p>
          </div>
        )}
        {filteredRows?.map((r) => <Row key={r.key} label={r.label} items={r.items} ranking={r.key === "top-10"} continueWatching={r.key === "continue"} />)}
      </div>
    </>
  );
}
