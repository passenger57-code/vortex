import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import Auth from "./pages/Auth.jsx";
import Profiles from "./pages/Profiles.jsx";
import Browse from "./pages/Browse.jsx";
import MyList from "./pages/MyList.jsx";
import Search from "./pages/Search.jsx";
import History from "./pages/History.jsx";
import Watch from "./pages/Watch.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import Settings from "./pages/Settings.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import BrowseBy, { BrowseGrid } from "./pages/BrowseBy.jsx";

export default function App() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("vortex_splash_seen")) return undefined;
    sessionStorage.setItem("vortex_splash_seen", "1");
    setShowSplash(true);
    const timer = setTimeout(() => setShowSplash(false), 1250);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/profiles" element={<Profiles />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Browse />} />
          <Route path="/series" element={<Browse type="series" title="Series" />} />
          <Route path="/movies" element={<Browse type="movie" title="Movies" />} />
          <Route path="/anime" element={<Browse type="anime" title="Anime" />} />
          <Route path="/browse-by" element={<BrowseBy />} />
          <Route path="/browse/genre/:slug" element={<BrowseGrid category="genre" />} />
          <Route path="/browse/year/:year" element={<BrowseGrid category="year" />} />
          <Route path="/browse/studio/:slug" element={<BrowseGrid category="studio" />} />
          <Route path="/my-list" element={<MyList />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/search" element={<Search />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/watch/:id" element={<Watch />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AnimatePresence>
        {showSplash && (
          <motion.div key="vortex-splash" role="status" aria-label="Vortex" initial={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }} className="fixed inset-0 z-[100] grid place-items-center bg-ink">
            <motion.img src="/logo-emblem.png" alt="" initial={{ opacity: 0, scale: 0.65, rotate: -25 }}
              animate={{ opacity: 1, scale: [0.65, 1.08, 1], rotate: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-auto w-44 max-h-32 object-contain drop-shadow-[0_0_32px_rgba(31,139,255,0.65)]" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
