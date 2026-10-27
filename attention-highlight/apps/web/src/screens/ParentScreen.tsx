import type { Progress, Settings } from "../game/progress.ts";
import { HEAT_MODES } from "../game/domain.ts";
import { HEAT_MODE_LABELS } from "../game/domain.ts";

export interface ParentScreenProps {
  readonly progress: Progress;
  readonly onChange: (patch: Partial<Settings>) => void;
  readonly onClear: () => void;
  readonly onBack: () => void;
}

const FONT_OPTIONS: { value: Settings["fontScale"]; label: string }[] = [
  { value: 1, label: "标准" },
  { value: 1.15, label: "大" },
  { value: 1.3, label: "特大" },
];

export function ParentScreen({ progress, onChange, onClear, onBack }: ParentScreenProps) {
  const { settings } = progress;

  return (
    <main className="app">
      <header className="playbar">
        <button type="button" className="btn btn--quiet" onClick={onBack}>
          ← 返回
        </button>
        <div className="playbar__title">
          <strong>家长 / 课堂</strong>
          <span className="playbar__sub">本机数据，不上传任何个人信息</span>
        </div>
      </header>

      <section className="parent">
        <h2 className="section-title">孩子学到了什么</h2>
        <ul className="parent__list">
          <li>AI 读句子时会给每个词分配不同的「眼力」，加起来是 100%。</li>
          <li>指代（它 / 他 / 她）和因果（因为 / 所以）常常是 AI 重点看的地方。</li>
          <li>被看得多 ≠ 就是原因——注意力只是线索，不是解释。</li>
        </ul>

        <h2 className="section-title">显示与无障碍</h2>
        <div className="setting">
          <span className="setting__label">字号</span>
          <div className="segmented">
            {FONT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={settings.fontScale === option.value ? "seg seg--on" : "seg"}
                onClick={() => {
                  onChange({ fontScale: option.value });
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <span className="setting__label">热力图默认显示</span>
          <div className="segmented">
            {HEAT_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={settings.heatMode === mode ? "seg seg--on" : "seg"}
                onClick={() => {
                  onChange({ heatMode: mode });
                }}
              >
                {HEAT_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        <label className="setting setting--switch">
          <span className="setting__label">减少动态效果</span>
          <input
            type="checkbox"
            checked={settings.reduceMotion}
            onChange={(event) => {
              onChange({ reduceMotion: event.target.checked });
            }}
          />
        </label>

        <label className="setting setting--switch">
          <span className="setting__label">匿名使用统计</span>
          <input
            type="checkbox"
            checked={settings.telemetryEnabled}
            onChange={(event) => {
              onChange({ telemetryEnabled: event.target.checked });
            }}
          />
        </label>
        <p className="setting__note">
          当前统计仅保存在本次运行的内存中，不会上传；关闭后立即清空。
        </p>

        <h2 className="section-title">数据</h2>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            if (window.confirm("确定清空这台设备上的全部进度吗？此操作不可撤销。")) {
              onClear();
            }
          }}
        >
          一键清空本机数据
        </button>

        <h2 className="section-title">声明</h2>
        <p className="parent__legal">
          「豆包」是本游戏的虚构角色，与任何现实中的 AI 产品、公司或商标无关。
          游戏展示的注意力热力图是对语言模型内部信号的一种简化可视化，只作为理解 AI 的线索，
          不代表模型的完整推理过程。
        </p>
      </section>
    </main>
  );
}
