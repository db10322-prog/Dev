// URL 키 기반 판정 결과 캐시. CACHE_BACKEND=local(기본, 오프라인 데모용) | supabase(클라우드 배포용)
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const LOCAL_CACHE_DIR = path.join(__dirname, "..", "cache");

function keyFor(url) {
  return crypto.createHash("sha256").update(url).digest("hex");
}

// ---- local file backend (Electron 데모 기본값, 네트워크 없이도 동작) ----
function localGet(url) {
  const file = path.join(LOCAL_CACHE_DIR, `${keyFor(url)}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function localSet(url, report) {
  if (!fs.existsSync(LOCAL_CACHE_DIR)) fs.mkdirSync(LOCAL_CACHE_DIR, { recursive: true });
  const file = path.join(LOCAL_CACHE_DIR, `${keyFor(url)}.json`);
  fs.writeFileSync(file, JSON.stringify({ url, cachedAt: Date.now(), report }, null, 2), "utf-8");
}

// ---- supabase backend (Vercel 클라우드 배포용) ----
let supabaseClient = null;
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음");
  supabaseClient = createClient(url, key);
  return supabaseClient;
}

async function supabaseGet(url) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("analysis_cache")
    .select("report, cached_at")
    .eq("url_hash", keyFor(url))
    .maybeSingle();
  if (error) {
    console.warn(`[cache:supabase] get 실패: ${error.message}`);
    return null;
  }
  return data ? { url, cachedAt: new Date(data.cached_at).getTime(), report: data.report } : null;
}

async function supabaseSet(url, report) {
  const supabase = getSupabase();
  const { error } = await supabase.from("analysis_cache").upsert({
    url_hash: keyFor(url),
    url,
    report,
    cached_at: new Date().toISOString(),
  });
  if (error) console.warn(`[cache:supabase] set 실패: ${error.message}`);
}

function backend() {
  return (process.env.CACHE_BACKEND || "local").toLowerCase();
}

/** @returns {Promise<{url, cachedAt, report}|null>} */
async function getCached(url) {
  return backend() === "supabase" ? supabaseGet(url) : localGet(url);
}

async function setCached(url, report) {
  return backend() === "supabase" ? supabaseSet(url, report) : localSet(url, report);
}

module.exports = { getCached, setCached, keyFor };
