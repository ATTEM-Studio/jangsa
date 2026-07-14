(function startJangsaApp() {
  "use strict";

  const engine = window.JangsaEngine;
  const ui = window.JangsaUiLogic;
  const observationsApi = window.JangsaObservations;
  const presenterApi = window.JangsaDiagnosisPresenter;
  const form = document.getElementById("diagnosis-form");
  const intakeSection = document.getElementById("intake");
  const intakeForm = document.getElementById("place-intake-form");
  const analysisSection = document.getElementById("analysis");
  const diagnosisSection = document.getElementById("diagnosis");
  const storefrontScoreApi = window.JangsaStorefrontScore;
  const stepPanels = [...document.querySelectorAll("[data-step]")];
  const errorBox = document.getElementById("form-error");
  const nextButton = document.getElementById("next-button");
  const prevButton = document.getElementById("prev-button");
  const submitButton = document.getElementById("submit-button");
  const resultSection = document.getElementById("result");
  const historyList = document.getElementById("history-list");
  const emptyHistory = document.getElementById("empty-history");
  const checkinDialog = document.getElementById("checkin-dialog");
  const checkinForm = document.getElementById("checkin-form");
  const HISTORY_KEY = "jangsaNavigationV11History";

  let currentStep = 1;
  let latestResult = null;
  let latestHistoryId = null;
  let currentOwnerObservations = [];
  let toastTimer = null;

  const confirmationLabels = {
    businessCategory: "업종 정보",
    address: "주소",
    directions: "찾아오는 길",
    keywords: "대표 키워드",
    businessHours: "영업시간",
    contact: "연락처",
    coverPhoto: "대표 사진",
    menu: "메뉴",
    prices: "가격",
    reservation: "예약",
    order: "주문",
    inquiry: "문의",
    coupon: "쿠폰",
    reviewVolume: "리뷰 수",
    reviewRecency: "최근 리뷰",
    reviewQuality: "리뷰 내용",
    ownerReplies: "사장님 답글",
    photoReviews: "사진 리뷰",
    negativeResponse: "불만 리뷰 대응",
    description: "상세 설명",
    menuDescriptions: "메뉴 설명",
    photoDiversity: "사진 다양성",
    uniqueValue: "가게 차별점",
    recentPosts: "최근 소식",
    profileUpdated: "정보 최신성",
    reservationSlots: "예약 가능 시간",
    replySpeed: "답글 속도",
    recentPostActivity: "소식 활동",
    featureHealth: "기능 정상 작동",
  };

  function getValues() {
    return Object.fromEntries(new FormData(form).entries());
  }

  function setStep(step) {
    currentStep = Math.min(Math.max(step, 1), 3);
    stepPanels.forEach((panel) => {
      panel.hidden = Number(panel.dataset.step) !== currentStep;
    });
    document.getElementById("current-step-number").textContent = currentStep;
    document.getElementById("progress-fill").style.width = `${(currentStep / 3) * 100}%`;
    prevButton.hidden = currentStep === 1;
    nextButton.hidden = currentStep === 3;
    submitButton.hidden = currentStep !== 3;
    clearErrors();
  }

  function clearErrors() {
    errorBox.hidden = true;
    errorBox.innerHTML = "";
  }

  function showErrors(errors) {
    errorBox.innerHTML = `<ul>${errors.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function validateCurrentStep() {
    const errors = ui.validateStep(currentStep, getValues());
    if (errors.length) {
      showErrors(errors);
      return false;
    }
    clearErrors();
    return true;
  }

  function setConditionalFields() {
    const values = getValues();
    document.getElementById("ad-fields").hidden = values.adsRunning !== "true";
    document.getElementById("returning-fields").hidden = values.knowsReturningRate !== "true";
  }

  function showIntakeError(message) {
    const error = document.getElementById("place-url-error");
    error.textContent = message;
    error.hidden = false;
  }

  function setFlowState(state) {
    intakeSection.hidden = state !== "intake";
    analysisSection.hidden = state !== "analyzing";
    diagnosisSection.hidden = state !== "questions";
    resultSection.hidden = state !== "result";
  }

  function renderAnalysisProgress(placeUrl) {
    setFlowState("analyzing");
    document.getElementById("analysis-progress").innerHTML = [
      "플레이스 링크를 받았어요.",
      "사진, 메뉴, 방문 정보처럼 손님이 결정을 내릴 때 필요한 항목을 점수 기준에 맞춰 준비하고 있어요.",
      "아직 확인하지 못한 항목은 점수에 넣지 않고, 필요하면 사장님이 직접 보완할 수 있어요.",
    ].map((message) => `<li>${escapeHtml(message)}<small>${escapeHtml(placeUrl)}</small></li>`).join("");
  }

  function showDiagnosisForm() {
    setFlowState("questions");
    diagnosisSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setRadio(name, value) {
    const element = form.querySelector(`[name="${name}"][value="${value}"]`);
    if (element) element.checked = true;
  }

  function setInput(name, value) {
    const element = form.elements.namedItem(name);
    if (!element) return;
    if (element instanceof RadioNodeList) {
      element.value = String(value);
      return;
    }
    element.value = element.matches("[data-number]") ? ui.formatNumberInput(String(value)) : String(value);
  }

  function loadSample() {
    form.reset();
    currentOwnerObservations = storefrontScoreApi.STOREFRONT_RULES.map((rule, index) => observationsApi.createObservation({
      key: rule.key,
      value: index % 6 === 0 ? "partial" : index % 9 === 0 ? false : true,
      source: "owner",
      confidence: "high",
      observedAt: "2026-07-12T00:00:00.000Z",
      status: "confirmed",
      evidence: "샘플 매장 확인값",
    }));
    setInput("storeName", "샘플식당 하남점");
    setRadio("painPoint", "ads");
    setRadio("businessType", "meal");
    setInput("tradeArea", "transit");
    setInput("storeStrength", "specialty");
    setInput("currentRevenue", 10_000_000);
    setInput("targetRevenue", 15_000_000);
    setInput("remainingDays", 20);
    setInput("averageOrderValue", 20_000);
    setRadio("capacity", "yes");
    setRadio("canChangeMenu", "true");
    setRadio("hasConsentDb", "false");
    setRadio("adsRunning", "true");
    setInput("adSpend", 600_000);
    setInput("paidClicks", 1_000);
    setInput("contributionMarginRate", 20);
    setRadio("knowsReturningRate", "false");
    setConditionalFields();
    setStep(3);
    generateResult({ saveHistory: false });
  }

  function formatEffect(result) {
    const effect = result.action.effect;
    if (effect.low === null || effect.low === undefined || effect.high === null || effect.high === undefined) {
      return effect.label;
    }
    if (result.action.key === "existingCustomer") {
      return `하루 ${Math.round(effect.low)}~${Math.round(effect.high)}명 목표`;
    }
    return `${engine.formatShortWon(effect.low)}~${engine.formatShortWon(effect.high)}`;
  }

  function renderEvidence(result) {
    const metrics = result.metrics;
    const shortfall = metrics.targetReached
      ? `목표를 ${engine.formatShortWon(Math.abs(metrics.shortfallRevenue))} 넘겼어요.`
      : `목표까지 ${engine.formatShortWon(metrics.shortfallRevenue)} 남았어요.`;
    const positionStats = [
      ["남은 기간", `${result.input.remainingDays}일`],
      ["하루 필요 손님", `${metrics.requiredCustomersPerDay.toLocaleString("ko-KR")}명`],
    ];
    const problemStats = metrics.cpc !== null
      ? [
          ["클릭 1회 비용", engine.formatWon(metrics.cpc)],
          ["손님 1명까지 기준", `${metrics.maxSafeClicksPerCustomer.toFixed(1)}클릭`],
        ]
      : [["현재 고민", result.input.painPoint === "customers" ? "새 손님 유입" : result.input.painPoint === "repeat" ? "재방문" : "매출 구조"]];
    const renderStats = (stats) => stats.map(([label, value]) => `
      <div class="evidence-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
    `).join("");
    const renderReasons = result.confidence.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("");
    const assumptionText = result.assumptions.length
      ? result.assumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : "<li>입력한 정보만으로 우선순위를 정했습니다.</li>";

    document.getElementById("result-evidence").innerHTML = `
      <div class="evidence-flow">
        <article class="evidence-card evidence-position">
          <div class="evidence-card-heading"><span class="evidence-icon">📍</span><div><span class="evidence-eyebrow">현재 위치</span><h3>${escapeHtml(shortfall)}</h3></div></div>
          <p>입력한 매출과 기간을 손님 수 기준으로 바꿔봤어요.</p>
          <div class="evidence-stat-grid">${renderStats(positionStats)}</div>
        </article>
        <article class="evidence-card evidence-problem">
          <div class="evidence-card-heading"><span class="evidence-icon">🔎</span><div><span class="evidence-eyebrow">숫자가 말하는 문제</span><h3>${escapeHtml(result.action.why)}</h3></div></div>
          <div class="evidence-stat-grid">${renderStats(problemStats)}</div>
        </article>
        <article class="evidence-card evidence-priority">
          <div class="evidence-card-heading"><span class="evidence-icon">🎯</span><div><span class="evidence-eyebrow">그래서 오늘의 1순위</span><h3>${escapeHtml(result.action.title)}</h3></div></div>
          <p>${escapeHtml(result.action.summary)}</p>
          <div class="evidence-next-check"><span>확인은 이렇게</span><strong>${escapeHtml(result.action.metric)}</strong></div>
        </article>
        <article class="evidence-card evidence-basis">
          <div class="evidence-card-heading"><span class="evidence-icon">🧭</span><div><span class="evidence-eyebrow">이번 추천의 기준</span><h3>${escapeHtml(result.confidence.label)}</h3></div></div>
          <ul class="evidence-list">${renderReasons}</ul>
          <div class="evidence-assumption"><span>계산에 포함한 가정</span><ul>${assumptionText}</ul></div>
        </article>
        <aside class="evidence-defer"><span>지금은 미루기</span><p>${escapeHtml(result.action.avoid)}</p></aside>
      </div>
    `;
  }

  function renderDiagnosisView(view) {
    const score = document.getElementById("storefront-score");
    score.innerHTML = view.storefront.visible
      ? `
        <span class="score-eyebrow">플레이스 점수</span>
        <h3>손님이 방문을 결정하기 쉬운 정도</h3>
        <strong>${view.storefront.score}/100</strong>
        <p>손님이 가게를 고르기 전에 필요한 정보를 얼마나 쉽게 찾을 수 있는지 보여드려요.</p>
        <small>확인한 범위 ${Math.round(view.storefront.coverage * 100)}%</small>
      `
      : `
        <span class="score-eyebrow">플레이스 점수</span>
        <h3>점수를 보여드리려면 조금 더 확인이 필요해요</h3>
        <strong>확인 중</strong>
        <p>확인하지 못한 항목은 0점으로 넣지 않았어요.</p>
        <small>확인한 범위 ${Math.round(view.storefront.coverage * 100)}%</small>
      `;

    const target = document.getElementById("target-score");
    target.hidden = !view.storefront.visible || view.target.target === null;
    target.innerHTML = target.hidden
      ? ""
      : `<span>이번에 고칠 항목만 반영한 목표예요</span><strong>${view.target.current}/100 → ${view.target.target}/100</strong><small>이번 행동으로 회복할 수 있는 점수 +${view.target.gain}점</small>`;

    document.getElementById("score-categories").innerHTML = view.storefront.categories.map((category) => {
      const categoryScore = category.score === null ? "확인 중" : `${category.score}/100`;
      const progress = category.score === null ? 0 : category.score;
      const progressMarkup = category.score === null
        ? `<p class="place-score-pending" role="status">아직 확인하지 못한 항목이라 점수 계산에서 뺐어요.</p>`
        : `<div class="place-score-progress" role="progressbar" aria-label="${escapeHtml(category.label)} 점수" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
            <span style="width: ${progress}%"></span>
          </div>`;
      return `
        <article class="place-score-card">
          <div class="place-score-card-head">
            <h3>${escapeHtml(category.label)}</h3>
            <strong>${categoryScore}</strong>
          </div>
          <p>${escapeHtml(category.reason)}</p>
          ${progressMarkup}
          <details class="place-score-detail">
            <summary>왜 이렇게 봤나요?</summary>
            <div class="place-score-detail-body">
              <p><strong>살펴본 기준</strong>${escapeHtml(category.criterion)}</p>
              <p><strong>현재 확인한 내용</strong>${escapeHtml(category.reason)}</p>
              <ul>
                <li><strong>잘 되어 있음</strong> 손님이 바로 확인하고 다음 행동을 고를 수 있어요.</li>
                <li><strong>조금 아쉬움</strong> 정보는 있지만 더 또렷하게 다듬을 부분이 있어요.</li>
                <li><strong>비어 있음</strong> 손님이 결정할 때 필요한 정보가 보이지 않아요.</li>
                <li><strong>아직 확인 못 함</strong> 점수 계산에서 빼고, 0점으로 처리하지 않아요.</li>
              </ul>
            </div>
          </details>
        </article>
      `;
    }).join("");

    document.getElementById("business-bottleneck").innerHTML = `
      <span>현재 성장 병목</span>
      <strong>${escapeHtml(view.bottleneck.label)}</strong>
      <p>하루 필요한 고객 ${view.bottleneck.requiredCustomersPerDay.toLocaleString("ko-KR")}명</p>
    `;
  }

  function renderResult(result) {
    const badge = document.getElementById("confidence-badge");
    badge.textContent = result.confidence.label;
    badge.className = `confidence-badge ${result.confidence.level}`;
    document.getElementById("result-store").textContent = `${result.input.storeName} · 오늘의 1순위`;
    document.getElementById("result-title").textContent = result.action.title;
    document.getElementById("result-summary").textContent = result.action.summary;
    document.getElementById("result-why").textContent = result.action.why;
    document.getElementById("result-effect").textContent = formatEffect(result);
    document.getElementById("result-time").textContent = result.action.time;
    document.getElementById("result-difficulty").textContent = result.action.difficulty;
    document.getElementById("result-steps").innerHTML = result.action.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
    document.getElementById("result-metric").textContent = result.action.metric;
    document.getElementById("feedback-panel").hidden = true;
    renderEvidence(result);
    setFlowState("result");
  }

  function generateResult({ saveHistory = true } = {}) {
    const input = ui.buildDiagnosisInput(getValues());
    const businessResult = engine.diagnoseStore(input);
    const resolvedObservations = observationsApi.resolveObservations(currentOwnerObservations);
    const scoreItems = storefrontScoreApi.buildScoreItems(resolvedObservations);
    const storefront = storefrontScoreApi.calculateStorefrontScore(scoreItems);
    const target = storefrontScoreApi.calculateTargetScore(storefront, businessResult.action.recoverableScoreItems || []);
    const view = presenterApi.presentDiagnosis({
      businessResult,
      storefrontScore: storefront,
      targetScore: target,
      observationMap: resolvedObservations,
    });
    latestResult = { ...businessResult, view };
    renderDiagnosisView(view);
    renderResult(latestResult);

    if (saveHistory) {
      const entry = ui.createHistoryEntry(latestResult);
      latestHistoryId = entry.id;
      const history = loadHistory();
      saveHistoryItems([entry, ...history].slice(0, 10));
    } else {
      latestHistoryId = null;
    }

    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function loadHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      if (!Array.isArray(saved)) return [];
      const migrated = saved.map(ui.migrateHistoryEntry);
      if (JSON.stringify(migrated) !== JSON.stringify(saved)) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(migrated));
      }
      return migrated;
    } catch {
      return [];
    }
  }

  function saveHistoryItems(items) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    } catch {
      showToast("브라우저 저장이 차단되어 기록을 남기지 못했습니다.");
    }
    renderHistory();
  }

  function ensureLatestHistoryEntry() {
    if (latestHistoryId || !latestResult) return latestHistoryId;
    const entry = ui.createHistoryEntry(latestResult);
    latestHistoryId = entry.id;
    saveHistoryItems([entry, ...loadHistory()].slice(0, 10));
    return latestHistoryId;
  }

  function updateHistory(id, changes) {
    const updated = loadHistory().map((item) => item.id === id ? { ...item, ...changes } : item);
    saveHistoryItems(updated);
  }

  function statusLabel(status) {
    return {
      pending: "결정 전",
      accepted: "실행 예정",
      completed: "결과 기록 완료",
      mismatch: "상황과 맞지 않음",
    }[status] || "결정 전";
  }

  function renderHistory() {
    const items = loadHistory();
    emptyHistory.hidden = items.length > 0;
    historyList.innerHTML = items.map((item) => {
      const date = new Date(item.createdAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
      const resultText = item.resultValue
        ? `<p><strong>기록한 결과:</strong> ${escapeHtml(item.resultValue)}${item.resultNote ? ` · ${escapeHtml(item.resultNote)}` : ""}</p>`
        : `<p>확인할 숫자 · ${escapeHtml(item.metric)}</p>`;
      const due = item.checkInDueAt ? new Date(item.checkInDueAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) : null;
      const dueText = due ? `<p class="history-due">${escapeHtml(due)}에 결과 확인</p>` : "";
      return `
        <article class="history-card">
          <div>
            <div class="history-card-top">
              <time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(date)}</time>
              <span class="status-pill ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
              <span>${escapeHtml(item.storeName)}</span>
            </div>
            <h3>${escapeHtml(item.actionTitle)}</h3>
            ${dueText}
            ${resultText}
          </div>
          <div class="history-actions">
            <button type="button" data-checkin="${escapeHtml(item.id)}">${item.status === "completed" ? "결과 수정" : "결과 기록"}</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function openCheckin(id) {
    const item = loadHistory().find((entry) => entry.id === id);
    if (!item) return;
    document.getElementById("checkin-id").value = id;
    document.getElementById("checkin-metric").textContent = `확인할 숫자: ${item.metric}`;
    document.getElementById("checkin-value").value = item.resultValue || "";
    document.getElementById("checkin-note").value = item.resultNote || "";
    checkinDialog.showModal();
  }

  function resultCopyText() {
    if (!latestResult) return "";
    const result = latestResult;
    return [
      result.view?.safeShare || `[${result.input.storeName}] 오늘의 장사네비게이션`,
      `예상 시간: ${result.action.time}`,
      "",
      "지금 이렇게 하세요:",
      ...result.action.steps.map((step, index) => `${index + 1}. ${step}`),
    ].join("\n");
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2200);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.JangsaAppTest = {
    renderLowCoverageSample() {
      renderDiagnosisView({
        storefront: {
          visible: false,
          score: null,
          coverage: 0.4,
          categories: [{
            label: "대표사진",
            score: null,
            reason: "아직 확인하지 못했어요.",
            criterion: "처음 사진만 보고도 무엇을 파는지, 가 보고 싶은지 알 수 있어야 해요.",
          }],
        },
        target: { current: null, target: null, gain: 0, recovered: [] },
        bottleneck: { label: "기초 숫자 확인", requiredCustomersPerDay: 0 },
      });
    },
    renderHistory,
    resultCopyText,
  };

  document.querySelectorAll("[data-start]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById("intake").scrollIntoView({ behavior: "smooth" }));
  });

  document.querySelectorAll("[data-sample]").forEach((button) => button.addEventListener("click", loadSample));
  document.querySelectorAll("[data-scroll-history]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById("history").scrollIntoView({ behavior: "smooth" }));
  });

  intakeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const error = document.getElementById("place-url-error");
    error.hidden = true;
    const placeUrl = ui.normalizePlaceUrl(new FormData(intakeForm).get("placeUrl"));
    if (!placeUrl) {
      showIntakeError("Naver Place links only. Try a naver.me or place.naver.com URL, or continue manually.");
      return;
    }
    renderAnalysisProgress(placeUrl);
    showDiagnosisForm();
  });

  document.getElementById("manual-intake").addEventListener("click", () => {
    showDiagnosisForm();
  });

  nextButton.addEventListener("click", () => {
    if (!validateCurrentStep()) return;
    setStep(currentStep + 1);
    document.getElementById("diagnosis").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  prevButton.addEventListener("click", () => setStep(currentStep - 1));

  form.addEventListener("input", (event) => {
    if (event.target.matches("[data-number]")) {
      event.target.value = ui.formatNumberInput(event.target.value);
    }
    setConditionalFields();
  });

  form.addEventListener("change", setConditionalFields);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateCurrentStep()) return;
    generateResult({ saveHistory: true });
  });

  document.getElementById("accept-action").addEventListener("click", () => {
    const id = ensureLatestHistoryEntry();
    if (id) updateHistory(id, { status: "accepted" });
    showToast("오늘의 행동으로 저장했습니다. 실행 후 결과를 기록해 주세요.");
  });

  document.getElementById("reject-action").addEventListener("click", () => {
    document.getElementById("feedback-panel").hidden = false;
  });

  document.querySelectorAll("[data-feedback]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = ensureLatestHistoryEntry();
      if (id) updateHistory(id, { status: "mismatch", resultNote: button.dataset.feedback });
      document.getElementById("feedback-panel").hidden = true;
      showToast("의견을 저장했습니다. 다음 추천 보정에 필요한 기록입니다.");
    });
  });

  document.getElementById("copy-result").addEventListener("click", async () => {
    try {
      await copyText(resultCopyText());
      showToast("결과를 복사했습니다.");
    } catch {
      showToast("복사하지 못했습니다. 브라우저 권한을 확인해 주세요.");
    }
  });

  historyList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-checkin]");
    if (button) openCheckin(button.dataset.checkin);
  });

  checkinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.submitter && event.submitter.value === "cancel") {
      checkinDialog.close();
      return;
    }
    const id = document.getElementById("checkin-id").value;
    const resultValue = document.getElementById("checkin-value").value.trim();
    const resultNote = document.getElementById("checkin-note").value.trim();
    if (!resultValue) {
      showToast("확인한 숫자를 먼저 적어주세요.");
      return;
    }
    updateHistory(id, { status: "completed", resultValue, resultNote });
    checkinDialog.close();
    showToast("실행 결과를 저장했습니다.");
  });

  setStep(1);
  setConditionalFields();
  renderHistory();
})();
