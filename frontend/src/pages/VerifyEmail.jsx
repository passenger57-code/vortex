import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return;
    api.post("/auth/verification/confirm", { token })
      .then((result) => setMessage(result.message))
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false));
  }, [token]);

  const resend = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await api.post("/auth/verification/resend", { email });
      setMessage(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <section className="surface-panel w-full max-w-md p-6 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-volt">Account security</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-white">{token ? "Verify your email" : "Resend verification"}</h1>
        {token ? <p role={busy ? "status" : "alert"} className="mt-4 text-sm text-mist">{busy ? "Checking your verification link…" : error || message}</p> : (
          <form onSubmit={resend} className="mt-5 space-y-4">
            <label className="block text-sm text-mist">Email address
              <input className="field-control mt-1 py-3" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? "Sending…" : "Send verification email"}</button>
          </form>
        )}
        <Link to="/auth" className="mt-6 inline-block text-sm font-semibold text-snow hover:underline">Back to sign in</Link>
      </section>
    </main>
  );
}
