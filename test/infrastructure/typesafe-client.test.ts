// @ts-nocheck -- browser/provider boundary is runtime-validated; see ADR 0002.
import assert from "node:assert/strict";
import test from "node:test";

import { EvaluationAxes } from "../../extension/src/domain/evaluation-axes.js";
import { SearchResult } from "../../extension/src/domain/search-result.js";
import {
  ProviderError,
  TypeSafeClient,
} from "../../extension/src/infrastructure/typesafe-client.js";

const result = SearchResult.create({
  query: "manifest v3",
  url: "https://developer.chrome.com/docs/extensions",
  title: "Chrome Extensions",
  snippet: "Build extensions with Manifest V3.",
  locale: "en",
});

test("TypeSafeClient sends the user's key and only enabled questions", async () => {
  const calls = [];
  const client = new TypeSafeClient({
    fetch: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
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

  const evaluation = await client.evaluate({
    apiKey: "user-secret",
    result,
    axes: EvaluationAxes.create(["usefulness"]),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.typesafe.ai/v1/systemone");
  assert.equal(calls[0].init.headers.Authorization, "Bearer user-secret");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, "jev-latest");
  assert.deepEqual(Object.keys(body.questions), ["usefulness"]);
  assert.equal(body.state.result.title, "Chrome Extensions");
  assert.equal(evaluation.toViewModel().axes[0].value, 100);
});

test("TypeSafeClient retries overload once without leaking provider text", async () => {
  let attempts = 0;
  const delays = [];
  const client = new TypeSafeClient({
    fetch: async () => {
      attempts += 1;
      if (attempts === 1) return jsonResponse({ error: "internal details" }, 529);
      return jsonResponse({ model: "jev", answers: {}, usage: { input_tokens: 1, output_tokens: 1 } });
    },
    sleep: async (milliseconds) => delays.push(milliseconds),
    random: () => 0,
  });

  await client.evaluate({
    apiKey: "secret",
    result,
    axes: EvaluationAxes.create(["usefulness"]),
  });

  assert.equal(attempts, 2);
  assert.deepEqual(delays, [1000]);
});

test("TypeSafeClient classifies invalid credentials without retry", async () => {
  let attempts = 0;
  const client = new TypeSafeClient({
    fetch: async () => {
      attempts += 1;
      return jsonResponse({ error: "bad key user-secret" }, 401);
    },
  });

  await assert.rejects(
    client.evaluate({
      apiKey: "user-secret",
      result,
      axes: EvaluationAxes.create(["usefulness"]),
    }),
    (error) => error instanceof ProviderError && error.code === "invalid_token" && !error.message.includes("user-secret"),
  );
  assert.equal(attempts, 1);
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
