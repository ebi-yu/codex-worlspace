// 1. test対象の振る舞いを、最小の入力と期待値で固定する。
// @ts-nocheck
import assert from "node:assert/strict";
import { test } from "vitest";

import { EvaluationAxes } from "./evaluation-axes.js";

test("EvaluationAxes starts with the small high-value learning set", () => {
  const evaluationAxes = EvaluationAxes.learningPreset();

  assert.deepEqual(evaluationAxes.enabledAxisIds, [
    "usefulness",
    "prerequisite_level",
    "source_type",
  ]);
  assert.equal(evaluationAxes.matchedPresetName, "learning");
});

test("EvaluationAxes canonicalizes toggles for stable cache and request behavior", () => {
  const evaluationAxes = EvaluationAxes.fromUntrustedIds([
    "source_type",
    "usefulness",
    "source_type",
  ]);

  assert.deepEqual(evaluationAxes.enabledAxisIds, ["usefulness", "source_type"]);
  assert.equal(evaluationAxes.cacheKeySegment, "usefulness,source_type");
  assert.equal(evaluationAxes.matchedPresetName, "simple");
});

test("EvaluationAxes rejects unknown axes and an empty selection", () => {
  assert.throws(
    () => EvaluationAxes.fromUntrustedIds([]),
    /at least one evaluation axis/,
  );
  assert.throws(
    () => EvaluationAxes.fromUntrustedIds(["magic"]),
    /unknown evaluation axis/,
  );
});
