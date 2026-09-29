// 1. Google検索DOMとextension messageの境界はruntimeで検証する。詳細はADR 0002を参照。
// @ts-nocheck
(() => {
  const observedSearchResultLinks = new WeakSet();
  let currentSearchQuery = readSearchQueryFromCurrentUrl();
  let scheduledScanTimeoutId;

  // 2. viewportへ近づいた検索結果だけを評価し、API利用量を抑える。
  const viewportProximityObserver = new IntersectionObserver(
    handleViewportIntersections,
    {
      rootMargin: "150% 0px",
    },
  );
  const searchDomMutationObserver = new MutationObserver(() => {
    clearTimeout(scheduledScanTimeoutId);
    scheduledScanTimeoutId = setTimeout(findAndObserveSearchResultLinks, 350);
  });

  searchDomMutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  findAndObserveSearchResultLinks();

  function findAndObserveSearchResultLinks() {
    const latestSearchQuery = readSearchQueryFromCurrentUrl();
    if (latestSearchQuery !== currentSearchQuery)
      currentSearchQuery = latestSearchQuery;

    for (const resultHeading of document.querySelectorAll("#search a > h3")) {
      const searchResultLink = resultHeading.parentElement;
      if (!searchResultLink || observedSearchResultLinks.has(searchResultLink))
        continue;
      const destinationUrl = searchResultLink.href;
      if (!destinationUrl?.startsWith("http")) continue;
      observedSearchResultLinks.add(searchResultLink);
      viewportProximityObserver.observe(searchResultLink);
    }
  }

  function handleViewportIntersections(intersectionEntries) {
    for (const intersectionEntry of intersectionEntries) {
      if (!intersectionEntry.isIntersecting) continue;
      viewportProximityObserver.unobserve(intersectionEntry.target);
      void requestAndRenderSearchResultEvaluation(intersectionEntry.target);
    }
  }

  // 3. tokenを含めず、検索結果metadataだけをservice workerへ渡す。
  async function requestAndRenderSearchResultEvaluation(searchResultLink) {
    const searchResultCard =
      searchResultLink.closest("div.MjjYud") ?? searchResultLink.parentElement;
    const searchResultSnippet =
      searchResultCard?.querySelector("[data-sncf], .VwiC3b")?.textContent ?? "";
    const annotationContainer = createEvaluationAnnotationContainer();
    searchResultLink.insertAdjacentElement("afterend", annotationContainer);
    renderEvaluationRequestStatus(annotationContainer, "loading");

    try {
      const evaluationResponse = await chrome.runtime.sendMessage({
        type: "EVALUATE_RESULT",
        payload: {
          query: currentSearchQuery,
          url: searchResultLink.href,
          title: searchResultLink.textContent,
          snippet: searchResultSnippet,
          locale: document.documentElement.lang.toLowerCase().startsWith("ja")
            ? "ja"
            : "en",
        },
      });
      if (!evaluationResponse?.ok) {
        renderEvaluationRequestStatus(
          annotationContainer,
          evaluationResponse?.reason ?? "temporary_error",
        );
        return;
      }
      renderEvaluationResults(annotationContainer, evaluationResponse.payload);
    } catch {
      renderEvaluationRequestStatus(annotationContainer, "temporary_error");
    }
  }

  // 4. Shadow DOMでGoogle側のstyleと評価UIを分離する。
  function createEvaluationAnnotationContainer() {
    const annotationContainer = document.createElement("div");
    annotationContainer.dataset.searchLens = "";
    const annotationShadowRoot = annotationContainer.attachShadow({
      mode: "closed",
    });
    const annotationStyleElement = document.createElement("style");
    annotationStyleElement.textContent = `
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
    const annotationPanel = document.createElement("div");
    annotationPanel.className = "lens";
    annotationPanel.setAttribute("aria-live", "polite");
    annotationShadowRoot.append(annotationStyleElement, annotationPanel);
    annotationContainer.annotationPanel = annotationPanel;
    return annotationContainer;
  }

  function renderEvaluationResults(annotationContainer, evaluationDisplayModel) {
    const annotationPanel = annotationContainer.annotationPanel;
    annotationPanel.replaceChildren();
    const usefulnessEvaluation = evaluationDisplayModel.axisEvaluations.find(
      (axisEvaluation) => axisEvaluation.axisId === "usefulness",
    );
    const headlineElement = createStyledElement("div", "headline");
    headlineElement.append(createStyledElement("span", "mark"));
    headlineElement.append(
      document.createTextNode(
        usefulnessEvaluation
          ? `${formatIdentifierAsLabel("usefulness")}: ${usefulnessEvaluation.displayValue}/100`
          : "Search Lens",
      ),
    );
    annotationPanel.append(headlineElement);

    const secondaryAxesElement = createStyledElement("div", "axes");
    for (const axisEvaluation of evaluationDisplayModel.axisEvaluations.filter(
      (candidateEvaluation) => candidateEvaluation.axisId !== "usefulness",
    )) {
      const confidenceSuffix =
        axisEvaluation.confidence == null
          ? ""
          : ` · ${Math.round(axisEvaluation.confidence * 100)}%`;
      const axisLabel = formatIdentifierAsLabel(axisEvaluation.axisId);
      const axisDisplayValue = formatIdentifierAsLabel(axisEvaluation.displayValue);
      const axisSummaryText = `${axisLabel}: ${axisDisplayValue}${confidenceSuffix}`;
      secondaryAxesElement.append(createStyledElement("span", "axis", axisSummaryText));
    }
    annotationPanel.append(secondaryAxesElement);
  }

  function renderEvaluationRequestStatus(annotationContainer, evaluationStatusCode) {
    const statusMessagesByCode = {
      loading: "Search Lens: evaluating…",
      not_configured: "Search Lens: add your JEV token in extension settings.",
      invalid_token: "Search Lens: check your JEV token.",
      disabled: "Search Lens is paused.",
      temporary_error: "Search Lens: evaluation is temporarily unavailable.",
      invalid_result: "Search Lens: this result could not be evaluated.",
    };
    const statusMessage =
      statusMessagesByCode[evaluationStatusCode] ??
      statusMessagesByCode.temporary_error;
    annotationContainer.annotationPanel.replaceChildren(
      createStyledElement("span", "muted", statusMessage),
    );
  }

  function createStyledElement(htmlTagName, cssClassName, textContent) {
    const htmlElement = document.createElement(htmlTagName);
    htmlElement.className = cssClassName;
    if (textContent) htmlElement.textContent = textContent;
    return htmlElement;
  }

  function formatIdentifierAsLabel(identifier) {
    return String(identifier).replaceAll("_", " ");
  }

  function readSearchQueryFromCurrentUrl() {
    return new URL(location.href).searchParams.get("q")?.trim() ?? "";
  }
})();
