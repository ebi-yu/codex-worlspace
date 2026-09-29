// 1. browser／provider境界はruntimeで検証する。詳細はADR 0002を参照。
// @ts-nocheck
import {
  EVALUATION_AXIS_IDS,
  EvaluationAxes,
} from "../domain/evaluation-axes.js";

const EVALUATION_AXIS_COPY_BY_ID = {
  usefulness: ["推定有用度", "今回の検索にどれくらい役立つか"],
  prerequisite_level: ["必要な前提知識", "入門から専門家向けまで"],
  source_type: ["情報源の種類", "公式、解説、コミュニティなど"],
  primary_source: ["一次情報性", "公式文書や原典である可能性"],
  specificity: ["具体性", "手順、例、数値が期待できるか"],
  freshness: ["新しさ", "クエリに必要な鮮度を満たすか"],
  transparency: ["透明性", "著者や出典が明確か"],
  audience: ["想定読者", "一般、学生、実務家、専門家など"],
  reading_effort: ["読む負担", "短い回答か詳細資料か"],
  commercial_intent: ["商用性", "購入や登録への誘導の強さ"],
};

const settingsFormElement = document.querySelector("#settings-form");
const evaluationAxesContainer = document.querySelector("#axes");
const apiKeyInputElement = document.querySelector("#api-key");
const tokenRegistrationStateElement = document.querySelector("#token-state");
const saveNoticeElement = document.querySelector("#notice");

// 2. domainが許可した評価軸だけをtoggleとして描画する。
for (const evaluationAxisId of EVALUATION_AXIS_IDS) {
  const axisToggleLabelElement = document.createElement("label");
  axisToggleLabelElement.className = "axis";
  const axisCheckboxElement = document.createElement("input");
  axisCheckboxElement.type = "checkbox";
  axisCheckboxElement.name = "axis";
  axisCheckboxElement.value = evaluationAxisId;
  const axisCopyElement = document.createElement("span");
  axisCopyElement.textContent = EVALUATION_AXIS_COPY_BY_ID[evaluationAxisId][0];
  const axisDescriptionElement = document.createElement("small");
  axisDescriptionElement.textContent =
    EVALUATION_AXIS_COPY_BY_ID[evaluationAxisId][1];
  axisCopyElement.append(axisDescriptionElement);
  axisToggleLabelElement.append(axisCheckboxElement, axisCopyElement);
  evaluationAxesContainer.append(axisToggleLabelElement);
}

await loadStoredSettingsIntoForm();

// 3. tokenは再表示せず、設定変更時は古い評価cacheを破棄する。
settingsFormElement.addEventListener(
  "submit",
  async (settingsFormSubmitEvent) => {
    settingsFormSubmitEvent.preventDefault();
    const enabledEvaluationAxisIds = readSelectedEvaluationAxisIds();
    try {
      EvaluationAxes.fromUntrustedIds(enabledEvaluationAxisIds);
    } catch {
      showSaveNotice("評価軸を1つ以上オンにしてください。", true);
      return;
    }
    const storedSecretData = await chrome.storage.local.get("secrets");
    const enteredApiKey = apiKeyInputElement.value.trim();
    await chrome.storage.local.set({
      settings: {
        enabled: document.querySelector("#enabled").checked,
        enabledAxes: enabledEvaluationAxisIds,
      },
      secrets: enteredApiKey
        ? { jevApiKey: enteredApiKey }
        : (storedSecretData.secrets ?? {}),
      evaluationCache: {},
    });
    apiKeyInputElement.value = "";
    await loadStoredSettingsIntoForm();
    showSaveNotice("設定を保存しました。次の検索結果から反映されます。");
  },
);

document.querySelector("#delete-token").addEventListener("click", async () => {
  await chrome.storage.local.set({ secrets: {}, evaluationCache: {} });
  apiKeyInputElement.value = "";
  await loadStoredSettingsIntoForm();
  showSaveNotice("JEV tokenを削除しました。");
});

async function loadStoredSettingsIntoForm() {
  const { settings, secrets } = await chrome.storage.local.get([
    "settings",
    "secrets",
  ]);
  const enabledEvaluationAxisIds =
    settings?.enabledAxes ?? EvaluationAxes.learningPreset().enabledAxisIds;
  document.querySelector("#enabled").checked = settings?.enabled ?? true;
  for (const axisCheckboxElement of document.querySelectorAll(
    'input[name="axis"]',
  )) {
    axisCheckboxElement.checked = enabledEvaluationAxisIds.includes(
      axisCheckboxElement.value,
    );
  }
  const isApiKeyRegistered = Boolean(secrets?.jevApiKey);
  tokenRegistrationStateElement.textContent = isApiKeyRegistered
    ? "登録済み"
    : "未登録";
  tokenRegistrationStateElement.classList.toggle("ready", isApiKeyRegistered);
}

function readSelectedEvaluationAxisIds() {
  return [...document.querySelectorAll('input[name="axis"]:checked')].map(
    (axisCheckboxElement) => axisCheckboxElement.value,
  );
}

function showSaveNotice(noticeMessage, isError = false) {
  saveNoticeElement.textContent = noticeMessage;
  saveNoticeElement.style.color = isError ? "#b42318" : "#16784a";
}
