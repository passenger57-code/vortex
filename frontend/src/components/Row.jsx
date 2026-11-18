import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import TitleCard from "./TitleCard.jsx";

export default function Row({ label, items, ranking = false, continueWatching = false }) {
  const ref = useRef(null);
  if (!items?.length) return null;
  const seeAll = { Series: "/series", Movies: "/movies", Anime: "/anime" }[label];
  const scroll = (dir) => {
    const el = ref.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  const arrow = "absolute top-0 z-40 hidden h-[calc(100%-7rem)] w-12 place-items-center bg-black/50 opacity-0 transition-opacity hover:bg-black/70 group-hover/row:opacity-100 focus-visible:opacity-100 md:grid";
  return (
    <section className="group/row relative">
      <div className="pad-x mb-1 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold sm:text-xl">{label}</h2>
        {seeAll && <Link to={seeAll} className="shrink-0 rounded px-2 py-1 text-sm font-semibold text-snow/70 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-glow">See all</Link>}
      </div>
      <div className="relative">
        <button type="button" aria-label={`Scroll ${label} left`} onClick={() => scroll(-1)} className={`${arrow} left-0 mt-2`}><ChevronLeft /></button>
        <div ref={ref} role="region" aria-label={`${label} titles`} tabIndex={0} className="no-scrollbar pad-x -mb-24 flex gap-2 overflow-x-auto pb-32 pt-3 focus-visible:outline">
          {items.map((t, index) => <TitleCard key={t.id} t={t} continueWatching={continueWatching} rank={ranking ? index + 1 : undefined} />)}
        </div>
        <button type="button" aria-label={`Scroll ${label} right`} onClick={() => scroll(1)} className={`${arrow} right-0 mt-2`}><ChevronRight /></button>
      </div>
    </section>
  );
}
