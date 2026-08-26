const leaveDialog = document.createElement("dialog");
leaveDialog.id = "leaveDialog";
leaveDialog.className = "dialog";
document.body.appendChild(leaveDialog);

const leaveStyle = document.createElement("style");
leaveStyle.textContent = `
  .leave-board{display:grid;grid-template-columns:1.05fr .95fr;gap:14px;align-items:start}
  .leave-cards{display:grid;gap:10px}
  .leave-card{border:1px solid var(--line);border-radius:8px;background:#fff;padding:12px;display:grid;gap:7px}
  .leave-card-head{display:flex;justify-content:space-between;gap:10px;align-items:start}
  .leave-actions{display:flex;gap:8px;flex-wrap:wrap}
  .lesson-card .leave-shortcut{justify-self:start}
  @media (max-width:1050px){.leave-board{grid-template-columns:1fr}}
`;
document.head.appendChild(leaveStyle);

function ensureLeaveData() {
  if (!Array.isArray(appState.leaveRequests)) appState.leaveRequests = [];
}

const leaveScheduleDays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function leaveIsoDateAfter(value, days = 7) {
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

if (typeof nextIsoDate === "function") {
  nextIsoDate = leaveIsoDateAfter;
}

if (typeof weekdayCheckboxes === "function") {
  weekdayCheckboxes = function weekdayCheckboxesWithWeekends() {
    return leaveScheduleDays
      .map(
        (day, index) => `<label class="weekday-option">
          <input type="checkbox" name="weekdays" value="${day}" ${index === 0 ? "checked" : ""} />
          ${day}
        </label>`
      )
      .join("");
  };
}

const baseStatusToneForLeave = statusTone;
statusTone = function statusToneWithLeave(value) {
  if (["待审批", "待补课"].includes(value)) return "amber";
  if (["已批准", "已安排补课", "已完成"].includes(value)) return "green";
  if (["已驳回"].includes(value)) return "red";
  return baseStatusToneForLeave(value);
};

if (!navItems.some((item) => item.id === "leaves")) {
  navItems.splice(navItems.length - 1, 0, { id: "leaves", label: "请假补课", icon: "假" });
  viewMeta.leaves = ["异常处理", "请假与补课"];
}

const baseRenderViewForLeave = renderView;
renderView = function renderViewWithLeave() {
  if (currentView === "leaves") {
    renderLeaveManagement();
    return;
  }
  baseRenderViewForLeave();
};

function leaveSortedLessons() {
  return appState.lessons
    .filter((lesson) => lesson.status !== "已取消")
    .slice()
    .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));
}

function leaveStudentsForLesson(lessonId) {
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson) return appState.students;
  const rows = lessonStudents(lesson);
  return rows.length ? rows : appState.students;
}

function leaveStudentOptions(selectedId = "", lessonId = "") {
  return leaveStudentsForLesson(lessonId)
    .map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}（${escapeHtml(item.className)}）</option>`)
    .join("");
}

function leaveLessonLabel(lesson) {
  return `${lesson.date} ${lesson.time} ${lesson.target} ${lesson.subject || ""}`;
}

function leaveLessonOptions(selectedId = "") {
  return leaveSortedLessons()
    .map((lesson) => `<option value="${escapeHtml(lesson.id)}" ${lesson.id === selectedId ? "selected" : ""}>${escapeHtml(leaveLessonLabel(lesson))}</option>`)
    .join("");
}

function syncLeaveLessonStudents(form) {
  if (!form?.elements?.studentId || !form.elements.lessonId) return;
  const selectedLessonId = form.elements.lessonId.value;
  const currentStudentId = form.elements.studentId.value;
  const rows = leaveStudentsForLesson(selectedLessonId);
  const nextStudentId = rows.some((student) => student.id === currentStudentId) ? currentStudentId : rows[0]?.id || "";
  form.elements.studentId.innerHTML = leaveStudentOptions(nextStudentId, selectedLessonId);
  form.elements.studentId.value = nextStudentId;
}

function leaveTypeOptions(selectedValue = "事假") {
  return ["事假", "病假", "迟到转请假", "其他"]
    .map((value) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function leaveMakeupPlanOptions(selectedValue = "需要补课") {
  return ["需要补课", "不需要补课", "待家长确认"]
    .map((value) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function leaveScenarioPresets() {
  return {
    sickMakeup: {
      label: "病假：需要补课",
      leaveType: "病假",
      contact: "家长",
      makeupPlan: "需要补课",
      reason: "学生生病，需请假补课"
    },
    personalMakeup: {
      label: "事假：需要补课",
      leaveType: "事假",
      contact: "家长",
      makeupPlan: "需要补课",
      reason: "临时家庭安排，待家长确认补课时间"
    },
    schoolConflict: {
      label: "学校活动冲突",
      leaveType: "事假",
      contact: "妈妈",
      makeupPlan: "待家长确认",
      reason: "学校活动冲突，需改期补课"
    },
    lateNoDeduct: {
      label: "迟到转请假",
      leaveType: "迟到转请假",
      contact: "老师代登记",
      makeupPlan: "不需要补课",
      reason: "迟到转请假，本节不消课"
    },
    weatherNoMakeup: {
      label: "天气/交通无需补课",
      leaveType: "其他",
      contact: "家长",
      makeupPlan: "不需要补课",
      reason: "交通/天气原因无法到课"
    },
    longLeaveConfirm: {
      label: "长期停课待确认",
      leaveType: "其他",
      contact: "前台代登记",
      makeupPlan: "待家长确认",
      reason: "长期停课/外出，需教务确认补课方案"
    }
  };
}

function leaveScenarioOptions(selectedValue = "sickMakeup") {
  return Object.entries(leaveScenarioPresets())
    .map(([value, item]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function applyLeaveScenario(form, scenario) {
  if (!form) return;
  const preset = leaveScenarioPresets()[scenario];
  if (!preset) return;
  if (form.elements.leaveType) {
    form.elements.leaveType.innerHTML = leaveTypeOptions(preset.leaveType);
    form.elements.leaveType.value = preset.leaveType;
  }
  if (form.elements.contact && typeof leaveContactOptions === "function") {
    form.elements.contact.innerHTML = leaveContactOptions(preset.contact);
    form.elements.contact.value = preset.contact;
  }
  if (form.elements.makeupPlan) {
    form.elements.makeupPlan.innerHTML = leaveMakeupPlanOptions(preset.makeupPlan);
    form.elements.makeupPlan.value = preset.makeupPlan;
  }
  if (form.elements.reason && typeof leaveReasonOptions === "function") {
    form.elements.reason.innerHTML = leaveReasonOptions(preset.reason);
    form.elements.reason.value = preset.reason;
  }
}

function leaveMakeupBaseDate(item, sourceLesson = {}) {
  return item?.lessonDate || sourceLesson.date || (typeof todayIsoDate === "function" ? todayIsoDate() : new Date().toISOString().slice(0, 10));
}

function nextLeaveWeekday(value, weekday) {
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return leaveIsoDateAfter(value, 7);
  const offset = (weekday - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function leaveMakeupTimeSlotValue(time) {
  if (typeof lessonSlotValueFromRange === "function") return lessonSlotValueFromRange(time) || "custom";
  return text(time).includes("-") ? time : "18:30-20:00";
}

function leaveMakeupArrangementPresets(item, sourceLesson = {}) {
  const baseDate = leaveMakeupBaseDate(item, sourceLesson);
  const sameTime = text(sourceLesson.time || item?.lessonTime || "18:30-20:00").trim() || "18:30-20:00";
  const teacher = item?.teacher || sourceLesson.teacher || "前台老师";
  const room = item?.room || sourceLesson.room || "试听教室";
  const onlineRoom = (appState.rooms || []).some((row) => row.name === "线上课程") ? "线上课程" : room;
  return {
    nextWeekSameTime: {
      label: "下周同时间",
      date: leaveIsoDateAfter(baseDate, 7),
      time: sameTime,
      teacher,
      room,
      hint: "适合普通请假补课，沿用原课节老师、教室和时间段。"
    },
    saturdayAfternoon: {
      label: "最近周六下午",
      date: nextLeaveWeekday(baseDate, 6),
      time: "13:30-15:00",
      teacher,
      room,
      hint: "适合家长周末有空的补课，自动安排到最近周六下午一。"
    },
    oneToOneEvening: {
      label: "晚间一对一",
      date: leaveIsoDateAfter(baseDate, 3),
      time: "17:00-18:00",
      teacher,
      room: "试听教室",
      hint: "适合单独补齐缺课内容，默认使用一对一晚间短课。"
    },
    onlineSameTime: {
      label: "线上同时间",
      date: leaveIsoDateAfter(baseDate, 7),
      time: sameTime,
      teacher,
      room: onlineRoom,
      hint: "适合无法到校的学员，保留原时间并优先安排线上课程。"
    },
    teacherGap: {
      label: "老师空档补课",
      date: leaveIsoDateAfter(baseDate, 2),
      time: "15:10-16:40",
      teacher,
      room,
      hint: "适合教务先占老师近两天可用空档，后续可再微调。"
    }
  };
}

function leaveMakeupArrangementOptions(item, sourceLesson = {}, selectedValue = "nextWeekSameTime") {
  return Object.entries(leaveMakeupArrangementPresets(item, sourceLesson))
    .map(([value, plan]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(plan.label)}</option>`)
    .join("");
}

function setLeaveChoiceField(field, value, optionsBuilder) {
  if (typeof setChoiceField === "function") {
    setChoiceField(field, value, optionsBuilder);
    return;
  }
  if (!field) return;
  if (field.tagName === "SELECT" && typeof optionsBuilder === "function") field.innerHTML = optionsBuilder(value);
  field.value = value;
}

function applyLeaveMakeupArrangement(form) {
  if (!form) return;
  const item = leaveForRow(form.dataset.leaveId);
  if (!item) return;
  const sourceLesson = appState.lessons.find((lesson) => lesson.id === item.lessonId) || {};
  const plan = leaveMakeupArrangementPresets(item, sourceLesson)[form.elements.leaveMakeupArrangement?.value];
  if (!plan) return;
  const time = splitLessonTime({ time: plan.time });
  if (form.elements.date) form.elements.date.value = plan.date;
  setLeaveChoiceField(form.elements.timeSlot, leaveMakeupTimeSlotValue(plan.time), typeof lessonTimeSlotOptions === "function" ? lessonTimeSlotOptions : null);
  if (form.elements.startTime) form.elements.startTime.value = time.start;
  if (form.elements.endTime) form.elements.endTime.value = time.end;
  setLeaveChoiceField(form.elements.teacher, plan.teacher, typeof teacherChoiceOptions === "function" ? teacherChoiceOptions : null);
  setLeaveChoiceField(form.elements.room, plan.room, typeof roomChoiceOptions === "function" ? roomChoiceOptions : null);
  const hint = form.querySelector("[data-leave-makeup-arrangement-hint]");
  if (hint) hint.textContent = plan.hint;
}

function leaveForRow(id) {
  ensureLeaveData();
  return appState.leaveRequests.find((item) => item.id === id);
}

function leaveCounts() {
  ensureLeaveData();
  return {
    pending: appState.leaveRequests.filter((item) => item.status === "待审批").length,
    waitingMakeup: appState.leaveRequests.filter((item) => item.status === "待补课").length,
    arranged: appState.leaveRequests.filter((item) => item.status === "已安排补课").length,
    total: appState.leaveRequests.length
  };
}

function lessonAllowsStudent(lesson, student) {
  if (!lesson || !student) return false;
  return lessonStudents(lesson).some((item) => item.id === student.id);
}

function activeDuplicateLeave(studentId, lessonId) {
  return appState.leaveRequests.some((item) => item.studentId === studentId && item.lessonId === lessonId && !["已驳回", "已完成"].includes(item.status));
}

function renderLeaveQuickForm() {
  const selectedLesson = leaveSortedLessons().find((lesson) => lesson.id === selectedLessonForLeave);
  const defaultLesson = selectedLesson || leaveSortedLessons()[0];
  const defaultStudent = leaveStudentsForLesson(defaultLesson?.id)[0];
  return `
    <form class="operation-panel" id="leaveRequestForm">
      <div>
        <strong>快速登记请假</strong>
        <span class="muted">适合前台接到家长电话后先登记，再审批并安排补课。</span>
      </div>
      <div class="operation-grid">
        <label>请假场景模板<select name="leaveScenario">${leaveScenarioOptions("sickMakeup")}</select></label>
        <label>学员<select name="studentId" required>${leaveStudentOptions(defaultStudent?.id || "", defaultLesson?.id || "")}</select></label>
        <label>关联课节<select name="lessonId" required>${leaveLessonOptions(defaultLesson?.id || "")}</select></label>
        <label>请假类型<select name="leaveType">${leaveTypeOptions("病假")}</select></label>
        <label>申请人<select name="contact" required>${typeof leaveContactOptions === "function" ? leaveContactOptions("家长") : "<option>家长</option>"}</select></label>
        <label>处理人<select name="operator" required>${typeof operatorChoiceOptions === "function" ? operatorChoiceOptions("前台老师") : "<option>前台老师</option>"}</select></label>
        <label>补课建议<select name="makeupPlan">${leaveMakeupPlanOptions("需要补课")}</select></label>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr;margin:0">
        <label>原因备注<select name="reason" required>${typeof leaveReasonOptions === "function" ? leaveReasonOptions("学生生病，需请假补课") : "<option>学生生病，需请假补课</option>"}</select></label>
      </div>
      <div class="dialog-actions">
        <span class="muted">审批通过后会同步考勤状态为请假，不产生消课。</span>
        <button class="primary-action" type="submit">保存请假</button>
      </div>
    </form>`;
}

function renderRecentLeaveCards() {
  ensureLeaveData();
  const rows = appState.leaveRequests.slice(0, 6).map((item) => {
    const canApprove = item.status === "待审批";
    const canMakeup = ["待补课", "已批准"].includes(item.status);
    const canComplete = item.status === "已安排补课";
    return `<article class="leave-card">
      <div class="leave-card-head">
        <div>
          <strong>${escapeHtml(item.student)} ${tag(item.status, statusTone(item.status))}</strong>
          <div class="muted">${escapeHtml(item.lessonDate)} ${escapeHtml(item.lessonTime)} · ${escapeHtml(item.target)}</div>
        </div>
        <span class="muted">${escapeHtml(item.leaveType)}</span>
      </div>
      <span class="muted">${escapeHtml(item.reason)} · ${escapeHtml(item.operator)}</span>
      <div class="leave-actions">
        <button class="small-button" type="button" data-leave-approve="${escapeHtml(item.id)}" ${canApprove ? "" : "disabled"}>批准</button>
        <button class="small-button" type="button" data-leave-reject="${escapeHtml(item.id)}" ${canApprove ? "" : "disabled"}>驳回</button>
        <button class="small-button" type="button" data-leave-makeup="${escapeHtml(item.id)}" ${canMakeup ? "" : "disabled"}>安排补课</button>
        <button class="small-button" type="button" data-leave-complete="${escapeHtml(item.id)}" ${canComplete ? "" : "disabled"}>完成</button>
      </div>
    </article>`;
  });
  return `<div class="leave-cards">${rows.join("") || `<div class="stack-item"><span class="muted">暂无请假记录。</span></div>`}</div>`;
}

function renderLeaveManagement() {
  ensureLeaveData();
  const counts = leaveCounts();
  const rows = appState.leaveRequests
    .filter(matchesRow)
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.student)}</strong><br><span class="muted">${escapeHtml(item.id)}</span></td>
        <td>${escapeHtml(item.lessonDate)}<br><span class="muted">${escapeHtml(item.lessonTime)}</span></td>
        <td>${escapeHtml(item.target)}</td>
        <td>${escapeHtml(item.leaveType)}</td>
        <td>${tag(item.status, statusTone(item.status))}</td>
        <td>${escapeHtml(item.makeupPlan || "")}</td>
        <td>${escapeHtml(item.newLessonId || "-")}</td>
        <td>${escapeHtml(item.operator)}</td>
        <td>${escapeHtml(item.updatedAt || item.createdAt)}</td>
      </tr>`
    );

  appContent.innerHTML = `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>待审批</span><strong>${counts.pending}</strong></div>
      <div class="metric"><span>待补课</span><strong>${counts.waitingMakeup}</strong></div>
      <div class="metric"><span>已安排</span><strong>${counts.arranged}</strong></div>
      <div class="metric"><span>请假记录</span><strong>${counts.total}</strong></div>
    </div>
    <section class="section">
      <div class="section-head"><h3>请假与补课闭环</h3><span class="muted">登记、审批、考勤联动、补课安排集中处理</span></div>
      <div class="section-body">
        ${renderNotice("leaves")}
        <div class="leave-board">
          <div>${renderLeaveQuickForm()}</div>
          <div>${renderRecentLeaveCards()}</div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h3>请假明细</h3><span class="muted">可在数据中心导出 CSV 对账</span></div>
      <div class="section-body">
        ${table(["学员", "原课节日期", "班级/对象", "类型", "状态", "补课建议", "补课课节", "处理人", "更新时间"], rows)}
      </div>
    </section>`;
}

function saveLeaveRequest(form) {
  ensureLeaveData();
  const formData = new FormData(form);
  const student = appState.students.find((item) => item.id === formData.get("studentId"));
  const lesson = appState.lessons.find((item) => item.id === formData.get("lessonId"));
  if (!student || !lesson) return;
  if (!lessonAllowsStudent(lesson, student)) {
    setNotice("leaves", `${student.name} 不在 ${lesson.target} 的本节课名单中，请核对课节。`, "red");
    renderView();
    return;
  }
  if (activeDuplicateLeave(student.id, lesson.id)) {
    setNotice("leaves", `${student.name} 本节课已有未完成请假记录。`, "amber");
    renderView();
    return;
  }

  const now = new Date().toLocaleString("zh-CN", { hour12: false });
  appState.leaveRequests.unshift({
    id: nextId("Q"),
    studentId: student.id,
    student: student.name,
    lessonId: lesson.id,
    lessonDate: lesson.date,
    lessonTime: lesson.time,
    target: lesson.target,
    subject: lesson.subject,
    teacher: lesson.teacher,
    room: lesson.room,
    leaveType: text(formData.get("leaveType")),
    contact: text(formData.get("contact")).trim() || "家长",
    reason: text(formData.get("reason")).trim(),
    makeupPlan: text(formData.get("makeupPlan")),
    status: "待审批",
    operator: text(formData.get("operator")).trim() || "前台老师",
    createdAt: now,
    updatedAt: now
  });
  setNotice("leaves", `${student.name} 的请假已登记，等待审批。`);
  saveState();
  setView("leaves");
}

function markAttendanceAsLeave(item) {
  if (typeof attendanceForLesson !== "function") return;
  const lesson = appState.lessons.find((row) => row.id === item.lessonId);
  if (!lesson || lesson.status === "已取消") return;
  const record = attendanceForLesson(lesson);
  const row = record.records.find((recordItem) => recordItem.studentId === item.studentId);
  if (!row) return;
  row.status = "请假";
  row.deduct = false;
  record.operator = item.operator;
  record.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
}

function approveLeave(id) {
  const item = leaveForRow(id);
  if (!item || item.status !== "待审批") return;
  item.status = item.makeupPlan === "不需要补课" ? "已批准" : "待补课";
  item.approvedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  item.updatedAt = item.approvedAt;
  markAttendanceAsLeave(item);
  setNotice("leaves", `${item.student} 请假已批准，考勤已标记为请假。`);
  saveState();
  renderView();
  renderNav();
}

function rejectLeave(id) {
  const item = leaveForRow(id);
  if (!item || item.status !== "待审批") return;
  item.status = "已驳回";
  item.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  setNotice("leaves", `${item.student} 的请假已驳回。`, "amber");
  saveState();
  renderView();
}

function renderLeaveMakeupDialog(id) {
  const item = leaveForRow(id);
  if (!item) return;
  const sourceLesson = appState.lessons.find((lesson) => lesson.id === item.lessonId) || {};
  const defaultArrangement = "nextWeekSameTime";
  const plan = leaveMakeupArrangementPresets(item, sourceLesson)[defaultArrangement];
  const time = splitLessonTime({ time: plan.time });
  leaveDialog.innerHTML = `
    <form method="dialog" id="leaveMakeupForm" data-leave-id="${escapeHtml(item.id)}">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">安排请假补课</p>
          <h3>${escapeHtml(item.student)}</h3>
          <span class="muted">原课节：${escapeHtml(item.lessonDate)} ${escapeHtml(item.lessonTime)} · ${escapeHtml(item.target)}</span>
        </div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <div class="form-grid">
        <label>补课安排模板<select name="leaveMakeupArrangement">${leaveMakeupArrangementOptions(item, sourceLesson, defaultArrangement)}</select></label>
        <label>补课日期<input name="date" type="date" value="${escapeHtml(plan.date)}" required /></label>
        <label>补课时间段<select name="timeSlot">${typeof lessonTimeSlotOptions === "function" ? lessonTimeSlotOptions(leaveMakeupTimeSlotValue(plan.time)) : "<option value=\"18:30-20:00\">晚一 18:30-20:00</option>"}</select></label>
        <label>开始时间<input name="startTime" type="time" value="${escapeHtml(time.start)}" required /></label>
        <label>结束时间<input name="endTime" type="time" value="${escapeHtml(time.end)}" required /></label>
        <label>上课教师<select name="teacher" required>${typeof teacherChoiceOptions === "function" ? teacherChoiceOptions(plan.teacher) : `<option>${escapeHtml(plan.teacher)}</option>`}</select></label>
        <label>上课教室<select name="room" required>${typeof roomChoiceOptions === "function" ? roomChoiceOptions(plan.room) : `<option>${escapeHtml(plan.room)}</option>`}</select></label>
        <label>操作人<select name="operator" required>${typeof operatorChoiceOptions === "function" ? operatorChoiceOptions(item.operator || "前台老师") : `<option>${escapeHtml(item.operator || "前台老师")}</option>`}</select></label>
        <span class="form-wide muted" data-leave-makeup-arrangement-hint>${escapeHtml(plan.hint)}</span>
      </div>
      <div class="dialog-actions">
        <span class="muted">会生成一节 1 对 1 补课课节，后续可正常点名和确认上课。</span>
        <button value="cancel" type="submit">取消</button>
        <button class="primary-action" value="default" type="submit">保存补课</button>
      </div>
    </form>`;
  leaveDialog.showModal();
}

function saveLeaveMakeup(form) {
  const item = leaveForRow(form.dataset.leaveId);
  if (!item) return;
  const formData = new FormData(form);
  const date = text(formData.get("date"));
  const student = appState.students.find((row) => row.id === item.studentId);
  const lesson = {
    id: nextId("L"),
    day: dayFromDate(date),
    date,
    time: `${text(formData.get("startTime"))}-${text(formData.get("endTime"))}`,
    type: "补课",
    target: `${item.student}-请假补课`,
    subject: item.subject || "课程",
    teacher: text(formData.get("teacher")).trim(),
    room: text(formData.get("room")).trim(),
    status: "待上课",
    sourceLeaveId: item.id,
    sourceLessonId: item.lessonId,
    deduct: Number(getClass(student?.className)?.deduct || 1)
  };
  if (typeof isValidLessonRange === "function" && !isValidLessonRange(lesson)) {
    setNotice("leaves", "补课结束时间必须晚于开始时间。", "red");
    renderView();
    return;
  }
  const conflicts = findLessonConflicts(lesson);
  if (conflicts.length) {
    setNotice("leaves", `补课安排冲突：${conflicts.map((row) => `${row.target} ${row.time}`).join("；")}`, "red");
    renderView();
    return;
  }
  appState.lessons.unshift(lesson);
  item.status = "已安排补课";
  item.newLessonId = lesson.id;
  item.makeupDate = lesson.date;
  item.makeupTime = lesson.time;
  item.operator = text(formData.get("operator")).trim() || item.operator;
  item.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  leaveDialog.close();
  setNotice("leaves", `${item.student} 已安排补课：${lesson.date} ${lesson.time}。`);
  saveState();
  renderView();
  renderNav();
}

function completeLeave(id) {
  const item = leaveForRow(id);
  if (!item || item.status !== "已安排补课") return;
  const lesson = appState.lessons.find((row) => row.id === item.newLessonId);
  if (lesson && lesson.status !== "已上课") {
    setNotice("leaves", "补课课节还未确认上课，暂不能完成。", "amber");
    renderView();
    return;
  }
  item.status = "已完成";
  item.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  setNotice("leaves", `${item.student} 的请假补课已完成。`);
  saveState();
  renderView();
}

function injectLeaveShortcuts() {
  if (currentView !== "schedule") return;
  appContent.querySelectorAll("[data-attendance-lesson]").forEach((button) => {
    const lesson = appState.lessons.find((item) => item.id === button.dataset.attendanceLesson);
    const card = button.closest(".lesson-card");
    if (!lesson || !card || card.querySelector("[data-lesson-leave]")) return;
    const disabled = lesson.status === "已上课" || lesson.status === "已取消";
    const target = card.querySelector(".schedule-adjust-actions") || button.closest(".attendance-actions");
    target?.insertAdjacentHTML("beforeend", `<button class="small-button leave-shortcut" type="button" data-lesson-leave="${escapeHtml(lesson.id)}" ${disabled ? "disabled" : ""}>请假</button>`);
  });
}

function renderLeaveLessonCard(lesson) {
  const done = lesson.status === "已上课";
  const canceled = lesson.status === "已取消";
  return `<article class="lesson-card ${done ? "done" : ""} ${canceled ? "canceled" : ""}">
    <strong>${escapeHtml(lesson.time)} ${tag(lesson.status, statusTone(lesson.status))}</strong>
    <span>${escapeHtml(lesson.target)}</span>
    <span class="muted">${escapeHtml(lesson.subject)} / ${escapeHtml(lesson.teacher)}</span>
    <span class="muted">${escapeHtml(lesson.room)}</span>
    <span class="muted">${typeof attendanceSummary === "function" ? escapeHtml(attendanceSummary(lesson)) : "未点名"}</span>
    <div class="attendance-actions">
      <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}" ${canceled ? "disabled" : ""}>点名</button>
      <button class="small-button" type="button" data-finish-lesson="${escapeHtml(lesson.id)}" ${done || canceled ? "disabled" : ""}>确认上课</button>
    </div>
  </article>`;
}

function ensureFullWeekScheduleColumns() {
  const board = appContent.querySelector(".board");
  if (!board) return;
  const existingDays = new Set([...board.querySelectorAll(".day-head")].map((item) => item.textContent.trim()));
  for (const day of leaveScheduleDays) {
    if (existingDays.has(day)) continue;
    const lessons = appState.lessons.filter((lesson) => lesson.day === day && matchesRow(lesson));
    const column = document.createElement("div");
    column.className = "day-column";
    column.innerHTML = `<div class="day-head">${day}</div>${lessons.map(renderLeaveLessonCard).join("") || `<div class="lesson-card"><span class="muted">暂无课程</span></div>`}`;
    board.appendChild(column);
  }
}

const baseRenderScheduleForLeave = renderSchedule;
renderSchedule = function renderScheduleWithLeaveShortcuts() {
  baseRenderScheduleForLeave();
  ensureFullWeekScheduleColumns();
  if (typeof injectScheduleAdjustmentControls === "function") injectScheduleAdjustmentControls();
  injectLeaveShortcuts();
};

function renderScheduleLeaveDialog(lessonId) {
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson) return;
  const students = lessonStudents(lesson);
  leaveDialog.innerHTML = `
    <form method="dialog" id="leaveRequestForm" data-from-schedule="true">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">课节请假</p>
          <h3>${escapeHtml(lesson.target)}</h3>
          <span class="muted">${escapeHtml(lesson.date)} ${escapeHtml(lesson.time)} · ${escapeHtml(lesson.teacher)}</span>
        </div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <input name="lessonId" value="${escapeHtml(lesson.id)}" hidden />
      <div class="form-grid">
        <label>请假场景模板<select name="leaveScenario">${leaveScenarioOptions("sickMakeup")}</select></label>
        <label>请假学员<select name="studentId" required>${students.map((student) => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)}（余额 ${escapeHtml(student.balance)}）</option>`).join("")}</select></label>
        <label>请假类型<select name="leaveType">${leaveTypeOptions("病假")}</select></label>
        <label>申请人<select name="contact" required>${typeof leaveContactOptions === "function" ? leaveContactOptions("家长") : "<option>家长</option>"}</select></label>
        <label>处理人<select name="operator" required>${typeof operatorChoiceOptions === "function" ? operatorChoiceOptions("前台老师") : "<option>前台老师</option>"}</select></label>
        <label>补课建议<select name="makeupPlan">${leaveMakeupPlanOptions("需要补课")}</select></label>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr;">
        <label>原因备注<select name="reason" required>${typeof leaveReasonOptions === "function" ? leaveReasonOptions("学生生病，需请假补课") : "<option>学生生病，需请假补课</option>"}</select></label>
      </div>
      <div class="dialog-actions">
        <span class="muted">保存后可到“请假补课”页面审批。</span>
        <button value="cancel" type="submit">取消</button>
        <button class="primary-action" value="default" type="submit">保存请假</button>
      </div>
    </form>`;
  leaveDialog.showModal();
}

function flattenLeaveRows() {
  ensureLeaveData();
  return appState.leaveRequests.map((item) => ({
    id: item.id,
    student: item.student,
    lessonId: item.lessonId,
    target: item.target,
    lessonDate: item.lessonDate,
    lessonTime: item.lessonTime,
    leaveType: item.leaveType,
    contact: item.contact,
    reason: item.reason,
    makeupPlan: item.makeupPlan,
    status: item.status,
    newLessonId: item.newLessonId || "",
    makeupDate: item.makeupDate || "",
    makeupTime: item.makeupTime || "",
    operator: item.operator,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));
}

if (typeof exportDataset === "function") {
  const baseExportDatasetForLeave = exportDataset;
  exportDataset = function exportDatasetWithLeave(type) {
    if (type !== "leaveRequests") {
      baseExportDatasetForLeave(type);
      return;
    }
    const columns = [
      ["id", "请假编号"],
      ["student", "学员"],
      ["lessonId", "原课节编号"],
      ["target", "班级/对象"],
      ["lessonDate", "原课节日期"],
      ["lessonTime", "原课节时间"],
      ["leaveType", "请假类型"],
      ["contact", "申请人"],
      ["reason", "原因备注"],
      ["makeupPlan", "补课建议"],
      ["status", "处理状态"],
      ["newLessonId", "补课课节编号"],
      ["makeupDate", "补课日期"],
      ["makeupTime", "补课时间"],
      ["operator", "处理人"],
      ["createdAt", "创建时间"],
      ["updatedAt", "更新时间"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("请假补课记录.csv", buildCsv(flattenLeaveRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "请假补课记录.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForLeave = renderDataCenter;
  renderDataCenter = function renderDataCenterWithLeave() {
    baseRenderDataCenterForLeave();
    const metricValue = [...appContent.querySelectorAll(".metric")]
      .find((item) => item.textContent.includes("数据表数量"))
      ?.querySelector("strong");
    if (metricValue) metricValue.textContent = "20";

    const dataGrid = appContent.querySelector(".data-grid");
    if (!dataGrid || dataGrid.querySelector('[data-export="leaveRequests"]')) return;
    const card = document.createElement("article");
    card.className = "data-card";
    card.innerHTML = `<div><span class="muted">请假补课记录</span><strong>${flattenLeaveRows().length}</strong></div><button class="small-button" type="button" data-export="leaveRequests">导出请假</button>`;
    const attendanceCard = dataGrid.querySelector('[data-export="attendance"]')?.closest(".data-card");
    if (attendanceCard) {
      attendanceCard.after(card);
    } else {
      dataGrid.appendChild(card);
    }
  };
}

document.addEventListener("click", (event) => {
  const leaveButton = event.target.closest("[data-schedule-leave]");
  if (leaveButton) openLeaveFormForLesson(leaveButton.dataset.scheduleLeave);

  const approveButton = event.target.closest("[data-leave-approve]");
  if (approveButton) approveLeave(approveButton.dataset.leaveApprove);

  const rejectButton = event.target.closest("[data-leave-reject]");
  if (rejectButton) rejectLeave(rejectButton.dataset.leaveReject);

  const makeupButton = event.target.closest("[data-leave-makeup]");
  if (makeupButton) renderLeaveMakeupDialog(makeupButton.dataset.leaveMakeup);

  const completeButton = event.target.closest("[data-leave-complete]");
  if (completeButton) completeLeave(completeButton.dataset.leaveComplete);
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "leaveRequestForm") {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveLeaveRequest(event.target);
    if (event.target.dataset.fromSchedule) leaveDialog.close();
  }

  if (event.target.id === "leaveMakeupForm") {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveLeaveMakeup(event.target);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.name === "leaveScenario" && event.target.closest("#leaveRequestForm")) {
    applyLeaveScenario(event.target.form, event.target.value);
  }

  if (event.target.name === "lessonId" && event.target.closest("#leaveRequestForm")) {
    syncLeaveLessonStudents(event.target.form);
  }

  if (event.target.name === "leaveMakeupArrangement" && event.target.closest("#leaveMakeupForm")) {
    applyLeaveMakeupArrangement(event.target.form);
  }
});

ensureLeaveData();
renderNav();
if (currentView === "schedule" || currentView === "leaves" || currentView === "data") renderView();
