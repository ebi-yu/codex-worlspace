// 1. 有効にできる評価軸と、request・cacheで使う正規順序を定義する。
export const EVALUATION_AXIS_IDS = [
  "usefulness",
  "prerequisite_level",
  "source_type",
  "primary_source",
  "specificity",
  "freshness",
  "transparency",
  "audience",
  "reading_effort",
  "commercial_intent",
] as const;
export type EvaluationAxisId = (typeof EVALUATION_AXIS_IDS)[number];

const AXIS_SORT_INDEX = new Map<EvaluationAxisId, number>(
  EVALUATION_AXIS_IDS.map((axisId, sortIndex) => [axisId, sortIndex]),
);
const AXIS_PRESETS = {
  simple: ["usefulness", "source_type"],
  learning: ["usefulness", "prerequisite_level", "source_type"],
  research: [
    "usefulness",
    "source_type",
    "primary_source",
    "specificity",
    "freshness",
    "transparency",
  ],
} as const satisfies Record<string, readonly EvaluationAxisId[]>;

// 2. 重複と順序を正規化し、同じ設定から同じcache key要素を作る。
export class EvaluationAxes {
  readonly enabledAxisIds: readonly EvaluationAxisId[];

  static learningPreset(): EvaluationAxes {
    return EvaluationAxes.fromUntrustedIds(AXIS_PRESETS.learning);
  }

  static fromUntrustedIds(
    untrustedAxisIds: readonly unknown[],
  ): EvaluationAxes {
    if (!Array.isArray(untrustedAxisIds) || untrustedAxisIds.length === 0) {
      throw new TypeError("at least one evaluation axis is required");
    }
    const deduplicatedAxisIds = [...new Set(untrustedAxisIds)];
    const unsupportedAxisId = deduplicatedAxisIds.find(
      (axisId) => !AXIS_SORT_INDEX.has(axisId as EvaluationAxisId),
    );
    if (unsupportedAxisId) {
      throw new TypeError(
        `unknown evaluation axis: ${String(unsupportedAxisId)}`,
      );
    }
    const sortedAxisIds = deduplicatedAxisIds as EvaluationAxisId[];
    sortedAxisIds.sort(
      (leftAxisId, rightAxisId) =>
        AXIS_SORT_INDEX.get(leftAxisId)! - AXIS_SORT_INDEX.get(rightAxisId)!,
    );
    return new EvaluationAxes(sortedAxisIds);
  }

  private constructor(enabledAxisIds: readonly EvaluationAxisId[]) {
    this.enabledAxisIds = Object.freeze([...enabledAxisIds]);
    Object.freeze(this);
  }

  get cacheKeySegment(): string {
    return this.enabledAxisIds.join(",");
  }

  get matchedPresetName(): string {
    return (
      Object.entries(AXIS_PRESETS).find(([, presetAxisIds]) =>
        containSameAxisIdsInOrder(presetAxisIds, this.enabledAxisIds),
      )?.[0] ?? "custom"
    );
  }
}

function containSameAxisIdsInOrder(
  leftAxisIds: readonly EvaluationAxisId[],
  rightAxisIds: readonly EvaluationAxisId[],
): boolean {
  return (
    leftAxisIds.length === rightAxisIds.length &&
    leftAxisIds.every((axisId, index) => axisId === rightAxisIds[index])
  );
}
