import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Plus, Check, ChevronDown } from "lucide-react";
import Art from "./Art.jsx";
import TrailerPreview from "./TrailerPreview.jsx";
import { useModal } from "../lib/modal.jsx";
import { useList } from "../lib/list.jsx";
import { epCode, metaLine, typeLabel } from "../lib/format.js";

function RoundBtn({ label, onClick, children, solid }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-full border transition-colors ${
        solid ? "border-snow bg-snow text-ink hover:bg-white/80" : "border-mist/70 bg-ink/60 text-snow hover:border-snow"}`}>
      {children}
    </button>
  );
}

export default function TitleCard({ t, grid = false, poster, continueWatching = false, rank }) {
  const { open } = useModal();
  const list = useList();
  const nav = useNavigate();
  const inList = list.has(t.id);
  const pg = t.progress;
  const progressPercent = Math.min(100, Math.round((pg?.percent || 0) * 100));
  const playLabel = pg?.position > 5 ? "Resume" : "Play";
  const [previewActive, setPreviewActive] = useState(false);
  const isPoster = !continueWatching && (poster ?? t.type !== "movie");

  return (
    <div onMouseEnter={() => setPreviewActive(true)} onMouseLeave={() => setPreviewActive(false)}
      className={`group/card relative ${isPoster ? "aspect-[2/3]" : "aspect-video"} ${grid ? "w-full" : isPoster ? "w-[34vw] shrink-0 sm:w-[180px] lg:w-[205px]" : "w-[44vw] shrink-0 sm:w-[250px] lg:w-[290px]"}`}>
      <div className="title-card-shell absolute left-0 top-0 w-full origin-top rounded-md bg-panel shadow-black/60 transition-transform duration-200 ease-out hover:z-30 hover:scale-[1.14] hover:shadow-2xl group-hover/card:z-30 group-hover/card:scale-[1.14] group-hover/card:shadow-2xl focus-within:z-30">
        <button type="button" onClick={() => open(t.id)} aria-label={`${t.title}: more info`}
          className={`relative block ${isPoster ? "aspect-[2/3]" : "aspect-video"} w-full overflow-hidden rounded-md group-hover/card:rounded-b-none focus-visible:z-10 focus-visible:outline`}>
          <div className="absolute inset-0"><Art title={t.title} src={isPoster ? t.poster_url || t.backdrop_url : t.backdrop_url || t.poster_url} /></div>
          <TrailerPreview url={t.trailer_url} title={t.title} active={previewActive} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          {rank && <span aria-hidden="true" className="absolute bottom-1 left-2 z-[2] font-display text-5xl font-extrabold italic leading-none text-white drop-shadow-lg sm:text-6xl">#{rank}</span>}
          {t.type !== "movie" && (
            <span className="absolute left-2 top-2 z-[2] rounded bg-volt px-1.5 py-0.5 text-[10px] font-bold text-white">{typeLabel[t.type]}</span>
          )}
          <span className="absolute bottom-2 left-3 right-3 z-[2] text-left font-display text-sm font-bold italic leading-tight drop-shadow sm:text-base">
            {t.title}
          </span>
          {pg && <span className="absolute right-2 top-2 z-[2] rounded bg-black/70 px-2 py-1 text-[10px] font-bold text-white">Resume</span>}
          {pg && (
            <span role="progressbar" aria-label={`${progressPercent}% watched`} aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}
              className="absolute inset-x-0 bottom-0 z-[2] h-1.5 bg-black/70">
              <span className="block h-full bg-volt" style={{ width: `${Math.max(3, progressPercent)}%` }} />
            </span>
          )}
        </button>

        <div className="title-card-expand hidden rounded-b-md bg-panel p-3 group-hover/card:block group-focus-within/card:block">
          <div className="flex items-center gap-2">
            <RoundBtn solid label={playLabel} onClick={() => nav(`/watch/${t.id}`)}><Play size={15} fill="currentColor" /></RoundBtn>
            <RoundBtn label={inList ? "Remove from My List" : "Add to My List"} onClick={() => list.toggle(t.id)}>
              {inList ? <Check size={16} /> : <Plus size={16} />}
            </RoundBtn>
            <span className="flex-1" />
            <RoundBtn label="More info" onClick={() => open(t.id)}><ChevronDown size={16} /></RoundBtn>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-mist">
            <span className="rounded border border-mist/50 px-1">{t.maturity}</span>
            <span>{pg?.episode ? epCode(pg.episode) : metaLine(t)}</span>
            {t.year && <span>{t.year}</span>}
          </div>
          <p className="mt-1.5 truncate text-xs text-snow/80">{t.genres.slice(0, 3).join("  /  ")}</p>
        </div>
        <div className="title-card-touch-actions absolute inset-x-2 bottom-2 z-10 hidden items-center justify-between rounded-full bg-black/70 p-1">
          <RoundBtn solid label={playLabel} onClick={() => nav(`/watch/${t.id}`)}><Play size={14} fill="currentColor" /></RoundBtn>
          <RoundBtn label={inList ? "Remove from My List" : "Add to My List"} onClick={() => list.toggle(t.id)}>
            {inList ? <Check size={15} /> : <Plus size={15} />}
          </RoundBtn>
          <RoundBtn label="More info" onClick={() => open(t.id)}><ChevronDown size={15} /></RoundBtn>
        </div>
      </div>
    </div>
  );
}
