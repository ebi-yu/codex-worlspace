// @ts-nocheck -- browser/provider boundary is runtime-validated; see ADR 0002.
import assert from "node:assert/strict";
import test from "node:test";

import { EvaluationAxes } from "../../extension/src/domain/evaluation-axes.js";
import { buildQuestions } from "../../extension/src/domain/questions.js";

test("buildQuestions sends exactly the axes the user enabled", () => {
  const questions = buildQuestions(
    EvaluationAxes.create(["usefulness", "prerequisite_level"]),
  );

  assert.deepEqual(Object.keys(questions), ["usefulness", "prerequisite_level"]);
  assert.equal(questions.usefulness.type, "score");
  assert.equal(questions.usefulness.criteria.length, 5);
  assert.equal(questions.prerequisite_level.type, "choice");
  assert.ok("unknown" in questions.prerequisite_level.criteria);
});
