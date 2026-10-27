import type { Level } from "@attention/schema";
import { createTargetGroups, scoreSelection, type ScoreOptions } from "./score.js";

export type FeedbackCode =
  | "PERFECT"
  | "MISS_KEY"
  | "MISS_SECONDARY"
  | "OVER_SELECTION"
  | "IRRELEVANT"
  | "DIFFERENT_BUT_VALID";

export interface FeedbackSection {
  copyId: string;
  text: string;
}

export interface FeedbackResult {
  primary: FeedbackCode;
  signals: FeedbackCode[];
  score: number;
  star: 0 | 1 | 2 | 3;
  sections: {
    right: FeedbackSection;
    missed: FeedbackSection;
    adjust: FeedbackSection;
  };
}

function tokenText(level: Level, tokenIndices: number[]): string {
  const labels = [...new Set(tokenIndices)]
    .sort((left, right) => left - right)
    .map((tokenIndex) => `「${level.tokens[tokenIndex]}」`);
  return labels.length <= 2
    ? labels.join("、")
    : `${labels.slice(0, 2).join("、")}等 ${labels.length} 处`;
}

function selectionGroupSignature(
  level: Level,
  tokenIndices: readonly number[],
  lens: ScoreOptions["lens"],
): string {
  const groups = createTargetGroups(level, lens);
  const byToken = new Map<number, string>();
  for (const group of groups) {
    for (const tokenIndex of group.tokenIndices) {
      byToken.set(tokenIndex, group.groupId);
    }
  }
  return [...new Set(tokenIndices.map((index) => byToken.get(index)))]
    .filter((value): value is string => value !== undefined)
    .sort()
    .join("|");
}

export function classifyFeedback(
  level: Level,
  selection: readonly number[],
  options: ScoreOptions = {},
): FeedbackResult {
  const result = scoreSelection(level, selection, options);
  const scoredGroups = [...result.selectedGroups].sort().join("|");
  const idealGroups = [...result.idealGroupIds].sort().join("|");
  const isPerfect = scoredGroups === idealGroups;
  const isAlternative = (level.alternatives ?? []).some((alternative) => {
    const alternativeGroups = selectionGroupSignature(
      level,
      alternative.tokenIndices,
      options.lens,
    );
    return alternativeGroups !== idealGroups && alternativeGroups === scoredGroups;
  });
  const allGroups = createTargetGroups(level, options.lens);

  const signals: FeedbackCode[] = [];
  if (isPerfect) signals.push("PERFECT");
  if (isAlternative) signals.push("DIFFERENT_BUT_VALID");
  if (result.selectedGroups.length > level.scoring.cap) {
    signals.push("OVER_SELECTION");
  }
  if (!result.keyHit) signals.push("MISS_KEY");
  if (result.keyHit && result.missedGroupIds.length > 0) {
    signals.push("MISS_SECONDARY");
  }
  if (result.extraGroupIds.length > 0) signals.push("IRRELEVANT");

  const primary: FeedbackCode = isPerfect
    ? "PERFECT"
    : isAlternative
      ? "DIFFERENT_BUT_VALID"
      : result.selectedGroups.length > level.scoring.cap
        ? "OVER_SELECTION"
        : !result.keyHit
          ? "MISS_KEY"
          : result.missedGroupIds.length > 0
            ? "MISS_SECONDARY"
            : "IRRELEVANT";

  const hitTokens = result.hitGroupIds.flatMap(
    (groupId) =>
      allGroups.find((group) => group.groupId === groupId)?.tokenIndices ?? [],
  );
  const missedTokens = result.missedGroupIds.flatMap((groupId) => {
    const group = allGroups.find(
      (candidate) => candidate.groupId === groupId,
    );
    return group?.tokenIndices ?? [];
  });

  const rightText = result.hitGroupIds.length > 0
    ? result.keyHit
      ? `你找到了最关键的目标${hitTokens.length > 0 ? `，也看到了${tokenText(level, hitTokens)}` : ""}。`
      : `你找到了${result.hitGroupIds.length}个有用目标。`
    : "你先做了一次判断，这是复盘注意力的好起点。";
  const missedText = !result.keyHit
    ? "最关键的那个词溜走啦，先找它看看。"
    : result.missedGroupIds.length > 0
      ? `还漏了${tokenText(level, missedTokens)}，它们也有线索。`
      : result.extraGroupIds.length > 0
        ? "有些选中项不在主要线索里，精炼一下会更准。"
        : "主要目标已经找齐。";

  const adjustByCode: Record<FeedbackCode, string> = {
    PERFECT: "下次换个透镜，看看同一句话的重点会不会变化。",
    MISS_KEY: "顺着焦点词回头找最亮的那个目标，再看次要线索。",
    MISS_SECONDARY: "先保留最关键目标，再补一个相关的次要目标。",
    OVER_SELECTION: "先放下一个，只保留最有把握的词。",
    IRRELEVANT: "每选一个词都问自己：它和焦点词直接相关吗？",
    DIFFERENT_BUT_VALID: "你的读法也有道理，可以对照热力图说说理由。",
  };

  return {
    primary,
    signals: [...new Set(signals)],
    score: result.score,
    star: result.star,
    sections: {
      right: {
        copyId: `FB-${primary}-RIGHT`,
        text: rightText,
      },
      missed: {
        copyId: `FB-${primary}-MISSED`,
        text: missedText,
      },
      adjust: {
        copyId: `FB-${primary}-ADJUST`,
        text: adjustByCode[primary],
      },
    },
  };
}
