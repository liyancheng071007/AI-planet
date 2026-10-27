/**
 * A 轨道 · 游戏域逻辑（纯函数，无 React / 无 DOM，可直接跑 node:test）
 *
 * 依据：板块 B 交付的 @attention/schema@1.0.0 与 @attention/engine@0.1.0
 *
 * 契约红线（与 B 的 score.ts 对齐，写错必崩）：
 *  1. focus（焦点词）与 punct（标点）权重恒为 0，且**不可进入选择集** ——
 *     engine 的 normalizeSelection 会对它们抛 InvalidSelectionError。
 *  2. 同指组成员合并成一个评分组：点组内任一成员 = 选中整组，cap 按"组数"算，不按词数。
 *  3. 星级线是 90 / 60 / 30（固定阈值），不是方案书 2.5 的浮动线 —— 浮动线尚未实现，见 docs。
 */
import { buildIdealTargets, classifyFeedback, scoreSelection } from "@attention/engine";
import type { FeedbackResult, ScoreResult } from "@attention/engine";
import type { Level, LensId } from "@attention/schema";

export const LENS_ORDER: readonly LensId[] = [
  "panorama",
  "coref",
  "causal",
  "emotion",
  "position",
];

export const LENS_LABELS: Record<LensId, string> = {
  panorama: "全景镜",
  coref: "指代镜",
  causal: "因果镜",
  emotion: "情绪镜",
  position: "位置镜",
};

export const LENS_HINTS: Record<LensId, string> = {
  panorama: "所有眼睛加在一起",
  coref: "专门找「它」是谁的眼睛",
  causal: "专门找「为什么」的眼睛",
  emotion: "专门找心情的眼睛",
  position: "总看旁边的近视眼",
};

export const HEAT_MODES = ["color", "texture", "number"] as const;
export type HeatMode = (typeof HEAT_MODES)[number];

export const HEAT_MODE_LABELS: Record<HeatMode, string> = {
  color: "颜色",
  texture: "纹理",
  number: "数字",
};

export const STAR_LINES = [30, 60, 90] as const;

export function starLabel(star: 0 | 1 | 2 | 3): string {
  if (star === 3) return "★★★";
  if (star === 2) return "★★";
  if (star === 1) return "★";
  return "未达标";
}

/** 距离下一档还差多少分；已满星返回 null。 */
export function nextStarHint(score: number): string | null {
  for (const line of STAR_LINES) {
    if (score < line) {
      const gap = Math.round((line - score) * 10) / 10;
      return `还差 ${gap.toFixed(1)} 分到 ${starLabel(line === 30 ? 1 : line === 60 ? 2 : 3)}`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * 选择状态
 * ------------------------------------------------------------------ */

export interface SelectionState {
  readonly selected: readonly number[];
  readonly history: readonly (readonly number[])[];
  readonly notice: string | null;
}

export function createSelection(): SelectionState {
  return { selected: [], history: [], notice: null };
}

/** 把下标换算成 engine 的 groupId（必须与 B 的 groupIdForCoref / token: 规则逐字一致）。 */
export function engineGroupId(level: Level, index: number): string {
  const coref = level.coref.find((group) => group.members.includes(index));
  if (coref) {
    const members = coref.members
      .filter((member) => member !== level.focus && !level.punct.includes(member))
      .sort((left, right) => left - right);
    return `coref:${coref.entity}:${members.join("-")}`;
  }
  return `token:${index}:${level.tokens[index] ?? ""}`;
}

/** 与 index 同组的已选下标（含 index 本身，如果它被选中的话）。 */
export function selectedGroupMembers(
  level: Level,
  selected: readonly number[],
  index: number,
): number[] {
  const key = engineGroupId(level, index);
  return selected.filter((candidate) => engineGroupId(level, candidate) === key);
}

export function selectedGroupCount(level: Level, selected: readonly number[]): number {
  return new Set(selected.map((index) => engineGroupId(level, index))).size;
}

export type ToggleRejection = "out_of_range" | "focus" | "punct" | "cap";

export interface ToggleResult {
  readonly state: SelectionState;
  readonly rejection: ToggleRejection | null;
}

const REJECTION_NOTICE: Record<ToggleRejection, string> = {
  out_of_range: "这个位置不在句子里",
  focus: "焦点词是这局的观察点，不用选",
  punct: "标点不参与评分",
  cap: "到上限了，先放下一个吧",
};

/**
 * 点一下选中 / 再点一下取消。同指组整组同步：
 * 组内已被选中时，点组里任何成员都会把整组取消（不会出现"选了两次"）。
 */
export function toggleSelection(
  level: Level,
  state: SelectionState,
  index: number,
): ToggleResult {
  if (!Number.isInteger(index) || index < 0 || index >= level.tokens.length) {
    return { state: { ...state, notice: REJECTION_NOTICE.out_of_range }, rejection: "out_of_range" };
  }
  if (index === level.focus) {
    return { state: { ...state, notice: REJECTION_NOTICE.focus }, rejection: "focus" };
  }
  if (level.punct.includes(index)) {
    return { state: { ...state, notice: REJECTION_NOTICE.punct }, rejection: "punct" };
  }

  const groupMembers = selectedGroupMembers(level, state.selected, index);
  const alreadySelected = state.selected.includes(index) || groupMembers.length > 0;

  if (alreadySelected) {
    const drop = new Set([...groupMembers, index]);
    const next = state.selected.filter((candidate) => !drop.has(candidate));
    return {
      state: {
        selected: next,
        history: [...state.history, state.selected],
        notice: groupMembers.length > 1 ? "这个同指组一起取消了" : null,
      },
      rejection: null,
    };
  }

  if (selectedGroupCount(level, state.selected) >= level.scoring.cap) {
    return { state: { ...state, notice: REJECTION_NOTICE.cap }, rejection: "cap" };
  }

  const next = [...state.selected, index].sort((left, right) => left - right);
  return {
    state: { selected: next, history: [...state.history, state.selected], notice: null },
    rejection: null,
  };
}

export function undoSelection(state: SelectionState): SelectionState {
  const previous = state.history.at(-1);
  if (previous === undefined) {
    return { ...state, notice: null };
  }
  return {
    selected: previous,
    history: state.history.slice(0, -1),
    notice: null,
  };
}

export function canUndo(state: SelectionState): boolean {
  return state.history.length > 0;
}

export function clearSelection(state: SelectionState): SelectionState {
  if (state.selected.length === 0) {
    return { selected: [], history: [], notice: null };
  }
  return { selected: [], history: [...state.history, state.selected], notice: null };
}

/* ------------------------------------------------------------------ *
 * 评分
 * ------------------------------------------------------------------ */

export interface Evaluation {
  readonly score: ScoreResult;
  readonly feedback: FeedbackResult;
}

/** 交卷前把非法下标剔掉，保证 engine 不会抛 InvalidSelectionError。 */
export function sanitizeSelection(level: Level, selected: readonly number[]): number[] {
  const punct = new Set(level.punct);
  return [...new Set(selected)]
    .filter((index) => index !== level.focus && !punct.has(index))
    .sort((left, right) => left - right);
}

export function evaluate(
  level: Level,
  selected: readonly number[],
  lens: LensId = "panorama",
): Evaluation {
  const usable = sanitizeSelection(level, selected);
  return {
    score: scoreSelection(level, usable, { lens }),
    feedback: classifyFeedback(level, usable, { lens }),
  };
}

/** 该透镜下的理想目标（A 档 + 累计到阈值的目标）对应的词下标。 */
export function idealTokenIndices(level: Level, lens: LensId = "panorama"): number[] {
  return buildIdealTargets(level, { lens }).groups.flatMap((group) => group.tokenIndices);
}

/** 把 engine 的 groupId 还原成词面（侦探报告统计"最常漏的词"用）。 */
export function tokenTextsForGroups(level: Level, groupIds: readonly string[]): string[] {
  const wanted = new Set(groupIds);
  const texts: string[] = [];
  for (const [index, text] of level.tokens.entries()) {
    if (index === level.focus || level.punct.includes(index)) continue;
    if (wanted.has(engineGroupId(level, index))) texts.push(text);
  }
  return texts;
}

/* ------------------------------------------------------------------ *
 * 视图模型
 * ------------------------------------------------------------------ */

export type TokenRole = "focus" | "punct" | "word";
export type HeatBucket = "none" | "low" | "mid" | "high";

export interface TokenView {
  readonly index: number;
  readonly text: string;
  readonly role: TokenRole;
  /** 这个下标本身在 selected 里。 */
  readonly selected: boolean;
  /** 同指组的其他成员被选中了（视觉上要跟着亮）。 */
  readonly inSelectedGroup: boolean;
  readonly weight: number;
  readonly percent: number;
  readonly bucket: HeatBucket;
  /** 揭晓后：命中理想目标。 */
  readonly hit: boolean;
  /** 揭晓后：命中但不在理想集合里（多选的）。 */
  readonly extra: boolean;
  /** 揭晓后：在理想集合里但没选（漏掉的）。 */
  readonly missed: boolean;
  /** 到上限后未选中的词块要变灰。 */
  readonly dimmed: boolean;
  readonly clickable: boolean;
  readonly label: string;
}

function bucketFor(ratio: number): HeatBucket {
  if (ratio <= 0) return "none";
  if (ratio >= 0.66) return "high";
  if (ratio >= 0.33) return "mid";
  return "low";
}

export function buildTokenViews(
  level: Level,
  state: SelectionState,
  lens: LensId = "panorama",
  evaluation?: Evaluation,
): TokenView[] {
  const weights = level.attention.lenses[lens];
  if (weights === undefined || weights.length !== level.tokens.length) {
    throw new Error(`透镜 ${lens} 的权重长度与词数不一致`);
  }

  const punct = new Set(level.punct);
  const selectedGroups = new Set(
    state.selected.map((index) => engineGroupId(level, index)),
  );
  const atCap = selectedGroupCount(level, state.selected) >= level.scoring.cap;

  const idealIds = evaluation === undefined ? null : new Set(evaluation.score.idealGroupIds);
  const hitIds = evaluation === undefined ? null : new Set(evaluation.score.hitGroupIds);
  const missedIds = evaluation === undefined ? null : new Set(evaluation.score.missedGroupIds);

  const wordWeights = weights.filter(
    (_, index) => index !== level.focus && !punct.has(index),
  );
  const maxWeight = Math.max(0, ...wordWeights);

  return level.tokens.map((text, index) => {
    const role: TokenRole =
      index === level.focus ? "focus" : punct.has(index) ? "punct" : "word";
    const weight = weights[index] ?? 0;
    const groupId = engineGroupId(level, index);
    const selected = state.selected.includes(index);
    const inSelectedGroup = !selected && selectedGroups.has(groupId);
    const clickable = role === "word";
    const dimmed = atCap && !selected && !inSelectedGroup && role === "word";
    const ratio = maxWeight > 0 ? weight / maxWeight : 0;
    const percent = Math.round(weight * 1000) / 10;

    return {
      index,
      text,
      role,
      selected,
      inSelectedGroup,
      weight,
      percent,
      bucket: role === "word" ? bucketFor(ratio) : "none",
      hit: hitIds?.has(groupId) ?? false,
      extra: evaluation !== undefined ? selected && !(hitIds?.has(groupId) ?? false) : false,
      missed: missedIds?.has(groupId) ?? false,
      dimmed,
      clickable,
      label:
        role === "focus"
          ? `${text}，本局焦点词`
          : role === "punct"
            ? `${text}，标点`
            : `${text}，注意力 ${percent.toFixed(1)}%`,
    } satisfies TokenView;
  });
}

/** 判断当前选择是否还能交卷。 */
export function canSubmit(state: SelectionState): boolean {
  return state.selected.length > 0;
}
