import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";

export default function Auth() {
  const { token, login, register } = useAuth();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState("login");
  const resetToken = searchParams.get("token");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmation: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (resetToken) setMode("reset");
  }, [resetToken]);
  if (token) return <Navigate to="/profiles" replace />;
  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((current) => ({ ...current, [k]: value }));
    setFieldErrors((current) => ({ ...current, [k]: "" }));
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    const nextErrors = {};
    if (mode !== "reset" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (mode === "register" && form.password.length < 6) nextErrors.password = "Use at least 6 characters.";
    if (mode === "reset" && form.password.length < 8) nextErrors.password = "Use at least 8 characters.";
    if (mode === "reset" && form.password !== form.confirmation) nextErrors.confirmation = "Passwords do not match.";
    if (mode === "register" && !form.name.trim()) nextErrors.name = "Enter a name for your profile.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else if (mode === "register") {
        const result = await register(form.email, form.password, form.name);
        if (result.verification_required) {
          setNotice(`Check ${result.email} for a verification link before signing in.`);
          setMode("login");
          return;
        }
      } else if (mode === "forgot") {
        await api.post("/auth/password/forgot", { email: form.email });
        setNotice("If the account is eligible, an email with reset instructions will arrive shortly.");
        setMode("login");
        return;
      } else {
        await api.post("/auth/password/reset", { token: resetToken, password: form.password });
        setNotice("Password updated. Sign in with your new password.");
        setMode("login");
        setForm((current) => ({ ...current, password: "", confirmation: "" }));
        setSearchParams({});
        return;
      }
      nav("/profiles");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = "field-control py-3";

  return (
    <main className="relative grid min-h-screen overflow-hidden lg:grid-cols-[1.15fr_1fr]">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-1/4 h-[40rem] w-[40rem] rounded-full bg-volt/20 blur-[140px]" />

      <section className="relative flex flex-col items-center justify-center px-6 pb-4 pt-10 lg:py-16">
        <motion.img src="/logo-emblem.png" alt="Vortex" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: "easeOut" }}
          className="w-[min(30rem,80%)]" />
        <img src="/logo-wordmark.png" alt="" className="-mt-4 w-[min(34rem,90%)]" />
        <p className="mt-4 font-display text-sm italic tracking-[0.35em] text-snow/80 sm:text-base">MOVIES  SERIES  ANIME</p>
      </section>

      <section className="relative flex items-center justify-center px-6 pb-14 pt-4 lg:py-16">
        <form noValidate onSubmit={submit} className="w-full max-w-md rounded-xl border border-line bg-panel/90 p-8 shadow-glow backdrop-blur">
          <h1 className="font-display text-3xl font-bold">
            {mode === "login" ? "Sign in" : mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Choose a new password"}
          </h1>
          <div className="mt-6 space-y-4">
            {mode === "register" && (
              <div>
                <label className="block"><span className="mb-1 block text-sm text-mist">Your name</span>
                  <input className={`${field} ${fieldErrors.name ? "border-red-400" : ""}`} value={form.name} onChange={set("name")} placeholder="Shown on your profile" autoComplete="nickname" maxLength={40} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "name-error" : undefined} /></label>
                {fieldErrors.name && <p id="name-error" className="mt-1 text-sm text-red-300">{fieldErrors.name}</p>}
              </div>
            )}
            {mode !== "reset" && <div>
              <label className="block"><span className="mb-1 block text-sm text-mist">Email</span>
                <input className={`${field} ${fieldErrors.email ? "border-red-400" : ""}`} type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} /></label>
              {fieldErrors.email && <p id="email-error" className="mt-1 text-sm text-red-300">{fieldErrors.email}</p>}
            </div>}
            {mode !== "forgot" && <div>
              <label htmlFor="auth-password" className="mb-1 block text-sm text-mist">Password</label>
              <div className="relative">
                <input id="auth-password" className={`${field} pr-12 ${fieldErrors.password ? "border-red-400" : ""}`} type={showPassword ? "text" : "password"} required minLength={mode === "register" ? 6 : mode === "reset" ? 8 : undefined} value={form.password} onChange={set("password")}
                  placeholder={mode === "register" ? "At least 6 characters" : mode === "reset" ? "At least 8 characters" : "Your password"} autoComplete={mode === "login" ? "current-password" : "new-password"} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : undefined} />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-1 grid w-10 place-items-center rounded text-mist hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-glow">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && <p id="password-error" className="mt-1 text-sm text-red-300">{fieldErrors.password}</p>}
            </div>}
            {(mode === "reset") && <div>
              <label htmlFor="auth-confirmation" className="mb-1 block text-sm text-mist">Confirm new password</label>
              <input id="auth-confirmation" className={`${field} ${fieldErrors.confirmation ? "border-red-400" : ""}`} type="password" required value={form.confirmation} onChange={set("confirmation")} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.confirmation)} />
              {fieldErrors.confirmation && <p className="mt-1 text-sm text-red-300">{fieldErrors.confirmation}</p>}
            </div>}
          </div>
          {error && <p role="alert" className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          {notice && <p role="status" className="mt-4 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</p>}
          <button type="submit" disabled={busy} aria-busy={busy}
            className="btn-primary mt-6 w-full disabled:cursor-wait">
            {busy ? "One moment..." : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}
          </button>
          {mode === "login" && <button type="button" onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}
            className="mt-4 block w-full text-center text-sm font-semibold text-snow hover:underline">Forgot password?</button>}
          <p className="mt-6 text-center text-sm text-mist">
            {mode === "login" ? "New to Vortex? " : mode === "register" ? "Already have an account? " : "Remembered your password? "}
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setNotice(""); setFieldErrors({}); setShowPassword(false); }}
              className="font-bold text-snow hover:underline">
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          {mode === "login" && <Link to="/verify-email" className="mt-3 block text-center text-sm text-mist hover:text-white">Resend verification email</Link>}
        </form>
      </section>
    </main>
  );
}
