let installPrompt = null;
const listeners = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    listeners.forEach((listener) => listener(true));
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    listeners.forEach((listener) => listener(false));
  });
}

export function subscribeToInstallPrompt(listener) {
  listeners.add(listener);
  listener(Boolean(installPrompt));
  return () => listeners.delete(listener);
}

export async function promptInstall() {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  installPrompt = null;
  await prompt.prompt();
  const result = await prompt.userChoice;
  listeners.forEach((listener) => listener(false));
  return result?.outcome === "accepted";
}
