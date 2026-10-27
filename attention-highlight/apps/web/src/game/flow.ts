/**
 * 单局流程状态机（XState v5）
 *
 * 为什么值得上状态机：这一段有 5 个状态和一堆非法转移——
 * 「交卷两次」「揭晓时还能改选择」「提示用两次」「重试后分数还挂着」。
 * 用布尔量堆 if 一定会漏，写成机器就能被测试逐条钉住（见 tests/flow.test.ts）。
 *
 * marking ──submit──▶ result ──retry──▶ marking
 *                       └──finish──▶ done
 * 提示是 marking 里的动作，不单独占状态：点了只是把 hint 放进 context。
 */
import { assign, setup } from "xstate";
import type { Level, LensId } from "@attention/schema";
import {
  canSubmit,
  clearSelection,
  createSelection,
  evaluate,
  toggleSelection,
  undoSelection,
} from "./domain.ts";
import type { Evaluation, SelectionState } from "./domain.ts";
import { computeHint } from "./hint.ts";
import type { HintResult } from "./hint.ts";

export interface FlowInput {
  readonly level: Level;
}

export interface FlowContext {
  readonly level: Level;
  readonly selection: SelectionState;
  readonly lens: LensId;
  readonly hintUsed: boolean;
  readonly hint: HintResult | null;
  readonly attempt: Evaluation | null;
}

export type FlowEvent =
  | { type: "toggle"; index: number }
  | { type: "undo" }
  | { type: "clear" }
  | { type: "useHint" }
  | { type: "lens"; lens: LensId }
  | { type: "submit" }
  | { type: "retry" }
  | { type: "finish" };

export const flowMachine = setup({
  types: {
    context: {} as FlowContext,
    events: {} as FlowEvent,
    input: {} as FlowInput,
  },
  guards: {
    canSubmit: ({ context }) => canSubmit(context.selection),
    hintAvailable: ({ context }) => !context.hintUsed,
    retryable: ({ context }) => context.attempt !== null,
  },
  actions: {
    toggleToken: assign(({ context, event }) => {
      if (event.type !== "toggle") return {};
      const result = toggleSelection(context.level, context.selection, event.index);
      return { selection: result.state };
    }),
    undoToken: assign(({ context }) => ({ selection: undoSelection(context.selection) })),
    clearTokens: assign(({ context }) => ({ selection: clearSelection(context.selection) })),
    markHintUsed: assign(({ context }) => {
      const hint = computeHint(context.level, context.selection.selected);
      return { hintUsed: true, hint };
    }),
    setLens: assign(({ event }) => (event.type === "lens" ? { lens: event.lens } : {})),
    submitAttempt: assign(({ context }) => ({
      attempt: evaluate(context.level, context.selection.selected, context.lens),
    })),
    rescore: assign(({ context, event }) => {
      if (event.type !== "lens") return {};
      return {
        lens: event.lens,
        attempt: evaluate(context.level, context.selection.selected, event.lens),
      };
    }),
    resetRound: assign(({ context }) => ({
      selection: createSelection(),
      hintUsed: false,
      hint: null,
      attempt: null,
      lens: context.lens,
    })),
  },
}).createMachine({
  id: "round",
  initial: "marking",
  context: ({ input }) => ({
    level: input.level,
    selection: createSelection(),
    lens: "panorama",
    hintUsed: false,
    hint: null,
    attempt: null,
  }),
  states: {
    marking: {
      on: {
        toggle: { actions: "toggleToken" },
        undo: { actions: "undoToken" },
        clear: { actions: "clearTokens" },
        useHint: { guard: "hintAvailable", actions: "markHintUsed" },
        lens: { actions: "setLens" },
        submit: { guard: "canSubmit", target: "result", actions: "submitAttempt" },
      },
    },
    result: {
      on: {
        lens: { actions: "rescore" },
        retry: { guard: "retryable", target: "marking", actions: "resetRound" },
        finish: { target: "done" },
      },
    },
    done: { type: "final" },
  },
});

export type FlowMachine = typeof flowMachine;
