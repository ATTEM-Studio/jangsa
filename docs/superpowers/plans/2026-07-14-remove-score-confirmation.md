# 점수 보완 화면 제거 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플레이스 링크 입력 뒤 사장님 점수 보완 설문 없이 바로 경영 진단으로 이동한다.

**Architecture:** `src/app.js`의 링크·수동 진입 흐름이 진단 질문 화면으로 직접 이동한다. 확인 화면의 마크업과 점수 보완 관찰값 생성은 제거한다.

**Tech Stack:** 바닐라 자바스크립트, Node 내장 테스트, 정적 빌드.

## Global Constraints

- 실제 수집기가 없을 때 임의 점수나 자동 분석 완료를 표시하지 않는다.
- 미확인 항목은 0점이 아니라 계산에서 제외한다.
- `dist/`는 직접 수정하지 않는다.

---

### Task 1: 보완 설문 제거

**Files:**
- Modify: `src/app.js`, `index.html`, `assets/styles.css`, `tests/app.integration.test.cjs`

- [ ] **Step 1: Write the failing test**

```js
test("플레이스 링크는 점수 보완 설문 없이 바로 경영 진단으로 이동한다", () => {
  const window = createApp();
  window.document.getElementById("place-url").value = "https://naver.me/abc123";
  window.document.getElementById("place-intake-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(window.document.getElementById("confirmation"), null);
  assert.equal(window.document.getElementById("diagnosis").hidden, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app.integration.test.cjs`
Expected: FAIL because the confirmation section exists and is shown.

- [ ] **Step 3: Write minimal implementation**

Remove the confirmation section, confirmation form rendering, section observation mapping, and the confirmation button handler. Route both supported-link and manual entry directly to `showDiagnosisForm()`.

- [ ] **Step 4: Run test and static build**

Run: `node --test tests/*.test.cjs` and `node scripts/build-static.cjs`
Expected: all tests pass and build completes.

- [ ] **Step 5: Commit**

```bash
git add src/app.js index.html assets/styles.css tests/app.integration.test.cjs docs/superpowers/plans/2026-07-14-remove-score-confirmation.md
git commit -m "feat: remove optional score confirmation"
```
