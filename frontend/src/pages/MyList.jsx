import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useList } from "../lib/list.jsx";
import TitleCard from "../components/TitleCard.jsx";

export default function MyList() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("recent");
  const [retry, setRetry] = useState(0);
  const list = useList();
  useEffect(() => {
    let active = true;
    setItems(null);
    setError("");
    api.get("/me/list")
      .then((data) => { if (active) setItems(data); })
      .catch((err) => { if (active) setError(err.message); })
    return () => { active = false; };
  }, [list.version, retry]);

  const sortedItems = useMemo(() => {
    if (!items) return items;
    return sort === "title" ? [...items].sort((a, b) => a.title.localeCompare(b.title)) : items;
  }, [items, sort]);

  return (
    <main className="pad-x pb-20 pt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-volt">Your library</p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">My List</h1>
          <p className="mt-2 text-sm text-mist">Titles you’ve saved to watch later.</p>
        </div>
        {items?.length > 1 && (
          <label className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-mist">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent text-snow outline-none">
              <option value="recent">Recently added</option>
              <option value="title">A–Z</option>
            </select>
          </label>
        )}
      </div>
      {items === null && !error && (
        <div aria-label="Loading your list" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-video animate-pulse rounded-md bg-panel" />)}
        </div>
      )}
      {error && (
        <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="rounded-md border border-red-300/50 px-3 py-1.5 font-bold hover:bg-red-400/10">Retry</button>
        </div>
      )}
      {items?.length === 0 && !error && (
        <div className="mt-8 rounded-xl border border-line bg-panel p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.18em] text-volt">A little space for your next favorite</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-white">Your list is empty</h2>
          <p className="mt-2 max-w-md text-mist">Save movies, series and anime with the plus button on a title card.</p>
          <Link to="/" className="btn-primary mt-5">Browse titles</Link>
        </div>
      )}
      {sortedItems?.length > 0 && !error && (
        <div className="mt-8 grid grid-cols-2 gap-x-2 gap-y-16 pb-24 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sortedItems.map((t) => <TitleCard key={t.id} t={t} grid />)}
        </div>
      )}
    </main>
  );
}
