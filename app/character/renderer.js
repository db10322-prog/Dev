// T-4 — 캐릭터 클릭 → 말풍선 → 수락 시 분석 요청 → 결과 창은 main.js가 별도로 표시.
const character = document.getElementById("character");
const bubble = document.getElementById("bubble");
const bubbleText = document.getElementById("bubble-text");
const statusEl = document.getElementById("status");
const btnAccept = document.getElementById("btn-accept");
const btnDecline = document.getElementById("btn-decline");

character.addEventListener("click", () => {
  bubbleText.textContent = "현재 페이지에 있는 기사 내용을 분석할까요?";
  statusEl.textContent = "";
  bubble.classList.toggle("show");
});

btnDecline.addEventListener("click", () => {
  bubble.classList.remove("show");
});

document.getElementById("btn-settings").addEventListener("click", () => {
  window.agentAPI.openSettings();
});

btnAccept.addEventListener("click", async () => {
  btnAccept.disabled = true;
  btnDecline.disabled = true;
  character.classList.add("thinking");
  statusEl.textContent = "분석 중... (최대 20초)";
  try {
    await window.agentAPI.analyzeCurrentTab();
    statusEl.textContent = "완료! 결과 창을 확인하세요.";
    setTimeout(() => bubble.classList.remove("show"), 1500);
  } catch (err) {
    statusEl.textContent = `오류: ${err.message}`;
  } finally {
    btnAccept.disabled = false;
    btnDecline.disabled = false;
    character.classList.remove("thinking");
  }
});
