/**
 * 玩法模块回归：手电提示 / 科普卡触发 / 侦探报告 / 进度与解锁。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { Level } from "@attention/schema";

import { pickCard } from "../src/game/cards.ts";
import { engineGroupId, idealTokenIndices } from "../src/game/domain.ts";
import { computeHint } from "../src/game/hint.ts";
import {
  createProgress,
  isLevelUnlocked,
  pickSentence,
  recordSession,
  sentencesOfLevel,
  totalStars,
  unlockedLensesFor,
} from "../src/game/progress.ts";
import { buildReport } from "../src/game/report.ts";
import type { SessionStat } from "../src/game/report.ts";
import { assertPackage } from "../src/levels/contract.ts";

const here = dirname(fileURLToPath(import.meta.url));
const raw: unknown = JSON.parse(
  readFileSync(join(here, "..", "src", "levels", "levels.draft.json"), "utf8"),
);
const pkg = assertPackage(raw);
const level = pkg.levels.find((item) => item.id === "L3-02") as Level;

function stat(overrides: Partial<SessionStat> = {}): SessionStat {
  return {
    levelId: "L1-01",
    level: 1,
    score: 64,
    star: 2,
    lens: "panorama",
    selectedCount: 1,
    idealCount: 3,
    keyHit: true,
    missed: ["因为"],
    usedHint: false,
    at: 1_700_000_000_000,
    ...overrides,
  };
}

test("手电提示只排除非理想目标，且不点破同指组", () => {
  const hint = computeHint(level, []);
  assert.notEqual(hint.index, null);
  const index = hint.index as number;

  const idealGroups = new Set(
    idealTokenIndices(level, "panorama").map((tokenIndex) => engineGroupId(level, tokenIndex)),
  );
  assert.equal(idealGroups.has(engineGroupId(level, index)), false, "不能照亮理想目标");
  assert.notEqual(index, level.focus);
  assert.equal(level.punct.includes(index), false);
  assert.match(hint.text, /排除/);
});

test("已经选了全部可排除项时，手电给出空提示而不是编一个", () => {
  const hint = computeHint(level, []);
  assert.notEqual(hint.index, null);
  // 构造一个「只剩理想目标」的极端情况：把所有非理想词都选上
  const idealGroups = new Set(
    idealTokenIndices(level, "panorama").map((tokenIndex) => engineGroupId(level, tokenIndex)),
  );
  const everything = level.tokens
    .map((_, index) => index)
    .filter(
      (index) =>
        index !== level.focus &&
        !level.punct.includes(index) &&
        !idealGroups.has(engineGroupId(level, index)),
    );
  const empty = computeHint(level, everything);
  assert.equal(empty.index, null);
  assert.match(empty.text, /没有了/);
});

test("科普卡按错误类型触发，一次只给一张", () => {
  const base = {
    primary: "PERFECT" as const,
    selectedCount: 3,
    wordCount: 10,
    corefMistakes: 0,
    highStreak: 0,
    hasCausal: false,
  };

  assert.equal(pickCard(base)?.id, "C11");
  assert.equal(pickCard({ ...base, corefMistakes: 2 })?.id, "C03");
  assert.equal(pickCard({ ...base, selectedCount: 0 })?.id, "C09");
  assert.equal(pickCard({ ...base, selectedCount: 9 })?.id, "C09");
  assert.equal(pickCard({ ...base, highStreak: 3 })?.id, "C11");
  assert.equal(
    pickCard({ ...base, primary: "MISS_SECONDARY", hasCausal: true })?.id,
    "C08",
  );
  assert.equal(pickCard({ ...base, primary: "OVER_SELECTION" })?.id, "C09");
  assert.equal(pickCard({ ...base, primary: "IRRELEVANT" })?.id, "C10");
});

test("每张科普卡都带 copyId，且标注了来源状态", () => {
  const card = pickCard({
    primary: "PERFECT",
    selectedCount: 3,
    wordCount: 10,
    corefMistakes: 0,
    highStreak: 0,
    hasCausal: false,
  });
  assert.ok(card !== null);
  assert.match(card.copyId, /^CARD-C\d{2}$/);
  assert.equal(card.status, "draft");
  assert.ok(card.body.length <= 160, "卡片正文不应太长");
});

test("侦探报告只统计最近 20 局，并给出风格建议", () => {
  const sessions: SessionStat[] = Array.from({ length: 25 }, (_, index) =>
    stat({
      score: index % 2 === 0 ? 80 : 40,
      star: index % 2 === 0 ? 3 : 1,
      missed: index % 2 === 0 ? [] : ["因为"],
      at: 1_700_000_000_000 + index * 1000,
    }),
  );

  const report = buildReport(sessions);
  assert.equal(report.played, 20);
  assert.ok(report.averageScore > 0);
  assert.equal(report.threeStarRate, 50);
  assert.equal(report.topMissed[0]?.word, "因为");
  assert.equal(report.style.label, "偏语义");
});

test("没有对局时报告是空的，不报错", () => {
  const report = buildReport([]);
  assert.equal(report.played, 0);
  assert.deepEqual(report.topMissed, []);
});

test("进度：通关解锁下一关与下一枚透镜", () => {
  let progress = createProgress();
  assert.equal(isLevelUnlocked(progress, 1), true);
  assert.equal(isLevelUnlocked(progress, 2), false);

  progress = recordSession(progress, stat({ levelId: "L1-01", level: 1, star: 2, score: 70 }));
  assert.equal(isLevelUnlocked(progress, 2), true);
  assert.deepEqual(progress.lenses, ["panorama", "coref"]);
  assert.equal(totalStars(progress), 2);

  progress = recordSession(progress, stat({ levelId: "L1-01", level: 1, star: 3, score: 100 }));
  assert.equal(progress.plays["L1-01"]?.best, 100);
  assert.equal(progress.plays["L1-01"]?.plays, 2);
  assert.equal(totalStars(progress), 3, "取最好的星，不累加");
});

test("未通关不解锁透镜", () => {
  const progress = recordSession(
    createProgress(),
    stat({ levelId: "L2-01", level: 2, star: 0, score: 10 }),
  );
  assert.deepEqual(progress.lenses, ["panorama"]);
});

test("透镜解锁是幂等的", () => {
  const once = unlockedLensesFor(1, ["panorama"]);
  const twice = unlockedLensesFor(1, once);
  assert.deepEqual(once, twice);
  assert.deepEqual(unlockedLensesFor(6, ["panorama"]), ["panorama"]);
});

test("每关选题优先没玩过的句子", () => {
  const sentences = sentencesOfLevel(pkg, 1);
  assert.ok(sentences.length >= 2);

  let progress = createProgress();
  const first = pickSentence(pkg, progress, 1);
  progress = recordSession(progress, stat({ levelId: first.id, level: 1 }));
  const second = pickSentence(pkg, progress, 1);
  assert.notEqual(second.id, first.id, "第二局应换一句没玩过的");
});
