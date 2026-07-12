# 플레이스 점수 우선 진단 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플레이스 관찰값을 10개 한글 영역의 100점 점수와 근거 토글로 보여 주는 점수 우선 진단 화면을 만든다.

**Architecture:** `src/place-score-model.js`가 점수 영역·상태 문구·근거 기준을 제공하고, 기존 `storefront-score.js`가 이를 사용해 점수를 계산한다. `src/app.js`는 점수 요약을 먼저 렌더링하고 보완 입력은 접힌 영역으로 내린다. 실제 수집기는 관찰값 계약을 통해 나중에 연결한다.

**Tech Stack:** 바닐라 자바스크립트, Node 내장 테스트, 정적 빌드 스크립트.

## Global Constraints

- 모든 사용자 문구와 점수 영역명은 한글로 작성한다.
- 실제 수집기가 없을 때 자동 분석 완료나 임의 점수를 표시하지 않는다.
- 미확인 값은 0점이 아니라 계산에서 제외하며 확인 범위 60% 미만이면 총점을 숨긴다.
- `dist/`는 직접 수정하지 않고 정적 빌드로 생성한다.

---

### Task 1: 플레이스 점수 기준 모델

**Files:**
- Create: `src/place-score-model.js`
- Modify: `src/storefront-score.js`
- Test: `tests/storefront-score.test.cjs`

**Interfaces:**
- Produces: `PLACE_SCORE_SECTIONS`, `getPlaceScoreSection(key)`, `getPlaceScoreStateLabel(state)`.
- Consumes: observation map keyed by score item key.

- [ ] **Step 1: Write the failing test**

```js
const { PLACE_SCORE_SECTIONS } = require("../src/place-score-model.js");

test("플레이스 점수는 10개 한글 영역과 100점 배점으로 구성된다", () => {
  assert.equal(PLACE_SCORE_SECTIONS.length, 10);
  assert.equal(PLACE_SCORE_SECTIONS.reduce((sum, section) => sum + section.maxPoints, 0), 100);
  assert.ok(PLACE_SCORE_SECTIONS.every((section) => /^[가-힣· ]+$/.test(section.label)));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/storefront-score.test.cjs`
Expected: FAIL because `place-score-model.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
const PLACE_SCORE_SECTIONS = Object.freeze([
  { key: "heroPhoto", label: "대표사진", maxPoints: 15, criterion: "첫 사진만 보고 무엇을 파는지 알 수 있어요." },
  { key: "description", label: "상세설명", maxPoints: 15, criterion: "누구에게 어떤 경험을 주는지 알 수 있어요." },
  { key: "directions", label: "찾아오는 길", maxPoints: 10, criterion: "주차와 도보 동선을 미리 알 수 있어요." },
  { key: "keywords", label: "대표키워드", maxPoints: 10, criterion: "지역과 대표 메뉴를 함께 찾을 수 있어요." },
  { key: "smartCall", label: "스마트콜", maxPoints: 8, criterion: "전화 문의를 바로 시작할 수 있어요." },
  { key: "menuInfo", label: "메뉴정보", maxPoints: 14, criterion: "사진과 가격으로 주문을 고를 수 있어요." },
  { key: "extraInfo", label: "부가정보", maxPoints: 8, criterion: "방문 전 필요한 편의 정보를 알 수 있어요." },
  { key: "talkTalk", label: "톡톡", maxPoints: 6, criterion: "자주 묻는 질문과 문의 시작점이 있어요." },
  { key: "reservation", label: "예약", maxPoints: 7, criterion: "시간과 인원을 골라 방문을 정할 수 있어요." },
  { key: "reviewCoupon", label: "리뷰 쿠폰 전략", maxPoints: 7, criterion: "실제 후기를 자연스럽게 받을 장치가 있어요." },
]);

function getPlaceScoreSection(key) {
  return PLACE_SCORE_SECTIONS.find((section) => section.key === key) || null;
}
```

`storefront-score.js`는 기존 영문 카테고리 대신 이 영역 객체를 결과에 포함하고, 근거가 없을 때도 한글 기준 문구를 반환한다.

```js
return {
  ...section,
  score,
  earnedPoints,
  knownMaxPoints,
  reason: observation?.evidence || "아직 자동으로 확인하지 못했어요.",
  state,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/storefront-score.test.cjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/place-score-model.js src/storefront-score.js tests/storefront-score.test.cjs
git commit -m "feat: define Korean place score model"
```

### Task 2: 점수 우선 분석 요약과 근거 토글

**Files:**
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `assets/styles.css`
- Test: `tests/app.integration.test.cjs`

**Interfaces:**
- Consumes: `storefrontScore.categories` with `label`, `score`, `reason`, `criterion`, and `fixLabel`.
- Produces: `renderPlaceScoreSummary(view)` and a `<details>` element for each score area.

- [ ] **Step 1: Write the failing test**

```js
test("플레이스 결과는 점수와 한글 근거 토글을 먼저 보여 준다", () => {
  const dom = loadAppWithSample();
  assert.match(dom.window.document.body.textContent, /플레이스 점수/);
  assert.match(dom.window.document.body.textContent, /왜 이렇게 봤나요/);
  assert.ok(dom.window.document.querySelectorAll("details.place-score-detail").length >= 10);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app.integration.test.cjs`
Expected: FAIL because no score-detail toggles exist.

- [ ] **Step 3: Write minimal implementation**

```js
function renderPlaceScoreSummary(view) {
  return view.storefront.categories.map((section) => `
    <article class="place-score-card">
      <p>${escapeHtml(section.label)}</p>
      <strong>${section.score === null ? "확인 중" : `${section.score}점`}</strong>
      <span>${escapeHtml(section.reason)}</span>
      <details class="place-score-detail">
        <summary>왜 이렇게 봤나요?</summary>
        <p>${escapeHtml(section.criterion)}</p>
      </details>
    </article>`).join("");
}
```

CSS는 요약 카드, 점수 막대, 토글, 모바일 한 열 레이아웃을 제공한다.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/app.integration.test.cjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.js index.html assets/styles.css tests/app.integration.test.cjs
git commit -m "feat: show place score before details"
```

### Task 3: 사장님 보완 입력을 선택 기능으로 전환

**Files:**
- Modify: `src/app.js`
- Modify: `index.html`
- Test: `tests/app.integration.test.cjs`

**Interfaces:**
- Consumes: `getPlaceScoreStateLabel`.
- Produces: 접힌 `직접 확인해서 점수 보완하기` 영역과 한글 상태 선택지.

- [ ] **Step 1: Write the failing test**

```js
test("확인 입력은 접힌 보완 기능이며 영어 판정값을 보여 주지 않는다", () => {
  const dom = submitSupportedPlaceLink();
  const text = dom.window.document.body.textContent;
  assert.match(text, /직접 확인해서 점수 보완하기/);
  assert.doesNotMatch(text, /Good|Needs work|Missing|owner confirmation/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app.integration.test.cjs`
Expected: FAIL because the confirmation form renders English labels.

- [ ] **Step 3: Write minimal implementation**

```js
confirmationForm.innerHTML = `
  <details class="score-confirmation">
    <summary>직접 확인해서 점수 보완하기</summary>
    <p>자동 분석으로 확인하지 못한 항목만 고쳐 주세요.</p>
    ${rules.map(renderKoreanStatusOptions).join("")}
  </details>`;
```

선택지는 `잘 되어 있음`, `조금 아쉬움`, `비어 있음`, `아직 확인 못 함`만 사용한다.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/app.integration.test.cjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.js index.html tests/app.integration.test.cjs
git commit -m "feat: make owner score input optional"
```

### Task 4: 전체 검증과 정적 빌드

**Files:**
- Modify: `README.md`
- Test: `tests/*.test.cjs`

- [ ] **Step 1: Add score-source explanation**

`README.md`에 실제 수집기 전의 점수 제한과 관찰값 계약을 한글로 설명한다.

- [ ] **Step 2: Run full tests**

Run: `node --test tests/*.test.cjs`
Expected: all tests pass.

- [ ] **Step 3: Check for prohibited UI copy**

Run: `rg -n "Good|Needs work|Missing|owner confirmation|Static version" src index.html assets`
Expected: no user-facing matches.

- [ ] **Step 4: Build static output**

Run: `node scripts/build-static.cjs`
Expected: build completes without error.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: explain place score evidence"
```
