import { test } from "node:test";
import { strict as assert } from "node:assert";
import { setTelemetryEnabled, track, peekQueue } from "../src/telemetry/index.ts";

test("关闭统计清空事件并阻止新事件", () => {
  setTelemetryEnabled(true);
  track({ name: "hint_use", levelId: "L1-01" });
  assert.equal(peekQueue().length, 1);
  setTelemetryEnabled(false);
  assert.equal(peekQueue().length, 0);
  track({ name: "hint_use", levelId: "L1-01" });
  assert.equal(peekQueue().length, 0);
});
