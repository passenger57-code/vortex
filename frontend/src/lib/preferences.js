export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

export function getPlayerPreferences(profileId) {
  if (!profileId) return { playbackRate: 1, subtitlesEnabled: true };
  const prefix = `vortex_profile_${profileId}`;
  const storedRate = Number(localStorage.getItem(`${prefix}_playback_rate`));
  return {
    playbackRate: PLAYBACK_RATES.includes(storedRate) ? storedRate : 1,
    subtitlesEnabled: localStorage.getItem(`${prefix}_subtitles_enabled`) !== "false",
  };
}

export function savePlayerPreferences(profileId, preferences) {
  if (!profileId) throw new Error("Choose a profile before saving playback settings.");
  if (!PLAYBACK_RATES.includes(preferences.playbackRate)) throw new Error("Choose a supported playback speed.");
  const prefix = `vortex_profile_${profileId}`;
  localStorage.setItem(`${prefix}_playback_rate`, String(preferences.playbackRate));
  localStorage.setItem(`${prefix}_subtitles_enabled`, String(preferences.subtitlesEnabled));
}
