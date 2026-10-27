import type { Progress } from "../game/progress.ts";
import { buildReport } from "../game/report.ts";

export interface ReportScreenProps {
  readonly progress: Progress;
  readonly onBack: () => void;
}

export function ReportScreen({ progress, onBack }: ReportScreenProps) {
  const report = buildReport(progress.sessions);

  return (
    <main className="app">
      <header className="playbar">
        <button type="button" className="btn btn--quiet" onClick={onBack}>
          ← 返回
        </button>
        <div className="playbar__title">
          <strong>侦探报告</strong>
          <span className="playbar__sub">只和你自己的过去比</span>
        </div>
      </header>

      {report.played === 0 ? (
        <section className="empty">
          <p>还没有记录。先玩一关，这里就会出现你的读句习惯。</p>
          <button type="button" className="btn" onClick={onBack}>
            去玩一关
          </button>
        </section>
      ) : (
        <section className="report">
          <div className="report__grid">
            <div className="report__cell">
              <span className="report__label">最近对局</span>
              <strong>{report.played}</strong>
            </div>
            <div className="report__cell">
              <span className="report__label">平均分</span>
              <strong>{report.averageScore.toFixed(1)}</strong>
            </div>
            <div className="report__cell">
              <span className="report__label">三星率</span>
              <strong>{report.threeStarRate}%</strong>
            </div>
            <div className="report__cell">
              <span className="report__label">平均标记</span>
              <strong>{report.averageSelected.toFixed(1)} 组</strong>
            </div>
          </div>

          <div className="report__style">
            <span className="report__tag">你的风格：{report.style.label}</span>
            <p>{report.style.hint}</p>
          </div>

          {report.topMissed.length > 0 ? (
            <div className="report__missed">
              <span className="report__label">最常漏的词</span>
              <ul>
                {report.topMissed.map((item) => (
                  <li key={item.word}>
                    <span className="word-chip">{item.word}</span>
                    <span className="report__times">{item.times} 次</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="report__hint">用掉手电的场次：{report.hintRate}%（用了不扣分，只是记录）</p>
        </section>
      )}
    </main>
  );
}
