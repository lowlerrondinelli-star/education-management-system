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

  @media (max-width: 1050px) {
    .attendance-row {
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

document.addEventListener("change", (event) => {
  if (!event.target.matches('select[name^="status:"]')) return;
  const form = event.target.closest("#attendanceForm");
  if (form) updateAttendanceDraftSummary(form);
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "attendanceForm") return;
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  saveAttendance(event.target);
});

ensureAttendanceData();
renderNav();
