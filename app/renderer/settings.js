// T-8 — API 키 입력 화면. 로컬 .env 에만 기록, 코드에 키를 박지 않음.
(async function init() {
  const current = await window.agentAPI.getSettings();
  document.getElementById("mistral").value = current.MISTRAL_API_KEY || "";
  document.getElementById("gemini").value = current.GEMINI_API_KEY || "";
  document.getElementById("groq").value = current.GROQ_API_KEY || "";
  document.getElementById("naverId").value = current.NAVER_CLIENT_ID || "";
  document.getElementById("naverSecret").value = current.NAVER_CLIENT_SECRET || "";
  document.getElementById("factcheck").value = current.GOOGLE_FACTCHECK_API_KEY || "";
})();

document.getElementById("save").addEventListener("click", async () => {
  const payload = {
    MISTRAL_API_KEY: document.getElementById("mistral").value.trim(),
    GEMINI_API_KEY: document.getElementById("gemini").value.trim(),
    GROQ_API_KEY: document.getElementById("groq").value.trim(),
    NAVER_CLIENT_ID: document.getElementById("naverId").value.trim(),
    NAVER_CLIENT_SECRET: document.getElementById("naverSecret").value.trim(),
    GOOGLE_FACTCHECK_API_KEY: document.getElementById("factcheck").value.trim(),
  };
  await window.agentAPI.saveSettings(payload);
  document.getElementById("status").textContent = "저장됨. 앱을 재시작하면 반영됩니다.";
});
