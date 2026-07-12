const test = require("node:test");
const assert = require("node:assert/strict");

const { presentDiagnosis } = require("../src/diagnosis-presenter.js");

test("presenter keeps storefront score and business bottleneck separate", () => {
  const view = presentDiagnosis({
    businessResult: {
      input: { storeName: "Dori Restaurant", currentRevenue: 10_000_000 },
      metrics: { shortfallRevenue: 5_000_000, requiredCustomersPerDay: 8 },
      action: {
        key: "localDiscovery",
        title: "Improve why customers choose you in local search",
        summary: "The first screen needs stronger proof.",
        why: "You need about 8 more customers per day.",
        steps: ["Select photos", "Revise description", "Track responses"],
        metric: "Search conversion",
        avoid: "Do not start by increasing ad spend.",
      },
      confidence: {
        level: "medium",
        label: "Some estimates included",
        reasons: ["Customer count is estimated from average order value."],
      },
      assumptions: ["Check response for 7 days."],
    },
    storefrontScore: { visible: true, score: 74, coverage: 0.86, categories: [], items: [] },
    targetScore: { current: 74, target: 83, gain: 9, recovered: ["coverPhoto"] },
    observationMap: {
      coverPhoto: { source: "owner", status: "confirmed", evidence: "Owner confirmed." },
    },
  });

  assert.equal(view.storefront.score, 74);
  assert.equal(view.bottleneck.requiredCustomersPerDay, 8);
  assert.equal(view.target.target, 83);
  assert.equal(view.evidence.observations.length, 1);
  assert.equal(view.safeShare.includes("10000000"), false);
});

test("hidden storefront score shows exact info-needed label", () => {
  const view = presentDiagnosis({
    businessResult: {
      input: { storeName: "Dori Restaurant" },
      metrics: { shortfallRevenue: 0, requiredCustomersPerDay: 0 },
      action: { title: "Confirm the basics", metric: "Completion", why: "Need more data." },
      confidence: { level: "low", label: "More information needed", reasons: [] },
      assumptions: [],
    },
    storefrontScore: { visible: false, score: null, coverage: 0.4, categories: [], items: [] },
    targetScore: { current: null, target: null, gain: 0, recovered: [] },
    observationMap: {},
  });

  assert.match(view.headline, /정보 추가 필요/);
  assert.match(view.safeShare, /정보 추가 필요/);
});

test("safe share redacts raw revenue and advertising-like values from action text", () => {
  const view = presentDiagnosis({
    businessResult: {
      input: { storeName: "Dori Restaurant", currentRevenue: 10_000_000 },
      metrics: { shortfallRevenue: 5_000_000, requiredCustomersPerDay: 8 },
      action: {
        title: "Do not raise the 600,000원 ad budget",
        metric: "Compare 1000 paid clicks after 7 days",
        why: "Raw values should not be shared.",
      },
      confidence: { level: "medium", label: "Some estimates included", reasons: [] },
      assumptions: [],
    },
    storefrontScore: { visible: true, score: 74, coverage: 0.86, categories: [], items: [] },
    targetScore: { current: 74, target: 83, gain: 9, recovered: ["coverPhoto"] },
    observationMap: {},
  });

  assert.equal(view.safeShare.includes("600,000"), false);
  assert.equal(view.safeShare.includes("1000"), false);
  assert.equal(view.safeShare.includes("10000000"), false);
  assert.equal(view.safeShare.includes("5000000"), false);
});
