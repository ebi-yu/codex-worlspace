// 1. browser／provider境界はruntimeで検証する。詳細はADR 0002を参照。
// @ts-nocheck
// 2. provider responseを検証し、誤解のない表示用valueへ変換する。
export class Evaluation {
  static fromTypeSafe(payload) {
    if (!payload || typeof payload.model !== "string" || !isObject(payload.answers)) {
      throw new TypeError("invalid TypeSafe response");
    }
    const axes = Object.entries(payload.answers).map(([id, answer]) => parseAnswer(id, answer));
    const inputTokens = payload.usage?.input_tokens;
    const outputTokens = payload.usage?.output_tokens;
    if (!Number.isInteger(inputTokens) || !Number.isInteger(outputTokens)) {
      throw new TypeError("invalid token usage");
    }
    return new Evaluation(payload.model, axes, { inputTokens, outputTokens });
  }

  constructor(model, axes, usage) {
    this.model = model;
    this.axes = axes;
    this.usage = usage;
    Object.freeze(this);
  }

  toViewModel() {
    return { model: this.model, axes: structuredClone(this.axes) };
  }
}

// 3. question typeごとに必要なfieldと範囲をruntimeで検証する。
function parseAnswer(id, answer) {
  if (!isObject(answer)) throw new TypeError(`invalid answer: ${id}`);
  if (answer.type === "score") return parseScore(id, answer);
  if (answer.type === "choice") return parseChoice(id, answer);
  if (answer.type === "noul") return parseNoul(id, answer);
  throw new TypeError(`invalid answer type: ${id}`);
}

function parseScore(id, answer) {
  const levels = Object.keys(answer.legend ?? {}).map(Number);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  if (
    !Number.isFinite(answer.score) ||
    !Number.isFinite(answer.confidence) ||
    !isObject(answer.legend) ||
    !isObject(answer.probabilities) ||
    !Number.isFinite(min) ||
    max <= min ||
    answer.score < min ||
    answer.score > max
  ) {
    throw new TypeError(`invalid score answer: ${id}`);
  }
  const nearest = String(Math.round(answer.score));
  return {
    id,
    kind: "score",
    value: Math.round(((answer.score - min) / (max - min)) * 100),
    label: answer.legend[nearest],
    confidence: answer.confidence,
    distribution: structuredClone(answer.probabilities),
    status: "evaluated",
  };
}

function parseChoice(id, answer) {
  if (
    typeof answer.choice !== "string" ||
    !Number.isFinite(answer.confidence) ||
    !isObject(answer.probabilities) ||
    !(answer.choice in answer.probabilities)
  ) {
    throw new TypeError(`invalid choice answer: ${id}`);
  }
  return {
    id,
    kind: "choice",
    value: answer.choice,
    confidence: answer.confidence,
    distribution: structuredClone(answer.probabilities),
    status: answer.choice === "unknown" ? "unknown" : "evaluated",
  };
}

function parseNoul(id, answer) {
  if (!Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) {
    throw new TypeError(`invalid noul answer: ${id}`);
  }
  return {
    id,
    kind: "noul",
    value: Math.round(answer.noul * 100),
    status: "evaluated",
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
