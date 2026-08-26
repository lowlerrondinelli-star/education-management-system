const scheduleAdjustmentStyle = document.createElement("style");
scheduleAdjustmentStyle.textContent = `
  .schedule-adjust-actions{display:flex;gap:8px;flex-wrap:wrap}
  .lesson-card.canceled{border-left-color:var(--red);background:#fff7f2;opacity:.86}
  .adjustment-list{border:1px solid var(--line);border-radius:8px;background:#fff;padding:14px;margin-bottom:14px;display:grid;gap:10px}
  .adjustment-row{border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:5px;background:#f8fafc}
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

function splitLessonTime(lesson) {
  const [start = "18:30", end = "20:00"] = text(lesson.time).split("-");
  return { start: start.trim(), end: end.trim() };
}

function nextIsoDate(value, days = 7) {
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function lessonSnapshot(lesson) {
  return ["id", "date", "day", "time", "type", "target", "subject", "teacher", "room", "status"].reduce((row, key) => {
    row[key] = lesson[key] || "";
    return row;
  }, {});
}

function lessonAdjustmentSummary(lesson) {
  ensureScheduleAdjustmentData();
  const latest = appState.scheduleAdjustments.find((item) => item.lessonId === lesson.id || item.newLessonId === lesson.id);
  return latest ? `${latest.type}：${latest.reason || "无备注"}` : "";
}

function appendScheduleAdjustment(item) {
  ensureScheduleAdjustmentData();
  appState.scheduleAdjustments.unshift({
    id: nextId("A"),
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    ...item
  });
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
  return `<div class="adjustment-list">
    <div class="quality-head">
      <div><strong>调课与补课记录</strong><div class="muted">记录取消课程、临时调课和补课安排，便于前台与老师对账。</div></div>
      ${tag(`${appState.scheduleAdjustments.length} 条记录`, appState.scheduleAdjustments.length ? "amber" : "green")}
    </div>
    ${rows.join("") || `<div class="stack-item"><span class="muted">暂无调课、取消或补课记录。</span></div>`}
  </div>`;
}

function injectScheduleAdjustmentControls() {
  const board = appContent.querySelector(".board");
  if (!board) return;
  const batchForm = appContent.querySelector("#batchScheduleForm");
  if (!appContent.querySelector(".adjustment-list")) {
    (batchForm || board).insertAdjacentHTML(batchForm ? "afterend" : "beforebegin", renderRecentScheduleAdjustments());
  }

  appContent.querySelectorAll("[data-finish-lesson]").forEach((finishButton) => {
    const lesson = appState.lessons.find((item) => item.id === finishButton.dataset.finishLesson);
    const card = finishButton.closest(".lesson-card");
    if (!lesson || !card || card.querySelector(".schedule-adjust-actions")) return;
    const locked = lesson.status === "已上课";
    const canceled = lesson.status === "已取消";
    if (canceled) card.classList.add("canceled");
    if (locked || canceled) finishButton.disabled = true;
    const attendanceButton = card.querySelector("[data-attendance-lesson]");
    if (attendanceButton && canceled) attendanceButton.disabled = true;
    const summary = lessonAdjustmentSummary(lesson);
    finishButton.closest(".attendance-actions")?.insertAdjacentHTML(
      "afterend",
      `<div class="schedule-adjust-actions">
        <button class="small-button" type="button" data-schedule-adjust="reschedule" data-lesson-id="${escapeHtml(lesson.id)}" ${locked || canceled ? "disabled" : ""}>调课</button>
        <button class="small-button" type="button" data-schedule-adjust="cancel" data-lesson-id="${escapeHtml(lesson.id)}" ${locked || canceled ? "disabled" : ""}>取消</button>
        <button class="small-button" type="button" data-schedule-adjust="makeup" data-lesson-id="${escapeHtml(lesson.id)}">补课</button>
      </div>${summary ? `<span class="muted">${escapeHtml(summary)}</span>` : ""}`
    );
  });
}

function renderScheduleAdjustmentDialog(kind, lessonId) {
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson) return;
  const titles = {
    reschedule: ["临时调课", "修改日期、时间、老师或教室，并保留变更记录。"],
    cancel: ["取消课程", "记录取消原因，取消后不再允许确认上课。"],
    makeup: ["安排补课", "为本次课程生成一节新的补课课节。"]
  };
  const [title, help] = titles[kind] || titles.reschedule;
  const isCancel = kind === "cancel";
  const time = splitLessonTime(lesson);
  const date = kind === "makeup" ? nextIsoDate(lesson.date) : lesson.date;
  scheduleAdjustDialog.innerHTML = `
    <form method="dialog" id="scheduleAdjustForm" data-kind="${escapeHtml(kind)}" data-lesson-id="${escapeHtml(lesson.id)}">
      <div class="dialog-head">
        <div><p class="eyebrow">课表异常处理</p><h3>${escapeHtml(title)}</h3><span class="muted">${escapeHtml(lesson.target)} · ${escapeHtml(lesson.date)} ${escapeHtml(lesson.time)}</span></div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <div class="form-grid">
        <label>上课日期<input name="date" type="date" value="${escapeHtml(date)}" ${isCancel ? "disabled" : "required"} /></label>
        <label>上课时间段<select name="timeSlot" ${isCancel ? "disabled" : ""}>${typeof lessonTimeSlotOptions === "function" ? lessonTimeSlotOptions(lesson.time || "18:30-20:00") : "<option value=\"18:30-20:00\">晚一 18:30-20:00</option>"}</select></label>
        <label>开始时间<input name="startTime" type="time" value="${escapeHtml(time.start)}" ${isCancel ? "disabled" : "required"} /></label>
        <label>结束时间<input name="endTime" type="time" value="${escapeHtml(time.end)}" ${isCancel ? "disabled" : "required"} /></label>
        <label>上课教师<select name="teacher" ${isCancel ? "disabled" : "required"}>${typeof teacherChoiceOptions === "function" ? teacherChoiceOptions(lesson.teacher) : `<option>${escapeHtml(lesson.teacher)}</option>`}</select></label>
        <label>上课教室<select name="room" ${isCancel ? "disabled" : "required"}>${typeof roomChoiceOptions === "function" ? roomChoiceOptions(lesson.room) : `<option>${escapeHtml(lesson.room)}</option>`}</select></label>
        <label>操作人<select name="operator" required>${typeof operatorChoiceOptions === "function" ? operatorChoiceOptions("前台老师") : "<option>前台老师</option>"}</select></label>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr;">
        <label>原因/备注<select name="reason" required>${typeof scheduleReasonOptions === "function" ? scheduleReasonOptions(kind, isCancel ? "学生请假或老师临时调整" : "") : `<option>${escapeHtml(isCancel ? "学生请假或老师临时调整" : "临时调整")}</option>`}</select></label>
      </div>
      <div class="dialog-actions"><span class="muted">${escapeHtml(help)}</span><button value="cancel" type="submit">取消</button><button class="primary-action" value="default" type="submit">保存</button></div>
    </form>`;
  scheduleAdjustDialog.showModal();
}

function adjustedCandidate(lesson, formData) {
  const date = text(formData.get("date"));
  return {
    ...lesson,
    date,
    day: dayFromDate(date),
    time: `${text(formData.get("startTime"))}-${text(formData.get("endTime"))}`,
    teacher: text(formData.get("teacher")).trim(),
    room: text(formData.get("room")).trim()
  };
}

function validateScheduleCandidate(candidate, actionName) {
  if (typeof isValidLessonRange === "function" && !isValidLessonRange(candidate)) {
    setNotice("schedule", "结束时间必须晚于开始时间，请调整后再保存。", "red");
    renderView();
    return false;
  }
  const conflicts = findLessonConflicts(candidate).filter((item) => item.status !== "已取消");
  if (conflicts.length) {
    setNotice("schedule", `${actionName}失败：${conflicts.map((item) => `${item.target} ${item.time}`).join("；")} 已占用。`, "red");
    renderView();
    return false;
  }
  return true;
}

function saveScheduleAdjustment(form) {
  const lesson = appState.lessons.find((item) => item.id === form.dataset.lessonId);
  if (!lesson) return;
  const formData = new FormData(form);
  const before = lessonSnapshot(lesson);
  const common = {
    lessonId: lesson.id,
    target: lesson.target,
    beforeDate: before.date,
    beforeTime: before.time,
    reason: text(formData.get("reason")).trim(),
    operator: text(formData.get("operator")).trim() || "前台老师",
    before
  };

  if (form.dataset.kind === "cancel") {
    if (lesson.status === "已上课") {
      setNotice("schedule", "已上课的课节不能取消，请在消课流水中核对处理。", "red");
      renderView();
      return;
    }
    lesson.status = "已取消";
    appendScheduleAdjustment({ ...common, type: "取消课程", status: "已取消", afterDate: "", afterTime: "", after: lessonSnapshot(lesson) });
    setNotice("schedule", `${lesson.target} ${lesson.date} ${lesson.time} 已取消。`, "amber");
  }

  if (form.dataset.kind === "reschedule") {
    if (lesson.status === "已上课" || lesson.status === "已取消") {
      setNotice("schedule", "已上课或已取消的课节不能直接调课。", "red");
      renderView();
      return;
    }
    const candidate = adjustedCandidate(lesson, formData);
    if (!validateScheduleCandidate(candidate, "调课")) return;
    Object.assign(lesson, candidate, { status: "待上课" });
    appendScheduleAdjustment({ ...common, type: "调课", status: "已调课", afterDate: lesson.date, afterTime: lesson.time, after: lessonSnapshot(lesson) });
    setNotice("schedule", `${lesson.target} 已调整到 ${lesson.date} ${lesson.time}。`);
  }

  if (form.dataset.kind === "makeup") {
    const candidate = { ...adjustedCandidate(lesson, formData), id: nextId("L"), type: "补课", status: "待上课", sourceLessonId: lesson.id };
    if (!validateScheduleCandidate(candidate, "补课")) return;
    appState.lessons.unshift(candidate);
    appendScheduleAdjustment({ ...common, type: "补课", status: "已安排", newLessonId: candidate.id, afterDate: candidate.date, afterTime: candidate.time, after: lessonSnapshot(candidate) });
    setNotice("schedule", `${lesson.target} 已安排补课：${candidate.date} ${candidate.time}。`);
  }

  saveState();
  scheduleAdjustDialog.close();
  setView("schedule");
}

function flattenScheduleAdjustmentRows() {
  ensureScheduleAdjustmentData();
  return appState.scheduleAdjustments.map((item) => ({
    id: item.id,
    type: item.type,
    status: item.status,
    lessonId: item.lessonId,
    newLessonId: item.newLessonId || "",
    target: item.target,
    beforeDate: item.beforeDate,
    beforeTime: item.beforeTime,
    afterDate: item.afterDate,
    afterTime: item.afterTime,
    reason: item.reason,
    operator: item.operator,
    createdAt: item.createdAt
  }));
}

const baseFindLessonConflictsForAdjustment = findLessonConflicts;
findLessonConflicts = function findLessonConflictsWithoutCanceled(candidate) {
  return baseFindLessonConflictsForAdjustment(candidate).filter((lesson) => lesson.status !== "已取消");
};

const baseRenderScheduleForAdjustment = renderSchedule;
renderSchedule = function renderScheduleWithAdjustment() {
  baseRenderScheduleForAdjustment();
  injectScheduleAdjustmentControls();
};

if (typeof exportDataset === "function") {
  const baseExportDatasetForAdjustment = exportDataset;
  exportDataset = function exportDatasetWithAdjustment(type) {
    if (type !== "scheduleAdjustments") {
      baseExportDatasetForAdjustment(type);
      return;
    }
    const columns = [
      ["id", "记录编号"],
      ["type", "调整类型"],
      ["status", "处理状态"],
      ["lessonId", "原课节编号"],
      ["newLessonId", "新课节编号"],
      ["target", "班级/对象"],
      ["beforeDate", "原日期"],
      ["beforeTime", "原时间"],
      ["afterDate", "新日期"],
      ["afterTime", "新时间"],
      ["reason", "原因备注"],
      ["operator", "操作人"],
      ["createdAt", "记录时间"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("调课补课记录.csv", buildCsv(flattenScheduleAdjustmentRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "调课补课记录.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForAdjustment = renderDataCenter;
  renderDataCenter = function renderDataCenterWithAdjustment() {
    baseRenderDataCenterForAdjustment();
    const metricValue = [...appContent.querySelectorAll(".metric")]
      .find((item) => item.textContent.includes("数据表数量"))
      ?.querySelector("strong");
    if (metricValue) metricValue.textContent = "19";

    const dataGrid = appContent.querySelector(".data-grid");
    if (!dataGrid || dataGrid.querySelector('[data-export="scheduleAdjustments"]')) return;
    const card = document.createElement("article");
    card.className = "data-card";
    card.innerHTML = `<div><span class="muted">调课补课记录</span><strong>${flattenScheduleAdjustmentRows().length}</strong></div><button class="small-button" type="button" data-export="scheduleAdjustments">导出调课</button>`;
    const batchCard = dataGrid.querySelector('[data-export="scheduleBatches"]')?.closest(".data-card");
    if (batchCard) {
      batchCard.after(card);
    } else {
      dataGrid.appendChild(card);
    }
  };
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-schedule-adjust]");
  if (button) renderScheduleAdjustmentDialog(button.dataset.scheduleAdjust, button.dataset.lessonId);
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "scheduleAdjustForm") return;
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  saveScheduleAdjustment(event.target);
});

ensureScheduleAdjustmentData();
if (currentView === "schedule") renderView();
