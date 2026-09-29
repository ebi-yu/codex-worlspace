// 1. browser／provider境界はruntimeで検証する。詳細はADR 0002を参照。
// @ts-nocheck
import { AXIS_IDS, EvaluationAxes } from "../domain/evaluation-axes.js";

const AXIS_COPY = {
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

const form = document.querySelector("#settings-form");
const axesContainer = document.querySelector("#axes");
const tokenInput = document.querySelector("#api-key");
const tokenState = document.querySelector("#token-state");
const notice = document.querySelector("#notice");

// 2. domainが許可した評価軸だけをtoggleとして描画する。
for (const id of AXIS_IDS) {
  const label = document.createElement("label");
  label.className = "axis";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = "axis";
  input.value = id;
  const copy = document.createElement("span");
  copy.textContent = AXIS_COPY[id][0];
  const detail = document.createElement("small");
  detail.textContent = AXIS_COPY[id][1];
  copy.append(detail);
  label.append(input, copy);
  axesContainer.append(label);
}

await load();

// 3. tokenは再表示せず、設定変更時は古い評価cacheを破棄する。
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const enabledAxes = selectedAxes();
  try {
    EvaluationAxes.create(enabledAxes);
  } catch {
    show("評価軸を1つ以上オンにしてください。", true);
    return;
  }
  const stored = await chrome.storage.local.get("secrets");
  const apiKey = tokenInput.value.trim();
  await chrome.storage.local.set({
    settings: {
      enabled: document.querySelector("#enabled").checked,
      enabledAxes,
    },
    secrets: apiKey ? { jevApiKey: apiKey } : stored.secrets ?? {},
    evaluationCache: {},
  });
  tokenInput.value = "";
  await load();
  show("設定を保存しました。次の検索結果から反映されます。");
});

document.querySelector("#delete-token").addEventListener("click", async () => {
  await chrome.storage.local.set({ secrets: {}, evaluationCache: {} });
  tokenInput.value = "";
  await load();
  show("JEV tokenを削除しました。");
});

async function load() {
  const { settings, secrets } = await chrome.storage.local.get(["settings", "secrets"]);
  const axes = settings?.enabledAxes ?? EvaluationAxes.defaults().ids;
  document.querySelector("#enabled").checked = settings?.enabled ?? true;
  for (const input of document.querySelectorAll('input[name="axis"]')) {
    input.checked = axes.includes(input.value);
  }
  const ready = Boolean(secrets?.jevApiKey);
  tokenState.textContent = ready ? "登録済み" : "未登録";
  tokenState.classList.toggle("ready", ready);
}

function selectedAxes() {
  return [...document.querySelectorAll('input[name="axis"]:checked')].map((input) => input.value);
}

function show(message, error = false) {
  notice.textContent = message;
  notice.style.color = error ? "#b42318" : "#16784a";
}
