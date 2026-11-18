import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth.jsx";

const ListContext = createContext(null);
export const useList = () => useContext(ListContext);

/** The active profile's My List, kept in sync for every card and modal. */
export function ListProvider({ children }) {
  const { profileId } = useAuth();
  const [ids, setIds] = useState(new Set());
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!profileId) return;
    api.get("/me/list/ids").then((a) => setIds(new Set(a))).catch(() => {});
  }, [profileId]);

  const toggle = useCallback(async (id) => {
    const has = ids.has(id);
    setIds((s) => { const n = new Set(s); has ? n.delete(id) : n.add(id); return n; });
    try {
      await (has ? api.del(`/me/list/${id}`) : api.post(`/me/list/${id}`));
      setVersion((v) => v + 1);
      setToast({ message: has ? "Removed from My List" : "Added to My List", undo: { id, wasAdded: !has } });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6500);
    } catch {
      setIds((s) => { const n = new Set(s); has ? n.add(id) : n.delete(id); return n; });
      setToast({ message: "Could not update My List. Try again.", undo: null });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    }
  }, [ids]);

  const undo = useCallback(async () => {
    if (!toast?.undo) return;
    const { id, wasAdded } = toast.undo;
    try {
      await (wasAdded ? api.del(`/me/list/${id}`) : api.post(`/me/list/${id}`));
      setIds((current) => { const next = new Set(current); wasAdded ? next.delete(id) : next.add(id); return next; });
      setVersion((value) => value + 1);
      setToast({ message: wasAdded ? "Removed from My List" : "Restored to My List", undo: null });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    } catch {
      setToast({ message: "Could not undo that change. Try again.", undo: null });
    }
  }, [toast]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  return (
    <ListContext.Provider value={{ has: (id) => ids.has(id), toggle, version }}>
      {children}
      {toast && (
        <div role={toast.undo ? "status" : "alert"} className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-[80] flex w-[min(94vw,28rem)] -translate-x-1/2 items-center gap-4 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-white shadow-2xl md:bottom-6">
          <span className="flex-1">{toast.message}</span>
          {toast.undo && <button type="button" onClick={undo} className="font-bold text-volt hover:text-white">Undo</button>}
        </div>
      )}
    </ListContext.Provider>
  );
}
