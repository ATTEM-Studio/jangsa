const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateStorefrontScore,
  calculateTargetScore,
} = require("../src/storefront-score.js");
const {
  PLACE_SCORE_SECTIONS,
  getPlaceScoreSection,
  getPlaceScoreStateLabel,
} = require("../src/place-score-model.js");

const items = [
  { key: "keywords", category: "discovery", maxPoints: 20, state: "pass", reason: "keywords confirmed" },
  { key: "coverPhoto", category: "conversion", maxPoints: 20, state: "partial", reason: "cover photo can improve" },
  { key: "reviews", category: "trust", maxPoints: 20, state: "fail", reason: "recent reviews missing" },
  { key: "description", category: "content", maxPoints: 20, state: "unknown", reason: "needs confirmation" },
  { key: "recentActivity", category: "activity", maxPoints: 20, state: "pass", reason: "recent activity confirmed" },
];

test("플레이스 점수는 10가지 한글 영역과 100점 배점으로 구성된다", () => {
  assert.equal(PLACE_SCORE_SECTIONS.length, 10);
  assert.equal(PLACE_SCORE_SECTIONS.reduce((sum, section) => sum + section.maxPoints, 0), 100);
  assert.ok(PLACE_SCORE_SECTIONS.every((section) => /^[가-힣 ]+$/.test(section.label)));
  assert.deepEqual(
    PLACE_SCORE_SECTIONS.map((section) => section.key),
    [
      "heroPhoto",
      "description",
      "directions",
      "keywords",
      "smartCall",
      "menuInfo",
      "extraInfo",
      "talkTalk",
      "reservation",
      "reviewCoupon",
    ],
  );
});

test("플레이스 점수 영역은 손님이 이해할 수 있는 판단 기준과 상태 문구를 제공한다", () => {
  assert.match(getPlaceScoreSection("heroPhoto").criterion, /처음/);
  assert.equal(getPlaceScoreSection("missing"), null);
  assert.equal(getPlaceScoreStateLabel("pass"), "잘 되어 있어요");
  assert.equal(getPlaceScoreStateLabel("partial"), "조금 아쉬워요");
  assert.equal(getPlaceScoreStateLabel("fail"), "비어 있어요");
  assert.equal(getPlaceScoreStateLabel("unknown"), "아직 확인하지 못했어요");
});

test("unknown items are excluded from the denominator", () => {
  const result = calculateStorefrontScore(items);
  assert.equal(result.knownMaxPoints, 80);
  assert.equal(result.earnedPoints, 50);
  assert.equal(result.score, 63);
  assert.equal(result.coverage, 0.8);
  assert.equal(result.visible, true);
});

test("coverage below 60 percent hides the total score", () => {
  const result = calculateStorefrontScore(
    items.map((item, index) => (index < 2 ? item : { ...item, state: "unknown" })),
  );
  assert.equal(result.coverage, 0.4);
  assert.equal(result.visible, false);
  assert.equal(result.score, null);
});

test("target score only adds recoverable missing points", () => {
  const result = calculateStorefrontScore(items);
  assert.deepEqual(calculateTargetScore(result, ["coverPhoto", "reviews", "missing"]), {
    current: 63,
    target: 100,
    gain: 37,
    recovered: ["coverPhoto", "reviews"],
  });
});
