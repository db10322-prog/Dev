window.agentAPI.onSetupProgress(({ downloaded, total, mirrorIndex, error }) => {
  const bar = document.getElementById("bar");
  const pct = document.getElementById("pct");
  const errorEl = document.getElementById("error");

  if (error) {
    errorEl.style.display = "block";
    errorEl.textContent = `다운로드 실패: ${error}`;
    pct.textContent = "재시도 중...";
    return;
  }
  if (!total) return;
  const p = Math.floor((downloaded / total) * 100);
  bar.style.width = `${p}%`;
  pct.textContent = `${p}% (${(downloaded / 1e6).toFixed(0)}MB / ${(total / 1e6).toFixed(0)}MB)`;
});
