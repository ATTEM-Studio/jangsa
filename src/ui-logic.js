(function initJangsaUiLogic(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.JangsaUiLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createJangsaUiLogic() {
  "use strict";

  function parseNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const normalized = String(value || "").replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
  }

  function formatNumberInput(value) {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    return digits ? Number(digits).toLocaleString("ko-KR") : "";
  }

  function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === "";
  }

  function validateStep(step, values) {
    const errors = [];

    if (step === 1) {
      if (isBlank(values.painPoint)) errors.push("지금 가장 답답한 문제를 선택해 주세요.");
      if (isBlank(values.businessType)) errors.push("업종을 선택해 주세요.");
    }

    if (step === 2) {
      if (isBlank(values.targetRevenue) || parseNumber(values.targetRevenue) <= 0) errors.push("목표 매출을 입력해 주세요.");
      if (isBlank(values.remainingDays) || parseNumber(values.remainingDays) <= 0) errors.push("목표일까지 남은 기간을 입력해 주세요.");
      if (isBlank(values.averageOrderValue) || parseNumber(values.averageOrderValue) <= 0) errors.push("평균 객단가를 입력해 주세요.");
    }

    if (step === 3) {
      if (isBlank(values.capacity)) errors.push("손님을 더 받을 여력이 있는지 선택해 주세요.");
      if (isBlank(values.hasConsentDb)) errors.push("수신동의 고객 DB 여부를 선택해 주세요.");
      if (isBlank(values.canChangeMenu)) errors.push("메뉴 구성을 바꿀 수 있는지 선택해 주세요.");
      if (isBlank(values.adsRunning)) errors.push("현재 광고 집행 여부를 선택해 주세요.");

      if (String(values.adsRunning) === "true") {
        if (isBlank(values.adSpend) || parseNumber(values.adSpend) <= 0) errors.push("같은 기간의 광고비를 입력해 주세요.");
        if (isBlank(values.paidClicks) || parseNumber(values.paidClicks) <= 0) errors.push("같은 기간의 광고 클릭 수를 입력해 주세요.");
      }

      if (String(values.knowsReturningRate) === "true" && (isBlank(values.returningRate) || parseNumber(values.returningRate) > 100)) {
        errors.push("재방문 비율을 0~100 사이로 입력해 주세요.");
      }
    }

    return errors;
  }

  function asBoolean(value) {
    return value === true || value === "true";
  }

  function buildDiagnosisInput(values) {
    const margin = parseNumber(values.contributionMarginRate || 30);
    return {
      storeName: String(values.storeName || "우리 매장").trim() || "우리 매장",
      painPoint: String(values.painPoint || "unknown"),
      businessType: String(values.businessType || "meal"),
      tradeArea: String(values.tradeArea || "residential"),
      storeStrength: String(values.storeStrength || "specialty"),
      currentRevenue: parseNumber(values.currentRevenue),
      targetRevenue: parseNumber(values.targetRevenue),
      remainingDays: parseNumber(values.remainingDays),
      averageOrderValue: parseNumber(values.averageOrderValue),
      adsRunning: asBoolean(values.adsRunning),
      adSpend: parseNumber(values.adSpend),
      paidClicks: parseNumber(values.paidClicks),
      contributionMarginRate: Math.min(Math.max(margin / 100, 0), 1),
      hasConsentDb: asBoolean(values.hasConsentDb),
      capacity: String(values.capacity || "sometimes"),
      canChangeMenu: asBoolean(values.canChangeMenu),
      knowsReturningRate: asBoolean(values.knowsReturningRate),
      returningRate: isBlank(values.returningRate) ? null : Math.min(parseNumber(values.returningRate) / 100, 1),
    };
  }

  function createHistoryEntry(result, now = new Date()) {
    const timestamp = now.toISOString();
    return {
      id: `diagnosis-${timestamp.replace(/[^0-9]/g, "")}`,
      createdAt: timestamp,
      storeName: result.input.storeName,
      actionKey: result.action.key,
      actionTitle: result.action.title,
      metric: result.action.metric,
      confidenceLabel: result.confidence.label,
      status: "pending",
      resultNote: "",
      resultValue: "",
    };
  }

  return {
    buildDiagnosisInput,
    createHistoryEntry,
    formatNumberInput,
    parseNumber,
    validateStep,
  };
});
