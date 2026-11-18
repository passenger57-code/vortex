import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { getPlayerPreferences, PLAYBACK_RATES, savePlayerPreferences } from "../lib/preferences.js";
import { api } from "../lib/api.js";
import { promptInstall, subscribeToInstallPrompt } from "../lib/pwa.js";

function InstallApp() {
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState("");
  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;

  useEffect(() => subscribeToInstallPrompt(setAvailable), []);

  if (!available && !ios) return null;
  return (
    <section className="surface-panel mt-5 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-xl font-bold text-white">Install Vortex</h2>
        <p className="mt-1 text-sm text-mist">{ios ? "Use Share → Add to Home Screen to install Vortex." : "Add Vortex to your home screen for a full-screen app experience."}</p>
        {message && <p role="status" className="mt-2 text-sm text-mist">{message}</p>}
      </div>
      {available && <button type="button" onClick={async () => {
        const installed = await promptInstall();
        setMessage(installed ? "Vortex installed." : "Installation was dismissed.");
      }} className="btn-secondary">Install app</button>}
    </section>
  );
}

export default function Settings() {
  const { profile, profileId, user, logout } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(() => getPlayerPreferences(profileId));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "" });
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get("/auth/sessions")
      .then((data) => { if (active) setSessions(data); })
      .catch((err) => { if (active) setAccountError(err.message); })
      .finally(() => { if (active) setSessionsLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    setPreferences(getPlayerPreferences(profileId));
    setSaved(false);
  }, [profileId]);

  const update = (next) => {
    setError("");
    setSaved(false);
    try {
      savePlayerPreferences(profileId, next);
      setPreferences(next);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setAccountError("");
    setAccountMessage("");
    setAccountBusy(true);
    try {
      await api.post("/auth/password/change", { current_password: passwords.current, new_password: passwords.next });
      setAccountMessage("Password changed. Sign in again on your devices.");
      setPasswords({ current: "", next: "" });
      logout();
      navigate("/auth", { replace: true });
    } catch (err) {
      setAccountError(err.message);
    } finally {
      setAccountBusy(false);
    }
  };

  const revokeSessions = async () => {
    setAccountError("");
    setAccountBusy(true);
    try {
      await api.post("/auth/sessions/revoke", {});
      logout();
      navigate("/auth", { replace: true });
    } catch (err) {
      setAccountError(err.message);
      setAccountBusy(false);
    }
  };

  const revokeSession = async (session) => {
    setAccountError("");
    setAccountBusy(true);
    try {
      await api.del(`/auth/sessions/${encodeURIComponent(session.id)}`);
      if (session.current) {
        logout();
        navigate("/auth", { replace: true });
        return;
      }
      setSessions((current) => current.filter((item) => item.id !== session.id));
    } catch (err) {
      setAccountError(err.message);
    } finally {
      setAccountBusy(false);
    }
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    setAccountError("");
    if (deleteConfirmation !== "DELETE") {
      setAccountError('Type "DELETE" to confirm account deletion.');
      return;
    }
    setAccountBusy(true);
    try {
      await api.del("/auth/me", { password: deletePassword });
      logout();
      navigate("/auth", { replace: true });
    } catch (err) {
      setAccountError(err.message);
      setAccountBusy(false);
    }
  };

  return (
    <main className="pad-x mx-auto max-w-3xl pb-20 pt-28">
      <p className="text-sm uppercase tracking-[0.18em] text-volt">Preferences</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-white sm:text-4xl">Settings</h1>
      <p className="mt-2 text-sm text-mist">Playback preferences for {profile?.name || "this profile"}, saved on this device.</p>
      <InstallApp />

      <section className="surface-panel mt-8 space-y-6 p-5 sm:p-6" aria-labelledby="playback-settings">
        <div>
          <h2 id="playback-settings" className="font-display text-xl font-bold text-white">Playback</h2>
          <p className="mt-1 text-sm text-mist">These settings apply when the browser supports the selected media.</p>
        </div>
        <label className="flex flex-col gap-2 text-sm text-snow sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="block font-semibold">Default playback speed</span>
            <span className="mt-1 block text-mist">You can still change speed from your browser’s video controls.</span>
          </span>
          <select value={preferences.playbackRate} onChange={(event) => update({ ...preferences, playbackRate: Number(event.target.value) })}
            className="min-h-11 rounded-md border border-line bg-raised px-3 text-snow">
            {PLAYBACK_RATES.map((rate) => <option key={rate} value={rate}>{rate === 1 ? "Normal" : `${rate}×`}</option>)}
          </select>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-raised/50 p-4">
          <input type="checkbox" checked={preferences.subtitlesEnabled} onChange={(event) => update({ ...preferences, subtitlesEnabled: event.target.checked })}
            className="mt-1 h-4 w-4 accent-volt" />
          <span>
            <span className="block font-semibold text-snow">Show subtitles by default</span>
            <span className="mt-1 block text-sm text-mist">Uses the available subtitle track when a title provides one.</span>
          </span>
        </label>
        {saved && <p role="status" className="text-sm text-emerald-300">Settings saved on this device.</p>}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </section>

      <section className="surface-panel mt-5 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6" aria-labelledby="session-settings">
        <div>
          <h2 id="session-settings" className="font-display text-xl font-bold text-white">Account</h2>
          <p className="mt-1 text-sm text-mist">{user?.email} · {user?.email_verified ? "Email verified" : "Email not verified"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { logout(); navigate("/auth", { replace: true }); }} className="btn-secondary">Sign out</button>
          <button type="button" disabled={accountBusy} onClick={revokeSessions} className="btn-secondary">Sign out everywhere</button>
        </div>
      </section>

      <section className="surface-panel mt-5 p-5 sm:p-6" aria-labelledby="active-sessions">
        <h2 id="active-sessions" className="font-display text-xl font-bold text-white">Active sessions</h2>
        <p className="mt-1 text-sm text-mist">Review signed-in devices and end any session you no longer recognize.</p>
        {sessionsLoading ? <p role="status" className="mt-4 text-sm text-mist">Loading sessions…</p> : sessions.length === 0 ? (
          <p className="mt-4 text-sm text-mist">No active sessions found.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {sessions.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-snow">{session.current ? "This device" : session.user_agent || "Unknown device"}</p>
                  <p className="mt-1 text-xs text-mist">Last active {new Date(session.last_seen_at).toLocaleString()}</p>
                </div>
                <button type="button" disabled={accountBusy} onClick={() => revokeSession(session)}
                  className="min-h-9 rounded-md border border-line px-3 text-sm text-snow hover:border-red-400 hover:text-red-200">
                  {session.current ? "Sign out" : "End session"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-panel mt-5 p-5 sm:p-6" aria-labelledby="password-settings">
        <h2 id="password-settings" className="font-display text-xl font-bold text-white">Change password</h2>
        <form onSubmit={changePassword} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-mist">Current password
            <input className="field-control mt-1 py-3" type="password" autoComplete="current-password" required value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} />
          </label>
          <label className="text-sm text-mist">New password (at least 8 characters)
            <input className="field-control mt-1 py-3" type="password" autoComplete="new-password" minLength={8} required value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} />
          </label>
          <button type="submit" disabled={accountBusy} className="btn-primary sm:col-span-2">{accountBusy ? "Working…" : "Change password"}</button>
        </form>
      </section>

      <section className="surface-panel mt-5 border-red-500/30 p-5 sm:p-6" aria-labelledby="delete-account">
        <h2 id="delete-account" className="font-display text-xl font-bold text-white">Delete account</h2>
        <p className="mt-1 text-sm text-mist">Permanently remove your account, profiles, watch history, and saved list. This cannot be undone.</p>
        <form onSubmit={deleteAccount} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-mist">Confirm your password
            <input className="field-control mt-1 py-3" type="password" autoComplete="current-password" required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
          </label>
          <label className="text-sm text-mist">Type DELETE to confirm
            <input className="field-control mt-1 py-3" required value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />
          </label>
          <button type="submit" disabled={accountBusy} className="min-h-11 rounded-md border border-red-400/60 px-4 font-bold text-red-200 hover:bg-red-500/10 sm:col-span-2">Delete account permanently</button>
        </form>
      </section>
      {accountError && <p role="alert" className="mt-4 text-sm text-red-300">{accountError}</p>}
      {accountMessage && <p role="status" className="mt-4 text-sm text-emerald-200">{accountMessage}</p>}
    </main>
  );
}
