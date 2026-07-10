const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildDiagnosisInput,
  createHistoryEntry,
  formatNumberInput,
  validateStep,
} = require("../src/ui-logic.js");

test("금액 입력은 쉼표와 문자를 제거하고 읽기 쉬운 숫자로 표시한다", () => {
  assert.equal(formatNumberInput("15000000원"), "15,000,000");
});

test("1단계는 고민과 업종을 선택해야 넘어갈 수 있다", () => {
  assert.deepEqual(validateStep(1, { painPoint: "", businessType: "" }), ["지금 가장 답답한 문제를 선택해 주세요.", "업종을 선택해 주세요."]);
});

test("2단계는 목표·기간·객단가가 없으면 쉬운 오류 문구를 돌려준다", () => {
  const errors = validateStep(2, { currentRevenue: "10,000,000", targetRevenue: "", remainingDays: "", averageOrderValue: "" });

  assert.equal(errors.length, 3);
  assert.ok(errors.some((message) => message.includes("목표 매출")));
});

test("광고 중이면 같은 기간 광고비와 클릭 수가 필요하다", () => {
  const errors = validateStep(3, {
    adsRunning: "true",
    adSpend: "",
    paidClicks: "",
    contributionMarginRate: "30",
    hasConsentDb: "false",
    capacity: "yes",
    canChangeMenu: "false",
    knowsReturningRate: "false",
  });

  assert.ok(errors.some((message) => message.includes("광고비")));
  assert.ok(errors.some((message) => message.includes("클릭 수")));
});

test("화면 입력값을 추천엔진이 쓰는 타입으로 변환한다", () => {
  const input = buildDiagnosisInput({
    storeName: "우리식당",
    painPoint: "ads",
    businessType: "meal",
    tradeArea: "residential",
    storeStrength: "specialty",
    currentRevenue: "10,000,000",
    targetRevenue: "15,000,000",
    remainingDays: "20",
    averageOrderValue: "20,000",
    adsRunning: "true",
    adSpend: "600,000",
    paidClicks: "1,000",
    contributionMarginRate: "30",
    hasConsentDb: "false",
    capacity: "yes",
    canChangeMenu: "false",
    knowsReturningRate: "false",
    returningRate: "",
  });

  assert.equal(input.currentRevenue, 10_000_000);
  assert.equal(input.adsRunning, true);
  assert.equal(input.contributionMarginRate, 0.3);
  assert.equal(input.returningRate, null);
});

test("실행 이력은 추천 행동과 확인 지표를 보존한다", () => {
  const entry = createHistoryEntry({
    input: { storeName: "우리식당" },
    action: { key: "aov", title: "세트메뉴 배치", metric: "객단가" },
    confidence: { label: "일부 가정 포함" },
  }, new Date("2026-07-11T10:00:00+09:00"));

  assert.equal(entry.storeName, "우리식당");
  assert.equal(entry.status, "pending");
  assert.equal(entry.metric, "객단가");
  assert.match(entry.id, /^diagnosis-/);
});
