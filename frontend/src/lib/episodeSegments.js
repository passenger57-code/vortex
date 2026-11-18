export function activeSegmentAction(episode, currentTime) {
  if (!episode || !Number.isFinite(currentTime)) return null;
  if (episode.intro_start != null && episode.intro_end != null) {
    const introStart = Number(episode.intro_start);
    const introEnd = Number(episode.intro_end);
    if (
      Number.isFinite(introStart)
      && Number.isFinite(introEnd)
      && currentTime >= introStart
      && currentTime < Math.min(introEnd, introStart + 10)
    ) return "intro";
  }

  if (episode.recap_start == null || episode.recap_end == null) return null;
  const recapStart = Number(episode.recap_start);
  const recapEnd = Number(episode.recap_end);
  if (
    Number.isFinite(recapStart)
    && Number.isFinite(recapEnd)
    && currentTime >= recapStart
    && currentTime < recapEnd
  ) return "recap";
  return null;
}
