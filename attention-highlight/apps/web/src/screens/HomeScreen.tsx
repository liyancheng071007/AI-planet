import type { LevelPackage } from "@attention/schema";
import { isLevelUnlocked, levelNumbers, sentencesOfLevel, totalStars } from "../game/progress.ts";
import type { Progress } from "../game/progress.ts";

export interface HomeScreenProps {
  readonly pkg: LevelPackage;
  readonly progress: Progress;
  readonly dailyDone: boolean;
  readonly onPlayLevel: (levelNumber: number) => void;
  readonly onDaily: () => void;
  readonly onReport: () => void;
  readonly onParent: () => void;
  readonly onClassroom: () => void;
}

export function HomeScreen(props: HomeScreenProps) {
  const { pkg, progress, dailyDone, onPlayLevel, onDaily, onReport, onParent, onClassroom } = props;
  const numbers = levelNumbers(pkg);
  const stars = totalStars(progress);

  return (
    <main className="app">
      <header className="home-head">
        <div>
          <h1 className="home-title">注意力高亮</h1>
          <p className="home-sub">猜一猜 AI 读句子时，眼睛落在哪几个词上</p>
        </div>
        <div className="star-total" aria-label={`已获得 ${String(stars)} 颗星`}>
          <span aria-hidden="true">★</span>
          {stars}
        </div>
      </header>

      <aside className="demo-notice" aria-label="体验版说明">
        <strong>开发体验版</strong> · 题目与科普内容仍待人工审核，暂不适用于儿童正式教学或研究。
        「豆包」是虚构角色；注意力只是理解模型的线索，并非完整解释。
      </aside>
      <button type="button" className="daily-entry" onClick={onDaily}>
        <span className="daily-entry__tag">今日一句</span>
        <span className="daily-entry__text">
          {dailyDone ? "今天已经玩过了，还想再来一次？" : "每天一句话，看看 AI 今天盯着谁"}
        </span>
        <span aria-hidden="true">→</span>
      </button>

      <ol className="level-list">
        {numbers.map((number) => {
          const sentences = sentencesOfLevel(pkg, number);
          const unlocked = isLevelUnlocked(progress, number);
          const best = Math.max(
            0,
            ...sentences.map((level) => progress.plays[level.id]?.stars ?? 0),
          );
          return (
            <li key={number}>
              <button
                type="button"
                className="level-card"
                disabled={!unlocked}
                onClick={() => {
                  onPlayLevel(number);
                }}
              >
                <span className="level-card__no">{number}</span>
                <span className="level-card__main">
                  <span className="level-card__name">
                    {unlocked ? `第 ${number} 关` : "还没解锁"}
                  </span>
                  <span className="level-card__meta">
                    {unlocked ? `${String(sentences.length)} 句 · ${sentences[0]?.template ?? ""}` : "先过上一关"}
                  </span>
                </span>
                <span
                  className="level-card__stars"
                  aria-label={best > 0 ? `${String(best)} 星` : "还没玩"}
                >
                  {!unlocked ? "🔒" : best > 0 ? "★".repeat(best) : "还没玩"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <nav className="home-nav">
        <button type="button" className="btn" onClick={onReport}>
          侦探报告
        </button>
        <button type="button" className="btn" onClick={onClassroom}>课堂投影</button>
        <button type="button" className="btn" onClick={onParent}>
          家长 / 课堂
        </button>
      </nav>

      <p className="home-foot">
        没有排行榜，没有倒计时。只跟你昨天的自己比。
      </p>
    </main>
  );
}
