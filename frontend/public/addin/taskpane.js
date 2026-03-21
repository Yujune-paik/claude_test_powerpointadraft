/* ==========================================================
   Auto Speaker Notes – PowerPoint Web Add-in  (taskpane.js)
   ========================================================== */

// ---- Configuration ----
const API_BASE = getApiBase();

function getApiBase() {
  // In production, API is on the same origin as the add-in
  // During local dev, you can override via ?api=http://localhost:3000
  const params = new URLSearchParams(window.location.search);
  return params.get("api") || window.location.origin;
}

// ---- State ----
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let currentSlideIndex = -1;
let slidePollingTimer = null;
let slideAudioMap = new Map(); // slideIndex -> { chunks, startTime }

// ---- DOM Elements ----
const loginScreen = document.getElementById("login-screen");
const mainScreen = document.getElementById("main-screen");
const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("password-input");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

const statusBar = document.getElementById("status-bar");
const statusIcon = document.getElementById("status-icon");
const statusText = document.getElementById("status-text");
const slideLabel = document.getElementById("slide-label");
const btnStart = document.getElementById("btn-start");
const btnStop = document.getElementById("btn-stop");
const progressSection = document.getElementById("progress-section");
const progressList = document.getElementById("progress-list");
const resultsSection = document.getElementById("results-section");
const resultsSummary = document.getElementById("results-summary");
const mainError = document.getElementById("main-error");

// ---- Office.js Initialization ----
Office.onReady(function (info) {
  if (info.host === Office.HostType.PowerPoint) {
    initApp();
  }
});

function initApp() {
  // Bind events
  loginForm.addEventListener("submit", handleLogin);
  btnStart.addEventListener("click", handleStartRehearsal);
  btnStop.addEventListener("click", handleStopRehearsal);

  // Check for saved auth
  if (sessionStorage.getItem("authed") === "true") {
    showMainScreen();
  }
}

// ---- Authentication ----
async function handleLogin(e) {
  e.preventDefault();
  loginBtn.disabled = true;
  loginBtn.textContent = "確認中...";
  hideError(loginError);

  try {
    const res = await fetch(API_BASE + "/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput.value }),
    });
    const data = await res.json();

    if (data.ok) {
      sessionStorage.setItem("authed", "true");
      showMainScreen();
    } else {
      showError(loginError, data.error || "パスワードが違います");
    }
  } catch (err) {
    showError(loginError, "認証に失敗しました: " + err.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "ログイン";
  }
}

function showMainScreen() {
  loginScreen.hidden = true;
  mainScreen.hidden = false;
}

// ---- Rehearsal Flow ----
async function handleStartRehearsal() {
  hideError(mainError);
  progressSection.hidden = true;
  resultsSection.hidden = true;
  progressList.innerHTML = "";
  slideAudioMap.clear();

  try {
    // Request microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Get current slide index
    currentSlideIndex = await getCurrentSlideIndex();
    updateSlideLabel(currentSlideIndex);

    // Start MediaRecorder
    startNewRecorder(stream);

    // Start polling for slide changes
    slidePollingTimer = setInterval(pollSlideChange, 500);

    // Update UI
    isRecording = true;
    btnStart.hidden = true;
    btnStop.hidden = false;
    setStatus("recording", "🔴", "録音中 — スライド " + (currentSlideIndex + 1));
    progressSection.hidden = false;
  } catch (err) {
    showError(mainError, "マイクへのアクセスに失敗しました: " + err.message);
  }
}

async function handleStopRehearsal() {
  isRecording = false;

  // Stop polling
  if (slidePollingTimer) {
    clearInterval(slidePollingTimer);
    slidePollingTimer = null;
  }

  // Stop current recording and save
  const blob = await stopCurrentRecorder();
  if (blob && currentSlideIndex >= 0) {
    addSlideAudio(currentSlideIndex, blob);
  }

  // Update UI
  btnStart.hidden = false;
  btnStop.hidden = true;
  setStatus("processing", "⏳", "ノートを生成中...");

  // Process all recorded slides
  await processAllSlides();

  setStatus("done", "✅", "完了！");
  resultsSection.hidden = false;
  const count = slideAudioMap.size;
  resultsSummary.textContent = count + " 枚のスライドにノートを書き込みました";
}

// ---- Audio Recording ----
function startNewRecorder(stream) {
  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: getSupportedMimeType(),
  });
  mediaRecorder.ondataavailable = function (e) {
    if (e.data.size > 0) {
      audioChunks.push(e.data);
    }
  };
  mediaRecorder.start(200); // collect data every 200ms
}

function stopCurrentRecorder() {
  return new Promise(function (resolve) {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      resolve(null);
      return;
    }
    mediaRecorder.onstop = function () {
      const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      audioChunks = [];
      // Resolve with blob only if it has meaningful data
      resolve(blob.size > 0 ? blob : null);
    };
    mediaRecorder.stop();
  });
}

function getSupportedMimeType() {
  var types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (var i = 0; i < types.length; i++) {
    if (MediaRecorder.isTypeSupported(types[i])) return types[i];
  }
  return "";
}

// ---- Slide Change Detection ----
async function pollSlideChange() {
  if (!isRecording) return;

  try {
    const newIndex = await getCurrentSlideIndex();
    if (newIndex !== currentSlideIndex && newIndex >= 0) {
      await onSlideChanged(newIndex);
    }
  } catch (_) {
    // Ignore polling errors (e.g. during slide transition)
  }
}

async function onSlideChanged(newIndex) {
  // Stop recording for the previous slide
  const stream = mediaRecorder ? mediaRecorder.stream : null;
  const blob = await stopCurrentRecorder();

  if (blob && currentSlideIndex >= 0) {
    addSlideAudio(currentSlideIndex, blob);
  }

  // Update state
  currentSlideIndex = newIndex;
  updateSlideLabel(currentSlideIndex);
  setStatus("recording", "🔴", "録音中 — スライド " + (currentSlideIndex + 1));

  // Start recording for the new slide
  if (stream) {
    startNewRecorder(stream);
  }
}

function addSlideAudio(slideIndex, blob) {
  // If we already have audio for this slide (went back), append
  const existing = slideAudioMap.get(slideIndex);
  if (existing) {
    slideAudioMap.set(slideIndex, new Blob([existing, blob], { type: blob.type }));
  } else {
    slideAudioMap.set(slideIndex, blob);
  }
  updateProgressItem(slideIndex, "pending", "録音完了、処理待ち");
}

// ---- Process Slides: Transcribe + Generate + Write ----
async function processAllSlides() {
  var entries = Array.from(slideAudioMap.entries()).sort(function (a, b) {
    return a[0] - b[0];
  });

  for (var i = 0; i < entries.length; i++) {
    var slideIndex = entries[i][0];
    var audioBlob = entries[i][1];
    await processOneSlide(slideIndex, audioBlob);
  }
}

async function processOneSlide(slideIndex, audioBlob) {
  try {
    // 1. Transcribe
    updateProgressItem(slideIndex, "transcribing", "文字起こし中...");
    var transcript = await transcribeAudio(audioBlob, slideIndex);

    if (!transcript || !transcript.trim()) {
      updateProgressItem(slideIndex, "done", "音声なし（スキップ）");
      return;
    }

    // 2. Generate note
    updateProgressItem(slideIndex, "generating", "ノート生成中...");
    var note = await generateNote(transcript);

    // 3. Write to PowerPoint
    updateProgressItem(slideIndex, "writing", "PowerPointに書き込み中...");
    await writeNoteToSlide(slideIndex, note);

    updateProgressItem(slideIndex, "done", "完了");
  } catch (err) {
    updateProgressItem(slideIndex, "error", "エラー: " + err.message);
  }
}

// ---- API Calls ----
async function transcribeAudio(audioBlob, slideIndex) {
  var formData = new FormData();
  formData.append("audio", audioBlob, "slide_" + slideIndex + ".webm");
  formData.append("slide_index", slideIndex.toString());
  formData.append("language", "ja");

  var res = await fetch(API_BASE + "/api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    var errData = await res.json().catch(function () { return {}; });
    throw new Error(errData.detail || "Transcription failed");
  }

  var data = await res.json();
  return data.transcript;
}

async function generateNote(transcript) {
  var res = await fetch(API_BASE + "/api/generate-notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slide_text: "",
      transcript: transcript,
      model: "gpt-4o",
    }),
  });

  if (!res.ok) {
    var errData = await res.json().catch(function () { return {}; });
    throw new Error(errData.detail || "Note generation failed");
  }

  var data = await res.json();
  return data.note;
}

// ---- PowerPoint API ----
function getCurrentSlideIndex() {
  return new Promise(function (resolve, reject) {
    Office.context.document.getSelectedDataAsync(
      Office.CoercionType.SlideRange,
      function (result) {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          // result.value.slides is an array of { id, title, index }
          var slides = result.value.slides;
          if (slides && slides.length > 0) {
            // index is 1-based in Office.js
            resolve(slides[0].index - 1);
          } else {
            resolve(-1);
          }
        } else {
          reject(new Error(result.error.message));
        }
      }
    );
  });
}

async function writeNoteToSlide(slideIndex, noteText) {
  return PowerPoint.run(async function (context) {
    var slides = context.presentation.slides;
    slides.load("items");
    await context.sync();

    if (slideIndex >= slides.items.length) {
      throw new Error("スライド " + (slideIndex + 1) + " が見つかりません");
    }

    var slide = slides.items[slideIndex];
    var notesSlide = slide.notesSlide;
    notesSlide.load("shapes");
    await context.sync();

    // The notes slide has a shape (usually index 1) that contains the notes text
    var shapes = notesSlide.shapes;
    shapes.load("items");
    await context.sync();

    // Find the text body shape in notes (typically the second shape, after slide image)
    var notesBody = null;
    for (var i = 0; i < shapes.items.length; i++) {
      var shape = shapes.items[i];
      if (shape.type === "Placeholder" || shape.type === PowerPoint.ShapeType.placeholder) {
        shape.textFrame.load("textRange");
        await context.sync();
        // The notes text placeholder is usually placeholderType "body"
        notesBody = shape;
        break;
      }
    }

    if (notesBody) {
      notesBody.textFrame.textRange.text = noteText;
    } else {
      // Fallback: try to set text on the first available shape with a text frame
      for (var j = 0; j < shapes.items.length; j++) {
        try {
          shapes.items[j].textFrame.textRange.text = noteText;
          break;
        } catch (_) {
          continue;
        }
      }
    }

    await context.sync();
  });
}

// ---- UI Helpers ----
function setStatus(state, icon, text) {
  statusBar.className = "status-bar " + state;
  statusIcon.textContent = icon;
  statusText.textContent = text;
}

function updateSlideLabel(index) {
  slideLabel.textContent = "スライド: " + (index >= 0 ? index + 1 : "--");
}

function updateProgressItem(slideIndex, state, detail) {
  var id = "progress-slide-" + slideIndex;
  var el = document.getElementById(id);

  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.className = "progress-item";
    el.innerHTML =
      '<span class="icon"></span>' +
      '<span class="label">スライド ' + (slideIndex + 1) + "</span>" +
      '<span class="detail"></span>';
    progressList.appendChild(el);
  }

  el.className = "progress-item " + state;
  el.querySelector(".detail").textContent = detail;
}

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}

function hideError(el) {
  el.textContent = "";
  el.hidden = true;
}
