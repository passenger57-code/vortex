import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Info, Play } from "lucide-react";
import { api } from "../lib/api";
import Art from "./Art.jsx";
import { useModal } from "../lib/modal.jsx";
import { metaLine, typeLabel } from "../lib/format.js";
import TrailerPreview from "./TrailerPreview.jsx";

export default function Billboard({ type }) {
  const [titles, setTitles] = useState([]);
  const [active, setActive] = useState(0);
  const [failure, setFailure] = useState("");
  const [retry, setRetry] = useState(0);
  const [previewActive, setPreviewActive] = useState(false);
  const nav = useNavigate();
  const { open } = useModal();

  useEffect(() => {
    let active = true;
    setTitles([]);
    setActive(0);
    setFailure("");
    api.get(`/titles/featured/carousel${type ? `?type=${type}` : ""}`)
      .then((data) => { if (active) setTitles(data); })
      .catch((err) => { if (active) setFailure(err.message); });
    return () => { active = false; };
  }, [type, retry]);

  useEffect(() => {
    if (titles.length < 2) return undefined;
    const timer = setInterval(() => setActive((index) => (index + 1) % titles.length), 8000);
    return () => clearInterval(timer);
  }, [titles.length]);

  const t = titles[active];
  if (!t && !failure) return (
    <div role="status" aria-label="Loading featured title" className="h-[min(72vh,48rem)] min-h-[26rem] animate-pulse bg-panel">
      <div className="pad-x flex h-full max-w-2xl flex-col justify-end pb-[18vh]">
        <div className="h-4 w-40 rounded bg-raised" />
        <div className="mt-4 h-12 w-3/4 rounded bg-raised" />
        <div className="mt-4 h-16 max-w-xl rounded bg-raised" />
        <div className="mt-6 h-11 w-48 rounded bg-raised" />
      </div>
    </div>
  );
  if (!t || failure) {
    const noTitles = failure.toLowerCase().includes("no titles");
    return (
    <div className="pad-x flex min-h-72 items-end bg-gradient-to-r from-panel to-ink pb-12 pt-28 sm:min-h-96">
      <div className="max-w-xl">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-volt">{failure && !noTitles ? "Unable to load featured title" : "Welcome to Vortex"}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">{noTitles ? "Your library is ready." : failure ? "Your library is still here." : "Find your next favorite."}</h1>
        <p className="mt-3 text-snow/80">{noTitles ? "Add movies, series or anime to start building your library." : failure ? "Check your connection and try loading the featured title again." : "Browse movies, series and anime from your library below."}</p>
        {failure && !noTitles && <button type="button" onClick={() => setRetry((value) => value + 1)} className="btn-primary mt-5">Retry</button>}
      </div>
    </div>
    );
  }

  return (
    <header onMouseEnter={() => setPreviewActive(true)} onMouseLeave={() => setPreviewActive(false)}
      className="relative h-[min(78vh,52rem)] min-h-[30rem] w-full overflow-hidden sm:min-h-[34rem]">
      <div className="absolute inset-0 z-0"><Art title={t.title} src={t.backdrop_url || t.poster_url} /></div>
      <TrailerPreview url={t.trailer_url} title={t.title} active={previewActive} className="absolute inset-0 z-[1] h-full w-full object-cover" />
      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-ink via-ink/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 z-[2] h-1/2 bg-gradient-to-t from-ink to-transparent" />
      <div className="absolute inset-y-0 left-0 z-[2] w-full bg-gradient-to-r from-ink/75 via-ink/30 to-transparent sm:w-4/5" />
      <motion.div key={t.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="pad-x absolute bottom-[14%] z-[3] max-w-2xl sm:bottom-[20%]">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-snow/90">
          <span className="rounded bg-volt px-2 py-0.5 text-xs font-bold text-white">{typeLabel[t.type]}</span>
          <span className="rounded border border-mist/60 px-1.5 text-xs">{t.maturity}</span>
          {t.year && <span>{t.year}</span>}
          <span>{metaLine(t)}</span>
        </div>
        <h1 className="font-display text-[clamp(2.2rem,6vw,4.75rem)] font-extrabold italic leading-[1.02] drop-shadow-lg">{t.title}</h1>
        <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-snow/95 sm:text-lg">{t.description}</p>
        <div className="mt-5 flex flex-wrap gap-3 sm:mt-6">
          <button type="button" onClick={() => nav(`/watch/${t.id}`)}
            className="flex min-h-11 items-center gap-2 rounded-md bg-snow px-6 py-2.5 font-bold text-ink transition hover:bg-white/80">
            <Play size={20} fill="currentColor" /> Play
          </button>
          <button type="button" onClick={() => open(t.id)}
            className="flex min-h-11 items-center gap-2 rounded-md bg-white/20 px-6 py-2.5 font-bold backdrop-blur transition hover:bg-white/30">
            <Info size={20} /> More info
          </button>
        </div>
      </motion.div>
      {titles.length > 1 && (
        <div role="tablist" aria-label="Featured titles" className="absolute bottom-5 right-5 z-[4] flex gap-2 sm:bottom-8 sm:right-8">
          {titles.map((title, index) => (
            <button key={title.id} type="button" role="tab" aria-label={`Show featured title ${index + 1}: ${title.title}`}
              aria-selected={index === active} onClick={() => setActive(index)}
              className={`h-2.5 rounded-full transition-all ${index === active ? "w-8 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"}`} />
          ))}
        </div>
      )}
    </header>
  );
}
