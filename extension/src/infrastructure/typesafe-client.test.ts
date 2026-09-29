// 1. test対象の振る舞いを、最小の入力と期待値で固定する。
// @ts-nocheck
import assert from "node:assert/strict";
import { test } from "vitest";

import { EvaluationAxes } from "../domain/evaluation-axes.js";
import { SearchResult } from "../domain/search-result.js";
import { ProviderError, TypeSafeClient } from "./typesafe-client.js";

const searchResult = SearchResult.fromUntrustedInput({
  query: "manifest v3",
  url: "https://developer.chrome.com/docs/extensions",
  title: "Chrome Extensions",
  snippet: "Build extensions with Manifest V3.",
  locale: "en",
});

test("TypeSafeClient sends the user's key and only enabled questions", async () => {
  const recordedHttpRequests = [];
  const typeSafeClient = new TypeSafeClient({
    performHttpRequest: async (requestUrl, requestInit) => {
      recordedHttpRequests.push({ requestUrl, requestInit });
      return createJsonResponse({
        model: "jev-1.13.0",
        answers: {
          usefulness: {
            type: "score",
            score: 4,
            legend: { 0: "No", 1: "Low", 2: "Medium", 3: "High", 4: "Direct" },
            probabilities: { 0: 0, 1: 0, 2: 0, 3: 0.1, 4: 0.9 },
            confidence: 0.9,
          },
        },
        usage: { input_tokens: 10, output_tokens: 4 },
      });
    },
  });

  const evaluation = await typeSafeClient.requestSearchResultEvaluation({
    apiKey: "user-secret",
    searchResult,
    evaluationAxes: EvaluationAxes.fromUntrustedIds(["usefulness"]),
  });

  assert.equal(recordedHttpRequests.length, 1);
  assert.equal(
    recordedHttpRequests[0].requestUrl,
    "https://api.typesafe.ai/v1/systemone",
  );
  assert.equal(
    recordedHttpRequests[0].requestInit.headers.Authorization,
    "Bearer user-secret",
  );
  const requestBody = JSON.parse(recordedHttpRequests[0].requestInit.body);
  assert.equal(requestBody.model, "jev-latest");
  assert.deepEqual(Object.keys(requestBody.questions), ["usefulness"]);
  assert.equal(requestBody.state.result.title, "Chrome Extensions");
  assert.equal(evaluation.toDisplayModel().axisEvaluations[0].displayValue, 100);
});

test("TypeSafeClient retries overload once without leaking provider text", async () => {
  let httpRequestCount = 0;
  const recordedRetryDelays = [];
  const typeSafeClient = new TypeSafeClient({
    performHttpRequest: async () => {
      httpRequestCount += 1;
      if (httpRequestCount === 1)
        return createJsonResponse({ error: "internal details" }, 529);
      return createJsonResponse({
        model: "jev",
        answers: {},
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    },
    waitBeforeRetry: async (retryDelayMilliseconds) =>
      recordedRetryDelays.push(retryDelayMilliseconds),
    generateRandomFraction: () => 0,
  });

  await typeSafeClient.requestSearchResultEvaluation({
    apiKey: "secret",
    searchResult,
    evaluationAxes: EvaluationAxes.fromUntrustedIds(["usefulness"]),
  });

  assert.equal(httpRequestCount, 2);
  assert.deepEqual(recordedRetryDelays, [1000]);
});

test("TypeSafeClient classifies invalid credentials without retry", async () => {
  let httpRequestCount = 0;
  const typeSafeClient = new TypeSafeClient({
    performHttpRequest: async () => {
      httpRequestCount += 1;
      return createJsonResponse({ error: "bad key user-secret" }, 401);
    },
  });

  await assert.rejects(
    typeSafeClient.requestSearchResultEvaluation({
      apiKey: "user-secret",
      searchResult,
      evaluationAxes: EvaluationAxes.fromUntrustedIds(["usefulness"]),
    }),
    (error) =>
      error instanceof ProviderError &&
      error.publicErrorCode === "invalid_token" &&
      !error.message.includes("user-secret"),
  );
  assert.equal(httpRequestCount, 1);
});

function createJsonResponse(responseBody, httpStatus = 200) {
  return new Response(JSON.stringify(responseBody), {
    status: httpStatus,
    headers: { "Content-Type": "application/json" },
  });
}
