const lessonExecutionStyle = document.createElement("style");
lessonExecutionStyle.textContent = `
  .lesson-execution-panel {
    margin-top: 16px;
  }

  .lesson-execution-toolbar {
    align-items: end;
  }

  .lesson-execution-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .lesson-execution-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .lesson-execution-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
    margin-top: 12px;
  }

  .lesson-execution-card {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  .lesson-execution-card.warn {
    border-color: #f2b8a2;
    background: #fff7f2;
  }

  .lesson-execution-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }

  .lesson-execution-title strong {
    line-height: 1.45;
  }

  .lesson-execution-steps {
    display: grid;
    gap: 7px;
  }

  .lesson-execution-step {
    display: grid;
    grid-template-columns: 78px minmax(0, 1fr);
    gap: 8px;
    align-items: start;
    border-top: 1px solid var(--line);
    padding-top: 7px;
    min-width: 0;
  }

  .lesson-execution-step:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .lesson-execution-step span:last-child {
    overflow-wrap: anywhere;
    line-height: 1.5;
  }

  .lesson-execution-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .lesson-execution-table-note {
    max-width: 280px;
    overflow-wrap: anywhere;
    white-space: normal;
    line-height: 1.5;
  }

  @media (max-width: 650px) {
    .lesson-execution-toolbar,
    .lesson-execution-toolbar label,
    .lesson-execution-toolbar select {
      width: 100%;
    }

    .lesson-execution-step {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(lessonExecutionStyle);

let lessonExecutionWindowFilter = "next7";
let lessonExecutionStatusFilter = "todo";

function lessonExecutionDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function lessonExecutionDiffDays(lesson) {
  const today = lessonExecutionDate(todayIsoDate());
  const lessonDate = lessonExecutionDate(lesson.date);
  if (!today || !lessonDate) return 0;
  return Math.floor((lessonDate - today) / 86400000);
}

function lessonExecutionStudents(lesson) {
  return typeof lessonStudents === "function" ? lessonStudents(lesson) : [];
}

function lessonExecutionFeedbackDone(lesson) {
  return typeof lessonHasSentFeedback === "function" ? lessonHasSentFeedback(lesson) : false;
}

function lessonExecutionAttendanceDone(lesson) {
  return typeof lessonHasAttendance === "function" ? lessonHasAttendance(lesson) : false;
}

function lessonExecutionStudentRisks(lesson) {
  const students = lessonExecutionStudents(lesson);
  return students
    .filter((student) => Number(student.balance || 0) <= 3 || Number(student.debt || 0) > 0)
    .map((student) => ({
      id: student.id,
      name: student.name,
      balance: Number(student.balance || 0),
      debt: Number(student.debt || 0)
    }));
}

function lessonExecutionStepState(lesson) {
  const students = lessonExecutionStudents(lesson);
  const hasStudents = students.length > 0;
  const hasAttendance = lessonExecutionAttendanceDone(lesson);
  const isFinished = lesson.status === "已上课";
  const hasFeedback = lessonExecutionFeedbackDone(lesson);
  const risks = lessonExecutionStudentRisks(lesson);

  return {
    hasStudents,
    hasAttendance,
    isFinished,
    hasFeedback,
    risks,
    doneCount: [hasStudents, hasAttendance, isFinished, hasFeedback, risks.length === 0].filter(Boolean).length
  };
}

function lessonExecutionPrimaryLabel(lesson) {
  const state = lessonExecutionStepState(lesson);
  const diffDays = lessonExecutionDiffDays(lesson);
  if (!state.hasStudents) return { label: "先核名单", tone: "red" };
  if (!state.hasAttendance) return { label: diffDays < 0 ? "补点名" : "待点名", tone: "amber" };
  if (!state.isFinished) return { label: "待消课", tone: "amber" };
  if (!state.hasFeedback) return { label: "待反馈", tone: "red" };
  if (state.risks.length) return { label: "需提醒", tone: "amber" };
  return { label: "已闭环", tone: "green" };
}

function lessonExecutionMatchesWindow(lesson) {
  const diffDays = lessonExecutionDiffDays(lesson);
  if (lessonExecutionWindowFilter === "today") return diffDays === 0;
  if (lessonExecutionWindowFilter === "next7") return diffDays >= 0 && diffDays <= 7;
  if (lessonExecutionWindowFilter === "past") return diffDays < 0;
  if (lessonExecutionWindowFilter === "completed") return lesson.status === "已上课";
  return true;
}

function lessonExecutionMatchesStatus(lesson) {
  const state = lessonExecutionStepState(lesson);
  if (lessonExecutionStatusFilter === "all") return true;
  if (lessonExecutionStatusFilter === "attendance") return !state.hasAttendance && lesson.status !== "已取消";
  if (lessonExecutionStatusFilter === "consume") return state.hasAttendance && !state.isFinished;
  if (lessonExecutionStatusFilter === "feedback") return state.isFinished && !state.hasFeedback;
  if (lessonExecutionStatusFilter === "risk") return state.risks.length > 0;
  if (lessonExecutionStatusFilter === "done") return state.hasStudents && state.hasAttendance && state.isFinished && state.hasFeedback && !state.risks.length;
  return !state.hasStudents || !state.hasAttendance || !state.isFinished || !state.hasFeedback || state.risks.length > 0;
}

function lessonExecutionVisibleLessons() {
  return teacherDeskLessons()
    .filter((lesson) => lessonExecutionMatchesWindow(lesson) && lessonExecutionMatchesStatus(lesson))
    .sort((left, right) => {
      const leftLabel = lessonExecutionPrimaryLabel(left);
      const rightLabel = lessonExecutionPrimaryLabel(right);
      const score = { red: 0, amber: 1, green: 3, "": 2 };
      return (score[leftLabel.tone] ?? 2) - (score[rightLabel.tone] ?? 2) || compareLessonTime(left, right);
    });
}

function lessonExecutionSummary(lessons, visibleLessons) {
  const todo = lessons.filter((lesson) => lessonExecutionPrimaryLabel(lesson).label !== "已闭环").length;
  const feedback = lessons.filter((lesson) => {
    const state = lessonExecutionStepState(lesson);
    return state.isFinished && !state.hasFeedback;
  }).length;
  const risks = lessons.reduce((sum, lesson) => sum + lessonExecutionStudentRisks(lesson).length, 0);

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleLessons.length}</strong><small>全部 ${lessons.length} 节</small></div>
      <div class="metric"><span>未闭环</span><strong>${todo}</strong><small>点名、消课、反馈或风险</small></div>
      <div class="metric"><span>待反馈</span><strong>${feedback}</strong><small>已消课但未发送</small></div>
      <div class="metric"><span>风险学员</span><strong>${risks}</strong><small>欠费或余额不高于 3</small></div>
    </div>`;
}

function renderLessonExecutionToolbar() {
  return `
    <div class="filters lesson-execution-toolbar">
      <label>时间范围
        <select id="lessonExecutionWindowFilter" aria-label="上课闭环时间范围">
          <option value="next7" ${lessonExecutionWindowFilter === "next7" ? "selected" : ""}>未来 7 天</option>
          <option value="today" ${lessonExecutionWindowFilter === "today" ? "selected" : ""}>今天</option>
          <option value="past" ${lessonExecutionWindowFilter === "past" ? "selected" : ""}>历史课节</option>
          <option value="completed" ${lessonExecutionWindowFilter === "completed" ? "selected" : ""}>已上课节</option>
          <option value="all" ${lessonExecutionWindowFilter === "all" ? "selected" : ""}>全部课节</option>
        </select>
      </label>
      <label>闭环状态
        <select id="lessonExecutionStatusFilter" aria-label="上课闭环状态筛选">
          <option value="todo" ${lessonExecutionStatusFilter === "todo" ? "selected" : ""}>只看待处理</option>
          <option value="attendance" ${lessonExecutionStatusFilter === "attendance" ? "selected" : ""}>待点名</option>
          <option value="consume" ${lessonExecutionStatusFilter === "consume" ? "selected" : ""}>待消课</option>
          <option value="feedback" ${lessonExecutionStatusFilter === "feedback" ? "selected" : ""}>待反馈</option>
          <option value="risk" ${lessonExecutionStatusFilter === "risk" ? "selected" : ""}>有风险学员</option>
          <option value="done" ${lessonExecutionStatusFilter === "done" ? "selected" : ""}>已闭环</option>
          <option value="all" ${lessonExecutionStatusFilter === "all" ? "selected" : ""}>全部状态</option>
        </select>
      </label>
    </div>`;
}

function lessonExecutionRiskText(risks) {
  if (!risks.length) return "没有欠费或低课时学员";
  return risks
    .map((risk) => `${risk.name}${risk.debt > 0 ? `欠费 ${money(risk.debt)}` : ""}${risk.balance <= 3 ? `余额 ${risk.balance}` : ""}`)
    .join("；");
}

function lessonExecutionRiskActions(risks) {
  const actions = risks
    .filter((risk) => risk.id)
    .slice(0, 2)
    .map((risk) => {
      const label = risk.debt > 0 ? "欠费跟进" : "续费跟进";
      return `<button class="small-button" type="button" data-student-follow="${escapeHtml(risk.id)}">${escapeHtml(risk.name)} ${label}</button>`;
    });
  if (risks.length > actions.length) actions.push(`<button class="small-button" type="button" data-go="followUp">更多跟进</button>`);
  return actions.join("");
}

function lessonExecutionStep(label, done, textValue, tone = "") {
  return `<div class="lesson-execution-step">
    <span>${tag(done ? "已完成" : "待处理", done ? "green" : tone || "amber")}</span>
    <span><strong>${escapeHtml(label)}</strong><br><span class="muted">${escapeHtml(textValue)}</span></span>
  </div>`;
}

function renderLessonExecutionCard(lesson) {
  const state = lessonExecutionStepState(lesson);
  const primary = lessonExecutionPrimaryLabel(lesson);
  const students = lessonExecutionStudents(lesson);
  const attendanceText = typeof attendanceSummary === "function" && state.hasAttendance ? attendanceSummary(lesson) : "尚未保存点名";
  const studentText = students.length ? `${students.length} 名学员，课前确认到课名单` : "没有匹配到学员，请先核对班级或 1 对 1 名称";
  const finishText = state.isFinished ? "已确认上课并生成课时流水" : state.hasAttendance ? "点名后确认上课，按实际到课扣课" : "先保存点名，再确认上课";
  const feedbackText = state.hasFeedback ? "已发送或留档课后反馈" : state.isFinished ? "课后反馈还未发送" : "上课完成后再发送反馈";

  return `<article class="lesson-execution-card ${primary.tone === "green" ? "" : "warn"}">
    <div class="lesson-execution-title">
      <div>
        <strong>${escapeHtml(lesson.target)}</strong>
        <div class="muted">${escapeHtml(lesson.date)} ${escapeHtml(dayFromDate(lesson.date))} ${escapeHtml(lesson.time)}</div>
      </div>
      ${tag(primary.label, primary.tone)}
    </div>
    <div class="teacher-task-tags">
      ${tag(lesson.subject, "")}
      ${tag(lesson.teacher, "")}
      ${tag(lesson.room || "未分教室", lesson.room ? "" : "amber")}
      ${tag(`${state.doneCount}/5`, state.doneCount >= 5 ? "green" : "amber")}
    </div>
    <div class="lesson-execution-steps">
      ${lessonExecutionStep("名单", state.hasStudents, studentText, "red")}
      ${lessonExecutionStep("点名", state.hasAttendance, attendanceText)}
      ${lessonExecutionStep("消课", state.isFinished, finishText)}
      ${lessonExecutionStep("反馈", state.hasFeedback, feedbackText, "red")}
      ${lessonExecutionStep("续费提醒", state.risks.length === 0, lessonExecutionRiskText(state.risks))}
    </div>
    <div class="lesson-execution-actions">
      <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}" ${lesson.status === "已取消" ? "disabled" : ""}>点名</button>
      <button class="small-button" type="button" data-finish-lesson="${escapeHtml(lesson.id)}" ${!state.hasAttendance || state.isFinished || lesson.status === "已取消" ? "disabled" : ""}>确认消课</button>
      <button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}" ${lesson.status === "已取消" ? "disabled" : ""}>反馈</button>
      ${lessonExecutionRiskActions(state.risks) || `<button class="small-button" type="button" data-go="followUp">跟进台</button>`}
    </div>
  </article>`;
}

function renderLessonExecutionRows(lessons) {
  return lessons.map((lesson) => {
    const state = lessonExecutionStepState(lesson);
    const primary = lessonExecutionPrimaryLabel(lesson);
    return `<tr>
      <td><strong>${escapeHtml(lesson.date)}</strong><br><span class="muted">${escapeHtml(dayFromDate(lesson.date))} ${escapeHtml(lesson.time)}</span></td>
      <td>${escapeHtml(lesson.target)}<br><span class="muted">${escapeHtml(lesson.subject)} / ${escapeHtml(lesson.teacher)}</span></td>
      <td>${tag(primary.label, primary.tone)}<br><span class="muted">${state.doneCount}/5 项完成</span></td>
      <td>${tag(state.hasAttendance ? "已点名" : "未点名", state.hasAttendance ? "green" : "amber")}</td>
      <td>${tag(state.isFinished ? "已消课" : "待消课", state.isFinished ? "green" : "amber")}</td>
      <td>${tag(state.hasFeedback ? "已反馈" : "待反馈", state.hasFeedback ? "green" : "red")}</td>
      <td class="lesson-execution-table-note">${escapeHtml(lessonExecutionRiskText(state.risks))}</td>
      <td>
        <div class="lesson-execution-actions">
          <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}">点名</button>
          <button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">反馈</button>
          ${lessonExecutionRiskActions(state.risks)}
        </div>
      </td>
    </tr>`;
  });
}

function appendLessonExecutionBoard() {
  if (currentView !== "teacherDesk" || appContent.querySelector(".lesson-execution-panel")) return;
  const lessons = teacherDeskLessons();
  const visibleLessons = lessonExecutionVisibleLessons();
  const cardLessons = visibleLessons.slice(0, 6);

  const panel = `
    <section class="section lesson-execution-panel">
      <div class="section-head">
        <div>
          <h3>上课执行闭环</h3>
          <span class="muted">把老师每节课需要做的名单、点名、消课、反馈和续费提醒放在一张操作清单里。</span>
        </div>
        ${tag(`${visibleLessons.length} 节`, visibleLessons.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${lessonExecutionSummary(lessons, visibleLessons)}
        ${renderLessonExecutionToolbar()}
        <div class="lesson-execution-grid">
          ${cardLessons.map(renderLessonExecutionCard).join("") || `<div class="stack-item"><strong>暂无待处理课节</strong><span class="muted">当前筛选条件下没有需要老师处理的上课闭环。</span></div>`}
        </div>
        ${table(["日期时间", "班级/对象", "闭环状态", "点名", "消课", "反馈", "续费提醒", "操作"], renderLessonExecutionRows(visibleLessons))}
      </div>
    </section>`;

  const taskPanel = appContent.querySelector(".teacher-task-panel");
  if (taskPanel) {
    taskPanel.insertAdjacentHTML("beforebegin", panel);
  } else {
    appContent.insertAdjacentHTML("beforeend", panel);
  }
}

const baseRenderTeacherDeskForExecutionBoard = renderTeacherDesk;
renderTeacherDesk = function renderTeacherDeskWithExecutionBoard() {
  baseRenderTeacherDeskForExecutionBoard();
  appendLessonExecutionBoard();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "lessonExecutionWindowFilter") lessonExecutionWindowFilter = event.target.value;
  if (event.target.id === "lessonExecutionStatusFilter") lessonExecutionStatusFilter = event.target.value;

  if (["lessonExecutionWindowFilter", "lessonExecutionStatusFilter"].includes(event.target.id) && currentView === "teacherDesk") {
    renderView();
  }
});

if (currentView === "teacherDesk") {
  renderView();
}
