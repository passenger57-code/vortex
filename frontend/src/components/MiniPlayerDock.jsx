import { useRef } from "react";
import { Maximize2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import VideoPlayer from "./VideoPlayer.jsx";
import { useMiniPlayer } from "../lib/miniPlayer.jsx";

export default function MiniPlayerDock() {
  const { miniPlayer, closeMiniPlayer, updateMiniPlayerTime } = useMiniPlayer();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  if (!miniPlayer) return null;

  const expand = () => {
    const path = miniPlayer.episodeId
      ? `/watch/${miniPlayer.titleId}?ep=${miniPlayer.episodeId}`
      : `/watch/${miniPlayer.titleId}`;
    const currentTime = videoRef.current?.currentTime ?? miniPlayer.currentTime;
    closeMiniPlayer();
    navigate(path, { state: { miniResumeAt: currentTime } });
  };

  return (
    <section aria-label="Mini player" className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[70] ml-auto w-auto overflow-hidden rounded-xl border border-line bg-panel shadow-2xl md:inset-x-auto md:bottom-4 md:right-4 md:w-80">
      <header className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{miniPlayer.title}</p>
          {miniPlayer.episodeName && <p className="truncate text-xs text-mist">{miniPlayer.episodeName}</p>}
        </div>
        <button type="button" onClick={expand} aria-label="Return to full player" title="Return to full player"
          className="grid h-8 w-8 shrink-0 place-items-center rounded hover:bg-raised"><Maximize2 size={17} /></button>
        <button type="button" onClick={closeMiniPlayer} aria-label="Close mini player" title="Close mini player"
          className="grid h-8 w-8 shrink-0 place-items-center rounded hover:bg-raised"><X size={18} /></button>
      </header>
      <div className="aspect-video bg-black">
        <VideoPlayer key={miniPlayer.instanceId} ref={videoRef} src={miniPlayer.src} subtitle={miniPlayer.subtitle}
          profileId={miniPlayer.profileId} startAt={miniPlayer.currentTime} playbackRate={miniPlayer.playbackRate}
          subtitlesEnabled={miniPlayer.subtitlesEnabled}
          onTimeUpdate={(event) => updateMiniPlayerTime(event.currentTarget.currentTime)} />
      </div>
    </section>
  );
}
