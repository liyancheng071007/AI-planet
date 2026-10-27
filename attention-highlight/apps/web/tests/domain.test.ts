/**
 * A 轨道域逻辑回归（node:test，零依赖，可直接跑）
 *   运行：pnpm test   （= node --test apps/web/tests/）
 *
 * 覆盖三类：契约自检、标记交互（同指/上限/撤销）、评分与视图模型。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { scoreSelection } from "@attention/engine";
import type { Level } from "@attention/schema";

import {
  buildTokenViews,
  canUndo,
  createSelection,
  engineGroupId,
  evaluate,
  idealTokenIndices,
  nextStarHint,
  sanitizeSelection,
  selectedGroupCount,
  toggleSelection,
  undoSelection,
} from "../src/game/domain.ts";
import { assertPackage } from "../src/levels/contract.ts";

const here = dirname(fileURLToPath(import.meta.url));
const raw: unknown = JSON.parse(
  readFileSync(join(here, "..", "src", "levels", "levels.draft.json"), "utf8"),
);
const pkg = assertPackage(raw);

function levelById(id: string): Level {
  const found = pkg.levels.find((item) => item.id === id);
  assert.ok(found, `找不到关卡 ${id}`);
  return found;
}

const level = levelById("L3-02");

function wordIndices(target: Level): number[] {
  return target.tokens
    .map((_, index) => index)
    .filter((index) => index !== target.focus && !target.punct.includes(index));
}

function distinctGroupIndices(target: Level): number[] {
  const seen = new Set<string>();
  const result: number[] = [];
  for (const index of wordIndices(target)) {
    const key = engineGroupId(target, index);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(index);
    }
  }
  return result;
}

test("draft 包通过 A 侧契约自检", () => {
  assert.equal(pkg.status, "draft");
  assert.equal(pkg.levels.length, 12);
  for (const item of pkg.levels) {
    assert.equal(item.review.status, "draft");
  }
});

test("焦点词与标点不可选，且不改变选择集", () => {
  const state = createSelection();

  const focusResult = toggleSelection(level, state, level.focus);
  assert.equal(focusResult.rejection, "focus");
  assert.deepEqual(focusResult.state.selected, []);

  const punct = level.punct[0];
  assert.ok(punct !== undefined);
  const punctResult = toggleSelection(level, state, punct);
  assert.equal(punctResult.rejection, "punct");
  assert.deepEqual(punctResult.state.selected, []);
  assert.match(punctResult.state.notice ?? "", /标点/);
});

test("点一下选中、再点一下取消、撤销可退回", () => {
  const index = distinctGroupIndices(level)[0];
  assert.ok(index !== undefined);

  const afterSelect = toggleSelection(level, createSelection(), index).state;
  assert.deepEqual([...afterSelect.selected], [index]);
  assert.equal(selectedGroupCount(level, afterSelect.selected), 1);

  const afterDeselect = toggleSelection(level, afterSelect, index).state;
  assert.deepEqual([...afterDeselect.selected], []);
  assert.ok(canUndo(afterDeselect));

  const afterUndo = undoSelection(afterDeselect);
  assert.deepEqual([...afterUndo.selected], [index]);
});

test("同指组：点任一成员即选中整组，且只算一组", () => {
  const group = level.coref.find((candidate) => {
    const usable = candidate.members.filter(
      (member) => member !== level.focus && !level.punct.includes(member),
    );
    return usable.length >= 2;
  });
  assert.ok(group, "L3-02 应当有可用的同指组");

  const [first, second] = group.members.filter(
    (member) => member !== level.focus && !level.punct.includes(member),
  );
  assert.ok(first !== undefined && second !== undefined);

  const selected = toggleSelection(level, createSelection(), first).state;
  assert.deepEqual([...selected.selected], [first]);
  assert.equal(selectedGroupCount(level, selected.selected), 1);

  const views = buildTokenViews(level, selected, "panorama");
  const sibling = views.find((view) => view.index === second);
  assert.equal(sibling?.inSelectedGroup, true, "组内另一处要显示为同指已选");

  const cancelled = toggleSelection(level, selected, second).state;
  assert.deepEqual([...cancelled.selected], [], "点组内另一处应整组取消");
});

test("到达 cap 后拒绝继续选择", () => {
  // cap 是逐关数据，draft 里全是 4，而 L3-02 恰好只有 4 个可评分组，
  // 所以这里克隆一关把 cap 调成 1，才能构造出"超上限"的场景。
  const capped: Level = structuredClone(level);
  capped.scoring.cap = 1;

  const candidates = distinctGroupIndices(capped);
  assert.ok(candidates.length >= 2, "至少要有两个可评分组");

  const first = candidates[0];
  const second = candidates[1];
  assert.ok(first !== undefined && second !== undefined);

  const accepted = toggleSelection(capped, createSelection(), first);
  assert.equal(accepted.rejection, null);
  assert.equal(selectedGroupCount(capped, accepted.state.selected), 1);

  const rejected = toggleSelection(capped, accepted.state, second);
  assert.equal(rejected.rejection, "cap");
  assert.match(rejected.state.notice ?? "", /上限/);
  assert.equal(selectedGroupCount(capped, rejected.state.selected), 1);
});

test("空选得 0 分，反馈归为 MISS_KEY", () => {
  const evaluation = evaluate(level, []);
  assert.equal(evaluation.score.score, 0);
  assert.equal(evaluation.score.star, 0);
  assert.equal(evaluation.feedback.primary, "MISS_KEY");
});

test("选满理想目标得 100 分，且与引擎直算一致", () => {
  const ideal = idealTokenIndices(level, "panorama");
  const picked: number[] = [];
  const seen = new Set<string>();
  for (const index of ideal) {
    const key = engineGroupId(level, index);
    if (!seen.has(key)) {
      seen.add(key);
      picked.push(index);
    }
  }

  const evaluation = evaluate(level, picked, "panorama");
  assert.equal(evaluation.score.score, 100);
  assert.equal(evaluation.score.star, 3);

  const direct = scoreSelection(level, picked, { lens: "panorama" });
  assert.equal(evaluation.score.score, direct.score);
});

test("engine 对焦点词与标点会抛错，A 侧必须先过滤", () => {
  assert.throws(() => scoreSelection(level, [level.focus]), /焦点词/);
  const punct = level.punct[0];
  assert.ok(punct !== undefined);
  assert.throws(() => scoreSelection(level, [punct]), /标点/);

  const word = wordIndices(level)[0];
  assert.ok(word !== undefined);
  assert.deepEqual(sanitizeSelection(level, [level.focus, punct, word]), [word]);
});

test("视图模型：标点/焦点不可点，词块权重合计为 1", () => {
  const views = buildTokenViews(level, createSelection(), "panorama");

  for (const view of views) {
    if (view.role === "word") {
      assert.equal(view.clickable, true);
    } else {
      assert.equal(view.clickable, false, `${view.text} 不应可点`);
      assert.equal(view.bucket, "none");
    }
  }

  const sum = views
    .filter((view) => view.role === "word")
    .reduce((total, view) => total + view.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-6, `权重和应为 1，实际 ${sum}`);

  const focusView = views[level.focus];
  assert.equal(focusView?.weight, 0, "焦点词权重必须为 0");
});

test("切换透镜会带出不同的权重与评分上下文", () => {
  const panorama = buildTokenViews(level, createSelection(), "panorama");
  const coref = buildTokenViews(level, createSelection(), "coref");
  assert.notDeepEqual(
    panorama.map((view) => view.weight),
    coref.map((view) => view.weight),
    "五个透镜的权重不应完全相同",
  );

  const evaluation = evaluate(level, [distinctGroupIndices(level)[0] ?? 0], "coref");
  assert.equal(evaluation.score.lens, "coref");
});

test("星级提示按 30 / 60 / 90 三档计算", () => {
  assert.equal(nextStarHint(100), null);
  assert.equal(nextStarHint(90), null);
  assert.match(nextStarHint(84.4) ?? "", /5\.6 分到 ★★★/);
  assert.match(nextStarHint(0) ?? "", /30\.0 分/);
});
