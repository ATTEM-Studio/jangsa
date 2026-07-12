(function initActionPriority(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaActionPriority = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createActionPriorityApi() {
  "use strict";

  function isEligible(candidate, context) {
    const requirements = candidate.requires || {};
    const requirementsPass = Object.entries(requirements).every(([key, value]) => context[key] === value);
    if (!requirementsPass) return false;
    if (candidate.spendsMoney && candidate.confidenceScore < 60) return false;
    return !(candidate.disqualify || []).some((rule) => context[rule.key] === rule.value);
  }

  function scoreAction(candidate) {
    return candidate.impact * 0.35
      + candidate.urgency * 0.2
      + candidate.feasibility * 0.2
      + candidate.lowCost * 0.1
      + candidate.confidenceScore * 0.15;
  }

  function selectTopAction(candidates, context) {
    const eligible = candidates.filter((candidate) => isEligible(candidate, context));
    return eligible.sort((a, b) => scoreAction(b) - scoreAction(a) || a.key.localeCompare(b.key))[0] || null;
  }

  return { isEligible, scoreAction, selectTopAction };
});
