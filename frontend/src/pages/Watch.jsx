import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, CirclePlay, Flag, LoaderCircle, ListVideo, Minimize2, SkipForward, X } from "lucide-react";
import { api } from "../lib/api";
import { epCode } from "../lib/format.js";
import { useAuth } from "../lib/auth.jsx";
import { getPlayerPreferences } from "../lib/preferences.js";
import Art from "../components/Art.jsx";
import VideoPlayer from "../components/VideoPlayer.jsx";
import { activeSegmentAction } from "../lib/episodeSegments.js";
import { useMiniPlayer } from "../lib/miniPlayer.jsx";

export default function Watch() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const location = useLocation();
  const nav = useNavigate();
  const { profileId } = useAuth();
  const { startMiniPlayer } = useMiniPlayer();
  const [preferences, setPreferences] = useState(() => getPlayerPreferences(profileId));
  const [title, setTitle] = useState(null);
  const [error, setError] = useState("");
  const [playerError, setPlayerError] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [signedSources, setSignedSources] = useState({});
  const [retry, setRetry] = useState(0);
  const [playbackAttempt, setPlaybackAttempt] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [nearEnd, setNearEnd] = useState(false);
  const [segmentAction, setSegmentAction] = useState(null);
  const [upNextCancelled, setUpNextCancelled] = useState(false);
  const [upNextCountdown, setUpNextCountdown] = useState(10);
  const [season, setSeason] = useState(1);
  const [episodePage, setEpisodePage] = useState(0);
  const [jumpNumber, setJumpNumber] = useState("");
  const [watchedEpisodes, setWatchedEpisodes] = useState(() => new Set());
  const [episodeProgress, setEpisodeProgress] = useState({});
  const [markingAllWatched, setMarkingAllWatched] = useState(false);
  const [episodeListError, setEpisodeListError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState("broken_video");
  const [reportDetails, setReportDetails] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const saved = useRef(null);       // last known progress row from the server
  const [loaded, setLoaded] = useState(false);
  const last = useRef({ t: 0, d: 0 });
  const vref = useRef(null);
  const box = useRef(null);
  const hideTimer = useRef(null);
  const upNextStarted = useRef(false);
  const loggedPlayEvents = useRef(new Set());

  useEffect(() => {
    setPreferences(getPlayerPreferences(profileId));
  }, [profileId]);

  useEffect(() => {
    setTitle(null); setError(""); setLoaded(false); setPlayerError(false);
    let active = true;
    Promise.all([api.get(`/titles/${id}`), api.get(`/me/progress/${id}`).catch(() => null)])
      .then(([t, p]) => { if (active) { saved.current = p; setTitle(t); setLoaded(true); } })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id, retry]);

  const isShow = title && title.type !== "movie";
  const episodes = title?.episodes || [];
  const epParam = Number(sp.get("ep")) || null;

  // Which episode is playing: ?ep=, else where the viewer left off, else the first one.
  const episode = useMemo(() => {
    if (!isShow || !episodes.length) return null;
    return episodes.find((e) => e.id === epParam)
      || episodes.find((e) => e.id === saved.current?.episode_id)
      || episodes[0];
  }, [isShow, episodes, epParam, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextEp = episode ? episodes[episodes.findIndex((e) => e.id === episode.id) + 1] : null;
  const videoAssetId = isShow ? episode?.video_asset_id : title?.video_asset_id;
  const subtitleAssetId = isShow ? episode?.subtitle_asset_id : title?.subtitle_asset_id;
  const fallbackSrc = isShow ? episode?.video_url : title?.video_url;
  const fallbackSubtitle = isShow ? episode?.subtitle_url : title?.subtitle_url;

  useEffect(() => {
    let active = true;
    setSignedSources({});
    const assets = [
      ["video", videoAssetId],
      ["subtitle", subtitleAssetId],
    ].filter(([, assetId]) => assetId);
    if (!assets.length) return () => { active = false; };
    setSourceLoading(true);
    Promise.all(assets.map(async ([kind, assetId]) => {
      const result = await api.get(`/media/assets/${assetId}/playback`);
      return [kind, result.url];
    })).then((entries) => {
      if (active) setSignedSources(Object.fromEntries(entries));
    }).catch((err) => {
      if (active) {
        setError(err.message);
        setPlayerError(true);
      }
    }).finally(() => {
      if (active) setSourceLoading(false);
    });
    return () => { active = false; };
  }, [videoAssetId, subtitleAssetId, retry]);

  const src = videoAssetId ? signedSources.video : fallbackSrc;
  const subtitle = subtitleAssetId ? signedSources.subtitle : fallbackSubtitle;

  const startAt = useMemo(() => {
    const miniResumeAt = location.state?.miniResumeAt;
    if (miniResumeAt != null && Number.isFinite(Number(miniResumeAt)) && Number(miniResumeAt) >= 0) {
      return Number(miniResumeAt);
    }
    const p = saved.current;
    if (!p || !title) return 0;
    const same = isShow ? p.episode_id === episode?.id : true;
    if (!same || p.position < 5) return 0;
    if (p.duration && p.position > p.duration - 15) return 0;
    return p.position;
  }, [title, episode, isShow, location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (episode) setSeason(episode.season);
    setEpisodePage(0);
    setNearEnd(false);
    setSegmentAction(null);
    setUpNextCancelled(false);
    setUpNextCountdown(10);
    upNextStarted.current = false;
    last.current = { t: 0, d: 0 };
  }, [episode?.id]);

  useEffect(() => {
    api.get("/me/watched-episodes")
      .then((ids) => setWatchedEpisodes(new Set(ids)))
      .catch((err) => console.error("Could not load watched episode markers.", err));
  }, [id, profileId]);
  useEffect(() => {
    let active = true;
    setEpisodeProgress({});
    api.get(`/me/titles/${id}/episode-progress`)
      .then((progress) => { if (active) setEpisodeProgress(progress); })
      .catch((err) => console.error("Could not load episode progress.", err));
    return () => { active = false; };
  }, [id, profileId]);
  useEffect(() => {
    setMediaLoading(Boolean(src));
    setPlayerError(false);
  }, [src, episode?.id, playbackAttempt]);

  // ---- progress saving -----------------------------------------------------
  const save = useCallback((finished = false) => {
    const { t, d } = last.current;
    if (!title || !d) return;
    const body = { title_id: title.id, episode_id: episode?.id ?? null, position: finished ? d : t, duration: d };
    saved.current = { ...body };
    if (episode?.id) {
      setEpisodeProgress((current) => ({
        ...current,
        [episode.id]: { position: body.position, duration: body.duration },
      }));
      if (finished) setWatchedEpisodes((current) => new Set(current).add(episode.id));
    }
    api.put("/me/progress", body, { keepalive: true }).catch(() => {});
  }, [title, episode?.id]);

  useEffect(() => {
    const iv = setInterval(() => { if (vref.current && !vref.current.paused) save(); }, 10000);
    return () => { clearInterval(iv); save(); };
  }, [save]);

  const onTimeUpdate = (e) => {
    const v = e.currentTarget;
    if (!v.duration) return;
    last.current = { t: v.currentTime, d: v.duration };
    const action = activeSegmentAction(episode, v.currentTime);
    setSegmentAction((current) => current === action ? current : action);
    const shouldOfferNext = !!nextEp && v.duration - v.currentTime < 15;
    if (shouldOfferNext && !upNextStarted.current) {
      upNextStarted.current = true;
      setUpNextCountdown(10);
      setUpNextCancelled(false);
    } else if (!shouldOfferNext && upNextStarted.current) {
      upNextStarted.current = false;
      setUpNextCountdown(10);
      setUpNextCancelled(false);
    }
    setNearEnd(shouldOfferNext);
  };

  const skipSegment = () => {
    if (!episode || !vref.current) return;
    const target = segmentAction === "intro" ? episode.intro_end : episode.recap_end;
    if (target != null && Number.isFinite(Number(target))) vref.current.currentTime = Number(target);
    setSegmentAction(null);
  };

  const goNext = useCallback(() => {
    if (!nextEp) return;
    save(true);
    nav(`/watch/${title.id}?ep=${nextEp.id}`, { replace: true });
  }, [nextEp, title, nav, save]);

  const onEnded = () => { if (nextEp && !upNextCancelled) goNext(); else save(true); };

  const markAllWatched = async () => {
    setEpisodeListError("");
    setMarkingAllWatched(true);
    try {
      const result = await api.post(`/me/titles/${title.id}/watched-episodes`, {});
      setWatchedEpisodes((current) => new Set([...current, ...result.episode_ids]));
    } catch (err) {
      setEpisodeListError(err.message);
    } finally {
      setMarkingAllWatched(false);
    }
  };

  const episodeProgressPercent = (item) => {
    if (watchedEpisodes.has(item.id)) return 100;
    if (episode?.id === item.id && last.current.d > 0) {
      return Math.min(100, Math.round((last.current.t / last.current.d) * 100));
    }
    const progress = episodeProgress[item.id];
    if (progress?.duration > 0) {
      return Math.min(100, Math.round((progress.position / progress.duration) * 100));
    }
    return 0;
  };

  const handlePlayerPlay = () => {
    wake();
    const key = `${title.id}:${episode?.id || ""}`;
    if (loggedPlayEvents.current.has(key)) return;
    loggedPlayEvents.current.add(key);
    api.post("/me/playback-events", { event_type: "play", title_id: title.id, episode_id: episode?.id ?? null })
      .catch((err) => console.error("Could not record playback start.", err));
  };

  const handlePlayerError = (event) => {
    const code = event?.currentTarget?.error?.code;
    api.post("/me/playback-events", {
      event_type: "error",
      title_id: title?.id,
      episode_id: episode?.id ?? null,
      error_code: code ? `media_error_${code}` : "media_error",
      details: "The browser could not load or decode the media stream.",
    }).catch((err) => console.error("Could not record playback error.", err));
    setMediaLoading(false);
    setPlayerError(true);
  };

  const submitReport = async (event) => {
    event.preventDefault();
    setReportError("");
    setReportBusy(true);
    try {
      await api.post("/me/reports", {
        title_id: title.id,
        episode_id: episode?.id ?? null,
        category: reportCategory,
        details: reportDetails,
      });
      setReportMessage("Report sent. Thanks for helping improve the library.");
      setReportOpen(false);
      setReportDetails("");
    } catch (err) {
      setReportError(err.message);
    } finally {
      setReportBusy(false);
    }
  };

  useEffect(() => {
    if (!nearEnd || !nextEp || upNextCancelled) return undefined;
    if (upNextCountdown <= 0) {
      goNext();
      return undefined;
    }
    const timer = setTimeout(() => setUpNextCountdown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [nearEnd, nextEp, upNextCancelled, upNextCountdown, goNext]);

  // ---- controls overlay + keyboard ----------------------------------------
  const wake = () => {
    setUiVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (vref.current && !vref.current.paused) setUiVisible(false); }, 2800);
  };
  useEffect(() => { wake(); return () => clearTimeout(hideTimer.current); }, []); // eslint-disable-line

  useEffect(() => {
    const onKey = (e) => {
      const v = vref.current;
      if (!v || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") { e.preventDefault(); v.paused ? v.play() : v.pause(); }
      else if (k === "arrowright") { e.preventDefault(); v.currentTime += 10; }
      else if (k === "arrowleft") { e.preventDefault(); v.currentTime -= 10; }
      else if (k === "m") v.muted = !v.muted;
      else if (k === "f") document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen?.();
      else if (k === "n") goNext();
      wake();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext]);

  useEffect(() => {
    if (!drawer) return undefined;
    const previousFocus = document.activeElement;
    const focusable = () => [...(document.getElementById("episodes-drawer")?.querySelectorAll('button:not([disabled]), select:not([disabled])') || [])];
    focusable()[0]?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        setDrawer(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus?.();
    };
  }, [drawer]);

  const back = () => (window.history.length > 1 ? nav(-1) : nav("/"));
  const minimize = () => {
    const video = vref.current;
    if (!title || !src || !video) return;
    startMiniPlayer({
      titleId: title.id,
      title: title.title,
      episodeId: episode?.id,
      episodeName: episode ? `${epCode(episode)} · ${episode.name}` : "",
      src,
      subtitle,
      currentTime: video.currentTime,
      profileId,
      playbackRate: preferences.playbackRate,
      subtitlesEnabled: preferences.subtitlesEnabled,
    });
    back();
  };

  if (error) return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p role="alert" className="text-lg">{error}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="rounded-md bg-volt px-5 py-2 font-bold text-white">Retry</button>
          <Link to="/" className="rounded-md border border-line bg-panel px-5 py-2 font-bold">Back to Vortex</Link>
        </div>
      </div>
    </main>
  );
  if (!title) return (
    <div role="status" aria-label="Loading title" className="grid min-h-screen place-items-center bg-ink">
      <div className="text-center"><img src="/favicon.png" alt="" className="mx-auto h-16 w-16 animate-pulse" /><p className="mt-4 text-sm text-mist">Loading your title…</p></div>
    </div>
  );

  const seasons = [...new Set(episodes.map((e) => e.season))];
  const creditsArePlaying = episode?.credits_start != null && last.current.t >= episode.credits_start;
  const seasonEpisodes = episodes.filter((e) => e.season === season);
  const episodePageCount = Math.max(1, Math.ceil(seasonEpisodes.length / 50));
  const visibleEpisodes = seasonEpisodes.slice(episodePage * 50, (episodePage + 1) * 50);
  const jumpToEpisode = () => {
    const target = seasonEpisodes.find((item) => item.number === Number(jumpNumber));
    if (!target) return;
    setEpisodePage(Math.floor(seasonEpisodes.indexOf(target) / 50));
    nav(`/watch/${title.id}?ep=${target.id}`, { replace: true });
    setJumpNumber("");
    setDrawer(false);
  };

  return (
    <div ref={box} onMouseMove={wake} onTouchStart={wake} className="relative h-screen w-screen overflow-hidden bg-black">
      {src ? (
        <VideoPlayer key={`${episode?.id || title.id}-${playbackAttempt}`} ref={vref} src={src} subtitle={subtitle} profileId={profileId} startAt={startAt}
          playbackRate={preferences.playbackRate} subtitlesEnabled={preferences.subtitlesEnabled}
          onTimeUpdate={onTimeUpdate} onEnded={onEnded} onPause={() => { setUiVisible(true); save(); }}
          onError={handlePlayerError} onPlay={handlePlayerPlay}
          onLoadedMetadata={() => setMediaLoading(false)} />
      ) : (
        <div className="grid h-full place-items-center px-6 text-center text-mist">
          <div><p className="text-lg font-semibold text-white">Video not available yet</p><p className="mt-2">This title does not have a video file attached.</p><Link to="/" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-volt px-5 font-bold text-white">Back to Vortex</Link></div>
        </div>
      )}

      {(mediaLoading || sourceLoading) && !playerError && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/25" role="status">
          <div className="flex items-center gap-3 rounded-lg bg-panel/90 px-4 py-3 text-sm text-white"><LoaderCircle className="animate-spin text-volt" /> Loading video…</div>
        </div>
      )}

      {playerError && (
        <div role="alert" className="absolute inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 rounded-xl border border-line bg-panel/95 p-5 text-center shadow-xl sm:inset-x-auto">
          <h2 className="font-display text-xl font-bold text-white">This video couldn’t be played</h2>
          <p className="mt-2 text-sm text-mist">Check the media URL or try again. Some video formats are not supported by every browser.</p>
          <div className="mt-4 flex justify-center gap-3">
            <button type="button" onClick={() => { setPlayerError(false); setRetry((value) => value + 1); setPlaybackAttempt((value) => value + 1); }} className="min-h-11 rounded-md bg-volt px-4 font-bold text-white">Retry</button>
            <button type="button" onClick={back} className="min-h-11 rounded-md border border-line px-4 font-bold text-white">Go back</button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {segmentAction && (
          <motion.button key={segmentAction} type="button" onClick={skipSegment}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            className="absolute bottom-24 left-5 z-10 rounded-full border border-white/30 bg-black/75 px-5 py-3 font-bold text-white shadow-xl backdrop-blur hover:bg-volt sm:bottom-20 sm:left-8">
            {segmentAction === "intro" ? "Skip intro" : "Skip recap"}
          </motion.button>
        )}
      </AnimatePresence>

      <div className={`pointer-events-none absolute inset-x-0 top-0 flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent px-5 py-4 transition-opacity duration-300 ${uiVisible ? "opacity-100" : "opacity-0"}`}>
        <button type="button" onClick={back} aria-label="Back" className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/50 hover:bg-black/80"><ArrowLeft /></button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold italic sm:text-xl">{title.title}</h1>
          {episode && <p className="truncate text-sm text-snow/80">{epCode(episode)}  {episode.name}</p>}
        </div>
        {src && (
          <button type="button" onClick={minimize} aria-label="Minimize player" title="Keep playing while browsing"
            className="pointer-events-auto ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/50 hover:bg-black/80">
            <Minimize2 size={19} />
          </button>
        )}
        {isShow && (
          <button type="button" onClick={() => setDrawer(true)} aria-expanded={drawer} aria-controls="episodes-drawer"
            className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-md bg-black/50 px-3 py-2 text-sm hover:bg-black/80">
            <ListVideo size={18} /> Episodes
          </button>
        )}
        <button type="button" onClick={() => { setReportOpen(true); setReportMessage(""); setReportError(""); }}
          className="pointer-events-auto ml-auto inline-flex min-h-11 items-center gap-2 rounded-md bg-black/50 px-3 text-sm hover:bg-black/80" aria-label="Report a problem">
          <Flag size={17} /> <span className="hidden sm:inline">Report</span>
        </button>
      </div>

      {reportMessage && <p role="status" className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-panel/95 px-4 py-3 text-sm text-emerald-200">{reportMessage}</p>}
      {reportOpen && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-4">
          <form onSubmit={submitReport} role="dialog" aria-modal="true" aria-labelledby="report-title" className="surface-panel w-full max-w-md space-y-4 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="report-title" className="font-display text-xl font-bold text-white">Report a problem</h2><p className="mt-1 text-sm text-mist">{title.title}{episode ? ` · ${epCode(episode)}` : ""}</p></div>
              <button type="button" onClick={() => setReportOpen(false)} aria-label="Close report form" className="rounded p-1 text-mist hover:text-white"><X size={18} /></button>
            </div>
            <label className="block text-sm text-mist">Problem type
              <select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)} className="field-control mt-1">
                <option value="broken_video">Video won’t play</option>
                <option value="wrong_subtitles">Wrong subtitles</option>
                <option value="audio">Audio problem</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block text-sm text-mist">Details (optional)
              <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={1000} rows={3} className="field-control mt-1" />
            </label>
            {reportError && <p role="alert" className="text-sm text-red-300">{reportError}</p>}
            <button type="submit" disabled={reportBusy} className="btn-primary w-full">{reportBusy ? "Sending…" : "Send report"}</button>
          </form>
        </div>
      )}

      {nearEnd && nextEp && (
        !upNextCancelled ? (
          <div className="absolute inset-x-4 bottom-24 z-10 ml-auto flex max-w-md flex-col gap-3 rounded-xl border border-line bg-panel/95 p-4 shadow-xl sm:inset-x-auto sm:right-6">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-20 shrink-0 place-items-center overflow-hidden rounded bg-raised">
                <Art title={nextEp.name} src={nextEp.thumbnail_url} />
              </span>
              <div className="min-w-0 flex-1">
                <p aria-live="polite" className="text-xs uppercase tracking-wider text-volt">Up next · {upNextCountdown}s</p>
                <p className="mt-1 truncate font-bold text-white">{epCode(nextEp)} · {nextEp.name}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={goNext} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-snow px-4 font-bold text-ink hover:bg-white/80">
                <SkipForward size={18} fill="currentColor" /> Play now
              </button>
              <button type="button" onClick={() => setUpNextCancelled(true)} className="min-h-11 rounded-md border border-line px-4 font-bold text-white hover:bg-raised">
                {creditsArePlaying ? "Watch credits" : "Cancel"}
              </button>
            </div>
          </div>
        ) : null
      )}

      {drawer && (
        <aside id="episodes-drawer" role="dialog" aria-modal="true" aria-label="Episodes" className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-line bg-panel/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 border-b border-line p-4">
            <h2 className="font-display text-lg font-bold">Episodes</h2>
            <span className="flex-1" />
            <button type="button" disabled={markingAllWatched || !episodes.length} onClick={markAllWatched}
              className="min-h-9 rounded-md border border-line px-3 text-xs font-semibold text-snow hover:border-volt disabled:opacity-50 sm:text-sm">
              {markingAllWatched ? "Marking…" : "Mark all watched"}
            </button>
            {seasons.length > 1 && (
              <select value={season} onChange={(e) => { setSeason(Number(e.target.value)); setEpisodePage(0); }} aria-label="Season"
                className="rounded-md border border-line bg-raised px-2 py-1 text-sm">
                {seasons.map((s) => <option key={s} value={s}>Season {s}</option>)}
              </select>
            )}
            <button type="button" onClick={() => setDrawer(false)} aria-label="Close episodes" className={`grid h-8 w-8 place-items-center rounded-full hover:bg-raised ${seasons.length > 1 ? "" : "ml-auto"}`}><X size={18} /></button>
          </div>
          {episodeListError && <p role="alert" className="border-b border-line px-4 py-2 text-sm text-red-300">{episodeListError}</p>}
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <label htmlFor="episode-jump" className="text-xs text-mist">Jump to episode</label>
            <input id="episode-jump" type="number" min="1" max={Math.max(1, ...seasonEpisodes.map((item) => item.number))}
              value={jumpNumber} onChange={(event) => setJumpNumber(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") jumpToEpisode(); }}
              className="w-20 rounded border border-line bg-raised px-2 py-1 text-sm text-white" />
            <button type="button" onClick={jumpToEpisode} className="ml-auto rounded bg-raised px-3 py-1.5 text-xs font-bold hover:bg-line">Go</button>
          </div>
          {seasonEpisodes.length > 50 && (
            <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-mist">
              <span>Episodes {episodePage * 50 + 1}–{Math.min((episodePage + 1) * 50, seasonEpisodes.length)} of {seasonEpisodes.length}</span>
              <span className="flex gap-2">
                <button type="button" disabled={!episodePage} onClick={() => setEpisodePage((page) => page - 1)} className="rounded border border-line px-2 py-1 disabled:opacity-40">Previous</button>
                <button type="button" disabled={episodePage + 1 >= episodePageCount} onClick={() => setEpisodePage((page) => page + 1)} className="rounded border border-line px-2 py-1 disabled:opacity-40">Next</button>
              </span>
            </div>
          )}
          <ul className="flex-1 overflow-y-auto">
            {visibleEpisodes.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => { nav(`/watch/${title.id}?ep=${e.id}`, { replace: true }); setDrawer(false); }}
                  className={`flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left hover:bg-raised ${e.id === episode?.id ? "bg-raised" : ""}`}>
                  <span className="relative h-14 w-24 shrink-0 overflow-hidden rounded bg-ink">
                    <Art title={e.name} src={e.thumbnail_url} />
                    {e.id === episode?.id && <span className="absolute inset-0 grid place-items-center bg-black/50"><CirclePlay size={22} className="text-white" /></span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 truncate font-bold">{e.number}. {e.name}{e.is_new && <span className="status-badge shrink-0 bg-volt/20 text-volt">New</span>}</span>
                    <span className="block text-xs text-mist">{e.duration ? `${e.duration}m` : ""}{(e.audio_mode || title.audio_mode) ? ` · ${(e.audio_mode || title.audio_mode) === "both" ? "Sub · Dub" : e.audio_mode || title.audio_mode}` : ""}{e.id === episode?.id ? " · Now playing" : watchedEpisodes.has(e.id) ? " · Watched" : ""}</span>
                    <span role="progressbar" aria-label={`${e.name}: ${episodeProgressPercent(e)}% watched`}
                      aria-valuenow={episodeProgressPercent(e)} aria-valuemin={0} aria-valuemax={100}
                      className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-line">
                      <span className="block h-full bg-volt" style={{ width: `${episodeProgressPercent(e)}%` }} />
                    </span>
                  </span>
                  {watchedEpisodes.has(e.id) && <Check size={18} aria-label="Watched" className="shrink-0 text-volt" />}
                </button>
              </li>
            ))}
          </ul>
          {nextEp && <button type="button" onClick={goNext} className="flex min-h-12 items-center justify-center gap-2 border-t border-line font-bold text-volt hover:bg-raised"><SkipForward size={16} /> Next up · {epCode(nextEp)}</button>}
        </aside>
      )}
    </div>
  );
}
