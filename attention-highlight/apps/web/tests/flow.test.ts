/**
 * 单局状态机回归：把「不能发生的转移」逐条钉住。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createActor } from "xstate";
import type { Level } from "@attention/schema";

import { flowMachine } from "../src/game/flow.ts";
import { assertPackage } from "../src/levels/contract.ts";

const here = dirname(fileURLToPath(import.meta.url));
const raw: unknown = JSON.parse(
  readFileSync(join(here, "..", "src", "levels", "levels.draft.json"), "utf8"),
);
const pkg = assertPackage(raw);
const level = pkg.levels.find((item) => item.id === "L3-02") as Level;

function start() {
  const actor = createActor(flowMachine, { input: { level } });
  actor.start();
  return actor;
}

const word = level.tokens.findIndex(
  (_, index) => index !== level.focus && !level.punct.includes(index),
);

test("初始态是 marking，且没有任何尝试记录", () => {
  const actor = start();
  assert.equal(actor.getSnapshot().value, "marking");
  assert.equal(actor.getSnapshot().context.attempt, null);
  assert.deepEqual(actor.getSnapshot().context.selection.selected, []);
});

test("空选不能交卷", () => {
  const actor = start();
  actor.send({ type: "submit" });
  assert.equal(actor.getSnapshot().value, "marking");
  assert.equal(actor.getSnapshot().context.attempt, null);
});

test("选中后可交卷，进入 result 并带出评分", () => {
  const actor = start();
  actor.send({ type: "toggle", index: word });
  actor.send({ type: "submit" });
  assert.equal(actor.getSnapshot().value, "result");
  const attempt = actor.getSnapshot().context.attempt;
  assert.ok(attempt !== null);
  assert.equal(typeof attempt.score.score, "number");
});

test("揭晓态里点词块不会改变选择", () => {
  const actor = start();
  actor.send({ type: "toggle", index: word });
  const before = [...actor.getSnapshot().context.selection.selected];
  actor.send({ type: "submit" });
  actor.send({ type: "toggle", index: word });
  assert.deepEqual([...actor.getSnapshot().context.selection.selected], before);
});

test("重试会清空选择、提示和分数", () => {
  const actor = start();
  actor.send({ type: "toggle", index: word });
  actor.send({ type: "useHint" });
  actor.send({ type: "submit" });
  actor.send({ type: "retry" });

  const snapshot = actor.getSnapshot();
  assert.equal(snapshot.value, "marking");
  assert.deepEqual(snapshot.context.selection.selected, []);
  assert.equal(snapshot.context.attempt, null);
  assert.equal(snapshot.context.hintUsed, false);
  assert.equal(snapshot.context.hint, null);
});

test("手电每关只能用一次", () => {
  const actor = start();
  actor.send({ type: "useHint" });
  const first = actor.getSnapshot().context.hint;
  assert.equal(actor.getSnapshot().context.hintUsed, true);
  assert.notEqual(first, null);

  actor.send({ type: "useHint" });
  assert.equal(actor.getSnapshot().context.hint, first, "第二次不应改写提示");
});

test("揭晓后切透镜会重新评分", () => {
  const actor = start();
  actor.send({ type: "toggle", index: word });
  actor.send({ type: "submit" });
  const before = actor.getSnapshot().context.attempt?.score.score;

  actor.send({ type: "lens", lens: "coref" });
  const after = actor.getSnapshot().context.attempt;
  assert.equal(after?.score.lens, "coref");
  assert.ok(before !== undefined);
});

test("marking 状态下不会响应 retry", () => {
  const actor = start();
  actor.send({ type: "retry" });
  assert.equal(actor.getSnapshot().value, "marking");
});
