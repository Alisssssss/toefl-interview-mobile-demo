const DATA_URL = "./data/interview-data.json";
const STORAGE_KEY = "speak40-progress-v1";
const HIGHLIGHT_STORAGE_KEY = "speak40-highlights-v1";
const MAX_SECONDS = 45;

const TOPIC_LABELS = {
  Z001: "Health", Z002: "Exercise", Z003: "Art", Z004: "Music",
  Z005: "Culture", Z006: "Hobbies", Z007: "Movies", Z008: "School",
  Z009: "Finance", Z010: "Tech", Z011: "Goals", Z012: "E-learning",
  Z013: "Eco Life", Z014: "Education", Z015: "Work", Z016: "Reading",
  Z017: "Commute", Z018: "Social", Z019: "Sports", Z020: "Spending",
  Z021: "Holidays", Z022: "Grocery", Z023: "Recycling", Z024: "E-shopping",
  Z025: "Gardening", Z026: "Friends", Z027: "Shopping", Z028: "Volunteer",
  Z029: "Achievement", Z030: "Sleep", Z031: "Transit", Z032: "Time",
  Z033: "Travel", Z034: "Dining", Z035: "Nutrition", Z036: "Fashion",
  Z037: "Career", Z038: "Planning", Z039: "Organize", Z040: "Devices"
};

const state = {
  data: null,
  currentSet: null,
  currentQuestion: 0,
  mediaRecorder: null,
  mediaStream: null,
  timerId: null,
  startedAt: 0,
  chunks: [],
  activeRecorder: null,
  objectUrls: new Set(),
  progress: loadStoredObject(STORAGE_KEY),
  highlights: loadStoredObject(HIGHLIGHT_STORAGE_KEY)
};

const el = {
  home: document.querySelector("#homeView"),
  practice: document.querySelector("#practiceView"),
  setGrid: document.querySelector("#setGrid"),
  totalAnswers: document.querySelector("#totalAnswers"),
  completedSets: document.querySelector("#completedSets"),
  back: document.querySelector("#backButton"),
  setId: document.querySelector("#practiceSetId"),
  title: document.querySelector("#practiceTitle"),
  roundBadge: document.querySelector("#setRoundBadge"),
  scenario: document.querySelector("#scenarioText"),
  track: document.querySelector("#questionTrack"),
  dots: document.querySelector("#questionDots"),
  about: document.querySelector("#aboutDialog"),
  aboutButton: document.querySelector("#aboutButton"),
  closeAbout: document.querySelector("#closeAbout"),
  toast: document.querySelector("#toast")
};

init();

async function init() {
  wireStaticEvents();
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    renderHome();
    const requestedSetId = location.hash.replace("#", "");
    if (state.data.sets.some(set => set.set_id === requestedSetId)) openSet(requestedSetId, false);
  } catch (error) {
    el.setGrid.innerHTML = `<div class="error-card"><strong>数据文件未能载入。</strong><br>请不要直接双击 HTML；在项目目录启动本地服务器后访问，例如：<br><code>python3 -m http.server 8012</code></div>`;
    console.error(error);
  }
}

function wireStaticEvents() {
  el.back.addEventListener("click", showHome);
  el.aboutButton.addEventListener("click", () => el.about.showModal());
  el.closeAbout.addEventListener("click", () => el.about.close());
  el.about.addEventListener("click", event => {
    if (event.target === el.about) el.about.close();
  });
  window.addEventListener("popstate", () => {
    const setId = location.hash.replace("#", "");
    if (state.data?.sets.some(set => set.set_id === setId)) openSet(setId, false);
    else showHome(false);
  });
}

function loadStoredObject(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch { return {}; }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function saveHighlights() {
  localStorage.setItem(HIGHLIGHT_STORAGE_KEY, JSON.stringify(state.highlights));
}

function questionCounts(setId) {
  const counts = state.progress[setId] || [0, 0, 0, 0];
  return [0, 1, 2, 3].map(index => Number(counts[index]) || 0);
}

function getSetProgress(setId) {
  const counts = questionCounts(setId);
  const rounds = Math.min(...counts);
  const partial = counts.filter(value => value > rounds).length;
  return { counts, rounds, partial, total: counts.reduce((sum, value) => sum + value, 0) };
}

function renderHome() {
  const sets = state.data.sets;
  el.setGrid.innerHTML = sets.map((set, index) => {
    const p = getSetProgress(set.set_id);
    const level = Math.min(p.rounds, 4);
    const partial = p.partial * 25;
    const label = p.rounds > 0 ? `${p.rounds} 轮完成` : `${p.partial} / 4 本轮`;
    return `
      <button class="set-button level-${level}" style="--partial:${partial}%; animation-delay:${Math.min(index * 18, 360)}ms" data-set-id="${set.set_id}" type="button">
        <span class="set-number">${set.set_id}</span>
        <strong class="set-topic">${TOPIC_LABELS[set.set_id] || set.title}</strong>
        <span class="set-progress"><span>${label}</span><span class="mini-dots">${p.counts.map(count => `<i class="${count > p.rounds ? "done" : ""}"></i>`).join("")}</span></span>
      </button>`;
  }).join("");

  el.setGrid.querySelectorAll(".set-button").forEach(button => {
    button.addEventListener("click", () => openSet(button.dataset.setId));
  });

  const allProgress = sets.map(set => getSetProgress(set.set_id));
  el.totalAnswers.textContent = allProgress.reduce((sum, item) => sum + item.total, 0);
  el.completedSets.textContent = allProgress.filter(item => item.rounds >= 1).length;
}

function openSet(setId, updateHistory = true) {
  state.currentSet = state.data.sets.find(set => set.set_id === setId);
  if (!state.currentSet) return;
  if (updateHistory) history.pushState({ setId }, "", `#${setId}`);
  renderPractice();
  el.home.hidden = true;
  el.practice.hidden = false;
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderPractice() {
  const set = state.currentSet;
  const p = getSetProgress(set.set_id);
  el.setId.textContent = set.set_id;
  el.title.textContent = set.title;
  el.scenario.textContent = set.scenario_prompt;
  el.roundBadge.textContent = `第 ${p.rounds + 1} 轮`;

  el.dots.innerHTML = set.tasks.map((_, index) => `<button class="question-dot ${index === 0 ? "active" : ""}" type="button" aria-label="前往第${index + 1}题" data-index="${index}"></button>`).join("");
  el.track.innerHTML = set.tasks.map((task, index) => questionCard(set.set_id, task, index, p.counts[index])).join("");

  el.dots.querySelectorAll("button").forEach(dot => {
    dot.addEventListener("click", () => scrollToQuestion(Number(dot.dataset.index)));
  });
  el.track.querySelectorAll(".record-button").forEach(button => button.addEventListener("click", () => toggleRecording(button)));
  el.track.querySelectorAll(".answer-bulb").forEach(button => button.addEventListener("click", () => toggleAnswer(button)));
  el.track.querySelectorAll(".sample-text").forEach(sample => {
    sample.addEventListener("pointerup", () => window.setTimeout(() => captureHighlight(sample), 30));
    sample.addEventListener("touchend", () => window.setTimeout(() => captureHighlight(sample), 80), { passive: true });
    sample.addEventListener("click", event => {
      const mark = event.target.closest("mark");
      if (mark && window.getSelection()?.isCollapsed) removeHighlight(sample, Number(mark.dataset.start), Number(mark.dataset.end));
    });
  });
  el.track.addEventListener("scroll", updateActiveQuestion, { passive: true });
  state.currentQuestion = 0;
}

function questionCard(setId, task, index, attempts) {
  const tags = [...(task.material_tags || []), ...(task.reason_tags || [])];
  const responses = task.model_responses || [];
  return `
    <article class="question-card" data-question-index="${index}">
      <div class="question-card-head">
        <span class="question-index">QUESTION ${index + 1} / 4</span>
        <span class="attempt-count">已回答 <b>${attempts}</b> 次</span>
      </div>
      <p class="question-text">${escapeHtml(task.question)}</p>
      <button class="answer-bulb" type="button" aria-expanded="false" aria-label="展开第${index + 1}题范答">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M8.5 15.5c-1.5-1.1-2.5-3-2.5-5a6 6 0 1 1 12 0c0 2-1 3.9-2.5 5-.6.4-.9 1-.9 1.5H9.4c0-.5-.3-1.1-.9-1.5Z"/><path d="M12 1V0M4.2 3.2l-.8-.8M19.8 3.2l.8-.8M3 10H1M23 10h-2"/></svg>
      </button>
      <div class="tag-list">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      <section class="answer-panel" hidden aria-label="第${index + 1}题范答">
        <div class="answer-panel-head"><strong>Model response</strong><span>拖选文字即可留下高亮</span></div>
        ${responses.map((response, sampleIndex) => sampleBlock(setId, index, sampleIndex, response, responses.length)).join("")}
        <p class="highlight-help">再次点击黄色高亮片段即可取消。标记保存在当前浏览器。</p>
      </section>
      <div class="recorder">
        <div class="record-row">
          <button class="record-button" type="button" data-set-id="${setId}" data-question-index="${index}" aria-label="开始45秒录音">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>
            <span class="stop-icon"></span>
          </button>
          <div class="timer"><strong>45</strong><span>SECONDS · 点击开始</span></div>
        </div>
        <audio class="playback" controls hidden></audio>
        <p class="recorder-note">录音仅在本页临时保存；完成后计入训练进度。</p>
      </div>
    </article>`;
}

function sampleBlock(setId, questionIndex, sampleIndex, text, sampleCount) {
  const key = highlightKey(setId, questionIndex, sampleIndex);
  const label = sampleCount > 1 ? `SAMPLE ${sampleIndex + 1}` : "SAMPLE";
  return `<div class="sample-block"><span class="sample-label">${label}</span><p class="sample-text" data-highlight-key="${key}">${renderHighlightedText(text, state.highlights[key] || [])}</p></div>`;
}

function toggleAnswer(button) {
  const panel = button.closest(".question-card").querySelector(".answer-panel");
  const willOpen = panel.hidden;
  panel.hidden = !willOpen;
  button.setAttribute("aria-expanded", String(willOpen));
  button.setAttribute("aria-label", `${willOpen ? "收起" : "展开"}本题范答`);
  if (willOpen) window.setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
}

function highlightKey(setId, questionIndex, sampleIndex) {
  return `${setId}-${questionIndex}-${sampleIndex}`;
}

function getSampleSource(sample) {
  const [, questionIndex, sampleIndex] = sample.dataset.highlightKey.match(/^Z\d{3}-(\d+)-(\d+)$/) || [];
  return state.currentSet?.tasks[Number(questionIndex)]?.model_responses?.[Number(sampleIndex)] || "";
}

function captureHighlight(sample) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!sample.contains(range.startContainer) || !sample.contains(range.endContainer)) return;

  const prefix = range.cloneRange();
  prefix.selectNodeContents(sample);
  prefix.setEnd(range.startContainer, range.startOffset);
  let start = prefix.toString().length;
  let end = start + range.toString().length;
  while (start < end && /\s/.test(getSampleSource(sample)[start] || "")) start += 1;
  while (end > start && /\s/.test(getSampleSource(sample)[end - 1] || "")) end -= 1;
  selection.removeAllRanges();
  if (end <= start) return;

  const key = sample.dataset.highlightKey;
  const current = normalizeRanges(state.highlights[key] || [], getSampleSource(sample).length);
  const insideExisting = current.find(([a, b]) => start >= a && end <= b);
  if (insideExisting) {
    state.highlights[key] = current.filter(rangeItem => rangeItem !== insideExisting);
  } else {
    let mergedStart = start;
    let mergedEnd = end;
    const untouched = [];
    current.forEach(([a, b]) => {
      if (b < mergedStart || a > mergedEnd) untouched.push([a, b]);
      else { mergedStart = Math.min(mergedStart, a); mergedEnd = Math.max(mergedEnd, b); }
    });
    state.highlights[key] = [...untouched, [mergedStart, mergedEnd]].sort((a, b) => a[0] - b[0]);
  }
  saveHighlights();
  repaintSample(sample);
}

function removeHighlight(sample, start, end) {
  const key = sample.dataset.highlightKey;
  state.highlights[key] = (state.highlights[key] || []).filter(([a, b]) => a !== start || b !== end);
  saveHighlights();
  repaintSample(sample);
}

function repaintSample(sample) {
  const source = getSampleSource(sample);
  sample.innerHTML = renderHighlightedText(source, state.highlights[sample.dataset.highlightKey] || []);
}

function normalizeRanges(ranges, textLength) {
  return ranges
    .filter(range => Array.isArray(range) && range.length === 2)
    .map(([start, end]) => [Math.max(0, Number(start)), Math.min(textLength, Number(end))])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);
}

function renderHighlightedText(text, ranges) {
  const cleanRanges = normalizeRanges(ranges, text.length);
  let cursor = 0;
  let html = "";
  cleanRanges.forEach(([start, end]) => {
    if (start < cursor) return;
    html += escapeHtml(text.slice(cursor, start));
    html += `<mark data-start="${start}" data-end="${end}" title="点击取消高亮">${escapeHtml(text.slice(start, end))}</mark>`;
    cursor = end;
  });
  return html + escapeHtml(text.slice(cursor));
}

function scrollToQuestion(index) {
  const card = el.track.children[index];
  card?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
}

function updateActiveQuestion() {
  const cards = [...el.track.children];
  const trackLeft = el.track.getBoundingClientRect().left;
  let nearest = 0;
  let distance = Infinity;
  cards.forEach((card, index) => {
    const value = Math.abs(card.getBoundingClientRect().left - trackLeft);
    if (value < distance) { distance = value; nearest = index; }
  });
  state.currentQuestion = nearest;
  el.dots.querySelectorAll("button").forEach((dot, index) => dot.classList.toggle("active", index === nearest));
}

async function toggleRecording(button) {
  if (state.mediaRecorder?.state === "recording") {
    if (state.activeRecorder === button) stopRecording();
    else showToast("请先结束当前录音");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showToast("当前浏览器不支持录音，请使用新版 Safari 或 Chrome");
    return;
  }

  try {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.chunks = [];
    state.mediaRecorder = new MediaRecorder(state.mediaStream);
    state.activeRecorder = button;
    state.startedAt = Date.now();
    state.mediaRecorder.addEventListener("dataavailable", event => { if (event.data.size) state.chunks.push(event.data); });
    state.mediaRecorder.addEventListener("stop", finishRecording, { once: true });
    state.mediaRecorder.start();
    button.classList.add("recording");
    button.setAttribute("aria-label", "停止录音");
    tickTimer();
    state.timerId = window.setInterval(tickTimer, 100);
  } catch (error) {
    showToast("需要允许麦克风权限才能录音");
    console.error(error);
  }
}

function tickTimer() {
  if (!state.activeRecorder) return;
  const elapsed = Math.min((Date.now() - state.startedAt) / 1000, MAX_SECONDS);
  const remaining = Math.max(0, Math.ceil(MAX_SECONDS - elapsed));
  const recorder = state.activeRecorder.closest(".recorder");
  recorder.querySelector(".timer strong").textContent = String(remaining).padStart(2, "0");
  recorder.querySelector(".timer span").textContent = "SECONDS · 正在录音";
  state.activeRecorder.style.setProperty("--timer", `${elapsed / MAX_SECONDS * 360}deg`);
  if (elapsed >= MAX_SECONDS) stopRecording();
}

function stopRecording() {
  if (state.mediaRecorder?.state === "recording") state.mediaRecorder.stop();
  window.clearInterval(state.timerId);
  state.timerId = null;
}

function finishRecording() {
  const button = state.activeRecorder;
  if (!button) return;
  const elapsed = (Date.now() - state.startedAt) / 1000;
  const recorder = button.closest(".recorder");
  const audio = recorder.querySelector(".playback");
  const mimeType = state.mediaRecorder?.mimeType || "audio/webm";
  const blob = new Blob(state.chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  state.objectUrls.add(url);
  if (audio.src) URL.revokeObjectURL(audio.src);
  audio.src = url;
  audio.hidden = false;
  button.classList.remove("recording");
  button.style.setProperty("--timer", "0deg");
  button.setAttribute("aria-label", "重新录音45秒");
  recorder.querySelector(".timer strong").textContent = "45";
  recorder.querySelector(".timer span").textContent = `已录 ${Math.max(1, Math.round(elapsed))} 秒 · 可回放`;

  state.mediaStream?.getTracks().forEach(track => track.stop());
  state.mediaStream = null;
  state.mediaRecorder = null;
  state.activeRecorder = null;

  if (elapsed >= 1) {
    const setId = button.dataset.setId;
    const index = Number(button.dataset.questionIndex);
    const counts = questionCounts(setId);
    counts[index] += 1;
    state.progress[setId] = counts;
    saveProgress();
    const attempts = button.closest(".question-card").querySelector(".attempt-count b");
    attempts.textContent = counts[index];
    const p = getSetProgress(setId);
    el.roundBadge.textContent = `第 ${p.rounds + 1} 轮`;
    showToast(p.rounds > 0 && p.partial === 0 ? `完成第 ${p.rounds} 轮！` : `Question ${index + 1} 已记录`);
  }
}

function showHome(updateHistory = true) {
  stopRecording();
  state.mediaStream?.getTracks().forEach(track => track.stop());
  state.mediaStream = null;
  state.activeRecorder = null;
  el.practice.hidden = true;
  el.home.hidden = false;
  renderHome();
  window.scrollTo({ top: 0, behavior: "instant" });
  if (updateHistory && location.hash) history.pushState({}, "", location.pathname);
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => el.toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

window.addEventListener("beforeunload", () => {
  state.objectUrls.forEach(url => URL.revokeObjectURL(url));
  state.mediaStream?.getTracks().forEach(track => track.stop());
});
