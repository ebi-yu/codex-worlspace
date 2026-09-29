// 1. test対象の振る舞いを、最小の入力と期待値で固定する。
// @ts-nocheck
import assert from "node:assert/strict";
import { test } from "vitest";

import { Evaluation } from "./evaluation.js";

test("Evaluation converts TypeSafe answers into honest display values", () => {
  const parsedEvaluation = Evaluation.fromTypeSafeResponse({
    model: "jev-1.13.0",
    answers: {
      usefulness: {
        type: "score",
        score: 3.2,
        legend: {
          0: "Unlikely to help",
          1: "May contain relevant information",
          2: "Relevant but incomplete",
          3: "Likely useful",
          4: "Highly likely to answer",
        },
        probabilities: { 0: 0, 1: 0.02, 2: 0.08, 3: 0.58, 4: 0.32 },
        confidence: 0.81,
      },
      prerequisite_level: {
        type: "choice",
        choice: "practical",
        probabilities: {
          introductory: 0.05,
          basic: 0.2,
          practical: 0.7,
          advanced: 0.05,
        },
        confidence: 0.74,
      },
    },
    usage: { input_tokens: 120, output_tokens: 30 },
  });

  assert.deepEqual(parsedEvaluation.toDisplayModel().axisEvaluations, [
    {
      axisId: "usefulness",
      answerKind: "score",
      displayValue: 80,
      rubricLabel: "Likely useful",
      confidence: 0.81,
      probabilityDistribution: { 0: 0, 1: 0.02, 2: 0.08, 3: 0.58, 4: 0.32 },
      evaluationStatus: "evaluated",
    },
    {
      axisId: "prerequisite_level",
      answerKind: "choice",
      displayValue: "practical",
      confidence: 0.74,
      probabilityDistribution: {
        introductory: 0.05,
        basic: 0.2,
        practical: 0.7,
        advanced: 0.05,
      },
      evaluationStatus: "evaluated",
    },
  ]);
  assert.deepEqual(parsedEvaluation.tokenUsage, {
    inputTokenCount: 120,
    outputTokenCount: 30,
  });
});

test("Evaluation rejects malformed provider data instead of displaying invented values", () => {
  assert.throws(
    () =>
      Evaluation.fromTypeSafeResponse({
        model: "jev-latest",
        answers: { usefulness: { type: "score", score: 99 } },
        usage: {},
      }),
    /invalid score answer/,
  );
});
