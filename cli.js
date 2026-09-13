#!/usr/bin/env node
// T-1 완료 기준: node cli.js --url <기사URL> --text <본문파일>
require("dotenv").config();
const fs = require("fs");
const { analyzeArticle } = require("./core/pipeline");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url || !args.text) {
    console.error("사용법: node cli.js --url <기사URL> --text <본문파일> [--title <제목>] [--no-cache]");
    process.exit(1);
  }
  const text = fs.readFileSync(args.text, "utf-8");
  const started = Date.now();
  try {
    const report = await analyzeArticle(
      { url: args.url, title: args.title || "", text },
      { useCache: !args["no-cache"] }
    );
    console.log(JSON.stringify(report, null, 2));
    console.error(`\n[cli] 총 소요 ${Date.now() - started}ms (목표 20000ms 미만)`);
  } catch (err) {
    console.error("[cli] 실패:", err);
    process.exit(1);
  }
})();
