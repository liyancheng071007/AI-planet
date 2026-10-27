/**
 * 侦探报告（方案书 3.5 钩子 1 / README §4.3）
 *
 * 只跟"昨天的自己"比：不排名、不与他人比较。
 * 统计口径全部来自本机存档，不上传（合规：儿童数据不出设备）。
 */
import type { LensId } from "@attention/schema";

export interface SessionStat {
  readonly levelId: string;
  readonly level: number;
  readonly score: number;
  readonly star: 0 | 1 | 2 | 3;
  readonly lens: LensId;
  readonly selectedCount: number;
  readonly idealCount: number;
  readonly keyHit: boolean;
  /** 漏掉的词（原文），用于统计"最常漏的词类" */
  readonly missed: readonly string[];
  readonly usedHint: boolean;
  readonly at: number;
  /** 是否是「今日一句」的对局（用于首页标记今天已完成） */
  readonly daily?: boolean;
}

export interface StyleInsight {
  readonly label: string;
  readonly hint: string;
}

export interface DetectiveReport {
  readonly played: number;
  readonly averageScore: number;
  readonly threeStarRate: number;
  readonly averageSelected: number;
  readonly topMissed: readonly { word: string; times: number }[];
  readonly style: StyleInsight;
  readonly hintRate: number;
}

const CONNECTIVES = new Set(["因为", "所以", "但是", "而且", "如果", "就", "才", "却", "而且"]);
const PRONOUNS = new Set(["它", "他", "她", "这个", "那个"]);
const EMOTIONS = new Set(["难过", "开心", "生气", "害怕", "着急", "笑", "哭"]);

function classify(word: string): "connective" | "pronoun" | "emotion" | "entity" | "other" {
  if (CONNECTIVES.has(word)) return "connective";
  if (PRONOUNS.has(word)) return "pronoun";
  if (EMOTIONS.has(word)) return "emotion";
  // 句库主角只有四个名字
  if (["豆包", "奶娃", "妈妈牛", "小胖"].includes(word)) return "entity";
  return "other";
}

export function buildReport(sessions: readonly SessionStat[]): DetectiveReport {
  const recent = [...sessions].sort((left, right) => left.at - right.at).slice(-20);
  const played = recent.length;

  if (played === 0) {
    return {
      played: 0,
      averageScore: 0,
      threeStarRate: 0,
      averageSelected: 0,
      topMissed: [],
      style: { label: "还没开始", hint: "先玩一关，这里就会出现你的读句习惯。" },
      hintRate: 0,
    };
  }

  const sum = recent.reduce((total, item) => total + item.score, 0);
  const threeStar = recent.filter((item) => item.star === 3).length;
  const selected = recent.reduce((total, item) => total + item.selectedCount, 0);
  const usedHint = recent.filter((item) => item.usedHint).length;

  const missedCount = new Map<string, number>();
  const kindMiss = new Map<string, number>();
  for (const item of recent) {
    for (const word of item.missed) {
      missedCount.set(word, (missedCount.get(word) ?? 0) + 1);
      const kind = classify(word);
      kindMiss.set(kind, (kindMiss.get(kind) ?? 0) + 1);
    }
  }

  const topMissed = [...missedCount.entries()]
    .map(([word, times]) => ({ word, times }))
    .sort((left, right) => right.times - left.times || left.word.localeCompare(right.word))
    .slice(0, 3);

  const ranked = [...kindMiss.entries()].sort((left, right) => right[1] - left[1]);
  const worstKind = ranked[0]?.[0] ?? "other";

  const styleByKind: Record<string, StyleInsight> = {
    connective: {
      label: "偏语义",
      hint: "你更容易漏掉「因为 / 所以」这类连接词——它们不写内容，但决定了前后是什么关系。",
    },
    pronoun: {
      label: "偏实词",
      hint: "代词（它 / 他 / 她）容易被你跳过，但它们往往是整句话的钥匙。",
    },
    emotion: {
      label: "偏信息",
      hint: "情绪词常常被忽略，可它们经常是 AI 目光停留的地方。",
    },
    entity: {
      label: "偏关系",
      hint: "你容易漏人名——试试先问自己「这句话在说谁」。",
    },
    other: {
      label: "还在摸索",
      hint: "再多玩几局，这里会告诉你最常漏的是哪一类词。",
    },
  };

  return {
    played,
    averageScore: Math.round((sum / played) * 10) / 10,
    threeStarRate: Math.round((threeStar / played) * 100),
    averageSelected: Math.round((selected / played) * 10) / 10,
    topMissed,
    style: styleByKind[worstKind] ?? styleByKind.other!,
    hintRate: Math.round((usedHint / played) * 100),
  };
}
