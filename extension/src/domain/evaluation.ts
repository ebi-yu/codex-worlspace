// 1. TypeSafe responseは外部入力としてruntimeで検証する。詳細はADR 0002を参照。
// @ts-nocheck
// 2. provider responseを、表示目的が明確なfield名を持つmodelへ変換する。
export class Evaluation {
  static fromTypeSafeResponse(untrustedResponsePayload) {
    if (
      !untrustedResponsePayload ||
      typeof untrustedResponsePayload.model !== "string" ||
      !isNonArrayObject(untrustedResponsePayload.answers)
    ) {
      throw new TypeError("invalid TypeSafe response");
    }
    const axisEvaluations = Object.entries(untrustedResponsePayload.answers).map(
      ([axisId, untrustedAnswer]) => parseTypeSafeAnswer(axisId, untrustedAnswer),
    );
    const inputTokenCount = untrustedResponsePayload.usage?.input_tokens;
    const outputTokenCount = untrustedResponsePayload.usage?.output_tokens;
    if (!Number.isInteger(inputTokenCount) || !Number.isInteger(outputTokenCount)) {
      throw new TypeError("invalid token usage");
    }
    return new Evaluation(untrustedResponsePayload.model, axisEvaluations, {
      inputTokenCount,
      outputTokenCount,
    });
  }

  constructor(providerModelName, axisEvaluations, tokenUsage) {
    this.providerModelName = providerModelName;
    this.axisEvaluations = axisEvaluations;
    this.tokenUsage = tokenUsage;
    Object.freeze(this);
  }

  toDisplayModel() {
    return {
      providerModelName: this.providerModelName,
      axisEvaluations: structuredClone(this.axisEvaluations),
    };
  }
}

// 3. question typeごとに必要なfieldと範囲をruntimeで検証する。
function parseTypeSafeAnswer(axisId, untrustedAnswer) {
  if (!isNonArrayObject(untrustedAnswer))
    throw new TypeError(`invalid answer: ${axisId}`);
  if (untrustedAnswer.type === "score")
    return parseScoreAnswer(axisId, untrustedAnswer);
  if (untrustedAnswer.type === "choice")
    return parseChoiceAnswer(axisId, untrustedAnswer);
  if (untrustedAnswer.type === "noul") return parseNoulAnswer(axisId, untrustedAnswer);
  throw new TypeError(`invalid answer type: ${axisId}`);
}

function parseScoreAnswer(axisId, scoreAnswer) {
  const rubricLevelIndexes = Object.keys(scoreAnswer.legend ?? {}).map(Number);
  const minimumRubricLevel = Math.min(...rubricLevelIndexes);
  const maximumRubricLevel = Math.max(...rubricLevelIndexes);
  if (
    !Number.isFinite(scoreAnswer.score) ||
    !Number.isFinite(scoreAnswer.confidence) ||
    !isNonArrayObject(scoreAnswer.legend) ||
    !isNonArrayObject(scoreAnswer.probabilities) ||
    !Number.isFinite(minimumRubricLevel) ||
    maximumRubricLevel <= minimumRubricLevel ||
    scoreAnswer.score < minimumRubricLevel ||
    scoreAnswer.score > maximumRubricLevel
  ) {
    throw new TypeError(`invalid score answer: ${axisId}`);
  }
  const nearestRubricLevelKey = String(Math.round(scoreAnswer.score));
  return {
    axisId,
    answerKind: "score",
    displayValue: Math.round(
      ((scoreAnswer.score - minimumRubricLevel) /
        (maximumRubricLevel - minimumRubricLevel)) *
        100,
    ),
    rubricLabel: scoreAnswer.legend[nearestRubricLevelKey],
    confidence: scoreAnswer.confidence,
    probabilityDistribution: structuredClone(scoreAnswer.probabilities),
    evaluationStatus: "evaluated",
  };
}

function parseChoiceAnswer(axisId, choiceAnswer) {
  if (
    typeof choiceAnswer.choice !== "string" ||
    !Number.isFinite(choiceAnswer.confidence) ||
    !isNonArrayObject(choiceAnswer.probabilities) ||
    !(choiceAnswer.choice in choiceAnswer.probabilities)
  ) {
    throw new TypeError(`invalid choice answer: ${axisId}`);
  }
  return {
    axisId,
    answerKind: "choice",
    displayValue: choiceAnswer.choice,
    confidence: choiceAnswer.confidence,
    probabilityDistribution: structuredClone(choiceAnswer.probabilities),
    evaluationStatus: choiceAnswer.choice === "unknown" ? "unknown" : "evaluated",
  };
}

function parseNoulAnswer(axisId, noulAnswer) {
  if (!Number.isFinite(noulAnswer.noul) || noulAnswer.noul < 0 || noulAnswer.noul > 1) {
    throw new TypeError(`invalid noul answer: ${axisId}`);
  }
  return {
    axisId,
    answerKind: "noul",
    displayValue: Math.round(noulAnswer.noul * 100),
    evaluationStatus: "evaluated",
  };
}

function isNonArrayObject(candidate) {
  return (
    candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)
  );
}
