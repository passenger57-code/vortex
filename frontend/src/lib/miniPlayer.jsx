import { createContext, useCallback, useContext, useMemo, useState } from "react";

const MiniPlayerContext = createContext(null);

export function MiniPlayerProvider({ children }) {
  const [miniPlayer, setMiniPlayer] = useState(null);
  const startMiniPlayer = useCallback((details) => {
    setMiniPlayer({ ...details, instanceId: `${details.titleId}-${Date.now()}` });
  }, []);
  const closeMiniPlayer = useCallback(() => setMiniPlayer(null), []);
  const updateMiniPlayerTime = useCallback((currentTime) => {
    setMiniPlayer((current) => {
      if (!current || Math.floor(current.currentTime) === Math.floor(currentTime)) return current;
      return { ...current, currentTime };
    });
  }, []);
  const value = useMemo(() => ({
    miniPlayer, startMiniPlayer, closeMiniPlayer, updateMiniPlayerTime,
  }), [miniPlayer, startMiniPlayer, closeMiniPlayer, updateMiniPlayerTime]);

  return <MiniPlayerContext.Provider value={value}>{children}</MiniPlayerContext.Provider>;
}

export function useMiniPlayer() {
  const value = useContext(MiniPlayerContext);
  if (!value) throw new Error("useMiniPlayer must be used within MiniPlayerProvider.");
  return value;
}
