const scheduleAdjustmentStyle = document.createElement("style");
scheduleAdjustmentStyle.textContent = `
  .schedule-adjust-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .lesson-card.canceled {
    border-left-color: var(--red);
    background: #fff7f2;
    opacity: 0.86;
  }

  .adjustment-list {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    padding: 14px;
    margin-bottom: 14px;
    display: grid;
    gap: 10px;
  }

  .adjustment-row {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px;
    display: grid;
    gap: 5px;
    background: #f8fafc;
  }
`;
document.head.appendChild(scheduleAdjustmentStyle);

const scheduleAdjustDialog = document.createElement("dialog");
scheduleAdjustDialog.id = "scheduleAdjustDialog";
scheduleAdjustDialog.className = "dialog";
document.body.appendChild(scheduleAdjustDialog);

function ensureScheduleAdjustmentData() {
  if (!Array.isArray(appState.scheduleAdjustments)) appState.scheduleAdjustments = [];
}

const baseStatusToneForScheduleAdjustment = statusTone;
statusTone = function statusToneWithScheduleAdjustment(value) {
  if (value === "已取消") return "red";
  if (["已调课", "已安排", "补课"].includes(value)) return "amber";
  return baseStatusToneForScheduleAdjustment(value);
};

function scheduleAdjustmentByLesson(lessonId) {
  ensureScheduleAdjustmentData();
  return appState.scheduleAdjustments.filter((item) => item.lessonId === lessonId || item.newLessonId === lessonId);
}

function lessonSnapshot(lesson) {
  return {
    id: lesson.id,
    date: lesson.date,
    day: lesson.day,
    time: lesson.time,
    type: lesson.type,
    target: lesson.target,
    subject: lesson.subject,
    teacher: lesson.teacher,
    room: lesson.room,
    status: lesson.status
  };
}

function nextIsoDate(value, days = 7) {
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function splitLessonTime(lesson) {
  const [start = "18:30", end = "20:00"] = text(lesson.time).split("-");
  return { start: start.trim(), end: end.trim() };
}

function lessonAdjustmentSummary(lesson) {
  const latest = scheduleAdjustmentByLesson(lesson.id)[0];
  if (!latest) return "";
  return `${latest.type}：${latest.reason || "无备注"}`;
}

function renderRecentScheduleAdjustments() {
  ensureScheduleAdjustmentData();
  const rows = appState.scheduleAdjustments.slice(0, 4).map(
    (item) => `<div class="adjustment-row">
      <strong>${escapeHtml(item.type)} ${escapeHtml(item.target)} ${tag(item.status || "已记录", item.type === "取消课程" ? "red" : "amber")}</strong>
      <span class="muted">${escapeHtml(item.beforeDate)} ${escapeHtml(item.beforeTime)} -> ${escapeHtml(item.afterDate || "-")} ${escapeHtml(item.afterTime || "-")}</span>
      <span class="muted">${escapeHtml(item.reason || "无备注")} · ${escapeHtml(item.operator)}</span>
    </div>`
  );
  return `
    <div class="adjustment-list">
      <div class="quality-head">
        <div>
          <strong>调课与补课记录</strong>
          <div class="muted">记录取消课程、临时调课和补课安排，便于前台与老师对账。</div>
        </div>
        ${tag(`${appState.scheduleAdjustments.length} 条记录`, appState.scheduleAdjustments.length ? "amber" : "green")}
      </div>
      ${rows.join("") || `<div class="stack-item"><span class="muted">暂无调课、取消或补课记录。</span></div>`}
    </div>`;
}

function injectScheduleAdjustmentControls() {
  const sectionBody = appContent.querySelector(".section-body");
  const board = appContent.querySelector(".board");
  if (!sectionBody || !board) return;

  const batchForm = appContent.querySelector("#batchScheduleForm");
  if (!appContent.querySelector(".adjustment-list")) {
    (batchForm || board).insertAdjacentHTML(batchForm ? "afterend" : "beforebegin", renderRecentScheduleAdjustments());
  }

  appContent.querySelectorAll("[data-finish-lesson]").forEach((finishButton) => {
    const lessonId = finishButton.dataset.finishLesson;
    const lesson = appState.lessons.find((item) => item.id === lessonId);
    const card = finishButton.closest(".lesson-card");
    if (!lesson || !card || card.querySelector(".schedule-adjust-actions")) return;

    const isFinished = lesson.status === "已上课";
    const isCanceled = lesson.status === "已取消";
    if (isCanceled) card.classList.add("canceled");
    if (isCanceled || isFinished) finishButton.disabled = true;
    const attendanceButton = card.querySelector("[data-attendance-lesson]");
    if (attendanceButton && isCanceled) attendanceButton.disabled = true;

    const summary = lessonAdjustmentSummary(lesson);
    finishButton.closest(".attendance-actions")?.insertAdjacentHTML(
      "afterend",
      `<div class="schedule-adjust-actions">
        <button class="small-button" type="button" data-schedule-adjust="reschedule" data-lesson-id="${escapeHtml(lesson.id)}" ${isFinished || isCanceled ? "disabled" : ""}>调课</button>
        <button class="small-button" type="button" data-schedule-adjust="cancel" data-lesson-id="${escapeHtml(lesson.id)}" ${isFinished || isCanceled ? "disabled" : ""}>取消</button>
        <button class="small-button" type="button" data-schedule-adjust="makeup" data-lesson-id="${escapeHtml(lesson.id)}">补课</button>
      </div>
      ${summary ? `<span class="muted">${escapeHtml(summary)}</span>` : ""}`
    );
  });
}

function scheduleAdjustmentConflict(candidate) {
  const conflicts = findLessonConflicts(candidate).filter((item) => item.status !== "已取消");
  return conflicts;
}

function adjustmentDialogTitle(kind) {
  if (kind === "cancel") return ["取消课程", "记录取消原因，取消后不再允许确认上课。"];
  if (kind === "makeup") return ["安排补课", "为本次课程生成一节新的补课课节。"];
  return ["临时调课", "修改日期、时间、老师或教室，并保留变更记录。"];
}

function renderScheduleAdjustmentDialog(kind, lessonId) {
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson) return;
  const [title, help] = adjustmentDialogTitle(kind);
  const time = splitLessonTime(lesson);
  const isCancel = kind === "cancel";
  const defaultDate = kind === "makeup" ? nextIsoDate(lesson.date) : lesson.date;

  scheduleAdjustDialog.innerHTML = `
    <form method="dialog" id="scheduleAdjustForm" data-kind="${escapeHtml(kind)}" data-lesson-id="${escapeHtml(lesson.id)}">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">课表异常处理</p>
          <h3>${escapeHtml(title)}</h3>
          <span class="muted">${escapeHtml(lesson.target)} · ${escapeHtml(lesson.date)} ${escapeHtml(lesson.time)}</span>
        </div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <div class="form-grid">
        <label>上课日期<input name="date" type="date" value="${escapeHtml(defaultDate)}" ${isCancel ? "disabled" : "required