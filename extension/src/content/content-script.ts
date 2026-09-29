// 1. browser／provider境界はruntimeで検証する。詳細はADR 0002を参照。
// @ts-nocheck
(() => {
  const observed = new WeakSet();
  let query = readQuery();
  let debounce;

  // 2. viewportへ近づいた検索結果だけを評価し、API利用量を抑える。
  const intersection = new IntersectionObserver(onIntersection, { rootMargin: "150% 0px" });
  const mutations = new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(scan, 350);
  });

  mutations.observe(document.documentElement, { childList: true, subtree: true });
  scan();

  function scan() {
    const nextQuery = readQuery();
    if (nextQuery !== query) query = nextQuery;
    for (const heading of document.querySelectorAll("#search a > h3")) {
      const anchor = heading.parentElement;
      if (!anchor || observed.has(anchor)) continue;
      const url = anchor.href;
      if (!url?.startsWith("http")) continue;
      observed.add(anchor);
      intersection.observe(anchor);
    }
  }

  function onIntersection(entries) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      intersection.unobserve(entry.target);
      void evaluate(entry.target);
    }
  }

  // 3. tokenを含めず、検索結果metadataだけをservice workerへ渡す。
  async function evaluate(anchor) {
    const card = anchor.closest("div.MjjYud") ?? anchor.parentElement;
    const snippet = card?.querySelector("[data-sncf], .VwiC3b")?.textContent ?? "";
    const host = createHost();
    anchor.insertAdjacentElement("afterend", host);
    renderStatus(host, "loading");

    try {
      const response = await chrome.runtime.sendMessage({
        type: "EVALUATE_RESULT",
        payload: {
          query,
          url: anchor.href,
          title: anchor.textContent,
          snippet,
          locale: document.documentElement.lang.toLowerCase().startsWith("ja") ? "ja" : "en",
        },
      });
      if (!response?.ok) return renderStatus(host, response?.reason ?? "temporary_error");
      renderEvaluation(host, response.payload);
    } catch {
      renderStatus(host, "temporary_error");
    }
  }

  // 4. Shadow DOMでGoogle側のstyleと評価UIを分離する。
  function createHost() {
    const host = document.createElement("div");
    host.dataset.searchLens = "";
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host { color-scheme: light dark; }
      .lens { margin: 8px 0 4px; padding: 9px 11px; border: 1px solid #d8dee9;
        border-radius: 10px; background: #f8faff; color: #25324a; font: 12px/1.45 system-ui; }
      .headline { display: flex; align-items: center; gap: 8px; font-weight: 650; }
      .mark { width: 8px; height: 8px; border-radius: 50%; background: #5268d9; }
      .axes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
      .axis { padding: 3px 7px; border-radius: 999px; background: #e9edff; }
      .muted { color: #667085; }
      @media (prefers-color-scheme: dark) {
        .lens { border-color: #3d4656; background: #202532; color: #eef1ff; }
        .axis { background: #303957; } .muted { color: #b3bbca; }
      }
    `;
    const panel = document.createElement("div");
    panel.className = "lens";
    panel.setAttribute("aria-live", "polite");
    root.append(style, panel);
    host.panel = panel;
    return host;
  }

  function renderEvaluation(host, evaluation) {
    const panel = host.panel;
    panel.replaceChildren();
    const usefulness = evaluation.axes.find((axis) => axis.id === "usefulness");
    const headline = element("div", "headline");
    headline.append(element("span", "mark"));
    headline.append(
      document.createTextNode(
        usefulness ? `${label("usefulness")}: ${usefulness.value}/100` : "Search Lens",
      ),
    );
    panel.append(headline);
    const axes = element("div", "axes");
    for (const axis of evaluation.axes.filter((item) => item.id !== "usefulness")) {
      const confidence = axis.confidence == null ? "" : ` · ${Math.round(axis.confidence * 100)}%`;
      axes.append(element("span", "axis", `${label(axis.id)}: ${label(axis.value)}${confidence}`));
    }
    panel.append(axes);
  }

  function renderStatus(host, status) {
    const messages = {
      loading: "Search Lens: evaluating…",
      not_configured: "Search Lens: add your JEV token in extension settings.",
      invalid_token: "Search Lens: check your JEV token.",
      disabled: "Search Lens is paused.",
      temporary_error: "Search Lens: evaluation is temporarily unavailable.",
      invalid_result: "Search Lens: this result could not be evaluated.",
    };
    host.panel.replaceChildren(element("span", "muted", messages[status] ?? messages.temporary_error));
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function label(value) {
    return String(value).replaceAll("_", " ");
  }

  function readQuery() {
    return new URL(location.href).searchParams.get("q")?.trim() ?? "";
  }
})();
