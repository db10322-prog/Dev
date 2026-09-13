// T-5 — 판정 JSON을 화면에 렌더링. main.js가 "report-ready" IPC로 전달.
window.agentAPI.onReportReady((report) => renderReport(report));

function renderReport(report) {
  const badge = document.getElementById("verdict-badge");
  badge.textContent = report.verdict;
  badge.className = `verdict-badge ${report.verdict.replace(/\s/g, ".")}`;

  document.getElementById("confidence").textContent = `신뢰도 ${Math.round((report.confidence || 0) * 100)}%`;
  document.getElementById("cached-tag").style.display = report.meta?.cached ? "inline-block" : "none";

  const reasonsEl = document.getElementById("reasons");
  reasonsEl.innerHTML = "";
  (report.reasons || []).forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r;
    reasonsEl.appendChild(li);
  });

  const evidenceEl = document.getElementById("evidence");
  evidenceEl.innerHTML = "";
  (report.evidence || []).forEach((e) => {
    const div = document.createElement("div");
    div.className = "evidence-item";
    div.innerHTML = `<span class="stance ${e.stance}">${e.stance}</span><a href="${e.url}" target="_blank" rel="noopener">${e.title}</a><div class="outlet">${e.outlet}</div>`;
    evidenceEl.appendChild(div);
  });

  const biasMarker = document.getElementById("bias-marker");
  const score = report.bias?.score ?? 0; // -1(진보) ~ +1(보수)
  biasMarker.style.left = `calc(${((score + 1) / 2) * 100}% - 2px)`;

  const biasSignalsEl = document.getElementById("bias-signals");
  biasSignalsEl.innerHTML = "";
  (report.bias?.signals || []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = `[${s.layer}] ${s.label} — ${s.detail}`;
    biasSignalsEl.appendChild(li);
  });

  const counterEl = document.getElementById("counter-articles");
  counterEl.innerHTML = "";
  (report.counterArticles || []).forEach((c) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<a href="${c.url}" target="_blank" rel="noopener">${c.title}</a><div class="outlet">${c.outlet} · ${c.direction}</div>`;
    counterEl.appendChild(div);
  });

  const opinionCard = document.getElementById("opinion-card");
  if (report.opinion) {
    opinionCard.style.display = "block";
    const forPct = Math.round((report.opinion.forRatio || 0) * 100);
    const againstPct = Math.round((report.opinion.againstRatio || 0) * 100);
    document.getElementById("opinion-for").style.width = `${forPct}%`;
    document.getElementById("opinion-against").style.width = `${againstPct}%`;
    document.getElementById("opinion-alignment").textContent = `기사 논조와의 관계: ${report.opinion.alignmentWithArticle}`;
    const pointsEl = document.getElementById("opinion-points");
    pointsEl.innerHTML = "";
    (report.opinion.topPoints || []).forEach((p) => {
      const li = document.createElement("li");
      li.textContent = p;
      pointsEl.appendChild(li);
    });
  } else {
    opinionCard.style.display = "none";
  }

  const limitationsEl = document.getElementById("limitations");
  limitationsEl.innerHTML = "";
  (report.limitations || []).forEach((l) => {
    const li = document.createElement("li");
    li.textContent = l;
    limitationsEl.appendChild(li);
  });
}
