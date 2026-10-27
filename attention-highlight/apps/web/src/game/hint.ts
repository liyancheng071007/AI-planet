/**
 * 手电提示（方案书 3.3 / README §2 交互细节）
 *
 * 规则：照亮一个**不该选**的区域（排除法），直接给答案是不允许的。
 * - 每关 1 次，用了不扣分，但要记一笔（侦探报告会显示）；
 * - 候选只在「非焦点、非标点、不在理想集合里」的词中挑，权重最低的优先；
 * - 同一个同指组只点亮一处，避免提示变相泄露"这两个是同一个"。
 */
import type { Level } from "@attention/schema";
import { engineGroupId, idealTokenIndices } from "./domain.ts";

export interface HintResult {
  /** 被照亮的下标；null 表示没有可排除的词（比如能排除的都已经排除了）。 */
  readonly index: number | null;
  readonly copyId: string;
  readonly text: string;
}

const NONE_HINT: HintResult = {
  index: null,
  copyId: "HINT-NONE-01",
  text: "这句话里能明确排除的词已经没有了——剩下的都值得再想想。",
};

export function computeHint(level: Level, selected: readonly number[]): HintResult {
  const idealGroups = new Set(
    idealTokenIndices(level, "panorama").map((index) => engineGroupId(level, index)),
  );
  const selectedGroups = new Set(selected.map((index) => engineGroupId(level, index)));
  const punct = new Set(level.punct);

  const candidates: { index: number; weight: number }[] = [];
  const seenGroups = new Set<string>();

  for (const [index, weight] of level.attention.lenses.panorama.entries()) {
    if (index === level.focus || punct.has(index)) continue;
    const group = engineGroupId(level, index);
    if (idealGroups.has(group) || selectedGroups.has(group)) continue;
    if (seenGroups.has(group)) continue;
    seenGroups.add(group);
    candidates.push({ index, weight });
  }

  candidates.sort((left, right) => left.weight - right.weight);
  const best = candidates[0];
  if (best === undefined) return NONE_HINT;

  return {
    index: best.index,
    copyId: "HINT-EXCLUDE-01",
    text: `手电照到「${level.tokens[best.index] ?? ""}」：AI 几乎没看它，可以先把它排除。`,
  };
}
