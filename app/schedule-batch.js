const scheduleBatchStyle = document.createElement("style");
scheduleBatchStyle.textContent = `
  .schedule-batch {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 14px;
    background: #fbfdff;
    display: grid;
    gap: 12px;
  }

  .weekday-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .weekday-option {
    min-height: 36px;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #fff;
    color: var(--ink);
    font-weight: 700;
  }

  .weekday-option input {
    width: 16px;
    height: 16px;
  }

  .batch-history {
    display: grid;
    gap: 8px;
  }

  .batch-history-item {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px;
    background: #fff;
    display: grid;
    gap: 5px;
  }
`;
document.head.appendChild(scheduleBatchStyle);

const scheduleWeekdays = ["周一", "周二", "周三", "周四", "周五"];

function ensureScheduleBatchData() {
  if (!Array.isArray(appState.scheduleBatches)) appState.scheduleBatches = [];
}

function dateFromIso(value) {
  return new Date(`${value}T00:00:00`);
}

function isoFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function defaultBatchDates() {
  const start = dateFromIso("2026-09-07");
  return {
    start: isoFromDate(start),
    end: isoFromDate(addDays(start, 27))
  };
}

function weekdayCheckboxes() {
  return scheduleWeekdays
    .map(
      (day, index) => `<label class="weekday-option">
        <input type="checkbox" name="weekdays" value="${day}" ${index === 0 ? "checked" : ""} />
        ${day}
      </label>`
    )
    .join("");
}

function batchSubjectValue(classItem = {}) {
  const source = [classItem.name, classItem.course, classItem.subject].map(text).join(" ");
  if (source.includes("语文")) return "语文";
  if (source.includes("英语")) return "英语";
  if (source.includes("物理")) return "物理";
  if (source.includes("化学")) return "化学";
  if (source.includes("数学")) return "数学";
  return text(classItem.course).trim() || "课程";
}

function flattenScheduleBatchRows() {
  ensureScheduleBatchData();
  return appState.scheduleBatches.map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    target: item.target,
    subject: item.subject,
    teacher: item.teacher,
    room: item.room,
    dateRange: `${item.startDate} 至 ${item.endDate}`,
    weekdays: item.weekdays.join("、"),
    time: item.time,
    createdCount: item.createdCount,
    skippedCount: item.skippedCount,
    skippedDetail: item.skippedDetail,
    operator: item.operator
  }));
}

function createBatchLessonCandidates(formData) {
  const target = text(formData.get("target"));
  const classItem = getClass(target);
  const startDate = text(formData.get("startDate"));
  const endDate = text(formData.get("endDate"));
  const startTime = text(formData.get("startTime"));
  const endTime = text(formData.get("endTime"));
  const weekdays = formData.getAll("weekdays").map(text);
  const subject = text(formData.get("subject")).trim() || classItem?.course || "课程";
  const teacher = text(formData.get("teacher")).trim() || classItem?.teacher || "任课老师";
  const room = text(formData.get("room")).trim() || classItem?.room || "默认教室";
  const type = text(formData.get("type")) || "班级课";

  const firstDate = dateFromIso(startDate);
  const lastDate = dateFromIso(endDate);
  if (!target || !Number.isFinite(firstDate.getTime()) || !Number.isFinite(lastDate.getTime()) || firstDate > lastDate || !weekdays.length) return [];

  const candidates = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    const isoDate = isoFromDate(date);
    const day = dayFromDate(isoDate);
    if (!weekdays.includes(day)) continue;
    candidates.push({
      id: `${nextId("L")}${String(candidates.length + 1).padStart(2, "0")}`,
      day,
      date: isoDate,
      time: `${startTime}-${endTime}`,
      type,
      target,
      subject,
      teacher,
      room,
      status: "待上课",
      deduct: Number(classItem?.deduct || 1)
    });
  }
  return candidates;
}

function renderBatchSchedulePanel() {
  ensureScheduleBatchData();
  const dates = defaultBatchDates();
  const defaultClass = appState.classes.find((item) => item.status === "开课中") || appState.classes[0] || {};
  const historyRows = appState.scheduleBatches.slice(0, 3).map(
    (item) => `<div class="batch-history-item">
      <strong>${escapeHtml(item.target)} ${escapeHtml(item.time)} ${tag(`新增 ${item.createdCount}`, item.skippedCount ? "amber" : "green")}</strong>
      <span class="muted">${escapeHtml(item.startDate)} 至 ${escapeHtml(item.endDate)} · ${escapeHtml(item.weekdays.join("、"))} · 跳过 ${escapeHtml(item.skippedCount)} 节</span>
    </div>`
  );

  return `
    <form class="schedule-batch" id="batchScheduleForm">
      <div class="quality-head">
        <div>
          <strong>周期排课</strong>
          <div class="muted">适合秋季班、暑假班等固定每周上课安排，保存时会逐节检查教师、教室和班级冲突。</div>
        </div>
        ${tag("批量生成", "green")}
      </div>
      <div class="operation-grid">
        <label>班级/对象<select name="target" required>${classOptions(defaultClass.name)}</select></label>
        <label>开始日期<input name="startDate" type="date" value="${dates.start}" required /></label>
        <label>结束日期<input name="endDate" type="date" value="${dates.end}" required /></label>
        <label>课节类型<select name="type"><option>班级课</option><option>1对1</option></select></label>
        <label>开始时间<input name="startTime" type="time" value="18:30" required /></label>
        <label>结束时间<input name="endTime" type="time" value="20:00" required /></label>
        <label>上课教师<select name="teacher" required>${typeof teacherChoiceOptions === "function" ? teacherChoiceOptions(defaultClass.teacher || "任课老师") : `<option>${escapeHtml(defaultClass.teacher || "任课老师")}</option>`}</select></label>
        <label>上课教室<select name="room" required>${typeof roomChoiceOptions === "function" ? roomChoiceOptions(defaultClass.room || "默认教室") : `<option>${escapeHtml(defaultClass.room || "默认教室")}</option>`}</select></label>
        <label>科目<select name="subject" required>${typeof subjectChoiceOptions === "function" ? subjectChoiceOptions(batchSubjectValue(defaultClass)) : `<option>${escapeHtml(batchSubjectValue(defaultClass))}</option>`}</select></label>
      </div>
      <div class="weekday-picker" aria-label="选择星期">${weekdayCheckboxes()}</div>
      <div class="dialog-actions">
        <span class="muted">生成后会加入本周课表和排课健康检查；有冲突的课节会自动跳过。</span>
        <button class="primary-action" type="submit">生成周期课表</button>
      </div>
      <div class="batch-history">${historyRows.join("") || `<div class="stack-item"><span class="muted">还没有批量排课记录。</span></div>`}</div>
    </form>`;
}

function injectBatchSchedulePanel() {
  const lessonForm = appContent.querySelector("#lessonForm");
  if (!lessonForm || appContent.querySelector("#batchScheduleForm")) return;
  const qualityPanel = appContent.querySelector(".schedule-quality");
  (qualityPanel || lessonForm).insertAdjacentHTML("afterend", renderBatchSchedulePanel());
}

function applyBatchSchedule(form) {
  ensureScheduleBatchData();
  const formData = new FormData(form);
  const candidates = createBatchLessonCandidates(formData);
  if (!candidates.length) {
    setNotice("schedule", "请确认日期范围、星期和班级信息后再生成周期课表。", "red");
    renderView();
    return;
  }

  if (typeof isValidLessonRange === "function" && candidates.some((lesson) => !isValidLessonRange(lesson))) {
    setNotice("schedule", "结束时间必须晚于开始时间，请调整后再生成。", "red");
    renderView();
    return;
  }

  const created = [];
  const skipped = [];
  for (const candidate of candidates) {
    const conflicts = findLessonConflicts(candidate);
    if (conflicts.length) {
      skipped.push(`${candidate.date} ${candidate.time}：${conflicts.map((item) => `${item.target} ${item.reasons?.join("、") || ""}`).join("；")}`);
      continue;
    }
    appState.lessons.push(candidate);
    created.push(candidate);
  }

  const batch = {
    id: nextId("B"),
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    target: text(formData.get("target")),
    subject: text(formData.get("subject")).trim(),
    teacher: text(formData.get("teacher")).trim(),
    room: text(formData.get("room")).trim(),
    startDate: text(formData.get("startDate")),
    endDate: text(formData.get("endDate")),
    weekdays: formData.getAll("weekdays").map(text),
    time: `${text(formData.get("startTime"))}-${text(formData.get("endTime"))}`,
    createdCount: created.length,
    skippedCount: skipped.length,
    skippedDetail: skipped.join(" | "),
    operator: "前台老师"
  };
  appState.scheduleBatches.unshift(batch);
  saveState();
  setNotice("schedule", `周期排课完成：新增 ${created.length} 节，跳过 ${skipped.length} 节冲突课。`, skipped.length ? "amber" : "green");
  setView("schedule");
}

const baseRenderScheduleForBatch = renderSchedule;
renderSchedule = function renderScheduleWithBatch() {
  baseRenderScheduleForBatch();
  injectBatchSchedulePanel();
};

document.addEventListener("submit", (event) => {
  if (event.target.id !== "batchScheduleForm") return;
  event.preventDefault();
  applyBatchSchedule(event.target);
});

document.addEventListener("change", (event) => {
  if (event.target.closest("#batchScheduleForm") && event.target.name === "target") {
    const form = event.target.closest("#batchScheduleForm");
    const classItem = getClass(event.target.value);
    if (!form || !classItem) return;
    if (typeof teacherChoiceOptions === "function") form.elements.teacher.innerHTML = teacherChoiceOptions(classItem.teacher || form.elements.teacher.value);
    else form.elements.teacher.value = classItem.teacher || form.elements.teacher.value;
    if (typeof roomChoiceOptions === "function") form.elements.room.innerHTML = roomChoiceOptions(classItem.room || form.elements.room.value);
    else form.elements.room.value = classItem.room || form.elements.room.value;
    if (typeof subjectChoiceOptions === "function") form.elements.subject.innerHTML = subjectChoiceOptions(batchSubjectValue(classItem));
    else form.elements.subject.value = batchSubjectValue(classItem);
  }
});

ensureScheduleBatchData();
if (currentView === "schedule") renderView();
