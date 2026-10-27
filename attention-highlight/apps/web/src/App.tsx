import { useCallback, useEffect, useState } from "react";
import type { Level } from "@attention/schema";
import { ClassroomScreen } from "./screens/ClassroomScreen.tsx";
import { ParentScreen } from "./screens/ParentScreen.tsx";
import { PlayScreen } from "./screens/PlayScreen.tsx";
import { ReportScreen } from "./screens/ReportScreen.tsx";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { DRAFT_PACKAGE, findLevel } from "./levels/levels.ts";
import { HEAT_MODES } from "./game/domain.ts";
import type { HeatMode } from "./game/domain.ts";
import { pickSentence, recordSession, saveDraft, seedDemoProgress } from "./game/progress.ts";
import type { Progress, RoundDraft, Settings } from "./game/progress.ts";
import type { SessionStat } from "./game/report.ts";
import { clearAll, loadProgress, saveProgress } from "./storage/db.ts";
import { setTelemetryEnabled } from "./telemetry/index.ts";

type Screen =
  | { name: "home" }
  | { name: "play"; level: Level; mode: "level" | "daily" }
  | { name: "report" }
  | { name: "parent" }
  | { name: "classroom" };

/** 每日一题：按 Asia/Shanghai 的日期确定性选一句（同一天所有人拿到同一句）。 */
function shanghaiDayIndex(): number {
  const shifted = new Date(Date.now() + 8 * 3600 * 1000);
  const midnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  return Math.floor(midnight / 86_400_000);
}

function dailyLevel(): Level {
  const index = shanghaiDayIndex() % DRAFT_PACKAGE.levels.length;
  return DRAFT_PACKAGE.levels[index] ?? DRAFT_PACKAGE.levels[0]!;
}

function todayStart(): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

export default function App() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });

  useEffect(() => {
    let cancelled = false;
    void loadProgress().then((loaded) => {
      if (cancelled) return;
      const params = new URLSearchParams(window.location.search);
      const seeded =
        params.get("seed") === "1" && Object.keys(loaded.plays).length === 0
          ? seedDemoProgress()
          : loaded;
      const heat = params.get("heat");
      const ready =
        heat !== null && (HEAT_MODES as readonly string[]).includes(heat)
          ? { ...seeded, settings: { ...seeded.settings, heatMode: heat as HeatMode } }
          : seeded;

      setProgress(ready);
      setTelemetryEnabled(ready.settings.telemetryEnabled);

      // QA 钩子（只用于截图/自查，不影响正常入口）：?qa=play|report|parent&level=L3-02
      const qa = params.get("qa");
      if (qa === "report") setScreen({ name: "report" });
      else if (qa === "parent") setScreen({ name: "parent" });
      else if (qa === "play") {
        setScreen({
          name: "play",
          level: findLevel(params.get("level") ?? "L3-02"),
          mode: params.get("mode") === "daily" ? "daily" : "level",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (progress !== null) void saveProgress(progress);
  }, [progress]);

  // 注意：这个 hook 必须在「加载中」的提前 return 之前，否则会触发 React #310
  const handleDraftChange = useCallback((draft: RoundDraft | null): void => {
    setProgress((current) => (current === null ? current : saveDraft(current, draft)));
  }, []);

  if (progress === null) {
    return (
      <main className="app app--loading">
        <p>正在打开句子……</p>
      </main>
    );
  }

  const patchSettings = (patch: Partial<Settings>): void => {
    setProgress((current) =>
      current === null
        ? current
        : { ...current, settings: { ...current.settings, ...patch } },
    );
    if (patch.telemetryEnabled !== undefined) setTelemetryEnabled(patch.telemetryEnabled);
  };

  const finishRound = (stat: SessionStat, goNext: boolean): void => {
    const next = saveDraft(recordSession(progress, stat), null);
    setProgress(next);
    if (goNext) {
      const target = Math.min(6, stat.level + 1);
      setScreen({ name: "play", level: pickSentence(DRAFT_PACKAGE, next, target), mode: "level" });
      return;
    }
    setScreen({ name: "home" });
  };

  const daily = dailyLevel();
  const dailyDone = progress.sessions.some(
    (item) => item.daily === true && item.at >= todayStart(),
  );

  return (
    <div
      className="root"
      data-font={String(progress.settings.fontScale)}
      data-reduce-motion={progress.settings.reduceMotion ? "true" : "false"}
    >
      {screen.name === "home" ? (
        <HomeScreen
          pkg={DRAFT_PACKAGE}
          progress={progress}
          dailyDone={dailyDone}
          onPlayLevel={(levelNumber) => {
            setScreen({
              name: "play",
              level: pickSentence(DRAFT_PACKAGE, progress, levelNumber),
              mode: "level",
            });
          }}
          onDaily={() => {
            setScreen({ name: "play", level: daily, mode: "daily" });
          }}
          onReport={() => {
            setScreen({ name: "report" });
          }}
          onClassroom={() => { setScreen({ name: "classroom" }); }}
          onParent={() => {
            setScreen({ name: "parent" });
          }}
        />
      ) : null}

      {screen.name === "play" ? (
        <PlayScreen
          level={screen.level}
          progress={progress}
          mode={screen.mode}
          heatMode={progress.settings.heatMode}
          reduceMotion={progress.settings.reduceMotion}
          initialDraft={progress.roundDraft}
          onDraftChange={handleDraftChange}
          autoReveal={
            new URLSearchParams(window.location.search).get("reveal") === "1"
          }
          onHeatModeChange={(mode) => {
            patchSettings({ heatMode: mode });
          }}
          onExit={() => {
            setScreen({ name: "home" });
          }}
          onFinish={finishRound}
        />
      ) : null}

      {screen.name === "report" ? (
        <ReportScreen
          progress={progress}
          onBack={() => {
            setScreen({ name: "home" });
          }}
        />
      ) : null}

      {screen.name === "classroom" ? (
        <ClassroomScreen levels={DRAFT_PACKAGE.levels} onBack={() => setScreen({ name: "home" })} />
      ) : null}

      {screen.name === "parent" ? (
        <ParentScreen
          progress={progress}
          onChange={patchSettings}
          onClear={() => {
            void clearAll().then((fresh) => {
              setProgress(fresh);
              setScreen({ name: "home" });
            });
          }}
          onBack={() => {
            setScreen({ name: "home" });
          }}
        />
      ) : null}
    </div>
  );
}
