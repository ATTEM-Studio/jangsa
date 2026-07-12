const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Window } = require("happy-dom");

const root = path.resolve(__dirname, "..");

function createApp() {
  const window = new Window({ url: "http://localhost/" });
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  window.document.write(fs.readFileSync(path.join(root, "index.html"), "utf8"));
  window.eval(fs.readFileSync(path.join(root, "src/observations.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(root, "src/storefront-score.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(root, "src/action-priority.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(root, "src/engine.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(root, "src/diagnosis-presenter.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(root, "src/ui-logic.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(root, "src/app.js"), "utf8"));
  return window;
}

test("supported links switch to honest owner confirmation instead of automatic analysis", () => {
  const window = createApp();
  const input = window.document.getElementById("place-url");
  input.value = "https://naver.me/abc123";

  window.document.getElementById("place-intake-form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );

  assert.equal(window.document.getElementById("confirmation").hidden, false);
  assert.match(window.document.getElementById("confirmation").textContent, /static version|owner confirmation/);
  assert.doesNotMatch(window.document.getElementById("confirmation").textContent, /reviews [0-9,]+ analyzed/i);
});

test("오늘 실행하기는 v2 이력과 7일 확인일을 저장한다", () => {
  const window = createApp();

  window.document.querySelector("[data-sample]").click();
  window.document.getElementById("accept-action").click();

  const history = JSON.parse(window.localStorage.getItem("jangsaNavigationV11History"));
  assert.equal(history[0].version, 2);
  assert.equal(history[0].scoreVersion, "storefront-v1");
  assert.match(history[0].checkInDueAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(JSON.stringify(history[0]).includes("10000000"), false);
  assert.match(window.document.getElementById("history-list").textContent, /결과 확인/);
});

test("저장된 v1 이력은 화면 로딩 때 v2 표시 구조로 보완된다", () => {
  const window = createApp();
  window.localStorage.setItem("jangsaNavigationV11History", JSON.stringify([{
    id: "old",
    createdAt: "2026-07-12T00:00:00.000Z",
    storeName: "오래된식당",
    actionKey: "aov",
    actionTitle: "세트메뉴 배치",
    metric: "객단가",
    status: "accepted",
  }]));

  window.JangsaAppTest.renderHistory();

  const migrated = JSON.parse(window.localStorage.getItem("jangsaNavigationV11History"));
  assert.equal(migrated[0].version, 2);
  assert.equal(migrated[0].checkInDueAt, null);
  assert.match(window.document.getElementById("history-list").textContent, /오래된식당/);
});

test("sample result separates storefront readiness, target score, and business bottleneck", () => {
  const window = createApp();

  window.document.querySelector("[data-sample]").click();

  assert.match(window.document.getElementById("storefront-score").textContent, /매장 준비도|readiness/i);
  assert.match(window.document.getElementById("storefront-score").textContent, /\d+\/100/);
  assert.match(window.document.getElementById("target-score").textContent, /목표|target/i);
  assert.match(window.document.getElementById("business-bottleneck").textContent, /필요 고객|bottleneck/i);
  assert.equal(window.document.getElementById("target-score").hidden, false);
});

test("low coverage hides the score and asks for more information", () => {
  const window = createApp();

  window.JangsaAppTest.renderLowCoverageSample();

  assert.match(window.document.getElementById("storefront-score").textContent, /정보 추가 필요/);
  assert.equal(window.document.getElementById("target-score").hidden, true);
});

test("result copy text does not include raw revenue or ad values", () => {
  const window = createApp();

  window.document.querySelector("[data-sample]").click();

  const copyText = window.JangsaAppTest.resultCopyText();
  assert.equal(copyText.includes("10000000"), false);
  assert.equal(copyText.includes("10,000,000"), false);
  assert.equal(copyText.includes("600000"), false);
  assert.equal(copyText.includes("600,000"), false);
});

test("dynamic score updates use aria-live and result CTAs are semantic actions", () => {
  const window = createApp();

  window.document.querySelector("[data-sample]").click();

  const score = window.document.getElementById("storefront-score");
  assert.equal(score.getAttribute("aria-live"), "polite");

  for (const id of ["primary-fix-action", "generate-draft", "defer-action"]) {
    const action = window.document.getElementById(id);
    assert.ok(action);
    assert.match(action.tagName, /^(BUTTON|A)$/);
  }
});

test("intake flow keeps diagnosis questions hidden until confirmation is accepted", () => {
  const window = createApp();
  window.document.getElementById("place-url").value = "https://naver.me/abc123";

  window.document.getElementById("place-intake-form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );

  assert.equal(window.document.getElementById("intake").hidden, true);
  assert.equal(window.document.getElementById("diagnosis").hidden, true);
  window.document.getElementById("confirm-storefront").click();
  assert.equal(window.document.getElementById("confirmation").hidden, true);
  assert.equal(window.document.getElementById("analysis").hidden, true);
  assert.equal(window.document.getElementById("diagnosis").hidden, false);
});

test("manual intake still opens owner confirmation", () => {
  const window = createApp();

  window.document.getElementById("manual-intake").click();

  assert.equal(window.document.getElementById("confirmation").hidden, false);
  assert.equal(window.document.getElementById("intake").hidden, true);
  assert.equal(window.document.getElementById("diagnosis").hidden, true);
});

test("빈 1단계에서 다음을 누르면 쉬운 오류 문구를 보여준다", () => {
  const window = createApp();

  window.document.getElementById("next-button").click();

  const error = window.document.getElementById("form-error");
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /답답한 문제/);
  assert.match(error.textContent, /업종/);
});

test("샘플 진단은 광고 확대 금지 행동 하나와 확인 지표를 보여준다", () => {
  const window = createApp();

  window.document.querySelector("[data-sample]").click();

  assert.equal(window.document.getElementById("result").hidden, false);
  assert.equal(window.document.getElementById("intake").hidden, true);
  assert.equal(window.document.getElementById("diagnosis").hidden, true);
  assert.match(window.document.getElementById("result-title").textContent, /광고비를 늘리지 마세요/);
  assert.match(window.document.getElementById("result-metric").textContent, /전화|길찾기|예약/);
  assert.equal(window.document.querySelectorAll("#result-steps li").length, 3);
});

test("샘플 진단의 판단 근거는 현재 상황부터 추천 기준까지 카드로 설명한다", () => {
  const window = createApp();

  window.document.querySelector("[data-sample]").click();

  const evidence = window.document.getElementById("result-evidence");
  assert.equal(evidence.querySelectorAll(".evidence-card").length, 4);
  assert.match(evidence.textContent, /현재 위치/);
  assert.match(evidence.textContent, /숫자가 말하는 문제/);
  assert.match(evidence.textContent, /그래서 오늘의 1순위/);
  assert.match(evidence.textContent, /이번 추천의 기준/);
  assert.match(evidence.textContent, /지금은 미루기/);
});

test("오늘 실행하기를 누르면 실행 예정 상태가 이력에 남는다", () => {
  const window = createApp();
  window.document.querySelector("[data-sample]").click();

  window.document.getElementById("accept-action").click();

  const history = JSON.parse(window.localStorage.getItem("jangsaNavigationV11History"));
  assert.equal(history.length, 1);
  assert.equal(history[0].status, "accepted");
  assert.match(window.document.getElementById("history-list").textContent, /실행 예정/);
});
