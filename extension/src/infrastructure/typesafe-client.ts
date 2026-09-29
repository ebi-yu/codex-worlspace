// 1. provider境界はruntimeで検証する。詳細はADR 0002を参照。
// @ts-nocheck
import { Evaluation } from "../domain/evaluation.js";
import { convertEvaluationAxesToTypeSafeQuestions } from "../domain/questions.js";

const TYPESAFE_EVALUATION_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

// 2. 外部errorをUIへ安全に渡せるcodeへ限定する。
export class ProviderError extends Error {
  constructor(publicErrorCode) {
    super(`TypeSafe request failed: ${publicErrorCode}`);
    this.name = "ProviderError";
    this.publicErrorCode = publicErrorCode;
  }
}

// 3. 有効な評価軸だけを送り、一時errorだけを指数backoffで再試行する。
export class TypeSafeClient {
  constructor({
    performHttpRequest = globalThis.fetch,
    waitBeforeRetry = (milliseconds) =>
      new Promise((resolveWaiting) => setTimeout(resolveWaiting, milliseconds)),
    generateRandomFraction = Math.random,
  } = {}) {
    this.performHttpRequest = performHttpRequest;
    this.waitBeforeRetry = waitBeforeRetry;
    this.generateRandomFraction = generateRandomFraction;
  }

  async requestSearchResultEvaluation({
    apiKey,
    searchResult,
    evaluationAxes,
  }) {
    if (typeof apiKey !== "string" || !apiKey.trim()) {
      throw new ProviderError("not_configured");
    }
    const searchResultMetadata = searchResult.toSerializableMetadata();
    const requestBody = {
      state: {
        query: searchResultMetadata.query,
        result: {
          url: searchResultMetadata.url,
          title: searchResultMetadata.title,
          snippet: searchResultMetadata.snippet,
        },
      },
      model: "jev-latest",
      questions: convertEvaluationAxesToTypeSafeQuestions(evaluationAxes),
    };

    for (
      let requestAttemptIndex = 0;
      requestAttemptIndex < 3;
      requestAttemptIndex += 1
    ) {
      let httpResponse;
      try {
        httpResponse = await this.performHttpRequest(
          TYPESAFE_EVALUATION_ENDPOINT,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          },
        );
      } catch {
        throw new ProviderError("network_error");
      }

      if (httpResponse.ok) {
        return Evaluation.fromTypeSafeResponse(
          await parseJsonResponse(httpResponse),
        );
      }
      if (httpResponse.status === 401) throw new ProviderError("invalid_token");
      if (httpResponse.status === 422)
        throw new ProviderError("invalid_request");
      if (httpResponse.status !== 429 && httpResponse.status !== 529) {
        throw new ProviderError("provider_error");
      }
      if (requestAttemptIndex === 2) throw new ProviderError("temporary_error");
      const retryDelayMilliseconds =
        1000 * 2 ** requestAttemptIndex +
        Math.floor(this.generateRandomFraction() * 250);
      await this.waitBeforeRetry(retryDelayMilliseconds);
    }
  }
}

// 4. JSONでないresponseをdomainへ渡さない。
async function parseJsonResponse(httpResponse) {
  try {
    return await httpResponse.json();
  } catch {
    throw new ProviderError("invalid_response");
  }
}
