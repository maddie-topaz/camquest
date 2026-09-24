"use client";

import { useEffect, useMemo } from "react";
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { AudioProvider } from "@/app/audio-provider";
import { DevTools } from "@/app/dev-tools";
import { GameProvider, useGame } from "@/app/game-provider";
import { QueryProvider } from "@/app/query-provider";
import { getQuest, type QuestDefinition } from "@/lib/game/content/quests";
import { Archive } from "./game-ui/archive";
import { Inventory } from "./game-ui/inventory";
import { Lobby } from "./game-ui/lobby";
import { Portal } from "./game-ui/portal";
import { Profile } from "./game-ui/profile";
import { Completion } from "./game-ui/quest-completion";
import { Intro } from "./game-ui/quest-intro";
import { QuestLog } from "./game-ui/quest-log";
import { Challenge } from "./game-ui/quest-play";
import { Shell } from "./game-ui/shell";

function BrowserUrlSync() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const nextUrl = `${location.pathname}${location.search}${location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.pushState({}, "", nextUrl);
  }, [location]);

  useEffect(() => {
    const syncFromBrowser = () =>
      navigate(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
        { replace: true },
      );
    window.addEventListener("popstate", syncFromBrowser);
    return () => window.removeEventListener("popstate", syncFromBrowser);
  }, [navigate]);

  return null;
}

function RouteQuest({
  children,
}: {
  children: (quest: QuestDefinition) => React.ReactNode;
}) {
  const { slug } = useParams();
  const quest = useMemo(() => getQuest(slug || ""), [slug]);
  if (!quest || quest.status === "coming-soon") return <Portal />;
  return <>{children(quest)}</>;
}

// Direct-loads a locked destination (bookmark, stale link, someone typing
// a URL) get sent back to the lobby instead of the system rendering with
// no data behind it. Waits for the save before judging: `view` is
// undefined while loading, so an unlocked flash never happens.
function RequireSystem({
  system,
  children,
}: {
  system: string;
  children: React.ReactNode;
}) {
  const { view } = useGame();
  if (view?.save && !view.save.world.unlockedSystems.includes(system))
    return <Navigate to="/lobby" replace />;
  return <>{children}</>;
}

const QuestIntroRoute = () => (
  <RouteQuest>{(quest) => <Intro quest={quest} />}</RouteQuest>
);
const ChallengeRoute = () => (
  <RouteQuest>{(quest) => <Challenge quest={quest} />}</RouteQuest>
);
const CompletionRoute = () => (
  <RouteQuest>{(quest) => <Completion quest={quest} />}</RouteQuest>
);

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Portal />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/quest-log" element={<QuestLog />} />
      <Route path="/quests" element={<Navigate to="/quest-log" replace />} />
      <Route
        path="/archive"
        element={
          <RequireSystem system="archive">
            <Archive />
          </RequireSystem>
        }
      />
      <Route
        path="/inventory"
        element={
          <RequireSystem system="inventory">
            <Inventory />
          </RequireSystem>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireSystem system="profile">
            <Profile />
          </RequireSystem>
        }
      />
      <Route
        path="/dev"
        element={
          <Shell>
            <DevTools />
          </Shell>
        }
      />
      <Route path="/reset" element={<Navigate to="/dev" replace />} />
      <Route path="/quest/:slug" element={<QuestIntroRoute />} />
      <Route path="/quest/:slug/play" element={<ChallengeRoute />} />
      <Route path="/quest/:slug/complete" element={<CompletionRoute />} />
    </Routes>
  );
}

export function GameApp({ initialPath = "/" }: { initialPath?: string }) {
  // Keep one router mounted for the lifetime of the app so the CRT boot
  // sequence is not restarted when hydration completes.
  return (
    <QueryProvider>
      <AudioProvider>
        <GameProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <BrowserUrlSync />
            <AppRoutes />
          </MemoryRouter>
        </GameProvider>
      </AudioProvider>
    </QueryProvider>
  );
}
