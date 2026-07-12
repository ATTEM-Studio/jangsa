(function initStorefrontScore(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaStorefrontScore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createScoreApi() {
  "use strict";

  const STATE_FACTOR = { pass: 1, partial: 0.5, fail: 0, unknown: null };
  const STOREFRONT_RULES = [
    ["businessCategory", "discovery", 4],
    ["address", "discovery", 3],
    ["directions", "discovery", 3],
    ["keywords", "discovery", 5],
    ["businessHours", "discovery", 2],
    ["contact", "discovery", 3],
    ["coverPhoto", "conversion", 5],
    ["menu", "conversion", 5],
    ["prices", "conversion", 3],
    ["reservation", "conversion", 4],
    ["order", "conversion", 3],
    ["inquiry", "conversion", 2],
    ["coupon", "conversion", 3],
    ["reviewVolume", "trust", 4],
    ["reviewRecency", "trust", 4],
    ["reviewQuality", "trust", 4],
    ["ownerReplies", "trust", 4],
    ["photoReviews", "trust", 2],
    ["negativeResponse", "trust", 2],
    ["description", "content", 5],
    ["menuDescriptions", "content", 4],
    ["photoDiversity", "content", 4],
    ["uniqueValue", "content", 3],
    ["recentPosts", "content", 4],
    ["profileUpdated", "activity", 3],
    ["reservationSlots", "activity", 3],
    ["replySpeed", "activity", 3],
    ["recentPostActivity", "activity", 3],
    ["featureHealth", "activity", 3],
  ].map(([key, category, maxPoints]) => Object.freeze({ key, category, maxPoints }));

  function buildScoreItems(observationMap) {
    return STOREFRONT_RULES.map((rule) => {
      const observation = observationMap[rule.key];
      const state =
        !observation || ["unknown", "unavailable"].includes(observation.status)
          ? "unknown"
          : ["pass", "partial", "fail"].includes(observation.value)
            ? observation.value
            : observation.value === true
              ? "pass"
              : observation.value === false
                ? "fail"
                : "unknown";
      return { ...rule, state, reason: observation?.evidence || "No evidence available" };
    });
  }

  function calculateStorefrontScore(scoreItems) {
    const items = scoreItems.map((item) => {
      const factor = STATE_FACTOR[item.state];
      if (factor === undefined) throw new TypeError(`Unsupported score state: ${item.state}`);
      return { ...item, earnedPoints: factor === null ? null : item.maxPoints * factor };
    });
    const totalMaxPoints = items.reduce((sum, item) => sum + item.maxPoints, 0);
    const known = items.filter((item) => item.earnedPoints !== null);
    const knownMaxPoints = known.reduce((sum, item) => sum + item.maxPoints, 0);
    const earnedPoints = known.reduce((sum, item) => sum + item.earnedPoints, 0);
    const coverage = totalMaxPoints ? knownMaxPoints / totalMaxPoints : 0;
    const visible = coverage >= 0.6;
    const score = visible && knownMaxPoints ? Math.round((earnedPoints / knownMaxPoints) * 100) : null;
    const categories = Object.values(
      items.reduce((result, item) => {
        const category = result[item.category] || {
          key: item.category,
          earnedPoints: 0,
          knownMaxPoints: 0,
          totalMaxPoints: 0,
        };
        category.totalMaxPoints += item.maxPoints;
        if (item.earnedPoints !== null) {
          category.earnedPoints += item.earnedPoints;
          category.knownMaxPoints += item.maxPoints;
        }
        result[item.category] = category;
        return result;
      }, {}),
    ).map((category) => ({
      ...category,
      score: category.knownMaxPoints ? Math.round((category.earnedPoints / category.knownMaxPoints) * 100) : null,
    }));
    return { visible, score, coverage, earnedPoints, knownMaxPoints, totalMaxPoints, categories, items };
  }

  function calculateTargetScore(scoreResult, recoverableKeys) {
    if (!scoreResult.visible) return { current: null, target: null, gain: 0, recovered: [] };
    const recoverable = scoreResult.items.filter(
      (item) =>
        recoverableKeys.includes(item.key) &&
        item.earnedPoints !== null &&
        item.earnedPoints < item.maxPoints,
    );
    const recoveredPoints = recoverable.reduce((sum, item) => sum + item.maxPoints - item.earnedPoints, 0);
    const normalizedGain = Math.round((recoveredPoints / scoreResult.knownMaxPoints) * 100);
    const target = Math.min(100, scoreResult.score + normalizedGain);
    return { current: scoreResult.score, target, gain: target - scoreResult.score, recovered: recoverable.map((item) => item.key) };
  }

  return { STOREFRONT_RULES, buildScoreItems, calculateStorefrontScore, calculateTargetScore };
});
