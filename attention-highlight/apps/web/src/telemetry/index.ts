/** 本地调试事件：不上传；关闭统计会清空队列。 */
export type TelemetryEvent =
  | { name: "level_start"; levelId: string; level: number }
  | {
      name: "round_finish";
      levelId: string;
      level: number;
      score: number;
      star: number;
      selectedCount: number;
      lens: string;
      usedHint: boolean;
      durationMs: number;
      undoCount: number;
    }
  | { name: "hint_use"; levelId: string }
  | { name: "card_open"; cardId: string }
  | { name: "card_read"; cardId: string; durationMs: number }
  | { name: "session_break"; minutes: number }
  | { name: "level_retry"; levelId: string };

let enabled = true;
let queue: (TelemetryEvent & { at: number })[] = [];
export function setTelemetryEnabled(value: boolean): void {
  enabled = value;
  if (!value) queue = [];
}

/** Local-only debug events. No per-round events are transmitted. */
export function track(event: TelemetryEvent): void {
  if (!enabled) return;
  queue.push({ ...event, at: Date.now() });
  if (queue.length > 200) queue = queue.slice(-200);
}

/** 仅供本地调试/测试使用 */
export function peekQueue(): readonly TelemetryEvent[] {
  return queue;
}
