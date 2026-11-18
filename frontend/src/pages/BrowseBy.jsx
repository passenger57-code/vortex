import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import TitleCard from "../components/TitleCard.jsx";

const EMPTY_FACETS = { genres: [], years: [], studios: [], audio_modes: ["sub", "dub"], statuses: ["airing", "completed", "upcoming"] };
const SORTS = [
  ["popular", "Most popular"],
  ["newest", "Newest year"],
  ["oldest", "Oldest year"],
  ["title-asc", "Title A–Z"],
  ["title-desc", "Title Z–A"],
  ["recently-added", "Recently added"],
];
const PAGE_SIZE = 60;

function useFacets() {
  const [facets, setFacets] = useState(EMPTY_FACETS);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/browse/facets")
      .then((data) => { if (active) setFacets(data); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  return { facets, error };
}

function FacetLink({ to, children }) {
  return (
    <Link to={to} className="surface-panel flex min-h-20 items-center justify-between gap-3 p-4 transition hover:border-volt/60 hover:bg-raised">
      <span className="font-semibold text-snow">{children}</span>
      <span aria-hidden="true" className="text-xl text-volt">→</span>
    </Link>
  );
}

export default function BrowseBy() {
  const { facets, error } = useFacets();
  return (
    <main className="pad-x mx-auto max-w-7xl pb-24 pt-28">
      <p className="text-sm uppercase tracking-[0.18em] text-volt">Discover</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-white sm:text-4xl">Browse by</h1>
      {error && <p role="alert" className="mt-4 text-red-300">{error}</p>}

      <section className="mt-8" aria-labelledby="browse-genres">
        <h2 id="browse-genres" className="mb-3 font-display text-xl font-bold text-white">Genres</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {facets.genres.map((genre) => <FacetLink key={genre.slug} to={`/browse/genre/${encodeURIComponent(genre.slug)}`}>{genre.name}</FacetLink>)}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="browse-years">
        <h2 id="browse-years" className="mb-3 font-display text-xl font-bold text-white">Years</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {facets.years.map((year) => <FacetLink key={year} to={`/browse/year/${year}`}>{year}</FacetLink>)}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="browse-studios">
        <h2 id="browse-studios" className="mb-3 font-display text-xl font-bold text-white">Studios</h2>
        {facets.studios.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facets.studios.map((studio) => <FacetLink key={studio.slug} to={`/browse/studio/${encodeURIComponent(studio.slug)}`}>{studio.name}</FacetLink>)}
          </div>
        ) : <p className="rounded-xl border border-line bg-panel p-4 text-sm text-mist">Studio pages will appear as titles are given studio metadata.</p>}
      </section>
    </main>
  );
}

export function BrowseGrid({ category }) {
  const { slug, year } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { facets, error: facetsError } = useFacets();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const filters = useMemo(() => ({
    genre: searchParams.get("genre") || (category === "genre" ? slug : "all"),
    year: searchParams.get("year") || (category === "year" ? year : "all"),
    studio: searchParams.get("studio") || (category === "studio" ? slug : "all"),
    audio_mode: searchParams.get("audio_mode") || "all",
    status: searchParams.get("status") || "all",
    sort: searchParams.get("sort") || "popular",
    offset: Math.max(Number(searchParams.get("offset")) || 0, 0),
  }), [category, slug, year, searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(filters.offset), sort: filters.sort });
    for (const key of ["genre", "year", "studio", "audio_mode", "status"]) {
      if (filters[key] !== "all") query.set(key, filters[key]);
    }
    api.get(`/browse/titles?${query}`)
      .then((result) => {
        if (active) {
          setItems(result.items);
          setTotal(result.total);
        }
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters]);

  const changeFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    next.delete("offset");
    const defaultValue = key === "sort" ? "popular" : "all";
    const categoryKey = { genre: "genre", year: "year", studio: "studio" }[category];
    if (value === defaultValue && key === categoryKey) next.set(key, value);
    else if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const changePage = (offset) => {
    const next = new URLSearchParams(searchParams);
    if (offset > 0) next.set("offset", String(offset));
    else next.delete("offset");
    setSearchParams(next, { replace: true });
  };
  const currentPage = Math.floor(filters.offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const genreLabel = facets.genres.find((item) => item.slug === filters.genre)?.name;
  const studioLabel = facets.studios.find((item) => item.slug === filters.studio)?.name;
  const title = category === "genre" ? genreLabel || "Browse genre"
    : category === "year" ? filters.year
      : studioLabel || "Browse studio";

  return (
    <main className="pb-24 pt-24">
      <div className="pad-x mx-auto max-w-7xl">
        <p className="text-sm uppercase tracking-[0.18em] text-volt">Browse {category}</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-white sm:text-4xl">{title}</h1>
        {!loading && !error && <p className="mt-2 text-sm text-mist">{total} titles</p>}
      </div>

      <div className="sticky top-16 z-40 mt-5 border-y border-line/80 bg-ink/95 py-3 shadow-xl backdrop-blur">
        <div className="pad-x mx-auto flex max-w-7xl flex-wrap items-center gap-2">
          <FilterSelect label="Genre" value={filters.genre} onChange={(value) => changeFilter("genre", value)}>
            <option value="all">All genres</option>
            {facets.genres.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Year" value={filters.year} onChange={(value) => changeFilter("year", value)}>
            <option value="all">All years</option>
            {facets.years.map((item) => <option key={item} value={item}>{item}</option>)}
          </FilterSelect>
          <FilterSelect label="Studio" value={filters.studio} onChange={(value) => changeFilter("studio", value)}>
            <option value="all">All studios</option>
            {facets.studios.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Audio" value={filters.audio_mode} onChange={(value) => changeFilter("audio_mode", value)}>
            <option value="all">Sub and dub</option>
            <option value="sub">Sub</option>
            <option value="dub">Dub</option>
          </FilterSelect>
          <FilterSelect label="Status" value={filters.status} onChange={(value) => changeFilter("status", value)}>
            <option value="all">Any status</option>
            {facets.statuses.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
          </FilterSelect>
          <span className="flex-1" />
          <FilterSelect label="Sort" value={filters.sort} onChange={(value) => changeFilter("sort", value)}>
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </FilterSelect>
        </div>
      </div>

      <div className="pad-x mx-auto mt-6 max-w-7xl">
        {(error || facetsError) && <p role="alert" className="mb-4 text-red-300">{error || facetsError}</p>}
        {loading ? (
          <div aria-label="Loading titles" className="grid grid-cols-2 gap-x-2 gap-y-16 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((index) => <div key={index} className="skeleton-block aspect-video" />)}
          </div>
        ) : error ? null : items.length ? (
          <div className="grid grid-cols-2 gap-x-2 gap-y-16 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item) => <TitleCard key={item.id} t={item} grid />)}
          </div>
        ) : (
          <p className="surface-panel p-6 text-mist">No titles match these filters.</p>
        )}
        {!loading && !error && total > PAGE_SIZE && (
          <nav aria-label="Catalog pages" className="mt-8 flex items-center justify-center gap-4">
            <button type="button" disabled={filters.offset === 0} onClick={() => changePage(Math.max(0, filters.offset - PAGE_SIZE))}
              className="min-h-10 rounded-md border border-line px-4 text-sm text-snow hover:border-volt disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <span className="text-sm text-mist">Page {currentPage} of {pageCount}</span>
            <button type="button" disabled={filters.offset + PAGE_SIZE >= total} onClick={() => changePage(filters.offset + PAGE_SIZE)}
              className="min-h-10 rounded-md border border-line px-4 text-sm text-snow hover:border-volt disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </nav>
        )}
      </div>
    </main>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="inline-flex min-h-10 items-center rounded-full border border-line bg-panel px-3 text-xs font-semibold text-snow focus-within:border-volt sm:text-sm">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="max-w-36 bg-transparent py-2 text-snow outline-none sm:max-w-48">
        {children}
      </select>
    </label>
  );
}
