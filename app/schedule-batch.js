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

const scheduleWeekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

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
  const startValue = typeof lessonDatePresetValue === "function" ? lessonDatePresetValue("nextMonday") : "2026-09-07";
  const start = dateFromIso(startValue);
  return {
    start: isoFromDate(start),
    end: isoFromDate(addDays(start, 27))
  };
}

function scheduleBatchDateRange(startKey = "nextMonday", weeks = 4) {
  const startValue = typeof lessonDatePresetValue === "function" ? lessonDatePresetValue(startKey) : defaultBatchDates().start;
  const start = dateFromIso(startValue);
  return {
    start: isoFromDate(start),
    end: isoFromDate(addDays(start, Math.max(0, weeks * 7 - 1)))
  };
}

function scheduleBatchPlanPresets() {
  const weeknight = scheduleBatchDateRange("nextMonday", 4);
  const saturday = scheduleBatchDateRange("saturday", 4);
  const intensiveStart = typeof lessonDateOffset === "function" ? lessonDateOffset(1) : defaultBatchDates().start;
  return {
    autumnWeeknight: {
      label: "秋季每周晚一",
      startDate: weeknight.start,
      endDate: weeknight.end,
      weekdays: ["周一"],
      timeSlot: "18:30-20:00",
      type: "班级课",
      hint: "适合秋季常规班：下周一开始，连续 4 周，每周一晚一上课。"
    },
    weeknightTwice: {
      label: "每周两次晚课",
      startDate: weeknight.start,
      endDate: weeknight.end,
      weekdays: ["周一", "周三"],
      timeSlot: "18:30-20:00",
      type: "班级课",
      hint: "适合冲刺小班：下周一开始，连续 4 周，每周一、周三晚一上课。"
    },
    weekendMorning: {
      label: "周末上午强化",
      startDate: saturday.start,
      endDate: saturday.end,
      weekdays: ["周六"],
      timeSlot: "08:30-10:00",
      type: "班级课",
      hint: "适合周末班：最近周六开始，连续 4 周，每周六上午一上课。"
    },
    weekendDouble: {
      label: "周末连排",
      startDate: saturday.start,
      endDate: saturday.end,
      weekdays: ["周六", "周日"],
      timeSlot: "10:10-11:40",
      type: "班级课",
      hint: "适合短期强化：最近周六开始，连续 4 周，周六周日上午二连排。"
    },
    summerIntensive: {
      label: "暑假集训",
      startDate: intensiveStart,
      endDate: isoFromDate(addDays(dateFromIso(intensiveStart), 13)),
      weekdays: ["周一", "周二", "周三", "周四", "周五"],
      timeSlot: "13:30-15:00",
      type: "班级课",
      hint: "适合寒暑假密集班：从明天开始，两周内工作日下午一上课。"
    },
    oneToOneEvening: {
      label: "1 对 1 晚间",
      startDate: weeknight.start,
      endDate: weeknight.end,
      weekdays: ["周二"],
      timeSlot: "17:00-18:00",
      type: "1对1",
      hint: "适合固定 1 对 1：下周二开始，连续 4 周，一对一时段上课。"
    }
  };
}

function scheduleBatchPlanOptions(selectedValue = "autumnWeeknight") {
  return Object.entries(scheduleBatchPlanPresets())
    .map(([value, item]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function weekdayCheckboxes(selectedDays = ["周一"]) {
  const selected = new Set(selectedDays);
  return scheduleWeekdays
    .map(
      (day) => `<label class="weekday-option">
        <input type="checkbox" name="weekdays" value="${day}" ${selected.has(day) ? "checked" : ""} />
        ${day}
      </label>`
    )
    .join("");
}

function setBatchWeekdays(form, weekdays = []) {
  const selected = new Set(weekdays);
  form.querySelectorAll('input[name="weekdays"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function applyScheduleBatchPlan(form) {
  if (!form) return;
  const preset = scheduleBatchPlanPresets()[form.elements.batchPlan?.value] || scheduleBatchPlanPresets().autumnWeeknight;
  if (!preset) return;
  if (form.elements.startDate) form.elements.startDate.value = preset.startDate;
  if (form.elements.endDate) form.elements.endDate.value = preset.endDate;
  if (form.elements.type) form.elements.type.value = preset.type;
  if (form.elements.timeSlot) form.elements.timeSlot.value = preset.timeSlot;
  if (typeof applyLessonTimeSlot === "function") applyLessonTimeSlot(form);
  setBatchWeekdays(form, preset.weekdays);
  const hint = form.querySelector("[data-batch-plan-hint]");
  if (hint) hint.textContent = preset.hint;
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
  const defaultPlanKey = "autumnWeeknight";
  const defaultPlan = scheduleBatchPlanPresets()[defaultPlanKey];
  const dates = { start: defaultPlan.startDate, end: defaultPlan.endDate };
  const defaultClass = appState.classes.find((item) => item.status === "开课中") || appState.classes[0] || {};
  const recommendation = typeof lessonTargetRecommendation === "function" ? lessonTargetRecommendation(defaultClass) : {
    subject: batchSubjectValue(defaultClass),
    teacher: defaultClass.teacher || "任课老师",
    room: defaultClass.room || "默认教室",
    time: "18:30-20:00",
    timeSlot: "18:30-20:00"
  };
  const [defaultStartTime, defaultEndTime] = text(defaultPlan.timeSlot || recommendation.time || "18:30-20:00").split("-").map((part) => part.trim());
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
        <label>排课方案<select name="batchPlan">${scheduleBatchPlanOptions(defaultPlanKey)}</select></label>
        <label>班级/对象<select name="target" required>${classOptions(defaultClass.name)}</select></label>
        <label>开始日期<input name="startDate" type="date" value="${dates.start}" required /></label>
        <label>结束日期<input name="endDate" type="date" value="${dates.end}" required /></label>
        <label>课节类型<select name="type"><option ${defaultPlan.type === "班级课" ? "selected" : ""}>班级课</option><option ${defaultPlan.type === "1对1" ? "selected" : ""}>1对1</option></select></label>
        <label>上课时间段<select name="timeSlot">${typeof lessonTimeSlotOptions === "function" ? lessonTimeSlotOptions(defaultPlan.timeSlot) : "<option value=\"18:30-20:00\">晚一 18:30-20:00</option>"}</select></label>
        <label>开始时间<input name="startTime" type="time" value="${escapeHtml(defaultStartTime || "18:30")}" required /></label>
        <label>结束时间<input name="endTime" type="time" value="${escapeHtml(defaultEndTime || "20:00")}" required /></label>
        <label>上课教师<select name="teacher" required>${typeof teacherChoiceOptions === "function" ? teacherChoiceOptions(recommendation.teacher) : `<option>${escapeHtml(recommendation.teacher)}</option>`}</select></label>
        <label>上课教室<select name="room" required>${typeof roomChoiceOptions === "function" ? roomChoiceOptions(recommendation.room) : `<option>${escapeHtml(recommendation.room)}</option>`}</select></label>
        <label>科目<select name="subject" required>${typeof subjectChoiceOptions === "function" ? subjectChoiceOptions(recommendation.subject) : `<option>${escapeHtml(recommendation.subject)}</option>`}</select></label>
        <div class="form-wide muted" data-batch-plan-hint>${escapeHtml(defaultPlan.hint)}</div>
        <div class="form-wide muted" data-schedule-recommendation-hint>${escapeHtml(typeof lessonRecommendationHint === "function" ? lessonRecommendationHint(defaultClass, recommendation) : "选择班级后自动带出推荐排课默认项。")}</div>
      </div>
      <div class="weekday-picker" aria-label="选择星期">${weekdayCheckboxes(defaultPlan.weekdays)}</div>
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
  const batchForm = event.target.closest("#batchScheduleForm");
  if (!batchForm) return;
  if (event.target.name === "batchPlan") applyScheduleBatchPlan(batchForm);
  if (event.target.name === "target") syncLessonTargetDefaults(batchForm);
});

ensureScheduleBatchData();
if (currentView === "schedule") renderView();
