/**
 * 本地存档（IndexedDB，失败回落 localStorage）
 *
 * 合规：只存本机、不联网、无账号；家长视图可一键清空（clearAll）。
 * 崩溃恢复：每局结束写一次，进入关卡时读；写入失败不阻塞游戏。
 */
import { openDB, type IDBPDatabase } from "idb";
import { createProgress, PROGRESS_VERSION } from "../game/progress.ts";
import type { Progress } from "../game/progress.ts";

const DB_NAME = "attention-highlight";
const DB_VERSION = 1;
const STORE = "state";
const KEY = "progress";
const LS_KEY = "attention-highlight:progress";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === "undefined") return null;
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    },
  });
  return dbPromise;
}

function migrate(raw: unknown): Progress {
  const base = createProgress();
  if (raw === null || typeof raw !== "object") return base;
  const candidate = raw as Partial<Progress>;
  if (candidate.version !== PROGRESS_VERSION) {
    // 目前只有 v1；版本不匹配时保守丢弃，避免脏数据把游戏卡死
    return base;
  }
  return {
    ...base,
    ...candidate,
    plays: candidate.plays ?? {},
    lenses: candidate.lenses ?? base.lenses,
    sessions: candidate.sessions ?? [],
    settings: { ...base.settings, ...candidate.settings },
  };
}

export async function loadProgress(): Promise<Progress> {
  try {
    const db = getDb();
    if (db !== null) {
      const stored = await (await db).get(STORE, KEY);
      if (stored !== undefined) return migrate(stored);
    }
  } catch {
    /* 忽略，回落 localStorage */
  }

  try {
    const text = localStorage.getItem(LS_KEY);
    if (text !== null) return migrate(JSON.parse(text) as unknown);
  } catch {
    /* 忽略 */
  }

  return createProgress();
}

export async function saveProgress(progress: Progress): Promise<void> {
  try {
    const db = getDb();
    if (db !== null) {
      await (await db).put(STORE, progress, KEY);
      return;
    }
  } catch {
    /* 忽略，回落 localStorage */
  }

  try {
    localStorage.setItem(LS_KEY, JSON.stringify(progress));
  } catch {
    /* 存储满了也不该让游戏崩 */
  }
}

/** 家长视图「一键清空」：删库 + 删本地键，然后回到初始进度。 */
export async function clearAll(): Promise<Progress> {
  try {
    const db = getDb();
    if (db !== null) {
      await (await db).clear(STORE);
    }
  } catch {
    /* 忽略 */
  }
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* 忽略 */
  }
  return createProgress();
}
