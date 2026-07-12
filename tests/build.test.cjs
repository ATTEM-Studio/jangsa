const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { buildStaticSite } = require("../scripts/build-static.cjs");

test("정적 빌드는 실행에 필요한 파일만 dist에 복사한다", () => {
  const root = path.resolve(__dirname, "..");
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "jangsa-build-"));

  buildStaticSite({ root, outDir });

  assert.equal(fs.existsSync(path.join(outDir, "index.html")), true);
  assert.equal(fs.existsSync(path.join(outDir, "assets/styles.css")), true);
  assert.equal(fs.existsSync(path.join(outDir, "src/engine.js")), true);
  assert.equal(fs.existsSync(path.join(outDir, "src/observations.js")), true);
  assert.equal(fs.existsSync(path.join(outDir, "src/storefront-score.js")), true);
  assert.equal(fs.existsSync(path.join(outDir, "src/diagnosis-presenter.js")), true);
  assert.equal(fs.existsSync(path.join(outDir, ".nojekyll")), true);
  assert.equal(fs.existsSync(path.join(outDir, "tests")), false);
  assert.equal(fs.existsSync(path.join(outDir, "node_modules")), false);
});
