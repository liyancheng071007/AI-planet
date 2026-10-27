import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { createRequire } from "node:module";
import type {
  Level,
  LevelPackage,
  DailyVoteRequest,
  ValidationIssue,
  ValidationResult,
} from "./types.js";

const require = createRequire(import.meta.url);
const levelSchema = require("../level.schema.json") as object;
const levelPackageSchema = require("../level-package.schema.json") as object;
const dailyVoteSchema = require("../daily-vote.schema.json") as object;

const LEVEL_SCHEMA_ID =
  "https://attention-highlight.local/schema/level-v1.json";

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
});
ajv.addSchema(levelSchema, LEVEL_SCHEMA_ID);
const validateLevelSchema = ajv.compile<Level>(levelSchema);
const validatePackageSchema = ajv.compile<LevelPackage>(levelPackageSchema);
const validateDailyVoteSchema = ajv.compile<DailyVoteRequest>(dailyVoteSchema);

function schemaIssue(error: ErrorObject): ValidationIssue {
  return {
    path: error.instancePath || "/",
    keyword: error.keyword,
    message: error.message ?? "不符合数据契约",
  };
}

function semanticIssues(level: Level): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tokenCount = level.tokens.length;
  const punct = new Set(level.punct);

  const checkIndex = (value: number, path: string): void => {
    if (!Number.isInteger(value) || value < 0 || value >= tokenCount) {
      issues.push({
        path,
        keyword: "range",
        message: `下标 ${value} 超出 0..${tokenCount - 1}`,
      });
    }
  };

  checkIndex(level.focus, "/focus");
  for (const [index, value] of level.punct.entries()) {
    checkIndex(value, `/punct/${index}`);
  }
  if (punct.has(level.focus)) {
    issues.push({
      path: "/focus",
      keyword: "focusIsPunct",
      message: "焦点词不能是标点",
    });
  }

  const owners = new Map<number, string>();
  for (const [groupIndex, group] of level.coref.entries()) {
    const path = `/coref/${groupIndex}`;
    for (const member of group.members) {
      checkIndex(member, `${path}/members`);
      const owner = owners.get(member);
      if (owner !== undefined) {
        issues.push({
          path: `${path}/members`,
          keyword: "overlappingCoref",
          message: `词 ${member} 被多个同指组重复使用`,
        });
      }
      owners.set(member, group.entity);
      if (punct.has(member)) {
        issues.push({
          path: `${path}/members`,
          keyword: "punctMember",
          message: `同指组不能包含标点 ${member}`,
        });
      }
      if (member === level.focus) {
        issues.push({
          path: `${path}/members`,
          keyword: "focusMember",
          message: "焦点词自身不能作为同指组成员",
        });
      }
    }
    for (const source of group.refersFrom) {
      checkIndex(source, `${path}/refersFrom`);
    }
  }

  for (const [causalIndex, causal] of level.causal.entries()) {
    for (const value of causal.cause) {
      checkIndex(value, `/causal/${causalIndex}/cause`);
    }
    for (const value of causal.effect) {
      checkIndex(value, `/causal/${causalIndex}/effect`);
    }
    if (causal.connective !== undefined) {
      checkIndex(causal.connective, `/causal/${causalIndex}/connective`);
    }
  }

  for (const [alternativeIndex, alternative] of (
    level.alternatives ?? []
  ).entries()) {
    for (const tokenIndex of alternative.tokenIndices) {
      checkIndex(
        tokenIndex,
        `/alternatives/${alternativeIndex}/tokenIndices`,
      );
      if (punct.has(tokenIndex) || tokenIndex === level.focus) {
        issues.push({
          path: `/alternatives/${alternativeIndex}/tokenIndices`,
          keyword: "unselectableAlternative",
          message: `备选读法包含不可选下标 ${tokenIndex}`,
        });
      }
    }
  }

  for (const [lens, weights] of Object.entries(level.attention.lenses)) {
    if (weights.length !== tokenCount) {
      issues.push({
        path: `/attention/lenses/${lens}`,
        keyword: "length",
        message: `权重长度 ${weights.length} 与词数 ${tokenCount} 不一致`,
      });
      continue;
    }

    let sum = 0;
    for (const [tokenIndex, weight] of weights.entries()) {
      if (!Number.isFinite(weight) || weight < 0) {
        issues.push({
          path: `/attention/lenses/${lens}/${tokenIndex}`,
          keyword: "finiteNonNegative",
          message: "权重必须为有限非负数",
        });
      }
      const shouldBeZero =
        tokenIndex === level.focus || punct.has(tokenIndex);
      if (shouldBeZero && weight !== 0) {
        issues.push({
          path: `/attention/lenses/${lens}/${tokenIndex}`,
          keyword: "nonZeroExcluded",
          message: "焦点词自身和标点的权重必须为 0",
        });
      }
      if (!shouldBeZero) {
        sum += weight;
      }
    }
    if (Math.abs(sum - 1) > 1e-6) {
      issues.push({
        path: `/attention/lenses/${lens}`,
        keyword: "normalization",
        message: `可评分权重之和应为 1，实际为 ${sum.toFixed(9)}`,
      });
    }
  }

  if (level.attention.stability !== 1) {
    issues.push({
      path: "/attention/stability",
      keyword: "stability",
      message: "正式技术样例必须通过逐位稳定复跑",
    });
  }
  if (level.attention.crossModelAgreement < 0.6) {
    issues.push({
      path: "/attention/crossModelAgreement",
      keyword: "crossModelAgreement",
      message: "跨模型相关性必须不低于 0.6",
    });
  }
  if (level.attention.caseStrength < 0.45) {
    issues.push({
      path: "/attention/caseStrength",
      keyword: "caseStrength",
      message: "案例区分度必须不低于 0.45",
    });
  }

  return issues;
}

export function validateLevel(input: unknown): ValidationResult<Level> {
  if (!validateLevelSchema(input)) {
    return {
      ok: false,
      errors: (validateLevelSchema.errors ?? []).map(schemaIssue),
    };
  }
  const level = input as Level;
  const errors = semanticIssues(level);
  return errors.length === 0
    ? { ok: true, value: level }
    : { ok: false, errors };
}

export function validateLevelPackage(
  input: unknown,
  mode: "draft" | "release" = "draft",
): ValidationResult<LevelPackage> {
  if (!validatePackageSchema(input)) {
    return {
      ok: false,
      errors: (validatePackageSchema.errors ?? []).map(schemaIssue),
    };
  }

  const levelPackage = input as LevelPackage;
  const errors: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const [index, level] of levelPackage.levels.entries()) {
    const result = validateLevel(level);
    if (!result.ok) {
      errors.push(
        ...result.errors.map((issue) => ({
          ...issue,
          path: `/levels/${index}${issue.path === "/" ? "" : issue.path}`,
        })),
      );
    }
    if (ids.has(level.id)) {
      errors.push({
        path: `/levels/${index}/id`,
        keyword: "unique",
        message: `关卡 ID ${level.id} 重复`,
      });
    }
    ids.add(level.id);
    if (level.review.status === "rejected") {
      errors.push({
        path: `/levels/${index}/review/status`,
        keyword: "rejectedLevel",
        message: "已拒绝关卡不能进入任何关卡包",
      });
    }
    if (mode === "release" && level.review.status !== "approved") {
      errors.push({
        path: `/levels/${index}/review/status`,
        keyword: "productionReview",
        message: "生产包只能包含 approved 关卡",
      });
    }
  }

  if (mode === "release" && levelPackage.status !== "release") {
    errors.push({
      path: "/status",
      keyword: "productionStatus",
      message: "生产校验要求 status=release",
    });
  }

  return errors.length === 0
    ? { ok: true, value: levelPackage }
    : { ok: false, errors };
}

export function validateDailyVoteRequest(
  input: unknown,
): ValidationResult<DailyVoteRequest> {
  if (!validateDailyVoteSchema(input)) {
    return {
      ok: false,
      errors: (validateDailyVoteSchema.errors ?? []).map(schemaIssue),
    };
  }
  return { ok: true, value: input as DailyVoteRequest };
}

export class ProductionPackageError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(
      `生产关卡包未通过审核门禁：${issues
        .map((issue) => `${issue.path} ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "ProductionPackageError";
    this.issues = issues;
  }
}

export function assertProductionPackage(input: unknown): LevelPackage {
  const result = validateLevelPackage(input, "release");
  if (!result.ok) {
    throw new ProductionPackageError(result.errors);
  }
  return result.value;
}
