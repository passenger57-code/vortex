import { useEffect, useState } from "react";

function youtubeVideoId(value) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(url.hostname)) return "";
    if (url.pathname === "/watch") return url.searchParams.get("v") || "";
    const match = url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

export default function TrailerPreview({ url, title, active, className = "" }) {
  const [playing, setPlaying] = useState(false);
  const videoId = youtubeVideoId(url || "");

  useEffect(() => {
    if (!active || !videoId) {
      setPlaying(false);
      return undefined;
    }
    const timer = setTimeout(() => setPlaying(true), 800);
    return () => clearTimeout(timer);
  }, [active, videoId]);

  if (!playing) return null;
  const params = new URLSearchParams({
    autoplay: "1",
    controls: "0",
    loop: "1",
    mute: "1",
    playsinline: "1",
    playlist: videoId,
    rel: "0",
  });
  return (
    <iframe
      title={`${title} muted trailer preview`}
      src={`https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`}
      className={`pointer-events-none ${className}`}
      allow="autoplay; encrypted-media"
      tabIndex={-1}
      loading="lazy"
    />
  );
}
