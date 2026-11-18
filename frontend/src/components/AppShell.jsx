import { useEffect, useLayoutEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { ListProvider } from "../lib/list.jsx";
import { ModalProvider } from "../lib/modal.jsx";
import Navbar from "./Navbar.jsx";
import MobileTabBar from "./MobileTabBar.jsx";
import MiniPlayerDock from "./MiniPlayerDock.jsx";
import { MiniPlayerProvider, useMiniPlayer } from "../lib/miniPlayer.jsx";

const scrollPositions = new Map();

function ScrollTop() {
  const { pathname } = useLocation();
  const previousPath = useRef(null);
  useLayoutEffect(() => {
    const previous = previousPath.current;
    if (previous) scrollPositions.set(previous, window.scrollY);

    if (previous?.startsWith("/watch/") && scrollPositions.has(pathname)) {
      window.scrollTo(0, scrollPositions.get(pathname));
    } else if (!pathname.startsWith("/watch/")) {
      window.scrollTo(0, 0);
    }
    previousPath.current = pathname;
  }, [pathname]);
  return null;
}

/** Guards signed-in routes: needs a token and a chosen profile. Provides My List + info modal. */
export default function AppShell({ withNav = true }) {
  const { token, profileId, loading } = useAuth();
  const { pathname } = useLocation();
  const watchRoute = pathname.startsWith("/watch/");
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        <img
          src="/favicon.png"
          alt="Loading"
          className="h-16 w-16 animate-pulse"
        />
      </div>
    );
  if (!token) return <Navigate to="/auth" replace />;
  if (!profileId) return <Navigate to="/profiles" replace />;
  return (
    <MiniPlayerProvider>
      <ShellContent withNav={withNav && !watchRoute} watchRoute={watchRoute} />
    </MiniPlayerProvider>
  );
}

function ShellContent({ withNav, watchRoute }) {
  const { miniPlayer, closeMiniPlayer } = useMiniPlayer();
  useEffect(() => {
    if (watchRoute && miniPlayer) closeMiniPlayer();
  }, [watchRoute, miniPlayer, closeMiniPlayer]);
  return (
    <ListProvider>
      <ModalProvider>
        <ScrollTop />
        <div className={withNav ? "app-shell-with-tabs" : ""}>
          {withNav && <Navbar />}
          <Outlet />
          {withNav && <MobileTabBar />}
          {!watchRoute && <MiniPlayerDock />}
        </div>
      </ModalProvider>
    </ListProvider>
  );
}
