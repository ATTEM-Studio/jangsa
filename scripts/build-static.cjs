const fs = require("node:fs");
const path = require("node:path");

const FILES = ["index.html", "site.webmanifest", "robots.txt"];
const DIRECTORIES = ["assets", "src"];

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function buildStaticSite({ root, outDir }) {
  const sourceRoot = path.resolve(root);
  const destination = path.resolve(outDir);

  if (sourceRoot === destination) {
    throw new Error("빌드 출력 경로는 프로젝트 루트와 달라야 합니다.");
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });

  for (const file of FILES) {
    const source = path.join(sourceRoot, file);
    if (!fs.existsSync(source)) throw new Error(`필수 파일이 없습니다: ${file}`);
    fs.copyFileSync(source, path.join(destination, file));
  }

  for (const directory of DIRECTORIES) {
    const source = path.join(sourceRoot, directory);
    if (!fs.existsSync(source)) throw new Error(`필수 폴더가 없습니다: ${directory}`);
    copyDirectory(source, path.join(destination, directory));
  }

  fs.writeFileSync(path.join(destination, ".nojekyll"), "", "utf8");
  return destination;
}

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const outDir = path.join(root, "dist");
  const destination = buildStaticSite({ root, outDir });
  process.stdout.write(`정적 사이트 빌드 완료: ${destination}\n`);
}

module.exports = { buildStaticSite };
