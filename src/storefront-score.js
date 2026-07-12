(function initStorefrontScore(root, factory) {
  const model =
    typeof module !== "undefined" && module.exports && typeof require === "function"
      ? require("./place-score-model.js")
      : root.JangsaPlaceScoreModel;
  const api = factory(model);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaStorefrontScore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createScoreApi(placeScoreModel) {
  "use strict";

  const STATE_FACTOR = { pass: 1, partial: 0.5, fail: 0, unknown: null };
  const DEFAULT_REASON = "아직 자동으로 확인하지 못했어요.";
  const PLACE_SCORE_SECTIONS = placeScoreModel?.PLACE_SCORE_SECTIONS || [];
  const getPlaceScoreSection = placeScoreModel?.getPlaceScoreSection || (() => null);
  const STOREFRONT_RULES = [
    ["businessCategory", "keywords", 4],
    ["address", "directions", 3],
    ["directions", "directions", 3],
    ["keywords", "keywords", 5],
    ["businessHours", "extraInfo", 2],
    ["contact", "smartCall", 3],
    ["coverPhoto", "heroPhoto", 5],
    ["menu", "menuInfo", 5],
    ["prices", "menuInfo", 3],
    ["reservation", "reservation", 4],
    ["order", "menuInfo", 3],
    ["inquiry", "talkTalk", 2],
    ["coupon", "reviewCoupon", 3],
    ["reviewVolume", "reviewCoupon", 4],
    ["reviewRecency", "reviewCoupon", 4],
    ["reviewQuality", "reviewCoupon", 4],
    ["ownerReplies", "talkTalk", 4],
    ["photoReviews", "heroPhoto", 2],
    ["negativeResponse", "talkTalk", 2],
    ["description", "description", 5],
    ["menuDescriptions", "description", 4],
    ["photoDiversity", "heroPhoto", 4],
    ["uniqueValue", "description", 3],
    ["recentPosts", "description", 4],
    ["profileUpdated", "extraInfo", 3],
    ["reservationSlots", "reservation", 3],
    ["replySpeed", "smartCall", 3],
    ["recentPostActivity", "description", 3],
    ["featureHealth", "extraInfo", 3],
  ].map(([key, sectionKey, maxPoints]) => Object.freeze({ key, sectionKey, maxPoints }));

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
      return { ...rule, state, reason: observation?.evidence || DEFAULT_REASON };
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
    const grouped = items.reduce((result, item) => {
      const key = item.sectionKey || item.category || item.key;
      const group = result[key] || { earnedPoints: 0, knownMaxPoints: 0, totalMaxPoints: 0, items: [] };
      group.totalMaxPoints += item.maxPoints;
      group.items.push(item);
      if (item.earnedPoints !== null) {
        group.earnedPoints += item.earnedPoints;
        group.knownMaxPoints += item.maxPoints;
      }
      result[key] = group;
      return result;
    }, {});
    const categories = (PLACE_SCORE_SECTIONS.length ? PLACE_SCORE_SECTIONS : Object.keys(grouped).map((key) => ({ key, label: key, maxPoints: grouped[key].totalMaxPoints, criterion: DEFAULT_REASON }))).map(
      (section) => {
        const category = grouped[section.key] || { earnedPoints: 0, knownMaxPoints: 0, totalMaxPoints: 0, items: [] };
        const score = category.knownMaxPoints ? Math.round((category.earnedPoints / category.knownMaxPoints) * 100) : null;
        const coverage = category.totalMaxPoints ? category.knownMaxPoints / category.totalMaxPoints : 0;
        return {
          ...section,
          score,
          coverage,
          earnedPoints: score === null ? 0 : Math.round((section.maxPoints * score) / 100),
          knownMaxPoints: Math.round(section.maxPoints * coverage),
          totalMaxPoints: section.maxPoints,
          reason: category.items.find((item) => item.reason !== DEFAULT_REASON)?.reason || DEFAULT_REASON,
          state: score === null ? "unknown" : score === 100 ? "pass" : score === 0 ? "fail" : "partial",
        };
      },
    );
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

  return { STOREFRONT_RULES, buildScoreItems, calculateStorefrontScore, calculateTargetScore, getPlaceScoreSection };
});
