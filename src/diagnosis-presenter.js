(function initDiagnosisPresenter(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaDiagnosisPresenter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPresenterApi() {
  "use strict";

  const INFO_NEEDED_LABEL = "정보 추가 필요";
  const RAW_VALUE_PATTERN = /(?:\d[\d,]{3,}|\d{4,})(?:\s*(?:원|won|krw|clicks?|클릭))?/gi;

  function redactRawValues(value) {
    return String(value || "").replace(RAW_VALUE_PATTERN, "[비공개]");
  }

  function presentDiagnosis({ businessResult, storefrontScore, targetScore, observationMap }) {
    const { input, metrics, action, confidence, assumptions } = businessResult;
    const headline = storefrontScore.visible
      ? `${input.storeName}'s storefront readiness is ${storefrontScore.score} out of 100.`
      : `${input.storeName}: ${INFO_NEEDED_LABEL}`;
    const safeShare = [
      `[${input.storeName}] Today's Jangsa Navigation diagnosis`,
      storefrontScore.visible
        ? `Storefront readiness: ${storefrontScore.score}/100`
        : `Storefront readiness: ${INFO_NEEDED_LABEL}`,
      redactRawValues(action.title),
      `Verification metric: ${redactRawValues(action.metric)}`,
    ].join("\n");

    return {
      headline,
      action,
      storefront: storefrontScore,
      bottleneck: {
        shortfallRevenue: metrics.shortfallRevenue,
        requiredCustomersPerDay: metrics.requiredCustomersPerDay,
        label: action.why,
      },
      target: targetScore,
      evidence: {
        confidence,
        assumptions,
        observations: Object.values(observationMap),
      },
      safeShare,
    };
  }

  return { presentDiagnosis };
});
