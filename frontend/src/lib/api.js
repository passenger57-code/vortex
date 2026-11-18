const BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, { method = "GET", body, keepalive } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("vortex_token");
  const profile = sessionStorage.getItem("vortex_profile");
  if (token) headers.Authorization = `Bearer ${token}`;
  if (profile) headers["X-Profile-Id"] = profile;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, keepalive, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Can't reach the server. Check that the backend is running.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event("vortex:unauthorized"));
    throw new Error(data?.error || "Something went wrong. Try again.");
  }
  return data;
}

async function upload(path, file, kind) {
  const formData = new FormData();
  formData.append("file", file);
  if (kind) formData.append("kind", kind);

  const headers = {};
  const token = localStorage.getItem("vortex_token");
  const profile = sessionStorage.getItem("vortex_profile");
  if (token) headers.Authorization = `Bearer ${token}`;
  if (profile) headers["X-Profile-Id"] = profile;

  let res;
  try {
    res = await fetch(BASE + path, { method: "POST", headers, body: formData });
  } catch {
    throw new Error("Can't reach the server. Check that the backend is running.");
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event("vortex:unauthorized"));
    throw new Error(data?.error || "Upload failed. Try again.");
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: "POST", body }),
  put: (p, body, opts = {}) => request(p, { method: "PUT", body, ...opts }),
  patch: (p, body) => request(p, { method: "PATCH", body }),
  del: (p, body) => request(p, { method: "DELETE", body }),
  upload,
};
