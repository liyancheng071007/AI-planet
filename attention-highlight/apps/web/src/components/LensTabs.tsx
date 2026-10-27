import { LENS_HINTS, LENS_LABELS, LENS_ORDER } from "../game/domain.ts";
import type { LensId } from "@attention/schema";

export interface LensTabsProps {
  readonly value: LensId;
  readonly onChange: (lens: LensId) => void;
}

export function LensTabs({ value, onChange }: LensTabsProps) {
  return (
    <div className="lens-tabs" role="tablist" aria-label="切换透镜">
      {LENS_ORDER.map((lens) => (
        <button
          key={lens}
          type="button"
          role="tab"
          aria-selected={lens === value}
          className={lens === value ? "lens-tab lens-tab--active" : "lens-tab"}
          title={LENS_HINTS[lens]}
          onClick={() => {
            onChange(lens);
          }}
        >
          {LENS_LABELS[lens]}
        </button>
      ))}
    </div>
  );
}
