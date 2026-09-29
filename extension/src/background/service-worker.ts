// 1. browser／provider境界はruntimeで検証する。詳細はADR 0002を参照。
// @ts-nocheck
import { EvaluationAxes } from "../domain/evaluation-axes.js";
import { SearchResult } from "../domain/search-result.js";
import { ProviderError, TypeSafeClient } from "../infrastructure/typesafe-client.js";

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  enabledAxes: ["usefulness", "prerequisite_level", "source_type"],
});
const CACHE_TTL = 24 * 60 * 60 * 1000;
const pending = new Map();
const client = new TypeSafeClient();

// 2. 起動直後に秘密情報をcontent scriptから読めない範囲へ制限する。
void restrictStorage();

chrome.runtime.onInstalled.addListener(async () => {
  await restrictStorage();
  const { settings } = await chrome.storage.local.get("settings");
  if (!settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  await chrome.runtime.openOptionsPage();
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// 3. messageを検証し、cacheとin-flight requestを共有してAPI呼び出しを抑える。
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EVALUATE_RESULT") return false;
  evaluateMessage(message.payload)
    .then((payload) => sendResponse({ ok: true, payload }))
    .catch((error) => sendResponse({ ok: false, reason: publicReason(error) }));
  return true;
});

async function evaluateMessage(payload) {
  const result = SearchResult.create(payload);
  const { settings = DEFAULT_SETTINGS, secrets = {}, evaluationCache = {} } =
    await chrome.storage.local.get(["settings", "secrets", "evaluationCache"]);
  if (!settings.enabled) throw new ProviderError("disabled");
  const axes = EvaluationAxes.create(settings.enabledAxes);
  const cacheKey = await digest(`${result.identity}\n${result.toJSON().locale}\n${axes.cacheFragment}`);
  const cached = evaluationCache[cacheKey];
  if (cached?.expiresAt > Date.now()) return cached.value;

  if (!pending.has(cacheKey)) {
    pending.set(
      cacheKey,
      client
        .evaluate({ apiKey: secrets.jevApiKey, result, axes })
        .then(async (evaluation) => {
          const value = evaluation.toViewModel();
          const current = (await chrome.storage.local.get("evaluationCache")).evaluationCache ?? {};
          current[cacheKey] = { value, expiresAt: Date.now() + CACHE_TTL };
          await chrome.storage.local.set({ evaluationCache: trimCache(current) });
          return value;
        })
        .finally(() => pending.delete(cacheKey)),
    );
  }
  return pending.get(cacheKey);
}

// 4. cacheは期限と件数を制限し、公開errorはtokenやprovider本文を含めない。
async function restrictStorage() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function trimCache(cache) {
  const entries = Object.entries(cache)
    .filter(([, entry]) => entry.expiresAt > Date.now())
    .sort(([, left], [, right]) => right.expiresAt - left.expiresAt)
    .slice(0, 200);
  return Object.fromEntries(entries);
}

function publicReason(error) {
  if (error instanceof ProviderError) return error.code;
  if (error instanceof TypeError) return "invalid_result";
  return "temporary_error";
}
