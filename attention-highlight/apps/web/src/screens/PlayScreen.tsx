import { useEffect, useMemo, useRef, useState } from "react";
import { useMachine } from "@xstate/react";
import type { LensId, Level } from "@attention/schema";
import { Sentence } from "../components/Sentence.tsx";
import { LensTabs } from "../components/LensTabs.tsx";
import { ResultPanel } from "../components/ResultPanel.tsx";
import { ScienceCardSheet } from "../components/ScienceCardSheet.tsx";
import {
  buildTokenViews,
  canSubmit,
  canUndo,
  HEAT_MODES,
  HEAT_MODE_LABELS,
  idealTokenIndices,
  selectedGroupCount,
  tokenTextsForGroups,
} from "../game/domain.ts";
import type { HeatMode } from "../game/domain.ts";
import { flowMachine } from "../game/flow.ts";
import { pickCard } from "../game/cards.ts";
import type { Progress, RoundDraft } from "../game/progress.ts";
import type { SessionStat } from "../game/report.ts";
import { track } from "../telemetry/index.ts";

export interface PlayScreenProps {
  readonly level: Level;
  readonly progress: Progress;
  readonly mode: "level" | "daily";
  readonly heatMode: HeatMode;
  readonly reduceMotion: boolean;
  readonly onHeatModeChange: (mode: HeatMode) => void;
  readonly onExit: () => void;
  /** goNext=true 表示玩家点了「下一关」，由外层决定去哪 */
  readonly onFinish: (stat: SessionStat, goNext: boolean) => void;
  /** 上局没做完的选择（崩溃恢复），只对同一句生效 */
  readonly initialDraft?: RoundDraft | null;
  readonly onDraftChange?: (draft: RoundDraft | null) => void;
  /** QA：?reveal=1 时自动选中「最关键的一组」并交卷，供截图与视觉回归使用 */
  readonly autoReveal?: boolean;
}

const SCAN_MS = 1800;
const SESSION_BREAK_MS = 8 * 60 * 1000;

export function PlayScreen(props: PlayScreenProps) {
  const {
    level,
    progress,
    mode,
    heatMode,
    reduceMotion,
    onHeatModeChange,
    onExit,
    onFinish,
    initialDraft = null,
    onDraftChange,
    autoReveal = false,
  } = props;

  const [snapshot, send] = useMachine(flowMachine, { input: { level } });
  const revealed = snapshot.matches("result");
  const { selection, hint, hintUsed, attempt, lens } = snapshot.context;

  const autoDone = useRef(false);
  useEffect(() => {
    if (!autoReveal || autoDone.current) return;
    autoDone.current = true;
    const first = idealTokenIndices(level, "panorama")[0];
    if (first !== undefined) send({ type: "toggle", index: first });
    send({ type: "submit" });
  }, [autoReveal, level, send]);

  // 崩溃恢复：把上次没交卷的选择灌回状态机（只对同一句生效）
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || autoReveal) return;
    if (initialDraft === null || initialDraft.levelId !== level.id) return;
    restored.current = true;
    for (const index of initialDraft.selected) {
      send({ type: "toggle", index });
    }
    if (initialDraft.hintUsed) send({ type: "useHint" });
  }, [initialDraft, level.id, autoReveal, send]);

  // 每次改选择就落一次草稿；交卷后不再覆盖
  useEffect(() => {
    if (onDraftChange === undefined || revealed) return;
    const empty = selection.selected.length === 0 && !hintUsed;
    onDraftChange(
      empty
        ? null
        : {
            levelId: level.id,
            selected: [...selection.selected],
            hintUsed,
            at: Date.now(),
          },
    );
  }, [selection.selected, hintUsed, revealed, level.id, onDraftChange]);

  const [scanning, setScanning] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [breakDue, setBreakDue] = useState(false);

  const startedAt = useRef(Date.now());
  const undoCount = useRef(0);
  const hintMarked = useRef(false);
  const cardOpenedAt = useRef<number | null>(null);

  useEffect(() => {
    track({ name: "level_start", levelId: level.id, level: level.level });
    const timer = window.setTimeout(() => {
      setBreakDue(true);
      track({ name: "session_break", minutes: 8 });
    }, SESSION_BREAK_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [level.id, level.level]);

  useEffect(() => {
    if (!revealed) return undefined;
    if (reduceMotion) {
      setScanning(false);
      return undefined;
    }
    setScanning(true);
    const timer = window.setTimeout(() => {
      setScanning(false);
    }, SCAN_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [revealed, reduceMotion]);

  const views = useMemo(
    () => buildTokenViews(level, selection, lens, attempt ?? undefined),
    [level, selection, lens, attempt],
  );

  const groupCount = selectedGroupCount(level, selection.selected);
  const wordCount = views.filter((view) => view.role === "word").length;

  const card = useMemo(() => {
    if (attempt === null) return null;
    const recent = progress.sessions.slice(-20);
    const corefMistakes = recent.filter(
      (item) => item.missed.some((word) => ["它", "他", "她"].includes(word)),
    ).length;
    let highStreak = 0;
    for (const item of [...recent].reverse()) {
      if (item.score >= 80) highStreak += 1;
      else break;
    }
    return pickCard({
      primary: attempt.feedback.primary,
      selectedCount: groupCount,
      wordCount,
      corefMistakes,
      highStreak,
      hasCausal: level.causal.length > 0,
    });
  }, [attempt, groupCount, progress.sessions, wordCount, level.causal.length]);

  function finish(goNext = false) {
    if (attempt === null) return;
    const stat: SessionStat = {
      levelId: level.id,
      level: level.level,
      score: attempt.score.score,
      star: attempt.score.star,
      lens,
      selectedCount: groupCount,
      idealCount: attempt.score.idealGroupIds.length,
      keyHit: attempt.score.keyHit,
      missed: tokenTextsForGroups(level, attempt.score.missedGroupIds),
      usedHint: hintUsed,
      at: Date.now(),
      daily: mode === "daily",
    };
    track({
      name: "round_finish",
      levelId: level.id,
      level: level.level,
      score: stat.score,
      star: stat.star,
      selectedCount: stat.selectedCount,
      lens,
      usedHint: hintUsed,
      durationMs: Date.now() - startedAt.current,
      undoCount: undoCount.current,
    });
    onFinish(stat, goNext);
  }

  return (
    <main className="app">
      <header className="playbar">
        <button type="button" className="btn btn--quiet" onClick={onExit}>
          ← 返回
        </button>
        <div className="playbar__title">
          <strong>
            {mode === "daily" ? "今日一句" : `第 ${String(level.level)} 关`}
          </strong>
          <span className="playbar__sub">{level.id}</span>
        </div>
        <span className="counter">
          已选 {groupCount} / {level.scoring.cap} 组
        </span>
      </header>

      <section className="board" data-scanning={scanning ? "true" : "false"}>
        <p className="question">
          AI 读这句话时，会把「眼力」更多地放在哪些词上？
          <span className="question__focus">（焦点：{level.tokens[level.focus]}）</span>
        </p>

        <Sentence
          views={views}
          revealed={revealed}
          heatMode={heatMode}
          scanning={scanning}
          hintIndex={hint?.index ?? null}
          onToggle={(index) => {
            if (revealed) return;
            send({ type: "toggle", index });
          }}
        />

        {scanning ? (
          <button
            type="button"
            className="scan-skip"
            onClick={() => {
              setScanning(false);
            }}
          >
            跳过揭晓动画
          </button>
        ) : null}

        {!revealed && hint !== null ? (
          <p className="hint" data-copy-id={hint.copyId} role="status">
            {hint.text}
          </p>
        ) : null}

        {selection.notice !== null && !revealed ? (
          <p className="notice" role="status">
            {selection.notice}
          </p>
        ) : null}

        <div className="toolbar">
          {revealed ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                send({ type: "retry" });
              }}
            >
              换一组词再试
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn"
                disabled={!canUndo(selection)}
                onClick={() => {
                  undoCount.current += 1;
                  send({ type: "undo" });
                }}
              >
                撤销
              </button>
              <button
                type="button"
                className="btn"
                disabled={selection.selected.length === 0}
                onClick={() => {
                  send({ type: "clear" });
                }}
              >
                清空
              </button>
              <button
                type="button"
                className="btn btn--hint"
                disabled={hintUsed || breakDue}
                onClick={() => {
                  if (!hintMarked.current) {
                    hintMarked.current = true;
                    track({ name: "hint_use", levelId: level.id });
                  }
                  send({ type: "useHint" });
                }}
              >
                {hintUsed ? "手电已用" : "🔦 手电提示"}
              </button>
            </>
          )}

          <button
            type="button"
            className="btn btn--primary"
            disabled={revealed || !canSubmit(selection)}
            onClick={() => {
              send({ type: "submit" });
            }}
          >
            {revealed ? "已交卷" : "交卷"}
          </button>
        </div>
      </section>

      {revealed && attempt !== null ? (
        <section className="reveal">
          <div className="reveal__bar">
            <LensTabs
              value={lens}
              onChange={(next: LensId) => {
                send({ type: "lens", lens: next });
              }}
            />
            <div className="heat-modes" role="group" aria-label="热力图显示方式">
              {HEAT_MODES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === heatMode ? "chip chip--on" : "chip"}
                  aria-pressed={item === heatMode}
                  onClick={() => {
                    onHeatModeChange(item);
                  }}
                >
                  {HEAT_MODE_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          <ResultPanel level={level} evaluation={attempt} lens={lens} />

          {card !== null ? (
            <ScienceCardSheet
              card={card}
              open={cardOpen}
              onToggle={() => {
                const next = !cardOpen;
                setCardOpen(next);
                if (next) {
                  cardOpenedAt.current = Date.now();
                  track({ name: "card_open", cardId: card.id });
                } else if (cardOpenedAt.current !== null) {
                  track({ name: "card_read", cardId: card.id, durationMs: Date.now() - cardOpenedAt.current });
                  cardOpenedAt.current = null;
                }
              }}
            />
          ) : null}

          <div className="round-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                finish(false);
              }}
            >
              {mode === "daily" ? "收下今天的一句话" : "完成本关"}
            </button>
            {mode === "level" && level.level < 6 ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  finish(true);
                }}
              >
                下一关 →
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {breakDue ? (
        <div className="break-card" role="dialog" aria-label="休息提醒">
          <p>奶娃去打水了，你也起来走两步吧。</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setBreakDue(false);
            }}
          >
            继续
          </button>
        </div>
      ) : null}
    </main>
  );
}
