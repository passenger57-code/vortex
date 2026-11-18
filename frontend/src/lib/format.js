export const typeLabel = { movie: "Movie", series: "Series", anime: "Anime" };

export function metaLine(t) {
  if (t.type === "movie") return t.duration ? `${t.duration} min` : null;
  const s = t.seasons || 1;
  return `${s} ${s === 1 ? "season" : "seasons"}`;
}

export function epCode(ep) {
  return ep ? `S${ep.season}:E${ep.number}` : "";
}
