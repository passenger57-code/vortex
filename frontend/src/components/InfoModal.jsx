import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Play, Plus, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { api } from "../lib/api";
import { useList } from "../lib/list.jsx";
import { epCode, metaLine, typeLabel } from "../lib/format.js";
import Art from "./Art.jsx";

function sampleArtworkColor(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, 1, 1);
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        resolve(`rgb(${red}, ${green}, ${blue})`);
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export default function InfoModal({ titleId, onClose }) {
  const [t, setT] = useState(null);
  const [pg, setPg] = useState(null);
  const [season, setSeason] = useState(1);
  const [rating, setRating] = useState(0);
  const [recommendations, setRecommendations] = useState([]);
  const [themeColor, setThemeColor] = useState("");
  const dialogRef = useRef(null);
  const nav = useNavigate();
  const list = useList();

  useEffect(() => {
    setT(null); setPg(null); setRating(0); setRecommendations([]);
    if (!titleId) return;
    let off = false;
    Promise.all([api.get(`/titles/${titleId}`), api.get(`/me/progress/${titleId}`).catch(() => null)])
      .then(([d, p]) => {
        if (off) return;
        setT(d); setPg(p);
        const cur = d.episodes?.find((e) => e.id === p?.episode_id);
        setSeason(cur?.season ?? d.episodes?.[0]?.season ?? 1);
      })
      .catch(() => !off && onClose());
    Promise.all([api.get(`/me/ratings/${titleId}`), api.get(`/me/recommendations/${titleId}`)])
      .then(([score, items]) => { if (!off) { setRating(score.rating); setRecommendations(items); } })
      .catch((error) => console.error("Could not load title recommendations.", error));
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleId]);

  useEffect(() => {
    let active = true;
    setThemeColor(t?.theme_color || "");
    if (t && !t.theme_color) {
      sampleArtworkColor(t.backdrop_url || t.poster_url).then((color) => { if (active && color) setThemeColor(color); });
    }
    return () => { active = false; };
  }, [t?.id, t?.theme_color, t?.backdrop_url, t?.poster_url]);

  useEffect(() => {
    if (!titleId) return;
    const previousFocus = document.activeElement;
    const focusable = () => [...(dialogRef.current?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
    focusable()[0]?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault();
        items.at(-1).focus();
      } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
        e.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      previousFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleId]);

  const seasons = useMemo(() => [...new Set((t?.episodes || []).map((e) => e.season))], [t]);
  const episodes = (t?.episodes || []).filter((e) => e.season === season);
  const resumeEp = t?.episodes?.find((e) => e.id === pg?.episode_id);
  const resuming = pg && pg.position > 5;
  const play = (epId) => { onClose(); nav(`/watch/${t.id}${epId ? `?ep=${epId}` : ""}`); };
  const rate = async (value) => {
    try {
      const result = await api.put(`/me/ratings/${t.id}`, { rating: rating === value ? 0 : value });
      setRating(result.rating);
    } catch (error) {
      console.error("Could not save title feedback.", error);
    }
  };

  return (
    <AnimatePresence>
      {titleId && (
        <motion.div key="overlay" className="fixed inset-0 z-[60] overflow-y-auto bg-black/75 px-3 py-8 sm:py-12"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t?.title || "Title details"}
            className="dialog-panel mx-auto w-full max-w-3xl overflow-hidden ring-1 ring-line"
            initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}>
            <div className="relative aspect-video w-full">
              {t ? <Art title={t.title} src={t.backdrop_url || t.poster_url} /> : <div className="h-full w-full animate-pulse bg-raised" />}
              <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/20 to-transparent" style={themeColor ? { backgroundImage: `linear-gradient(to top, var(--panel, #09111d), ${themeColor}55 60%, transparent)` } : undefined} />
              <button type="button" onClick={onClose} aria-label="Close"
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ink/80 hover:bg-ink"><X size={18} /></button>
              {t && (
                <div className="absolute bottom-4 left-5 right-5 sm:left-8 sm:right-8">
                  <h2 className="font-display text-3xl font-extrabold italic leading-none drop-shadow sm:text-5xl">{t.title}</h2>
                  <div className="mt-4 flex items-center gap-3">
                    <button type="button" onClick={() => play(resuming ? pg.episode_id : null)}
                      className="flex items-center gap-2 rounded-md bg-snow px-5 py-2 font-bold text-ink hover:bg-white/80">
                      <Play size={18} fill="currentColor" />
                      {resuming ? `Resume${resumeEp ? ` ${epCode(resumeEp)}` : ""}` : "Play"}
                    </button>
                    <button type="button" onClick={() => list.toggle(t.id)}
                      aria-label={list.has(t.id) ? "Remove from My List" : "Add to My List"} title={list.has(t.id) ? "Remove from My List" : "Add to My List"}
                      className="grid h-10 w-10 place-items-center rounded-full border-2 border-mist bg-ink/60 hover:border-snow">
                      {list.has(t.id) ? <Check size={18} /> : <Plus size={18} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {t && (
              <div className="px-5 pb-6 pt-2 sm:px-8">
                <div className="grid gap-6 sm:grid-cols-[1fr_12rem]">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-snow/80">
                      <span className="status-badge bg-volt text-white">{typeLabel[t.type]}</span>
                      {t.type !== "movie" && t.airing_status && <span className="status-badge border border-line bg-raised text-snow">{t.airing_status}</span>}
                      {t.type === "anime" && t.audio_mode && <span className="status-badge border border-line bg-raised text-snow">{t.audio_mode === "both" ? "Sub · Dub" : t.audio_mode}</span>}
                      <span className="rounded border border-mist/60 px-1.5 text-xs">{t.maturity}</span>
                      {t.year && <span>{t.year}</span>}
                      <span>{metaLine(t)}</span>
                    </div>
                    <p className="leading-relaxed text-snow/90">{t.description}</p>
                  </div>
                  <p className="text-sm text-mist"><span className="block text-snow/60">Genres</span>{t.genres.join(", ")}</p>
                </div>
                {!!t.cast?.length && <p className="mt-4 text-sm text-mist"><span className="mr-2 text-snow/60">Cast / staff</span>{t.cast.join(", ")}</p>}
                <div className="mt-5 flex items-center gap-2" aria-label="Rate this title">
                  <span className="mr-2 text-sm text-mist">Your take</span>
                  <button type="button" onClick={() => rate(1)} aria-label="Like this title" aria-pressed={rating === 1}
                    className={`grid h-10 w-10 place-items-center rounded-full border ${rating === 1 ? "border-volt bg-volt/20 text-volt" : "border-line text-mist hover:text-white"}`}><ThumbsUp size={18} /></button>
                  <button type="button" onClick={() => rate(-1)} aria-label="Dislike this title" aria-pressed={rating === -1}
                    className={`grid h-10 w-10 place-items-center rounded-full border ${rating === -1 ? "border-volt bg-volt/20 text-volt" : "border-line text-mist hover:text-white"}`}><ThumbsDown size={18} /></button>
                </div>

                {!!recommendations.length && (
                  <section className="mt-7" aria-labelledby="more-like-this-title">
                    <h3 id="more-like-this-title" className="mb-3 font-display text-xl font-bold">More like this</h3>
                    <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
                      {recommendations.slice(0, 6).map((item) => (
                        <button key={item.id} type="button" onClick={() => { onClose(); nav(`/watch/${item.id}`); }}
                          className="w-24 shrink-0 text-left sm:w-28">
                          <span className="block aspect-[2/3] overflow-hidden rounded-md"><Art title={item.title} src={item.poster_url || item.backdrop_url} /></span>
                          <span className="mt-1 block truncate text-xs font-semibold">{item.title}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {t.type !== "movie" && (
                  <div className="mt-8">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-display text-xl font-bold">Episodes</h3>
                      {seasons.length > 1 && (
                        <select value={season} onChange={(e) => setSeason(Number(e.target.value))} aria-label="Season"
                          className="rounded-md border border-line bg-raised px-3 py-1.5 text-sm">
                          {seasons.map((s) => <option key={s} value={s}>Season {s}</option>)}
                        </select>
                      )}
                    </div>
                    {!episodes.length && <p className="text-sm text-mist">No episodes have been added yet.</p>}
                    <ul className="divide-y divide-line">
                      {episodes.map((e) => (
                        <li key={e.id}>
                          <button type="button" onClick={() => play(e.id)}
                            className={`flex w-full items-center gap-4 rounded-md px-2 py-3 text-left transition-colors hover:bg-raised ${e.id === pg?.episode_id ? "bg-raised/60" : ""}`}>
                            <span className="w-6 shrink-0 text-center font-display text-lg text-mist">{e.number}</span>
                            <span className="relative hidden aspect-video w-32 shrink-0 overflow-hidden rounded sm:block">
                              <Art title={`${t.title} ${e.name}`} src={e.thumbnail_url || undefined} />
                              <span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity hover:opacity-100"><Play fill="currentColor" size={22} /></span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex justify-between gap-3 font-bold">
                                <span className="flex min-w-0 items-center gap-2 truncate">{e.name}{e.is_new && <span className="status-badge shrink-0 bg-volt/20 text-volt">New</span>}{(e.audio_mode || t.audio_mode) && <span className="status-badge shrink-0 border border-line text-mist">{(e.audio_mode || t.audio_mode) === "both" ? "Sub · Dub" : (e.audio_mode || t.audio_mode)}</span>}</span>
                                {e.duration && <span className="shrink-0 text-sm font-normal text-mist">{e.duration}m</span>}
                              </span>
                              <span className="mt-1 line-clamp-2 block text-sm text-mist">{e.description}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {t.attribution && <p className="mt-5 text-xs text-mist">{t.attribution}</p>}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
