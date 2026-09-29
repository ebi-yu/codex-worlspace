// @ts-nocheck -- browser/provider boundary is runtime-validated; see ADR 0002.
import assert from "node:assert/strict";
import test from "node:test";

import { EvaluationAxes } from "../../extension/src/domain/evaluation-axes.js";

test("EvaluationAxes starts with the small high-value learning set", () => {
  const axes = EvaluationAxes.defaults();

  assert.deepEqual(axes.ids, ["usefulness", "prerequisite_level", "source_type"]);
  assert.equal(axes.preset, "learning");
});

test("EvaluationAxes canonicalizes toggles for stable cache and request behavior", () => {
  const axes = EvaluationAxes.create(["source_type", "usefulness", "source_type"]);

  assert.deepEqual(axes.ids, ["usefulness", "source_type"]);
  assert.equal(axes.cacheFragment, "usefulness,source_type");
  assert.equal(axes.preset, "simple");
});

test("EvaluationAxes rejects unknown axes and an empty selection", () => {
  assert.throws(() => EvaluationAxes.create([]), /at least one evaluation axis/);
  assert.throws(() => EvaluationAxes.create(["magic"]), /unknown evaluation axis/);
});
