/**
 * 进度模型（纯函数）
 *
 * 只存本机：关卡最好成绩、已解锁透镜、最近对局、设置。
 * 合规约束：不存任何可识别信息，家长可一键清空（见 storage/db.ts 的 clearAll）。
 */
import type { LensId, Level, LevelPackage } from "@attention/schema";
import type { HeatMode } from "./domain.ts";
import type { SessionStat } from "./report.ts";

export const PROGRESS_VERSION = 1;

export interface Settings {
  heatMode: HeatMode;
  fontScale: 1 | 1.15 | 1.3;
  /** 尊重系统「减少动态效果」，但允许手动锁定 */
  reduceMotion: boolean;
  telemetryEnabled: boolean;
}

export interface PlayRecord {
  best: number;
  stars: 0 | 1 | 2 | 3;
  plays: number;
  lastAt: number;
}

/** 进行中的一局（崩溃/切后台恢复用，对应方案书 G7「不要丢掉进度」）。 */
export interface RoundDraft {
  levelId: string;
  selected: number[];
  hintUsed: boolean;
  at: number;
}

export interface Progress {
  version: typeof PROGRESS_VERSION;
  plays: Record<string, PlayRecord>;
  lenses: LensId[];
  sessions: SessionStat[];
  settings: Settings;
  lastLevelId: string | null;
  roundDraft: RoundDraft | null;
}

export const DEFAULT_SETTINGS: Settings = {
  heatMode: "color",
  fontScale: 1,
  reduceMotion: false,
  telemetryEnabled: false,
};

export function createProgress(): Progress {
  return {
    version: PROGRESS_VERSION,
    plays: {},
    lenses: ["panorama"],
    sessions: [],
    settings: { ...DEFAULT_SETTINGS },
    lastLevelId: null,
    roundDraft: null,
  };
}

/** 记录进行中的选择；一局结束或玩家主动退出时清掉。 */
export function saveDraft(progress: Progress, draft: RoundDraft | null): Progress {
  if (draft === null) {
    return progress.roundDraft === null ? progress : { ...progress, roundDraft: null };
  }
  return { ...progress, roundDraft: draft };
}

/** 每关通关解锁下一枚透镜；全景镜永远可用。 */
const LENS_BY_LEVEL: Record<number, LensId> = {
  1: "coref",
  2: "causal",
  3: "emotion",
  4: "position",
};

export function unlockedLensesFor(completedLevel: number, current: readonly LensId[]): LensId[] {
  const next = LENS_BY_LEVEL[completedLevel];
  if (next === undefined) return [...current];
  return current.includes(next) ? [...current] : [...current, next];
}

export function isLevelUnlocked(progress: Progress, level: number): boolean {
  if (level <= 1) return true;
  const previous = Object.entries(progress.plays)
    .filter(([id]) => id.startsWith(`L${String(level - 1)}-`))
    .some(([, record]) => record.stars > 0);
  return previous;
}

export function levelNumbers(pkg: LevelPackage): number[] {
  return [...new Set(pkg.levels.map((level) => level.level))].sort((left, right) => left - right);
}

export function sentencesOfLevel(pkg: LevelPackage, levelNumber: number): Level[] {
  return pkg.levels.filter((level) => level.level === levelNumber);
}

/** 每关抽一句：优先没玩过的，其次分数最低的，保证重玩有变化。 */
export function pickSentence(pkg: LevelPackage, progress: Progress, levelNumber: number): Level {
  const sentences = sentencesOfLevel(pkg, levelNumber);
  if (sentences.length === 0) {
    throw new Error(`没有第 ${String(levelNumber)} 关的数据`);
  }
  const scored = sentences.map((level) => ({
    level,
    record: progress.plays[level.id],
  }));
  const unplayed = scored.filter((item) => item.record === undefined);
  if (unplayed.length > 0) {
    const index = Math.floor(Math.random() * unplayed.length);
    return unplayed[index]?.level ?? sentences[0]!;
  }
  const worst = [...scored].sort(
    (left, right) => (left.record?.best ?? 0) - (right.record?.best ?? 0),
  );
  return worst[0]?.level ?? sentences[0]!;
}

export function recordSession(progress: Progress, stat: SessionStat): Progress {
  const existing = progress.plays[stat.levelId];
  const plays: PlayRecord = {
    best: Math.max(existing?.best ?? 0, stat.score),
    stars: Math.max(existing?.stars ?? 0, stat.star) as 0 | 1 | 2 | 3,
    plays: (existing?.plays ?? 0) + 1,
    lastAt: stat.at,
  };

  const sessions = [...progress.sessions, stat].slice(-50);

  return {
    ...progress,
    plays: { ...progress.plays, [stat.levelId]: plays },
    sessions,
    lenses: stat.star > 0 ? unlockedLensesFor(stat.level, progress.lenses) : progress.lenses,
    lastLevelId: stat.levelId,
  };
}

export function totalStars(progress: Progress): number {
  return Object.values(progress.plays).reduce((total, record) => total + record.stars, 0);
}

/**
 * 仅供 QA/截图用的演示进度（?qa=seed）。
 * 不参与任何线上逻辑；家长视图「一键清空」会把它一起清掉。
 */
export function seedDemoProgress(): Progress {
  const now = Date.now();
  const samples: SessionStat[] = [
    { levelId: "L1-01", level: 1, score: 100, star: 3, lens: "panorama", selectedCount: 3, idealCount: 3, keyHit: true, missed: [], usedHint: false, at: now - 6 * 3_600_000 },
    { levelId: "L1-02", level: 1, score: 84.4, star: 2, lens: "coref", selectedCount: 2, idealCount: 3, keyHit: true, missed: ["因为"], usedHint: true, at: now - 5 * 3_600_000 },
    { levelId: "L2-01", level: 2, score: 66.7, star: 2, lens: "panorama", selectedCount: 1, idealCount: 3, keyHit: true, missed: ["难过", "豆包"], usedHint: false, at: now - 4 * 3_600_000 },
    { levelId: "L3-01", level: 3, score: 52.6, star: 1, lens: "causal", selectedCount: 2, idealCount: 3, keyHit: true, missed: ["它"], usedHint: false, at: now - 3 * 3_600_000 },
    { levelId: "L3-02", level: 3, score: 91.2, star: 3, lens: "panorama", selectedCount: 3, idealCount: 3, keyHit: true, missed: [], usedHint: true, at: now - 2 * 3_600_000 },
    { levelId: "L4-01", level: 4, score: 38.5, star: 1, lens: "panorama", selectedCount: 4, idealCount: 3, keyHit: false, missed: ["因为", "考试"], usedHint: false, at: now - 3_600_000 },
  ];

  let progress = createProgress();
  for (const sample of samples) {
    progress = recordSession(progress, sample);
  }
  return progress;
}
