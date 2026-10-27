/**
 * 关卡包入口：把 B 产出的 draft 数据接进来。
 *
 * 生产切换点（等 B 交付 approved 包后再打开）：
 *   status 必须是 release，每句 review.status = approved，并带 reviewer / reviewedAt。
 *   当前 levels/release 为空，assertProductionPackage 会直接抛错，这是 B 刻意的质量保护。
 */
import type { Level, LevelPackage } from "@attention/schema";
import raw from "./levels.draft.json";
import { assertPackage } from "./contract.ts";

export const DRAFT_PACKAGE: LevelPackage = assertPackage(raw as unknown);

/** 默认关卡：L3-02 同时带 coref 与 causal，是当前数据里最完整的一句。 */
export const DEFAULT_LEVEL_ID = "L3-02";

export function findLevel(id: string): Level {
  return DRAFT_PACKAGE.levels.find((level) => level.id === id) ?? DRAFT_PACKAGE.levels[0]!;
}
