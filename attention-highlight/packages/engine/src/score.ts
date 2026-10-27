import type { LensId, Level } from "@attention/schema";

export interface TargetGroup {
  groupId: string;
  tokenIndices: number[];
  weight: number;
  entity?: string;
}

export interface IdealTargets {
  groups: TargetGroup[];
  groupWeightTotal: number;
  cumulativeWeight: number;
  thresholdReached: boolean;
}

export interface ScoreOptions {
  lens?: LensId;
}

export interface ScoreResult {
  score: number;
  star: 0 | 1 | 2 | 3;
  lens: LensId;
  selection: number[];
  selectedGroups: string[];
  keyGroupId: string;
  idealGroupIds: string[];
  hitGroupIds: string[];
  missedGroupIds: string[];
  extraGroupIds: string[];
  keyHit: boolean;
  coverage: number;
  precision: number;
  overSelectionFactor: number;
  keyMissFactor: number;
  idealWeight: number;
  hitWeight: number;
}

export class InvalidSelectionError extends Error {
  readonly tokenIndex: number;

  constructor(tokenIndex: number, message: string) {
    super(message);
    this.name = "InvalidSelectionError";
    this.tokenIndex = tokenIndex;
  }
}

function groupIdForCoref(entity: string, members: number[]): string {
  return `coref:${entity}:${members.join("-")}`;
}

export function createTargetGroups(
  level: Level,
  lens: LensId = "panorama",
): TargetGroup[] {
  const excluded = new Set<number>([level.focus, ...level.punct]);
  const corefOwner = new Map<number, number>();
  const groups: TargetGroup[] = [];

  for (const [corefIndex, coreference] of level.coref.entries()) {
    for (const member of coreference.members) {
      const existing = corefOwner.get(member);
      if (existing !== undefined && existing !== corefIndex) {
        throw new Error(`同指下标 ${member} 被多个实体重复使用`);
      }
      corefOwner.set(member, corefIndex);
    }
  }

  const weights = level.attention.lenses[lens];
  if (!weights || weights.length !== level.tokens.length) {
    throw new Error(`透镜 ${lens} 的权重长度与词数不一致`);
  }

  for (const [corefIndex, coreference] of level.coref.entries()) {
    const members = [...coreference.members]
      .filter((tokenIndex) => !excluded.has(tokenIndex))
      .sort((left, right) => left - right);
    if (members.length === 0) {
      continue;
    }
    groups.push({
      groupId: groupIdForCoref(coreference.entity, members),
      tokenIndices: members,
      weight: members.reduce((sum, tokenIndex) => sum + weights[tokenIndex]!, 0),
      entity: coreference.entity,
    });
  }

  for (const [tokenIndex, token] of level.tokens.entries()) {
    if (excluded.has(tokenIndex) || corefOwner.has(tokenIndex)) {
      continue;
    }
    groups.push({
      groupId: `token:${tokenIndex}:${token}`,
      tokenIndices: [tokenIndex],
      weight: weights[tokenIndex]!,
    });
  }

  return groups.sort((left, right) => {
    const weightDifference = right.weight - left.weight;
    if (Math.abs(weightDifference) > Number.EPSILON * 16) {
      return weightDifference;
    }
    const indexDifference = left.tokenIndices[0]! - right.tokenIndices[0]!;
    return indexDifference !== 0
      ? indexDifference
      : left.groupId.localeCompare(right.groupId);
  });
}

export function buildIdealTargets(
  level: Level,
  options: ScoreOptions = {},
): IdealTargets {
  const groups = createTargetGroups(level, options.lens ?? "panorama");
  if (groups.length === 0) {
    throw new Error("该关卡没有可评分目标");
  }

  const selected: TargetGroup[] = [];
  let cumulativeWeight = 0;
  let thresholdReached = false;
  for (const group of groups) {
    selected.push(group);
    cumulativeWeight += group.weight;
    if (
      cumulativeWeight >= level.scoring.bCumulative ||
      selected.length >= level.scoring.maxTargets
    ) {
      thresholdReached =
        cumulativeWeight >= level.scoring.bCumulative;
      break;
    }
  }

  return {
    groups: selected,
    groupWeightTotal: groups.reduce((sum, group) => sum + group.weight, 0),
    cumulativeWeight,
    thresholdReached,
  };
}

function round1(value: number): number {
  return Math.floor(value * 10 + 0.5 + 1e-9) / 10;
}

export function starForScore(score: number): 0 | 1 | 2 | 3 {
  if (score >= 90) return 3;
  if (score >= 60) return 2;
  if (score >= 30) return 1;
  return 0;
}

function normalizeSelection(level: Level, selection: readonly number[]): number[] {
  const punct = new Set(level.punct);
  const unique = [...new Set(selection)].sort((left, right) => left - right);
  for (const tokenIndex of unique) {
    if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex >= level.tokens.length) {
      throw new InvalidSelectionError(
        tokenIndex,
        `选词下标 ${tokenIndex} 超出有效范围`,
      );
    }
    if (punct.has(tokenIndex)) {
      throw new InvalidSelectionError(tokenIndex, `标点 ${tokenIndex} 不可选`);
    }
    if (tokenIndex === level.focus) {
      throw new InvalidSelectionError(tokenIndex, "焦点词自身不可选");
    }
  }
  return unique;
}

export function scoreSelection(
  level: Level,
  selection: readonly number[],
  options: ScoreOptions = {},
): ScoreResult {
  const lens = options.lens ?? "panorama";
  const normalizedSelection = normalizeSelection(level, selection);
  const groups = createTargetGroups(level, lens);
  const ideal = buildIdealTargets(level, { lens });
  const groupByToken = new Map<number, TargetGroup>();
  for (const group of groups) {
    for (const tokenIndex of group.tokenIndices) {
      groupByToken.set(tokenIndex, group);
    }
  }

  const selectedGroupMap = new Map<string, TargetGroup>();
  for (const tokenIndex of normalizedSelection) {
    const group = groupByToken.get(tokenIndex);
    if (!group) {
      throw new Error(`选词下标 ${tokenIndex} 未映射到评分组`);
    }
    selectedGroupMap.set(group.groupId, group);
  }

  const idealMap = new Map(ideal.groups.map((group) => [group.groupId, group]));
  const selectedGroups = [...selectedGroupMap.values()];
  const hitGroups = selectedGroups.filter((group) => idealMap.has(group.groupId));
  const missedGroups = ideal.groups.filter(
    (group) => !selectedGroupMap.has(group.groupId),
  );
  const extraGroups = selectedGroups.filter(
    (group) => !idealMap.has(group.groupId),
  );

  const keyGroup = ideal.groups[0]!;
  const keyHit = selectedGroupMap.has(keyGroup.groupId);
  const idealWeight = ideal.groups.reduce((sum, group) => sum + group.weight, 0);
  const hitWeight = hitGroups.reduce((sum, group) => sum + group.weight, 0);
  const coverage = idealWeight > 0 ? hitWeight / idealWeight : 0;
  const precision =
    selectedGroups.length > 0 ? hitGroups.length / selectedGroups.length : 0;
  const overSelectionFactor =
    0.8 ** Math.max(0, selectedGroups.length - level.scoring.cap);
  const keyMissFactor = keyHit ? 1 : 0.5;
  const rawScore =
    coverage * precision * overSelectionFactor * keyMissFactor * 100;
  const score = round1(rawScore);

  return {
    score,
    star: starForScore(score),
    lens,
    selection: normalizedSelection,
    selectedGroups: selectedGroups.map((group) => group.groupId),
    keyGroupId: keyGroup.groupId,
    idealGroupIds: ideal.groups.map((group) => group.groupId),
    hitGroupIds: hitGroups.map((group) => group.groupId),
    missedGroupIds: missedGroups.map((group) => group.groupId),
    extraGroupIds: extraGroups.map((group) => group.groupId),
    keyHit,
    coverage,
    precision,
    overSelectionFactor,
    keyMissFactor,
    idealWeight,
    hitWeight,
  };
}
