// 1. このfileの責務を型とtestで明示する。
export const AXIS_IDS = [
  "usefulness", "prerequisite_level", "source_type", "primary_source", "specificity",
  "freshness", "transparency", "audience", "reading_effort", "commercial_intent",
] as const;
export type AxisId = (typeof AXIS_IDS)[number];
const AXIS_ORDER = new Map<AxisId, number>(AXIS_IDS.map((id, index) => [id, index]));
const PRESETS = {
  simple: ["usefulness", "source_type"],
  learning: ["usefulness", "prerequisite_level", "source_type"],
  research: ["usefulness", "source_type", "primary_source", "specificity", "freshness", "transparency"],
} as const satisfies Record<string, readonly AxisId[]>;

// 2. 軸の重複と順序を正規化し、同じ設定から同じcache keyを作る。
export class EvaluationAxes {
  readonly ids: readonly AxisId[];
  static defaults(): EvaluationAxes { return EvaluationAxes.create(PRESETS.learning); }
  static create(ids: readonly unknown[]): EvaluationAxes {
    if (!Array.isArray(ids) || ids.length === 0) throw new TypeError("at least one evaluation axis is required");
    const unique = [...new Set(ids)];
    const unknown = unique.find((id) => !AXIS_ORDER.has(id as AxisId));
    if (unknown) throw new TypeError(`unknown evaluation axis: ${String(unknown)}`);
    const valid = unique as AxisId[];
    valid.sort((a, b) => AXIS_ORDER.get(a)! - AXIS_ORDER.get(b)!);
    return new EvaluationAxes(valid);
  }
  private constructor(ids: readonly AxisId[]) { this.ids = Object.freeze([...ids]); Object.freeze(this); }
  get cacheFragment(): string { return this.ids.join(","); }
  get preset(): string {
    return Object.entries(PRESETS).find(([, ids]) => arraysEqual(ids, this.ids))?.[0] ?? "custom";
  }
}
function arraysEqual(left: readonly AxisId[], right: readonly AxisId[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
