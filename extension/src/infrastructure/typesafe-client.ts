// 1. browser／provider境界はruntimeで検証する。詳細はADR 0002を参照。
// @ts-nocheck
import { Evaluation } from "../domain/evaluation.js";
import { buildQuestions } from "../domain/questions.js";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

// 2. 外部errorをUIへ安全に渡せるcodeへ限定する。
export class ProviderError extends Error {
  constructor(code) {
    super(`TypeSafe request failed: ${code}`);
    this.name = "ProviderError";
    this.code = code;
  }
}

// 3. 有効な評価軸だけを送り、一時errorだけを指数backoffで再試行する。
export class TypeSafeClient {
  constructor({
    fetch = globalThis.fetch,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    random = Math.random,
  } = {}) {
    this.fetch = fetch;
    this.sleep = sleep;
    this.random = random;
  }

  async evaluate({ apiKey, result, axes }) {
    if (typeof apiKey !== "string" || !apiKey.trim()) throw new ProviderError("not_configured");
    const value = result.toJSON();
    const body = {
      state: {
        query: value.query,
        result: {
          url: value.url,
          title: value.title,
          snippet: value.snippet,
        },
      },
      model: "jev-latest",
      questions: buildQuestions(axes),
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response;
      try {
        response = await this.fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } catch {
        throw new ProviderError("network_error");
      }

      if (response.ok) return Evaluation.fromTypeSafe(await safeJson(response));
      if (response.status === 401) throw new ProviderError("invalid_token");
      if (response.status === 422) throw new ProviderError("invalid_request");
      if (response.status !== 429 && response.status !== 529) {
        throw new ProviderError("provider_error");
      }
      if (attempt === 2) throw new ProviderError("temporary_error");
      await this.sleep(1000 * 2 ** attempt + Math.floor(this.random() * 250));
    }
  }
}

// 4. JSONでないresponseをdomainへ渡さない。
async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    throw new ProviderError("invalid_response");
  }
}
