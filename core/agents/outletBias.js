// 매체 성향 매핑 조회 (T-2). data/outlet-bias.json 을 읽어 도메인 → 성향 라벨 반환.
const fs = require("fs");
const path = require("path");
const { resolveCoreAsset } = require("../resolveAsset");

const TABLE_PATH = resolveCoreAsset(
  path.join(__dirname, "..", "..", "data", "outlet-bias.json"),
  "data",
  "outlet-bias.json"
);
let cachedTable = null;

function loadTable() {
  if (cachedTable) return cachedTable;
  const raw = fs.readFileSync(TABLE_PATH, "utf-8");
  cachedTable = JSON.parse(raw);
  return cachedTable;
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** @returns {{domain, direction, source}} — 매핑 없으면 direction: "미분류", source: null */
function lookupOutletBias(urlOrDomain) {
  const table = loadTable();
  const domain = urlOrDomain.includes("://") ? domainFromUrl(urlOrDomain) : urlOrDomain;
  const entry = table.outlets.find((o) => o.domain === domain);
  if (!entry) {
    return { domain, direction: "미분류", source: null };
  }
  return { domain, direction: entry.direction, source: entry.source };
}

/** 주어진 direction과 "반대" 성향인 후보들만 필터링 (counterArticles 후보 산출용) */
const OPPOSITE_MAP = {
  진보: ["보수", "중도보수"],
  중도진보: ["보수", "중도보수"],
  중도: [],
  중도보수: ["진보", "중도진보"],
  보수: ["진보", "중도진보"],
  미분류: [],
};

function isOppositeDirection(baseDirection, candidateDirection) {
  return (OPPOSITE_MAP[baseDirection] || []).includes(candidateDirection);
}

module.exports = { loadTable, lookupOutletBias, isOppositeDirection };
