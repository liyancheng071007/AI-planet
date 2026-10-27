import { useState } from "react";
import type { Level } from "@attention/schema";

/** 先展示句子供全班讨论，教师手动揭晓；不采集学生答案。 */
export function ClassroomScreen({ levels, onBack }: { readonly levels: readonly Level[]; readonly onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const level = levels[index];
  if (!level) return <main className="app"><button onClick={onBack}>返回</button><p>暂无句子</p></main>;
  const ranked = level.tokens.map((text, i) => ({ text, i, weight: level.attention.lenses.panorama[i] ?? 0 }))
    .filter(item => item.i !== level.focus && !level.punct.includes(item.i))
    .sort((a, b) => b.weight - a.weight || a.i - b.i).slice(0, 3);
  return <main className="app classroom">
    <header className="playbar"><button className="btn" onClick={onBack}>← 返回</button><h1>课堂投影</h1></header>
    <label>选择句子 <select value={index} onChange={event => { setIndex(Number(event.target.value)); setRevealed(false); }}>
      {levels.map((item, i) => <option key={item.id} value={i}>第 {item.level} 关 · {item.id}</option>)}
    </select></label>
    <p>先请同学举手，说说 AI 可能多看了哪些词。</p>
    <p className="classroom__sentence">{level.tokens.map((word, i) => <span key={i} className={i === level.focus ? "classroom__focus" : undefined}>{word}</span>)}</p>
    <p>焦点词：{level.tokens[level.focus]}</p>
    <button className="btn btn--primary" onClick={() => setRevealed(!revealed)} aria-expanded={revealed}>{revealed ? "收起结果" : "讨论结束，揭晓"}</button>
    {revealed && <section aria-live="polite"><h2>全景镜下权重最高的三个词</h2><ol>{ranked.map(item => <li key={item.i}>{item.text}：{(item.weight * 100).toFixed(1)}%</li>)}</ol><p>注意力只是线索，不代表模型完整的推理过程。不同的读法也可以有道理。</p></section>}
  </main>;
}
