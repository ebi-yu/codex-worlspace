// 1. browser／provider境界はruntimeで検証する。詳細はADR 0002を参照。
// @ts-nocheck
import { EvaluationAxes } from "../domain/evaluation-axes.js";
import { SearchResult } from "../domain/search-result.js";
import { ProviderError, TypeSafeClient } from "../infrastructure/typesafe-client.js";

const DEFAULT_EXTENSION_SETTINGS = Object.freeze({
  enabled: true,
  enabledAxes: ["usefulness", "prerequisite_level", "source_type"],
});
const EVALUATION_CACHE_TTL_MILLISECONDS = 24 * 60 * 60 * 1000;
const pendingEvaluationPromisesByCacheKey = new Map();
const typeSafeClient = new TypeSafeClient();

// 2. 起動直後に秘密情報をcontent scriptから読めない範囲へ制限する。
void restrictLocalStorageToTrustedExtensionContexts();

chrome.runtime.onInstalled.addListener(async () => {
  await restrictLocalStorageToTrustedExtensionContexts();
  const { settings: storedExtensionSettings } =
    await chrome.storage.local.get("settings");
  if (!storedExtensionSettings) {
    await chrome.storage.local.set({ settings: DEFAULT_EXTENSION_SETTINGS });
  }
  await chrome.runtime.openOptionsPage();
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// 3. messageを検証し、cacheとin-flight requestを共有してAPI呼び出しを抑える。
chrome.runtime.onMessage.addListener(
  (runtimeMessage, _messageSender, sendRuntimeResponse) => {
    if (runtimeMessage?.type !== "EVALUATE_RESULT") return false;
    respondToEvaluationRequest(runtimeMessage.payload)
      .then((evaluationDisplayModel) =>
        sendRuntimeResponse({ ok: true, payload: evaluationDisplayModel }),
      )
      .catch((caughtError) =>
        sendRuntimeResponse({
          ok: false,
          reason: convertErrorToPublicReason(caughtError),
        }),
      );
    return true;
  },
);

async function respondToEvaluationRequest(untrustedSearchResultInput) {
  const searchResult = SearchResult.fromUntrustedInput(untrustedSearchResultInput);
  const {
    settings: extensionSettings = DEFAULT_EXTENSION_SETTINGS,
    secrets: extensionSecrets = {},
    evaluationCache = {},
  } = await chrome.storage.local.get(["settings", "secrets", "evaluationCache"]);
  if (!extensionSettings.enabled) throw new ProviderError("disabled");

  const evaluationAxes = EvaluationAxes.fromUntrustedIds(extensionSettings.enabledAxes);
  const searchResultLocale = searchResult.toSerializableMetadata().locale;
  const evaluationCacheKey = await calculateSha256HexDigest(
    `${searchResult.cacheIdentity}\n${searchResultLocale}\n${evaluationAxes.cacheKeySegment}`,
  );
  const cachedEvaluation = evaluationCache[evaluationCacheKey];
  if (cachedEvaluation?.expiresAt > Date.now()) return cachedEvaluation.displayModel;

  if (!pendingEvaluationPromisesByCacheKey.has(evaluationCacheKey)) {
    pendingEvaluationPromisesByCacheKey.set(
      evaluationCacheKey,
      typeSafeClient
        .requestSearchResultEvaluation({
          apiKey: extensionSecrets.jevApiKey,
          searchResult,
          evaluationAxes,
        })
        .then(async (evaluation) => {
          const evaluationDisplayModel = evaluation.toDisplayModel();
          const latestEvaluationCache =
            (await chrome.storage.local.get("evaluationCache")).evaluationCache ?? {};
          latestEvaluationCache[evaluationCacheKey] = {
            displayModel: evaluationDisplayModel,
            expiresAt: Date.now() + EVALUATION_CACHE_TTL_MILLISECONDS,
          };
          await chrome.storage.local.set({
            evaluationCache: removeExpiredAndExcessCacheEntries(latestEvaluationCache),
          });
          return evaluationDisplayModel;
        })
        .finally(() => pendingEvaluationPromisesByCacheKey.delete(evaluationCacheKey)),
    );
  }
  return pendingEvaluationPromisesByCacheKey.get(evaluationCacheKey);
}

// 4. cacheは期限と件数を制限し、公開errorはtokenやprovider本文を含めない。
async function restrictLocalStorageToTrustedExtensionContexts() {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
}

async function calculateSha256HexDigest(plainText) {
  const digestBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(plainText),
  );
  return Array.from(new Uint8Array(digestBytes), (digestByte) =>
    digestByte.toString(16).padStart(2, "0"),
  ).join("");
}

function removeExpiredAndExcessCacheEntries(evaluationCache) {
  const unexpiredCacheEntries = Object.entries(evaluationCache)
    .filter(([, cacheEntry]) => cacheEntry.expiresAt > Date.now())
    .sort(
      ([, leftCacheEntry], [, rightCacheEntry]) =>
        rightCacheEntry.expiresAt - leftCacheEntry.expiresAt,
    )
    .slice(0, 200);
  return Object.fromEntries(unexpiredCacheEntries);
}

function convertErrorToPublicReason(caughtError) {
  if (caughtError instanceof ProviderError) return caughtError.publicErrorCode;
  if (caughtError instanceof TypeError) return "invalid_result";
  return "temporary_error";
}
