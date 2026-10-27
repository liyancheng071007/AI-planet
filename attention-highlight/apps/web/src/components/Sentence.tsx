import type { CSSProperties } from "react";
import type { HeatMode, TokenView } from "../game/domain.ts";

function tokenClassName(view: TokenView, revealed: boolean, hinted: boolean): string {
  const classes = ["token"];
  if (view.role === "punct") classes.push("token--punct");
  if (view.role === "focus") classes.push("token--focus");
  if (view.selected) classes.push("token--selected");
  if (view.inSelectedGroup) classes.push("token--group");
  if (view.dimmed) classes.push("token--dim");
  if (hinted) classes.push("token--hint");
  if (revealed) {
    classes.push(`heat-${view.bucket}`);
    if (view.hit) classes.push("token--hit");
    if (view.extra) classes.push("token--extra");
    if (view.missed) classes.push("token--missed");
  }
  return classes.join(" ");
}

interface Chunk {
  readonly key: string;
  readonly head: TokenView | null;
  readonly tail: TokenView[];
}

/**
 * 把标点粘在前一个词块上，避免「。」单独掉到下一行开头
 * （中文避头尾规则；flex 下每个 token 都是独立 flex item 时会被强行换行）。
 */
function chunkViews(views: readonly TokenView[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const view of views) {
    if (view.role !== "punct") {
      chunks.push({ key: `w${String(view.index)}`, head: view, tail: [] });
      continue;
    }
    const last = chunks.at(-1);
    if (last !== undefined) {
      last.tail.push(view);
    } else {
      chunks.push({ key: `p${String(view.index)}`, head: null, tail: [view] });
    }
  }
  return chunks;
}

export interface SentenceProps {
  readonly views: readonly TokenView[];
  readonly revealed: boolean;
  readonly heatMode: HeatMode;
  readonly scanning?: boolean;
  readonly hintIndex?: number | null;
  readonly onToggle: (index: number) => void;
}

export function Sentence({
  views,
  revealed,
  heatMode,
  scanning = false,
  hintIndex = null,
  onToggle,
}: SentenceProps) {
  const chunks = chunkViews(views);

  return (
    <div
      className="sentence"
      data-mode={revealed ? heatMode : "color"}
      data-revealed={revealed ? "true" : "false"}
      data-scanning={scanning ? "true" : "false"}
    >
      {chunks.map((chunk) => {
        const head = chunk.head;
        return (
          <span className="chunk" key={chunk.key}>
            {head === null ? null : head.role === "focus" ? (
              <span className={tokenClassName(head, revealed, false)}>
                <span className="token__text">{head.text}</span>
                <span className="token__badge">焦点</span>
              </span>
            ) : (
              <button
                type="button"
                className={tokenClassName(head, revealed, head.index === hintIndex)}
                onClick={() => {
                  onToggle(head.index);
                }}
                aria-pressed={head.selected}
                aria-label={head.label}
                style={{ "--heat": head.weight.toFixed(4) } as CSSProperties}
              >
                <span className="token__text">{head.text}</span>
                {revealed && heatMode === "number" ? (
                  <span className="token__pct">{head.percent.toFixed(1)}%</span>
                ) : null}
                {revealed && head.selected ? (
                  <span className="token__check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            )}

            {chunk.tail.map((view) => (
              <span
                key={view.index}
                className={tokenClassName(view, revealed, false)}
                aria-hidden="true"
              >
                {view.text}
              </span>
            ))}
          </span>
        );
      })}

      {scanning ? <span className="scan-dot" aria-hidden="true" /> : null}
    </div>
  );
}
