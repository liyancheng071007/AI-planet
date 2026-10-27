import type { LensId, Level } from "@attention/schema";
import type { Evaluation } from "../game/domain.ts";
import { idealTokenIndices, starLabel, nextStarHint, LENS_LABELS } from "../game/domain.ts";

export interface ResultPanelProps {
  readonly level: Level;
  readonly evaluation: Evaluation;
  readonly lens: LensId;
}

function Stars({ star }: { star: 0 | 1 | 2 | 3 }) {
  return (
    <span className="stars" aria-label={starLabel(star)}>
      {[1, 2, 3].map((slot) => (
        <span key={slot} className={slot <= star ? "star star--on" : "star"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function ResultPanel({ level, evaluation, lens }: ResultPanelProps) {
  const { score, feedback } = evaluation;
  const hint = nextStarHint(score.score);
  const idealText = [
    ...new Set(idealTokenIndices(level, lens).map((index) => level.tokens[index] ?? "")),
  ].join("、");

  return (
    <section className="result" aria-live="polite">
      <header className="result__head">
        <div className="result__score">
          <strong>{score.score.toFixed(1)}</strong>
          <span className="result__unit">分</span>
        </div>
        <div className="result__meta">
          <Stars star={score.star} />
          <p className="result__hint">{hint ?? "已满星，换个透镜看看同一句话的重点会不会变。"}</p>
        </div>
      </header>

      <ul className="feedback" data-feedback-primary={feedback.primary}>
        <li className="feedback__row" data-copy-id={feedback.sections.right.copyId}>
          <span className="feedback__tag">对在哪</span>
          <span className="feedback__text">{feedback.sections.right.text}</span>
        </li>
        <li className="feedback__row" data-copy-id={feedback.sections.missed.copyId}>
          <span className="feedback__tag">漏在哪</span>
          <span className="feedback__text">{feedback.sections.missed.text}</span>
        </li>
        <li className="feedback__row" data-copy-id={feedback.sections.adjust.copyId}>
          <span className="feedback__tag">怎么调</span>
          <span className="feedback__text">{feedback.sections.adjust.text}</span>
        </li>
      </ul>

      <div className="result__explain" data-copy-id={level.explain.copyId}>
        <p className="result__explain-text">{level.explain.text}</p>
        <p className="result__ideal">
          当前透镜（{LENS_LABELS[lens]}）里 AI 看得最重的是：{idealText}
        </p>
      </div>

      <div className="result__legend">
        <span className="legend legend--hit">命中</span>
        <span className="legend legend--extra">多选</span>
        <span className="legend legend--missed">漏选</span>
      </div>
    </section>
  );
}
