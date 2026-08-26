const attendanceDialog = document.querySelector("#attendanceDialog");
const attendanceDialogBody = document.querySelector("#attendanceDialogBody");
const attendanceStatuses = ["到课", "迟到", "请假", "旷课"];

const attendanceStyle = document.createElement("style");
attendanceStyle.textContent = `
  .attendance-list {
    display: grid;
    gap: 8px;
    margin: 14px 0;
    max-height: min(52vh, 520px);
    overflow: auto;
  }

  .attendance-row {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) 130px 120px;
    gap: 10px;
    align-items: center;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px;
    background: #fff;
  }

  .attendance-row select {
    min-height: 36px;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0 10px;
    background: #fff;
  }

  .attendance-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .attendance-quickbar {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fbfdff;
    padding: 10px;
    margin-top: 14px;
    display: grid;
    gap: 10px;
  }

  .attendance-quickbar .attendance-actions {
    align-items: center;
  }

  .attendance-draft-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .consume-confirm-list {
    display: grid;
    gap: 8px;
    margin: 14px 0;
    max-height: min(48vh, 480px);
    overflow: auto;
  }

  .consume-confirm-row {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) 120px 120px 100px;
    gap: 10px;
    align-items: center;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px;
    background: #fff;
  }

  .consume-confirm-row strong,
  .consume-confirm-row span {
    min-width: 0;
  }

  @media (max-width: 1050px) {
    .attendance-row,
    .consume-confirm-row {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(attendanceStyle);

function ensureAttendanceData() {
  if (!Array.isArray(appState.attendance)) appState.attendance = [];
}

function lessonStudents(lesson) {
  const classStudents = appState.students.filter((student) => student.className === lesson.target);
  if (classStudents.length) return classStudents;
  const oneToOneName = text(lesson.target).split("-")[0];
  return appState.students.filter((student) => student.name === oneToOneName);
}

function attendanceForLesson(lesson) {
  ensureAttendanceData();
  let record = appState.attendance.find((item) => item.lessonId === lesson.id);
  const students = lessonStudents(lesson);
  if (!record) {
    record = {
      lessonId: lesson.id,
      target: lesson.target,
      date: lesson.date,
      time: lesson.time,
      operator: lesson.teacher,
      updatedAt: "",
      locked: false,
      records: []
    };
    appState.attendance.unshift(record);
  }

  const existing = new Set(record.records.map((item) => item.studentId));
  for (const student of students) {
    if (!existing.has(student.id)) {
      record.records.push({
        studentId: student.id,
        student: student.name,
        balance: Number(student.balance || 0),
        status: "到课",
        deduct: true
      });
    }
  }
  record.records = record.records.filter((item) => students.some((student) => student.id === item.studentId));
  return record;
}

function canDeductAttendance(status) {
  return status === "到课" || status === "迟到";
}

function attendanceSummary(lesson) {
  const record = appState.attendance?.find((item) => item.lessonId === lesson.id);
  if (!record) return "未点名";
  const present = record.records.filter((item) => canDeductAttendance(item.status)).length;
  const absent = record.records.length - present;
  return `${present} 到课 / ${absent} 未消课`;
}

function attendanceStatusOptions(value) {
  return attendanceStatuses.map((status) => `<option value="${status}" ${status === value ? "selected" : ""}>${status}</option>`).join("");
}

function attendanceDraftCounts(form) {
  const counts = Object.fromEntries(attendanceStatuses.map((status) => [status, 0]));
  form.querySelectorAll('select[name^="status:"]').forEach((select) => {
    counts[select.value] = Number(counts[select.value] || 0) + 1;
  });
  return counts;
}

function renderAttendanceDraftSummary(counts) {
  return `<div class="attendance-draft-summary">
    ${attendanceStatuses
      .map((status) => {
        const tone = status === "到课" || status === "迟到" ? "green" : status === "请假" ? "amber" : "red";
        return tag(`${status} ${counts[status] || 0}`, tone);
      })
      .join("")}
  </div>`;
}

function updateAttendanceDraftSummary(form) {
  const target = form.querySelector("[data-attendance-draft-summary]");
  if (target) target.innerHTML = renderAttendanceDraftSummary(attendanceDraftCounts(form));
}

function attendanceScenarioOptions(selectedValue = "normal") {
  const scenarios = [
    ["normal", "常规上课：全部到课"],
    ["oneLate", "有一人迟到"],
    ["oneLeave", "有一人请假"],
    ["oneAbsent", "有一人旷课"],
    ["riskLeave", "欠费/零课时学员先请假"]
  ];
  return scenarios.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function attendanceSelectStudent(select) {
  const studentId = text(select.name).replace(/^status:/, "");
  return appState.students.find((student) => student.id === studentId);
}

function applyAttendanceScenario(form, scenario) {
  if (!form) return;
  const selects = [...form.querySelectorAll('select[name^="status:"]')];
  selects.forEach((select) => {
    select.value = "到课";
  });
  if (scenario === "oneLate" && selects[0]) selects[0].value = "迟到";
  if (scenario === "oneLeave" && selects[0]) selects[0].value = "请假";
  if (scenario === "oneAbsent" && selects[0]) selects[0].value = "旷课";
  if (scenario === "riskLeave") {
    selects.forEach((select) => {
      const student = attendanceSelectStudent(select);
      if (Number(student?.debt || 0) > 0 || Number(student?.balance || 0) <= 0) select.value = "请假";
    });
  }
  updateAttendanceDraftSummary(form);
}

function consumeConfirmScenarioOptions(selectedValue = "attendance") {
  const scenarios = [
    ["attendance", "按点名结果消课"],
    ["riskHold", "欠费/零课时学员先不扣"],
    ["allPresent", "全部到课并消课"],
    ["allLeave", "整节请假不消课"]
  ];
  return scenarios.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function consumeStatusForScenario(recordItem, student, scenario) {
  if (scenario === "allPresent") return "到课";
  if (scenario === "allLeave") return "请假";
  if (scenario === "riskHold" && (Number(student?.debt || 0) > 0 || Number(student?.balance ?? recordItem.balance) <= 0)) return "请假";
  return recordItem.status || "到课";
}

function consumeConfirmRows(lesson, scenario = "attendance") {
  const record = attendanceForLesson(lesson);
  const deduct = lessonDeduct(lesson);
  const studentsById = new Map(appState.students.map((student) => [student.id, student]));
  return record.records.map((item) => {
    const student = studentsById.get(item.studentId);
    const status = consumeStatusForScenario(item, student, scenario);
    const before = Number(student?.balance ?? item.balance ?? 0);
    const shouldDeduct = canDeductAttendance(status);
    const change = shouldDeduct ? Math.min(before, deduct) : 0;
    const after = Math.max(0, before - change);
    return {
      ...item,
      status,
      before,
      change,
      after,
      deduct,
      debt: Number(student?.debt || 0),
      shouldDeduct
    };
  });
}

function consumeConfirmSummary(rows) {
  const deductedRows = rows.filter((row) => row.shouldDeduct);
  const skippedRows = rows.length - deductedRows.length;
  const totalChange = deductedRows.reduce((sum, row) => sum + row.change, 0);
  const shortage = deductedRows.filter((row) => row.before < row.deduct).length;
  return `<div class="attendance-draft-summary">
    ${tag(`消课 ${deductedRows.length} 人`, "green")}
    ${tag(`不消课 ${skippedRows} 人`, skippedRows ? "amber" : "green")}
    ${tag(`合计 ${totalChange} 课时`, "green")}
    ${shortage ? tag(`课时不足 ${shortage} 人`, "red") : tag("余额正常", "green")}
  </div>`;
}

function renderConsumeConfirmRows(rows) {
  return rows
    .map(
      (row) => `<div class="consume-confirm-row">
        <strong>${escapeHtml(row.student)}<br><span class="muted">${row.debt > 0 ? `欠费 ${money(row.debt)}` : "无欠费"}</span></strong>
        <span>${tag(row.status, row.shouldDeduct ? "green" : "amber")}</span>
        <span>${escapeHtml(row.before)} -> ${escapeHtml(row.after)}</span>
        <span class="consume-change ${row.change ? "negative" : ""}">${row.change ? `-${escapeHtml(row.change)}` : "不扣"}</span>
      </div>`
    )
    .join("");
}

function updateConsumeConfirmPreview(form) {
  const lesson = appState.lessons.find((item) => item.id === form?.dataset.lessonId);
  if (!lesson) return;
  const scenario = form.elements.consumeScenario?.value || "attendance";
  const rows = consumeConfirmRows(lesson, scenario);
  const summary = form.querySelector("[data-consume-confirm-summary]");
  const list = form.querySelector("[data-consume-confirm-list]");
  if (summary) summary.innerHTML = consumeConfirmSummary(rows);
  if (list) list.innerHTML = renderConsumeConfirmRows(rows);
}

function applyConsumeConfirmScenario(lesson, scenario) {
  const record = attendanceForLesson(lesson);
  const studentsById = new Map(appState.students.map((student) => [student.id, student]));
  record.records = record.records.map((item) => {
    const student = studentsById.get(item.studentId);
    const status = consumeStatusForScenario(item, student, scenario);
    return {
      ...item,
      status,
      deduct: canDeductAttendance(status)
    };
  });
  record.operator = lesson.teacher;
  record.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
}

function renderConsumeConfirmDialog(lessonId) {
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson || lesson.status === "已上课") return;
  const rows = consumeConfirmRows(lesson, "attendance");
  attendanceDialogBody.innerHTML = `
    <form method="dialog" id="consumeConfirmForm" data-lesson-id="${escapeHtml(lesson.id)}">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">消课确认</p>
          <h3>${escapeHtml(lesson.target)}</h3>
          <span class="muted">${escapeHtml(lesson.date)} ${escapeHtml(lesson.time)} · ${escapeHtml(lesson.teacher)} · 每人扣 ${escapeHtml(lessonDeduct(lesson))} 课时</span>
        </div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <div class="attendance-quickbar">
        <label>消课场景模板<select name="consumeScenario">${consumeConfirmScenarioOptions("attendance")}</select></label>
        <div data-consume-confirm-summary>${consumeConfirmSummary(rows)}</div>
      </div>
      <div class="consume-confirm-list" data-consume-confirm-list>${renderConsumeConfirmRows(rows)}</div>
      <div class="dialog-actions">
        <span class="muted">确认后会锁定本节考勤，并生成课时流水。</span>
        <button value="cancel" type="submit">取消</button>
        <button class="primary-action" value="default" type="submit">确认生成流水</button>
      </div>
    </form>`;
  attendanceDialog.showModal();
}

const baseRenderScheduleForAttendance = renderSchedule;
renderSchedule = function renderScheduleWithAttendance() {
  const days = ["周一", "周二", "周三", "周四", "周五"];
  appContent.innerHTML = `
    <section class="section">
      <div class="section-head">
        <h3>本周课表</h3>
        <span class="muted">先点名，再按实际到课消课</span>
      </div>
      <div class="section-body">
        ${renderNotice("schedule")}
        ${renderLessonForm()}
        <div class="board">
          ${days
            .map((day) => {
              const lessons = appState.lessons.filter((lesson) => lesson.day === day && matchesRow(lesson));
              return `<div class="day-column">
                <div class="day-head">${day}</div>
                ${lessons
                  .map(
                    (lesson) => `<article class="lesson-card ${lesson.status === "已上课" ? "done" : ""}">
                      <strong>${escapeHtml(lesson.time)} ${tag(lesson.status, statusTone(lesson.status))}</strong>
                      <span>${escapeHtml(lesson.target)}</span>
                      <span class="muted">${escapeHtml(lesson.subject)} / ${escapeHtml(lesson.teacher)}</span>
                      <span class="muted">${escapeHtml(lesson.room)}</span>
                      <span class="muted">${escapeHtml(attendanceSummary(lesson))}</span>
                      <div class="attendance-actions">
                        <button class="small-button" type="button" data-attendance-lesson="${lesson.id}">点名</button>
                        <button class="small-button" type="button" data-finish-lesson="${lesson.id}" ${lesson.status === "已上课" ? "disabled" : ""}>确认上课</button>
                      </div>
                    </article>`
                  )
                  .join("") || `<div class="lesson-card"><span class="muted">暂无课程</span></div>`}
              </div>`;
            })
            .join("")}
        </div>
      </div>
    </section>`;
};

function renderAttendanceDialog(lessonId) {
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson) return;
  const record = attendanceForLesson(lesson);
  const studentsById = new Map(appState.students.map((student) => [student.id, student]));
  const initialCounts = {
    到课: record.records.filter((item) => item.status === "到课").length,
    迟到: record.records.filter((item) => item.status === "迟到").length,
    请假: record.records.filter((item) => item.status === "请假").length,
    旷课: record.records.filter((item) => item.status === "旷课").length
  };
  attendanceDialogBody.innerHTML = `
    <form method="dialog" id="attendanceForm" data-lesson-id="${escapeHtml(lesson.id)}">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">课前点名</p>
          <h3>${escapeHtml(lesson.target)}</h3>
          <span class="muted">${escapeHtml(lesson.date)} ${escapeHtml(lesson.time)} · ${escapeHtml(lesson.teacher)}</span>
        </div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <div class="attendance-quickbar">
        <label>点名场景模板<select name="attendanceScenario">${attendanceScenarioOptions("normal")}</select></label>
        <div class="attendance-actions">
          <button class="small-button" type="button" data-attendance-bulk="到课">全部到课</button>
          <button class="small-button" type="button" data-attendance-bulk="迟到">全部迟到</button>
          <button class="small-button" type="button" data-attendance-bulk="请假">全部请假</button>
          <button class="small-button" type="button" data-attendance-bulk="旷课">全部旷课</button>
        </div>
        <div data-attendance-draft-summary>${renderAttendanceDraftSummary(initialCounts)}</div>
      </div>
      <div class="attendance-list">
        ${
          record.records
            .map((item) => {
              const student = studentsById.get(item.studentId);
              const debt = Number(student?.debt || 0);
              return `<label class="attendance-row">
                <strong>${escapeHtml(item.student)}</strong>
                <span class="muted">余额 ${escapeHtml(item.balance)} 课时${debt > 0 ? ` · 欠费 ${escapeHtml(money(debt))}` : ""}</span>
                <select name="status:${escapeHtml(item.studentId)}">${attendanceStatusOptions(item.status)}</select>
              </label>`;
            })
            .join("") || `<div class="stack-item"><span class="muted">当前课节没有匹配学员。</span></div>`
        }
      </div>
      <div class="dialog-actions">
        <span class="muted">到课、迟到会消课；请假、旷课不消课。</span>
        <button class="primary-action" value="default" type="submit">保存点名</button>
      </div>
    </form>`;
  attendanceDialog.showModal();
}

function saveAttendance(form) {
  const lesson = appState.lessons.find((item) => item.id === form.dataset.lessonId);
  if (!lesson) return;
  const record = attendanceForLesson(lesson);
  const formData = new FormData(form);
  record.records = record.records.map((item) => {
    const status = text(formData.get(`status:${item.studentId}`)) || "到课";
    return {
      ...item,
      status,
      deduct: canDeductAttendance(status)
    };
  });
  record.operator = lesson.teacher;
  record.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  record.locked = lesson.status === "已上课";
  setNotice("schedule", `${lesson.target} 已保存点名：${attendanceSummary(lesson)}。`);
  saveState();
  attendanceDialog.close();
  setView("schedule");
}

const baseFinishLessonForAttendance = finishLesson;
finishLesson = function finishLessonWithAttendance(lessonId) {
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson || lesson.status === "已上课") return;
  const record = attendanceForLesson(lesson);
  lesson.status = "已上课";
  record.locked = true;
  record.updatedAt = record.updatedAt || new Date().toLocaleString("zh-CN", { hour12: false });
  const deduct = lessonDeduct(lesson);
  const studentsById = new Map(appState.students.map((student) => [student.id, student]));
  const recordsToDeduct = record.records.filter((item) => canDeductAttendance(item.status));
  recordsToDeduct.forEach((item) => {
    const student = studentsById.get(item.studentId);
    if (student) applyLessonDeduction(student, lesson, deduct);
  });
  const skipped = record.records.length - recordsToDeduct.length;
  setNotice("schedule", `${lesson.target} 已确认上课，${recordsToDeduct.length} 人消课，${skipped} 人未消课。`);
  saveState();
  renderView();
  renderNav();
};

function flattenAttendanceRows() {
  ensureAttendanceData();
  return appState.attendance.flatMap((record) =>
    record.records.map((item) => ({
      lessonId: record.lessonId,
      date: record.date,
      time: record.time,
      target: record.target,
      student: item.student,
      status: item.status,
      deduct: item.deduct ? "是" : "否",
      operator: record.operator,
      updatedAt: record.updatedAt
    }))
  );
}

document.addEventListener("click", (event) => {
  const attendanceButton = event.target.closest("[data-attendance-lesson]");
  if (attendanceButton) renderAttendanceDialog(attendanceButton.dataset.attendanceLesson);

  const bulkButton = event.target.closest("[data-attendance-bulk]");
  if (bulkButton) {
    const form = bulkButton.closest("#attendanceForm");
    if (!form) return;
    form.querySelectorAll('select[name^="status:"]').forEach((select) => {
      select.value = bulkButton.dataset.attendanceBulk;
    });
    updateAttendanceDraftSummary(form);
  }
});

document.addEventListener(
  "click",
  (event) => {
    const finishButton = event.target.closest("[data-finish-lesson]");
    if (!finishButton) return;
    const lesson = appState.lessons.find((item) => item.id === finishButton.dataset.finishLesson);
    if (!lesson || lesson.status === "已上课") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renderConsumeConfirmDialog(lesson.id);
  },
  true
);

document.addEventListener("change", (event) => {
  if (event.target.name === "attendanceScenario" && event.target.closest("#attendanceForm")) {
    applyAttendanceScenario(event.target.form, event.target.value);
    return;
  }

  if (event.target.name === "consumeScenario" && event.target.closest("#consumeConfirmForm")) {
    updateConsumeConfirmPreview(event.target.form);
    return;
  }

  if (!event.target.matches('select[name^="status:"]')) return;
  const form = event.target.closest("#attendanceForm");
  if (form) updateAttendanceDraftSummary(form);
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "attendanceForm") {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveAttendance(event.target);
  }

  if (event.target.id === "consumeConfirmForm") {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const lesson = appState.lessons.find((item) => item.id === event.target.dataset.lessonId);
    if (!lesson) return;
    applyConsumeConfirmScenario(lesson, event.target.elements.consumeScenario?.value || "attendance");
    attendanceDialog.close();
    finishLesson(lesson.id);
  }
});

ensureAttendanceData();
renderNav();
