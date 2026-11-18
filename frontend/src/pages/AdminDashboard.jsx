import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clapperboard, Film, PencilLine, Plus, Search, ShieldAlert, Trash2, Tv, Upload } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import Art from "../components/Art.jsx";

const emptyForm = {
  type: "movie",
  title: "",
  description: "",
  year: new Date().getFullYear(),
  maturity: "PG",
  duration: "",
  poster_url: "",
  backdrop_url: "",
  video_url: "",
  video_asset_id: null,
  subtitle_url: "",
  subtitle_asset_id: null,
  genres: "",
  studios: "",
  airing_status: "completed",
  audio_mode: "sub",
  publish_at: "",
  trailer_url: "",
  franchise_name: "",
  theme_color: "",
  cast: "",
  attribution: "",
  featured: false,
  popularity: 0,
};

const segmentFields = [
  ["intro_start", "Intro starts"],
  ["intro_end", "Intro ends"],
  ["recap_start", "Recap starts"],
  ["recap_end", "Recap ends"],
  ["credits_start", "Credits start"],
];
const episodeDefaults = {
  season: 1, number: 1, name: "", description: "", video_url: "", video_asset_id: null, subtitle_url: "", duration: "", audio_mode: "",
  intro_start: "", intro_end: "", recap_start: "", recap_end: "", credits_start: "",
};

function EpisodeSegmentEditor({ episode, onSaved }) {
  const [values, setValues] = useState(() => Object.fromEntries(segmentFields.map(([key]) => [key, episode[key] ?? ""])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValues(Object.fromEntries(segmentFields.map(([key]) => [key, episode[key] ?? ""])));
  }, [episode]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await api.put(`/admin/episodes/${episode.id}`, Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value === "" ? null : Number(value)]),
      ));
      await onSaved();
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full rounded-md border border-line/70 bg-panel/60 p-3">
      <p className="mb-2 text-xs text-mist">Segment markers in seconds; intro and recap require start and end.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {segmentFields.map(([key, label]) => (
          <label key={key} className="text-xs text-mist">{label}
            <input aria-label={label} type="number" min="0" step="0.1" value={values[key]}
              onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
              className="mt-1 w-full rounded border border-line bg-raised px-2 py-1.5 text-snow" />
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : saved ? <p role="status" className="text-xs text-emerald-300">Markers saved.</p> : <span />}
        <button type="submit" disabled={busy} className="rounded-md border border-line px-3 py-1.5 text-sm text-snow hover:border-volt disabled:opacity-50">
          {busy ? "Saving…" : "Save markers"}
        </button>
      </div>
    </form>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="surface-panel p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-mist">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AdminAccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldAlert className="h-14 w-14 text-red-400" />
      <h1 className="text-3xl font-bold text-white">Access denied</h1>
      <p className="text-mist">This admin dashboard is only available to authenticated administrators.</p>
      <button type="button" onClick={() => navigate("/", { replace: true })} className="rounded-md bg-volt px-4 py-2 font-medium text-white transition hover:bg-volt/90">
        Back to Home
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [titles, setTitles] = useState([]);
  const [reports, setReports] = useState([]);
  const [playbackStats, setPlaybackStats] = useState([]);
  const [scanRoots, setScanRoots] = useState([]);
  const [scanRootIndex, setScanRootIndex] = useState("");
  const [scanType, setScanType] = useState("anime");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [selectedTitleId, setSelectedTitleId] = useState(null);
  const [selectedTitle, setSelectedTitle] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [episodeForm, setEpisodeForm] = useState(episodeDefaults);
  const [uploadingField, setUploadingField] = useState(null);

  const loadTitles = async () => {
    const items = await api.get("/admin/titles?limit=300");
    setTitles(items);
    if (!selectedTitleId && items.length) setSelectedTitleId(items[0].id);
  };

  const loadSelectedTitle = async (titleId) => {
    if (!titleId) {
      setSelectedTitle(null);
      return;
    }
    const detail = await api.get(`/admin/titles/${titleId}`);
    setSelectedTitle(detail);
  };

  useEffect(() => {
    if (!user?.is_admin) return;
    setLoading(true);
    loadTitles()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    Promise.all([api.get("/admin/reports"), api.get("/admin/analytics/playback"), api.get("/media/scan-roots")])
      .then(([reportRows, stats, roots]) => {
        setReports(reportRows);
        setPlaybackStats(stats);
        setScanRoots(roots);
        if (roots.length) setScanRootIndex(String(roots[0].id));
      })
      .catch((err) => setError(err.message));
  }, [user]);

  useEffect(() => {
    if (!selectedTitleId) {
      setSelectedTitle(null);
      return;
    }
    loadSelectedTitle(selectedTitleId).catch(() => setSelectedTitle(null));
  }, [selectedTitleId]);

  const stats = useMemo(() => {
    const totals = { total: titles.length, movie: 0, series: 0, anime: 0, episodes: 0 };
    for (const title of titles) {
      totals[title.type] += 1;
      totals.episodes += Number(title.episode_count || 0);
    }
    return totals;
  }, [titles]);

  const visibleTitles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return titles.filter((title) => {
      const typeMatches = filter === "all" || title.type === filter;
      const searchMatches = !query || [title.title, title.description, title.type, ...(title.genres || [])].join(" ").toLowerCase().includes(query);
      return typeMatches && searchMatches;
    });
  }, [titles, filter, search]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(visibleTitles.length / pageSize));
  const pageTitles = visibleTitles.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  if (!user) return null;
  if (!user.is_admin) return <AdminAccessDenied />;

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "video_url" ? { video_asset_id: null } : {}),
      ...(name === "subtitle_url" ? { subtitle_asset_id: null } : {}),
    }));
  };

  const handleEpisodeChange = (event) => {
    const { name, value } = event.target;
    setEpisodeForm((current) => ({ ...current, [name]: value, ...(name === "video_url" ? { video_asset_id: null } : {}) }));
  };

  const importMetadata = async (provider) => {
    const query = form.title.trim();
    if (!query) {
      setError("Enter a title before importing metadata.");
      return;
    }
    if (provider === "tmdb" && form.type === "anime") {
      setError("Use AniList for anime metadata.");
      return;
    }
    setError("");
    try {
      const imported = await api.post(`/admin/metadata/${provider}`, { query, type: form.type });
      setForm((current) => ({
        ...current,
        ...imported,
        year: imported.year || current.year,
        genres: (imported.genres || []).join(", "),
        studios: (imported.studios || []).join(", "),
        cast: (imported.cast || []).join(", "),
      }));
      setSuccess(`Metadata imported from ${provider === "tmdb" ? "TMDB" : "AniList"}. Review it before saving.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const uploadMediaFile = async (kind, field, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingField(field);
    setError("");
    try {
      const data = await api.upload("/media/upload", file, kind);
      setForm((current) => ({
        ...current,
        [field]: data.url,
        ...(kind === "video" ? { video_asset_id: data.asset_id } : {}),
        ...(kind === "subtitle" ? { subtitle_asset_id: data.asset_id } : {}),
      }));
      setSuccess(`${kind} uploaded successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingField(null);
      if (event.target) event.target.value = "";
    }
  };

  const uploadEpisodeVideo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingField("episode_video");
    setError("");
    try {
      const data = await api.upload("/media/upload", file, "video");
      setEpisodeForm((current) => ({ ...current, video_url: data.url, video_asset_id: data.asset_id }));
      setSuccess("Episode video uploaded. Save the episode to attach it securely.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingField(null);
      if (event.target) event.target.value = "";
    }
  };

  const submitTitle = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const payload = {
      ...form,
      year: Number(form.year) || new Date().getFullYear(),
      duration: form.duration ? Number(form.duration) : null,
      popularity: Number(form.popularity) || 0,
      featured: Boolean(form.featured),
      publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : null,
      cast: (form.cast || "").split(",").map((name) => name.trim()).filter(Boolean),
      studios: (form.studios || "").split(",").map((name) => name.trim()).filter(Boolean),
      genres: (form.genres || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };

    if (!payload.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (payload.type === "movie" && !payload.video_url.trim()) {
      setError("Movies need a video URL.");
      return;
    }

    try {
      if (editingId) {
        await api.put(`/admin/titles/${editingId}`, payload);
        setSuccess("Title updated.");
      } else {
        const created = await api.post("/admin/titles", payload);
        setSelectedTitleId(created.id);
        setSuccess("Title created.");
      }
      resetForm();
      await loadTitles();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (title) => {
    setEditingId(title.id);
    setSelectedTitleId(title.id);
    setForm({
      type: title.type,
      title: title.title,
      description: title.description || "",
      year: title.year || new Date().getFullYear(),
      maturity: title.maturity || "PG",
      duration: title.duration || "",
      poster_url: title.poster_url || "",
      backdrop_url: title.backdrop_url || "",
      video_url: title.video_url || "",
      video_asset_id: title.video_asset_id || null,
      subtitle_url: title.subtitle_url || "",
      subtitle_asset_id: title.subtitle_asset_id || null,
      genres: (title.genres || []).join(", "),
      studios: (title.studios || []).join(", "),
      airing_status: title.airing_status || "completed",
      audio_mode: title.audio_mode || "sub",
      publish_at: localDateTime(title.publish_at),
      trailer_url: title.trailer_url || "",
      franchise_name: title.franchise_name || "",
      theme_color: title.theme_color || "",
      cast: (title.cast || []).join(", "),
      attribution: title.attribution || "",
      featured: Boolean(title.featured),
      popularity: title.popularity || 0,
    });
    setError("");
    setSuccess("");
  };

  const deleteTitle = async (title) => {
    if (!window.confirm(`Delete ${title.title}? This removes the title and its episodes.`)) return;
    try {
      await api.del(`/admin/titles/${title.id}`);
      setSuccess(`${title.title} deleted.`);
      if (selectedTitleId === title.id) setSelectedTitleId(null);
      if (editingId === title.id) resetForm();
      await loadTitles();
    } catch (err) {
      setError(err.message);
    }
  };

  const addEpisode = async (event) => {
    event.preventDefault();
    if (!selectedTitle) {
      setError("Choose a title to add an episode to.");
      return;
    }
    if (!episodeForm.name.trim() || !episodeForm.video_url.trim()) {
      setError("Episode name and video URL are required.");
      return;
    }
    try {
      await api.post(`/admin/titles/${selectedTitle.id}/episodes`, {
        ...episodeForm,
        season: Number(episodeForm.season) || 1,
        number: Number(episodeForm.number) || 1,
        duration: episodeForm.duration ? Number(episodeForm.duration) : null,
      });
      setEpisodeForm(episodeDefaults);
      setSuccess("Episode added.");
      await loadTitles();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteEpisode = async (episodeId) => {
    if (!window.confirm("Delete this episode?")) return;
    try {
      await api.del(`/admin/episodes/${episodeId}`);
      setSuccess("Episode deleted.");
      await loadTitles();
    } catch (err) {
      setError(err.message);
    }
  };

  const resolveReport = async (report) => {
    try {
      await api.patch(`/admin/reports/${report.id}`, { status: report.status === "open" ? "resolved" : "open" });
      setReports((items) => items.map((item) => item.id === report.id ? { ...item, status: item.status === "open" ? "resolved" : "open" } : item));
    } catch (err) {
      setError(err.message);
    }
  };

  const scanLibrary = async () => {
    setError("");
    try {
      const result = await api.post("/media/scan", { root_index: Number(scanRootIndex), type: scanType });
      setSuccess(`Library scan added ${result.created_titles} titles and ${result.created_episodes} episodes.`);
      await loadTitles();
    } catch (err) {
      setError(err.message);
    }
  };

  const generateThumbnail = async (episode) => {
    if (!episode.video_asset_id) return;
    setError("");
    try {
      await api.post(`/media/assets/${episode.video_asset_id}/thumbnail`, {});
      setSuccess(`Thumbnail generated for ${episode.name}.`);
      await loadSelectedTitle(selectedTitle.id);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="pad-x pb-16 pt-24">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-volt">Admin</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Catalog dashboard</h1>
        </div>
      </div>

      {error && <div role="alert" className="mb-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">{error}</div>}
      {success && <div role="status" className="mb-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-200">{success}</div>}

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <StatCard label="Movies" value={stats.movie} icon={Film} />
        <StatCard label="Series" value={stats.series} icon={Tv} />
        <StatCard label="Anime" value={stats.anime} icon={Clapperboard} />
        <StatCard label="Episodes" value={stats.episodes} icon={Plus} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-line bg-panel p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Titles</h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-2 text-sm text-mist">
                <Search size={15} />
                <input aria-label="Search titles" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search titles" className="w-36 bg-transparent outline-none placeholder:text-mist sm:w-44" />
              </label>
              <select aria-label="Filter titles by type" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }} className="rounded-md border border-line bg-raised px-3 py-2 text-sm text-snow">
                <option value="all">All types</option>
                <option value="movie">Movies</option>
                <option value="series">Series</option>
                <option value="anime">Anime</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-md bg-raised" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-line text-mist">
                  <tr>
                    <th className="py-3 pr-4">Title</th>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Year</th>
                    <th className="py-3 pr-4">Episodes</th>
                    <th className="py-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageTitles.map((title) => (
                    <tr key={title.id} className={`border-b border-line ${selectedTitleId === title.id ? "bg-raised/70" : ""}`}>
                      <td className="py-3 pr-4">
                        <button type="button" onClick={() => setSelectedTitleId(title.id)} className="text-left font-medium text-white hover:text-volt">
                          {title.title}
                        </button>
                      </td>
                      <td className="py-3 pr-4 capitalize">{title.type}</td>
                      <td className="py-3 pr-4">{title.year || "—"}</td>
                      <td className="py-3 pr-4">{title.episode_count || 0}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => startEdit(title)} className="inline-flex items-center gap-1 rounded-md border border-line bg-raised px-2 py-1 text-xs text-snow hover:border-brand/60">
                            <PencilLine size={14} /> Edit
                          </button>
                          <button type="button" onClick={() => deleteTitle(title)} className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:border-red-400">
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleTitles.length && <p className="py-6 text-center text-mist">No titles match those filters.</p>}
              {visibleTitles.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm text-mist">
                  <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visibleTitles.length)} of {visibleTitles.length}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}
                      className="min-h-10 rounded-md border border-line px-3 text-snow hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                    <span aria-live="polite">Page {page} of {pageCount}</span>
                    <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                      className="min-h-10 rounded-md border border-line px-3 text-snow hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-panel p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">{editingId ? "Edit title" : "Create title"}</h2>
            {editingId && <button type="button" onClick={resetForm} className="text-sm text-volt hover:underline">Cancel</button>}
          </div>

          <form onSubmit={submitTitle} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-mist">
                <span>Type</span>
                <select name="type" value={form.type} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow">
                  <option value="movie">Movie</option>
                  <option value="series">Series</option>
                  <option value="anime">Anime</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-mist">
                <span>Year</span>
                <input name="year" type="number" value={form.year} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" />
              </label>
            </div>

            <label className="block space-y-1 text-sm text-mist">
              <span>Title</span>
              <input name="title" value={form.title} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="Title name" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => importMetadata("tmdb")} className="rounded-md border border-line bg-raised px-3 py-2 text-xs font-semibold text-snow hover:border-volt">Import from TMDB</button>
              <button type="button" onClick={() => importMetadata("anilist")} className="rounded-md border border-line bg-raised px-3 py-2 text-xs font-semibold text-snow hover:border-volt">Import from AniList</button>
            </div>

            <label className="block space-y-1 text-sm text-mist">
              <span>Description</span>
              <textarea name="description" value={form.description} onChange={handleChange} rows={4} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="Short plot summary" />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-mist">
                <span>Maturity</span>
                <input name="maturity" value={form.maturity} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="PG" />
              </label>
              <label className="space-y-1 text-sm text-mist">
                <span>Duration</span>
                <input name="duration" type="number" value={form.duration} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="Minutes" />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-mist">
                <span>Air status</span>
                <select name="airing_status" value={form.airing_status} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow">
                  <option value="airing">Airing</option>
                  <option value="completed">Completed</option>
                  <option value="upcoming">Upcoming</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-mist">
                <span>Audio</span>
                <select name="audio_mode" value={form.audio_mode} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow">
                  <option value="sub">Sub</option>
                  <option value="dub">Dub</option>
                  <option value="both">Sub and dub</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 text-sm text-mist">
                <label htmlFor="poster-url" className="block">Poster URL</label>
                <div className="flex gap-2">
                  <input id="poster-url" name="poster_url" value={form.poster_url} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="https://..." />
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-line bg-raised px-2 py-2 text-mist hover:text-white">
                    <Upload size={16} aria-hidden="true" />
                    <input type="file" accept="image/*" aria-label="Upload poster image" className="hidden" onChange={(event) => uploadMediaFile("poster", "poster_url", event)} />
                  </label>
                </div>
                {form.poster_url && <div className="mt-2 h-24 w-16 overflow-hidden rounded border border-line"><Art title={form.title || "Poster preview"} src={form.poster_url} /></div>}
                {uploadingField === "poster_url" && <span role="status" className="block text-xs text-volt">Uploading poster…</span>}
              </div>
              <div className="space-y-1 text-sm text-mist">
                <label htmlFor="backdrop-url" className="block">Backdrop URL</label>
                <div className="flex gap-2">
                  <input id="backdrop-url" name="backdrop_url" value={form.backdrop_url} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="https://..." />
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-line bg-raised px-2 py-2 text-mist hover:text-white">
                    <Upload size={16} aria-hidden="true" />
                    <input type="file" accept="image/*" aria-label="Upload backdrop image" className="hidden" onChange={(event) => uploadMediaFile("backdrop", "backdrop_url", event)} />
                  </label>
                </div>
                {form.backdrop_url && <div className="mt-2 aspect-video w-full max-w-56 overflow-hidden rounded border border-line"><Art title={form.title || "Backdrop preview"} src={form.backdrop_url} /></div>}
                {uploadingField === "backdrop_url" && <span role="status" className="block text-xs text-volt">Uploading backdrop…</span>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 text-sm text-mist">
                <label htmlFor="video-url" className="block">Video URL</label>
                <div className="flex gap-2">
                  <input id="video-url" name="video_url" value={form.video_url} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="https://... or /media/..." />
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-line bg-raised px-2 py-2 text-mist hover:text-white">
                    <Upload size={16} aria-hidden="true" />
                    <input type="file" accept=".mp4,.webm,.mov,.m3u8,.ts" aria-label="Upload video file" className="hidden" onChange={(event) => uploadMediaFile("video", "video_url", event)} />
                  </label>
                </div>
                <span className="block text-xs text-mist">MP4, WebM, MOV, or HLS files · up to 2 GB</span>
                {uploadingField === "video_url" && <span role="status" className="block text-xs text-volt">Uploading video…</span>}
              </div>
              <div className="space-y-1 text-sm text-mist">
                <label htmlFor="subtitle-url" className="block">Subtitle URL</label>
                <div className="flex gap-2">
                  <input id="subtitle-url" name="subtitle_url" value={form.subtitle_url} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="https://..." />
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-line bg-raised px-2 py-2 text-mist hover:text-white">
                    <Upload size={16} aria-hidden="true" />
                    <input type="file" accept=".vtt" className="hidden" onChange={(event) => uploadMediaFile("subtitle", "subtitle_url", event)} />
                  </label>
                </div>
                {uploadingField === "subtitle_url" && <span role="status" className="block text-xs text-volt">Uploading subtitles…</span>}
              </div>
            </div>

            <label className="block space-y-1 text-sm text-mist">
              <span>Genres</span>
              <input name="genres" value={form.genres} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="Action, Drama, Sci-Fi" />
            </label>
            <label className="block space-y-1 text-sm text-mist">
              <span>Studios</span>
              <input name="studios" value={form.studios} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="Studio name, another studio" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-mist">
                <span>Franchise / related titles</span>
                <input name="franchise_name" value={form.franchise_name} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="Series or universe name" />
              </label>
              <label className="space-y-1 text-sm text-mist">
                <span>Publish at (optional)</span>
                <input name="publish_at" type="datetime-local" value={form.publish_at} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" />
              </label>
              <label className="space-y-1 text-sm text-mist">
                <span>Trailer URL</span>
                <input name="trailer_url" type="url" value={form.trailer_url} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="https://youtube.com/watch?v=..." />
              </label>
              <label className="space-y-1 text-sm text-mist">
                <span>Artwork theme color</span>
                <input name="theme_color" value={form.theme_color} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="#1f8bff" maxLength={7} />
              </label>
            </div>
            <label className="block space-y-1 text-sm text-mist">
              <span>Cast / staff (comma-separated)</span>
              <input name="cast" value={form.cast} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" placeholder="Name, Name" />
            </label>
            {form.attribution && <p className="text-xs text-mist">{form.attribution}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-mist">
                <span>Popularity</span>
                <input name="popularity" type="number" min="0" max="100" value={form.popularity} onChange={handleChange} className="w-full rounded-md border border-line bg-raised px-3 py-2 text-snow" />
              </label>
              <label className="flex items-center gap-2 pt-7 text-sm text-mist">
                <input name="featured" type="checkbox" checked={form.featured} onChange={handleChange} className="h-4 w-4 accent-brand" />
                Featured title
              </label>
            </div>

            <button type="submit" className="w-full rounded-md bg-volt px-4 py-2 font-medium text-white hover:bg-volt/90">
              {editingId ? "Save title" : "Create title"}
            </button>
          </form>
        </section>
      </div>

      {selectedTitle && selectedTitle.type !== "movie" && (
        <section className="mt-8 rounded-xl border border-line bg-panel p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Episodes for {selectedTitle.title}</h2>
          </div>

          <form onSubmit={addEpisode} className="mb-6 grid gap-4 rounded-lg border border-line bg-raised p-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-mist">
              <span>Season</span>
              <input name="season" type="number" min="1" value={episodeForm.season} onChange={handleEpisodeChange} className="w-full rounded-md border border-line bg-panel px-3 py-2 text-snow" />
            </label>
            <label className="space-y-1 text-sm text-mist">
              <span>Episode #</span>
              <input name="number" type="number" min="1" value={episodeForm.number} onChange={handleEpisodeChange} className="w-full rounded-md border border-line bg-panel px-3 py-2 text-snow" />
            </label>
            <label className="space-y-1 text-sm text-mist md:col-span-2">
              <span>Episode name</span>
              <input name="name" value={episodeForm.name} onChange={handleEpisodeChange} className="w-full rounded-md border border-line bg-panel px-3 py-2 text-snow" placeholder="Episode title" />
            </label>
            <label className="space-y-1 text-sm text-mist md:col-span-2">
              <span>Description</span>
              <textarea name="description" value={episodeForm.description} onChange={handleEpisodeChange} rows={2} className="w-full rounded-md border border-line bg-panel px-3 py-2 text-snow" placeholder="Optional episode summary" />
            </label>
            <label className="space-y-1 text-sm text-mist md:col-span-2">
              <span>Video URL</span>
              <span className="flex gap-2">
                <input name="video_url" value={episodeForm.video_url} onChange={handleEpisodeChange} className="w-full rounded-md border border-line bg-panel px-3 py-2 text-snow" placeholder="https://... or upload a file" />
                <label className="inline-flex cursor-pointer items-center rounded-md border border-line bg-panel px-3 text-mist hover:text-white">
                  <Upload size={16} aria-hidden="true" />
                  <input type="file" accept=".mp4,.webm,.mov,.m3u8,.ts" aria-label="Upload episode video" className="hidden" onChange={uploadEpisodeVideo} />
                </label>
              </span>
              {uploadingField === "episode_video" && <span role="status" className="block text-xs text-volt">Uploading episode…</span>}
            </label>
            <label className="space-y-1 text-sm text-mist">
              <span>Subtitle URL</span>
              <input name="subtitle_url" value={episodeForm.subtitle_url} onChange={handleEpisodeChange} className="w-full rounded-md border border-line bg-panel px-3 py-2 text-snow" placeholder="Optional VTT" />
            </label>
            <label className="space-y-1 text-sm text-mist">
              <span>Duration (minutes)</span>
              <input name="duration" type="number" value={episodeForm.duration} onChange={handleEpisodeChange} className="w-full rounded-md border border-line bg-panel px-3 py-2 text-snow" placeholder="Optional" />
            </label>
            <label className="space-y-1 text-sm text-mist">
              <span>Audio</span>
              <select name="audio_mode" value={episodeForm.audio_mode} onChange={handleEpisodeChange} className="w-full rounded-md border border-line bg-panel px-3 py-2 text-snow">
                <option value="">Use title default</option>
                <option value="sub">Sub</option>
                <option value="dub">Dub</option>
                <option value="both">Sub and dub</option>
              </select>
            </label>
            <details className="rounded-md border border-line p-3 md:col-span-2">
              <summary className="cursor-pointer text-sm font-semibold text-snow">Intro, recap, and credits markers</summary>
              <p className="mt-2 text-xs text-mist">Enter times in seconds. Intro and recap need both a start and end.</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {segmentFields.map(([key, label]) => (
                  <label key={key} className="text-xs text-mist">{label}
                    <input name={key} type="number" min="0" step="0.1" value={episodeForm[key]} onChange={handleEpisodeChange}
                      className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5 text-snow" />
                  </label>
                ))}
              </div>
            </details>
            <div className="md:col-span-2 flex items-center gap-3">
              <button type="submit" className="rounded-md bg-volt px-4 py-2 font-medium text-white hover:bg-volt/90">Add episode</button>
              {uploadingField && <span className="text-sm text-mist">Uploading…</span>}
            </div>
          </form>

          <div className="space-y-3">
            {(selectedTitle.episodes || []).map((episode) => (
              <div key={episode.id} className="flex flex-col gap-3 rounded-lg border border-line bg-raised p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-white">S{episode.season} · E{episode.number} · {episode.name}</p>
                    <p className="text-sm text-mist">{episode.video_url}</p>
                  </div>
                  <div className="flex gap-2">
                    {episode.video_asset_id && <button type="button" onClick={() => generateThumbnail(episode)} className="rounded-md border border-line px-2 py-1 text-sm text-snow hover:border-volt">Generate thumbnail</button>}
                    <button type="button" onClick={() => deleteEpisode(episode.id)} className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-sm text-red-200 hover:border-red-400">
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
                <EpisodeSegmentEditor episode={episode} onSaved={() => loadSelectedTitle(selectedTitle.id)} />
              </div>
            ))}
            {!selectedTitle.episodes?.length && <p className="text-mist">No episodes yet for this title.</p>}
          </div>
        </section>
      )}

      {!selectedTitle && titles.length > 0 && (
        <div className="mt-8 flex items-center gap-2 rounded-md border border-line bg-panel p-4 text-mist">
          <AlertTriangle size={18} /> Select a title to manage episodes.
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel p-4 shadow-sm" aria-labelledby="problem-reports-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="problem-reports-title" className="text-xl font-semibold text-white">Problem reports</h2>
            <span className="rounded-full bg-raised px-2 py-1 text-xs text-mist">{reports.filter((report) => report.status === "open").length} open</span>
          </div>

          <section className="mt-8 rounded-xl border border-line bg-panel p-4 shadow-sm" aria-labelledby="library-scan-title">
            <h2 id="library-scan-title" className="text-xl font-semibold text-white">Library folder scan</h2>
            <p className="mt-1 text-sm text-mist">Scans only server folders explicitly configured in backend/.env. Expected names: Show S01E03.mkv.</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm text-mist">Configured folder
                <select value={scanRootIndex} onChange={(event) => setScanRootIndex(event.target.value)} disabled={!scanRoots.length} className="field-control mt-1 min-w-56">
                  {scanRoots.map((root) => <option key={root.id} value={root.id} disabled={!root.available}>{root.label}{root.available ? "" : " (unavailable)"}</option>)}
                </select>
              </label>
              <label className="text-sm text-mist">Content type
                <select value={scanType} onChange={(event) => setScanType(event.target.value)} className="field-control mt-1">
                  <option value="anime">Anime</option>
                  <option value="series">Series</option>
                </select>
              </label>
              <button type="button" disabled={!scanRoots.some((root) => String(root.id) === scanRootIndex && root.available)} onClick={scanLibrary} className="btn-primary">Scan folder</button>
            </div>
            {!scanRoots.length && <p className="mt-3 text-sm text-mist">No scan roots configured.</p>}
          </section>
          <div className="space-y-3">
            {reports.slice(0, 8).map((report) => (
              <article key={report.id} className="rounded-lg border border-line bg-raised p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{report.title}{report.episode_id ? ` · Episode ${report.episode_id}` : ""}</p>
                  <button type="button" onClick={() => resolveReport(report)} className="rounded border border-line px-2 py-1 text-xs font-bold text-volt hover:bg-panel">
                    {report.status === "open" ? "Resolve" : "Reopen"}
                  </button>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-mist">{report.category.replaceAll("_", " ")} · {report.email}</p>
                {report.details && <p className="mt-2 text-sm text-snow/80">{report.details}</p>}
              </article>
            ))}
            {!reports.length && <p className="text-sm text-mist">No problem reports yet.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-panel p-4 shadow-sm" aria-labelledby="playback-health-title">
          <h2 id="playback-health-title" className="mb-4 text-xl font-semibold text-white">Playback health</h2>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {playbackStats.filter((item) => item.plays || item.errors).map((item) => (
              <div key={item.title_id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-raised px-3 py-2">
                <span className="truncate text-sm font-medium text-white">{item.title}</span>
                <span className="shrink-0 text-xs text-mist">{item.plays} plays · <span className={item.errors ? "text-red-300" : ""}>{item.errors} errors</span></span>
              </div>
            ))}
            {!playbackStats.some((item) => item.plays || item.errors) && <p className="text-sm text-mist">Playback metrics appear as viewers watch titles.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
