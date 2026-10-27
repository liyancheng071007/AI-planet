/**
 * A 侧契约自检（纯函数，不碰 JSON / 不碰 DOM，可在 node:test 里直接跑）。
 *
 * 为什么不直接用 @attention/schema 的 validateLevelPackage：
 * 它依赖 ajv 与 node:module，是构建期/服务端工具，进不了浏览器包。
 * 权威校验仍在 CI：pnpm validate:levels
 */
import type { Level, LevelPackage, LensId } from "@attention/schema";

const LENS_IDS: readonly LensId[] = [
  "panorama",
  "coref",
  "causal",
  "emotion",
  "position",
];

const WEIGHT_SUM_TOLERANCE = 1e-6;

function fail(message: string): never {
  throw new Error(`关卡数据校验失败：${message}`);
}

export function assertLevel(level: Level, position: number): void {
  const where = `levels[${position}] (${String(level.id)})`;
  if (level.tokens.length < 8 || level.tokens.length > 16) {
    fail(`${where} tokens 必须在 8–16 之间，实际 ${level.tokens.length}`);
  }
  if (level.focus < 0 || level.focus >= level.tokens.length) {
    fail(`${where} focus 越界`);
  }
  if (level.punct.includes(level.focus)) {
    fail(`${where} focus 不能是标点`);
  }
  for (const index of level.punct) {
    if (index < 0 || index >= level.tokens.length) {
      fail(`${where} punct 下标 ${index} 越界`);
    }
  }
  for (const group of level.coref) {
    for (const member of group.members) {
      if (member < 0 || member >= level.tokens.length) {
        fail(`${where} coref 成员 ${member} 越界`);
      }
    }
  }

  const punct = new Set(level.punct);
  for (const lens of LENS_IDS) {
    const weights = level.attention.lenses[lens];
    if (weights.length !== level.tokens.length) {
      fail(`${where} 透镜 ${lens} 权重长度与 tokens 不一致`);
    }
    if (Math.abs(weights[level.focus] ?? 0) > WEIGHT_SUM_TOLERANCE) {
      fail(`${where} 透镜 ${lens} 的焦点词权重必须为 0`);
    }
    for (const index of punct) {
      if (Math.abs(weights[index] ?? 0) > WEIGHT_SUM_TOLERANCE) {
        fail(`${where} 透镜 ${lens} 的标点 ${index} 权重必须为 0`);
      }
    }
    const sum = weights.reduce((total, weight) => total + weight, 0);
    if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
      fail(`${where} 透镜 ${lens} 权重和为 ${sum}，应为 1`);
    }
  }

  if (level.scoring.cap < 1) {
    fail(`${where} scoring.cap 必须 ≥ 1`);
  }
}

export function assertPackage(raw: unknown): LevelPackage {
  const pkg = raw as LevelPackage;
  if (pkg.schemaVersion !== "1.0.0") {
    fail(`schemaVersion 应为 1.0.0，实际 ${String(pkg.schemaVersion)}`);
  }
  if (pkg.status !== "draft" && pkg.status !== "release") {
    fail(`status 非法：${String(pkg.status)}`);
  }
  if (pkg.levels.length === 0) {
    fail("levels 为空");
  }
  pkg.levels.forEach(assertLevel);
  return pkg;
}
