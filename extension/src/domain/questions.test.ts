// 1. test対象の振る舞いを、最小の入力と期待値で固定する。
// @ts-nocheck
import assert from "node:assert/strict";
import { test } from "vitest";

import { EvaluationAxes } from "./evaluation-axes.js";
import { convertEvaluationAxesToTypeSafeQuestions } from "./questions.js";

test("convertEvaluationAxesToTypeSafeQuestions sends exactly the axes the user enabled", () => {
  const typeSafeQuestions = convertEvaluationAxesToTypeSafeQuestions(
    EvaluationAxes.fromUntrustedIds(["usefulness", "prerequisite_level"]),
  );

  assert.deepEqual(Object.keys(typeSafeQuestions), [
    "usefulness",
    "prerequisite_level",
  ]);
  assert.equal(typeSafeQuestions.usefulness.type, "score");
  assert.equal(typeSafeQuestions.usefulness.criteria.length, 5);
  assert.equal(typeSafeQuestions.prerequisite_level.type, "choice");
  assert.ok("unknown" in typeSafeQuestions.prerequisite_level.criteria);
});
