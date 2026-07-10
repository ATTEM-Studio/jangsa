(function startJangsaApp() {
  "use strict";

  const engine = window.JangsaEngine;
  const ui = window.JangsaUiLogic;
  const form = document.getElementById("diagnosis-form");
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
  let toastTimer = null;

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
    const rows = [
      ["목표까지 남은 매출", engine.formatShortWon(metrics.shortfallRevenue)],
      ["하루 필요한 추가 손님", `${metrics.requiredCustomersPerDay.toLocaleString("ko-KR")}명`],
    ];
    if (metrics.cpc !== null) rows.push(["현재 클릭 비용", engine.formatWon(metrics.cpc)]);
    if (metrics.maxSafeClicksPerCustomer !== null) rows.push(["손님 1명까지 보수적 클릭 기준", `${metrics.maxSafeClicksPerCustomer.toFixed(1)}회`]);

    const reasons = result.confidence.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("");
    const assumptions = result.assumptions.length
      ? `<p><strong>포함된 가정</strong></p><ul>${result.assumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
    const metricRows = rows.map(([label, value]) => `<li><strong>${escapeHtml(label)}</strong> · ${escapeHtml(value)}</li>`).join("");

    document.getElementById("result-evidence").innerHTML = `
      <p><strong>입력값으로 확인한 기준</strong></p>
      <ul>${metricRows}</ul>
      <p><strong>추천 근거 수준</strong></p>
      <ul>${reasons}</ul>
      ${assumptions}
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
    document.getElementById("result-avoid").textContent = result.action.avoid;
    document.getElementById("feedback-panel").hidden = true;
    renderEvidence(result);
    resultSection.hidden = false;
  }

  function generateResult({ saveHistory = true } = {}) {
    const input = ui.buildDiagnosisInput(getValues());
    latestResult = engine.diagnoseStore(input);
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
      return Array.isArray(saved) ? saved : [];
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
      return `
        <article class="history-card">
          <div>
            <div class="history-card-top">
              <time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(date)}</time>
              <span class="status-pill ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
              <span>${escapeHtml(item.storeName)}</span>
            </div>
            <h3>${escapeHtml(item.actionTitle)}</h3>
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
      `[${result.input.storeName}] 오늘의 장사네비게이션`,
      "",
      result.action.title,
      result.action.summary,
      "",
      `왜: ${result.action.why}`,
      `예상 효과: ${formatEffect(result)}`,
      `예상 시간: ${result.action.time}`,
      "",
      "지금 이렇게 하세요",
      ...result.action.steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      `실행 후 확인할 숫자: ${result.action.metric}`,
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

  document.querySelectorAll("[data-start]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById("diagnosis").scrollIntoView({ behavior: "smooth" }));
  });

  document.querySelectorAll("[data-sample]").forEach((button) => button.addEventListener("click", loadSample));
  document.querySelectorAll("[data-scroll-history]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById("history").scrollIntoView({ behavior: "smooth" }));
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
