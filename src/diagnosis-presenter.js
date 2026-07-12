(function initDiagnosisPresenter(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaDiagnosisPresenter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPresenterApi() {
  "use strict";

  function presentDiagnosis({ businessResult, storefrontScore, targetScore, observationMap }) {
    const { input, metrics, action, confidence, assumptions } = businessResult;
    const headline = storefrontScore.visible
      ? `${input.storeName}'s storefront readiness is ${storefrontScore.score} out of 100.`
      : `${input.storeName} needs more storefront information before showing a score.`;
    const safeShare = [
      `[${input.storeName}] Today's Jangsa Navigation diagnosis`,
      storefrontScore.visible
        ? `Storefront readiness: ${storefrontScore.score}/100`
        : "Storefront readiness: more information needed",
      action.title,
      `Verification metric: ${action.metric}`,
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
