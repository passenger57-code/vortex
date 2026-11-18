import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth.jsx";

export default function Profiles() {
  const { token, loading, profiles, selectProfile, addProfile, removeProfile, logout } = useAuth();
  const nav = useNavigate();
  const [manage, setManage] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  if (loading) return <main className="grid min-h-screen place-items-center"><LoaderCircle className="animate-spin text-volt" aria-label="Loading profiles" /></main>;
  if (!token) return <Navigate to="/auth" replace />;

  const pick = (id) => { selectProfile(id); nav("/"); };
  const create = async (e) => {
    e.preventDefault();
    setError("");
    try { await addProfile(name.trim()); setName(""); setAdding(false); }
    catch (err) { setError(err.message); }
  };
  const remove = async (id) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile || !window.confirm(`Delete the "${profile.name}" profile and its watch history?`)) return;
    setError("");
    setDeletingId(id);
    try { await removeProfile(id); } catch (err) { setError(err.message); }
    finally { setDeletingId(null); }
  };

  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-10">
      <img src="/logo-wordmark.png" alt="Vortex" className="h-9 w-auto" />
      <div className="flex flex-1 flex-col items-center justify-center">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Who is watching?</h1>
        <ul className="mt-10 flex max-w-5xl flex-wrap justify-center gap-5 sm:gap-8">
          {profiles.map((p) => (
            <li key={p.id} className={`group relative w-24 text-center sm:w-36 ${manage ? "rounded-xl bg-red-500/5 p-2 ring-1 ring-red-400/40" : "p-2"}`}>
              <button type="button" onClick={() => (manage ? null : pick(p.id))} aria-label={manage ? p.name : `Watch as ${p.name}`}
                className="block w-full rounded-lg focus-visible:ring-2 focus-visible:ring-cyan-glow">
                <span className="block overflow-hidden rounded-lg ring-2 ring-transparent transition duration-200 group-hover:ring-snow group-hover:shadow-glow">
                  <span className="grid aspect-square w-full place-items-center rounded-lg font-display text-4xl font-bold text-white sm:text-5xl" style={{ background: `linear-gradient(145deg, ${p.color || "#1f8bff"}, #101b2e)` }}>{p.name.charAt(0).toUpperCase()}</span>
                </span>
                <span className="mt-3 block text-mist transition-colors group-hover:text-snow">{p.name}</span>
              </button>
              {manage && (
                <button type="button" onClick={() => remove(p.id)} disabled={deletingId === p.id} aria-label={`Delete ${p.name}`}
                  className="absolute inset-x-2 top-2 grid aspect-square place-items-center rounded-lg bg-black/70 text-red-300 hover:text-red-200 disabled:opacity-50">
                  {deletingId === p.id ? <LoaderCircle size={28} className="animate-spin" /> : <Trash2 size={28} />}
                </button>
              )}
            </li>
          ))}
          {profiles.length < 5 && (
            <li className="w-28 text-center sm:w-36">
              {adding ? (
                <form onSubmit={create} className="space-y-2">
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={40} required aria-label="Profile name"
                    className="w-full rounded-md border border-line bg-raised px-3 py-2 text-center text-sm focus:border-volt focus:outline-none" />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 rounded bg-volt py-1.5 text-sm font-bold">Save</button>
                    <button type="button" onClick={() => { setAdding(false); setName(""); }} className="flex-1 rounded bg-raised py-1.5 text-sm">Cancel</button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="group block w-full">
                  <span className="grid aspect-square w-full place-items-center rounded-lg border-2 border-dashed border-line text-mist transition group-hover:border-snow group-hover:text-snow">
                    <Plus size={44} />
                  </span>
                  <span className="mt-3 block text-mist group-hover:text-snow">Add profile</span>
                </button>
              )}
            </li>
          )}
        </ul>
        {profiles.length >= 5 && <p className="mt-5 text-sm text-mist">You’ve reached the 5-profile limit.</p>}
        {error && <p role="alert" className="mt-6 text-sm text-red-300">{error}</p>}
        <div className="mt-12 flex gap-4">
          <button type="button" onClick={() => setManage(!manage)}
            className="rounded-md border border-mist px-6 py-2 text-mist transition hover:border-snow hover:text-snow">
            {manage ? "Done" : "Manage profiles"}
          </button>
          <button type="button" onClick={() => { logout(); nav("/auth"); }}
            className="rounded-md px-6 py-2 text-mist transition hover:text-snow">Sign out</button>
        </div>
      </div>
    </main>
  );
}
