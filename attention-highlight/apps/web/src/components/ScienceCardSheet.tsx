import type { ScienceCard } from "../game/cards.ts";

export interface ScienceCardSheetProps {
  readonly card: ScienceCard;
  readonly open: boolean;
  readonly onToggle: () => void;
}

/**
 * 科普卡默认折叠（方案书 4.4 C7：不打断心流，玩家点了才展开）。
 * 卡片文案来自 C，这里只负责渲染结构；copyId 已挂在容器上，方便 C 定位替换。
 */
export function ScienceCardSheet({ card, open, onToggle }: ScienceCardSheetProps) {
  return (
    <section className="card-sheet" data-open={open ? "true" : "false"}>
      <button type="button" className="card-sheet__toggle" onClick={onToggle} aria-expanded={open}>
        <span className="card-sheet__label">科普卡</span>
        <span className="card-sheet__title">{card.title}</span>
        <span className="card-sheet__chevron">{open ? "收起" : "展开"}</span>
      </button>

      {open ? (
        <article className="card-sheet__body" data-copy-id={card.copyId}>
          <p className="card-sheet__text">{card.body}</p>
          <p className="card-sheet__action">{card.action}</p>
          <p className="card-sheet__meta">
            {card.source === "ai" ? "AI 起草 · 待内容组定稿" : "内容组定稿"}
          </p>
        </article>
      ) : null}
    </section>
  );
}
