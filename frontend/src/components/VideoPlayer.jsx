import { forwardRef, useEffect, useRef, useState } from "react";
import { PictureInPicture2 } from "lucide-react";

const isHls = (src) => /\.m3u8($|\?)/i.test(src || "");

/** Plain <video> that also plays HLS (.m3u8) through hls.js when the browser can't do it natively. */
const VideoPlayer = forwardRef(function VideoPlayer(
  { src, subtitle, profileId, startAt = 0, playbackRate = 1, subtitlesEnabled = true, onTimeUpdate, onEnded, onPlay, onPause, onError, onLoadedMetadata }, ref
) {
  const touch = useRef({ time: 0, x: 0 });
  const [seekNotice, setSeekNotice] = useState("");
  const [scrubPreview, setScrubPreview] = useState(null);
  const previewTimer = useRef(null);

  useEffect(() => () => clearTimeout(previewTimer.current), []);

  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    let hls, cancelled = false;
    v.playbackRate = playbackRate;
    const preferenceKey = `vortex_player_${profileId || "default"}`;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(preferenceKey) || "{}"); } catch { saved = {}; }
    if (Number.isFinite(saved.volume)) v.volume = saved.volume;
    if (typeof saved.muted === "boolean") v.muted = saved.muted;

    const persist = () => {
      try {
        localStorage.setItem(preferenceKey, JSON.stringify({
          volume: v.volume,
          muted: v.muted,
          subtitlesEnabled: [...v.textTracks].some((track) => track.mode === "showing"),
        }));
      } catch { /* browser storage may be disabled */ }
    };
    v.addEventListener("volumechange", persist);
    v.textTracks.addEventListener("change", persist);

    const begin = () => {
      const seek = () => { if (startAt > 0) v.currentTime = startAt; v.play().catch(() => {}); };
      v.addEventListener("loadedmetadata", seek, { once: true });
      if (v.textTracks.length) {
        [...v.textTracks].forEach((track) => { track.mode = saved.subtitlesEnabled === false ? "disabled" : "showing"; });
      }
    };

    if (isHls(src) && !v.canPlayType("application/vnd.apple.mpegurl")) {
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) { onError?.(); return; }
        hls = new Hls();
        hls.on(Hls.Events.ERROR, (_e, d) => d.fatal && onError?.());
        hls.loadSource(src);
        hls.attachMedia(v);
        begin();
      });
    } else {
      v.src = src;
      begin();
    }
    return () => {
      cancelled = true;
      hls?.destroy();
      clearTimeout(previewTimer.current);
      v.removeEventListener("volumechange", persist);
      v.textTracks.removeEventListener("change", persist);
      v.removeAttribute("src");
      v.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, profileId]);

  const seekBy = (seconds) => {
    const video = ref.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seconds));
    setSeekNotice(`${seconds > 0 ? "+" : ""}${seconds}s`);
    window.setTimeout(() => setSeekNotice(""), 650);
  };

  const onTouchStart = (event) => {
    const point = event.touches[0];
    if (!point) return;
    const now = Date.now();
    const bounds = event.currentTarget.getBoundingClientRect();
    if (now - touch.current.time < 320 && Math.abs(point.clientX - touch.current.x) < 70) {
      const direction = point.clientX < bounds.left + bounds.width / 2 ? -1 : 1;
      seekBy(direction * 10);
      event.preventDefault();
      touch.current.time = 0;
      return;
    }
    touch.current = { time: now, x: point.clientX };
  };

  const pictureInPicture = () => {
    const video = ref.current;
    if (video && document.pictureInPictureEnabled && document.pictureInPictureElement !== video) {
      video.requestPictureInPicture?.().catch(() => {});
    }
  };

  const handleSeeking = () => {
    const video = ref.current;
    if (!video) return;
    setScrubPreview({ time: video.currentTime, image: null });
    clearTimeout(previewTimer.current);
  };

  const handleSeeked = () => {
    const video = ref.current;
    if (!video) return;
    let image = null;
    if (video.videoWidth && video.videoHeight) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = Math.round(160 * video.videoHeight / video.videoWidth);
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        image = canvas.toDataURL("image/jpeg", 0.72);
      } catch {
        image = null;
      }
    }
    setScrubPreview({ time: video.currentTime, image });
    clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => setScrubPreview(null), 900);
  };

  return (
    <div className="relative h-full w-full">
      <video ref={ref} className="h-full w-full bg-black" controls playsInline crossOrigin={subtitle ? "anonymous" : undefined}
        onTouchStart={onTouchStart} onDoubleClick={(event) => seekBy(event.clientX < window.innerWidth / 2 ? -10 : 10)}
        onSeeking={handleSeeking} onSeeked={handleSeeked}
        onTimeUpdate={onTimeUpdate} onEnded={onEnded} onPlay={onPlay} onPause={onPause} onError={onError} onLoadedMetadata={onLoadedMetadata}>
        {subtitle && <track key={subtitle} kind="subtitles" src={subtitle} srcLang="en" label="English" default={subtitlesEnabled} />}
      </video>
      {scrubPreview?.image && (
        <div aria-label={`Preview at ${Math.floor(scrubPreview.time)} seconds`} className="pointer-events-none absolute bottom-16 left-1/2 z-10 w-40 -translate-x-1/2 overflow-hidden rounded-md border border-white/50 bg-black shadow-xl">
          <img src={scrubPreview.image} alt="" className="aspect-video w-full object-cover" />
          <span className="block py-1 text-center text-xs font-semibold text-white">{Math.floor(scrubPreview.time)}s</span>
        </div>
      )}
      {document.pictureInPictureEnabled && (
        <button type="button" onClick={pictureInPicture} aria-label="Picture in picture"
          className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white hover:bg-black">
          <PictureInPicture2 size={20} />
        </button>
      )}
      {seekNotice && <span aria-live="polite" className="pointer-events-none absolute inset-0 grid place-items-center text-3xl font-bold text-white drop-shadow-lg">{seekNotice}</span>}
    </div>
  );
});

export default VideoPlayer;
