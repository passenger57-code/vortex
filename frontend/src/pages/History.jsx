import { useEffect, useState } from "react";
import { Clock3, Sparkles, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { epCode } from "../lib/format.js";
import Art from "../components/Art.jsx";

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get("/me/progress");
      setItems(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const removeItem = async (titleId) => {
    try {
      await api.del(`/me/progress/${titleId}`);
      setItems((current) => current.filter((item) => item.id !== titleId));
    } catch (err) {
      setError(err.message);
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Clear your entire watch history?")) return;
    try {
      await api.del("/me/progress");
      setItems([]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="pad-x pb-20 pt-28">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-volt">Library</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Watch history</h1>
        </div>
        {items.length > 0 && (
          <button type="button" onClick={clearAll} className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:border-red-400">
            Clear all
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          <p>{error}</p>
          <button type="button" onClick={load} className="rounded-md border border-red-300/50 px-3 py-1.5 font-bold hover:bg-red-400/10">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-panel" />)}
        </div>
      ) : error ? null : !items.length ? (
        <div className="rounded-xl border border-line bg-panel p-6 text-mist">
          <div className="mb-3 flex items-center gap-2 text-white"><Clock3 size={18} /> No watch history yet.</div>
          <p>Start watching a title to build up your history here.</p>
          <Link to="/" className="mt-4 inline-block rounded-md bg-volt px-4 py-2 font-medium text-white">Browse titles</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const progress = Math.round((item.progress?.percent || 0) * 100);
            const episode = item.progress?.episode;
            return (
              <article key={item.id} className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 md:flex-row md:items-center">
                <div className="h-28 w-24 shrink-0 overflow-hidden rounded-lg"><Art title={item.title} src={item.poster_url || item.backdrop_url} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{item.title}</h2>
                      <p className="text-sm text-mist">
                        {item.type === "movie" ? "Movie" : `${item.type[0].toUpperCase()}${item.type.slice(1)}`} · {item.year || "—"}
                      </p>
                      {episode && <p className="text-sm text-snow/80">{epCode(episode)} · {episode.name}</p>}
                    </div>
                    <button type="button" onClick={() => removeItem(item.id)} className="inline-flex items-center gap-1 self-start rounded-md border border-line bg-raised px-2 py-1 text-xs text-red-200 hover:border-red-400">
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                  <div role="progressbar" aria-label={`${progress}% watched`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
                    <div className="h-full rounded-full bg-volt" style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-mist">
                    <span>{progress}% watched</span>
                    {episode ? <span>{episode.season}x{episode.number}</span> : <Sparkles size={14} />}
                  </div>
                </div>
                <Link to={`/watch/${item.id}`} className="rounded-md bg-volt px-4 py-2 text-center text-sm font-medium text-white hover:bg-volt/90">
                  Resume
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
