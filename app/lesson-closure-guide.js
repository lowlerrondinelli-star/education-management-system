const lessonClosureStyle = document.createElement("style");
lessonClosureStyle.textContent = `
  .lesson-closure {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fbfdff;
    padding: 10px;
    display: grid;
    gap: 8px;
  }

  .lesson-closure-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .lesson-closure-steps,
  .lesson-closure-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .closure-dialog-body {
    padding: 0 18px 18px;
    display: grid;
    gap: 12px;
  }

  .closure-dialog-summary {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fbfdff;
    padding: 12px;
    display: grid;
    gap: 8px;
  }

  .closure-dialog-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(160px, 1fr));
    gap: 10px;
  }

  .closure-step-card {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    padding: 10px;
    display: grid;
    gap: 6px;
  }

  @media (max-width: 720px) {
    .closure-dialog-grid {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(lessonClosureStyle);

function lessonClosureAttendanceRecord(lesson) {
  return (appState.attendance || []).find((item) => item.lessonId === lesson.id);
}

function lessonClosureStudents(lesson) {
  if (typeof lessonStudents === "function") return lessonStudents(lesson);
  return appState.students.filter((student) => student.className === lesson.target || text(lesson.target).includes(student.name));
}

function lessonClosureAtRiskStudents(lesson) {
  return lessonClosureStudents(lesson).filter((student) => {
    const balance = Number(student.balance || 0);
    return (balance > 0 && balance <= 3) || Number(student.debt || 0) > 0;
  });
}

function lessonClosureFeedbackRows(lesson) {
  if (typeof lessonFeedbacks === "function") return lessonFeedbacks(lesson.id);
  return (appState.lessonFeedbacks || []).filter((item) => item.lessonId === lesson.id);
}

function lessonClosureStatus(lesson) {
  const attendance = lessonClosureAttendanceRecord(lesson);
  const attendanceDone = Boolean(attendance?.updatedAt || lesson.status === "已上课");
  const consumeDone = lesson.status === "已上课";
  const feedbackRows = lessonClosureFeedbackRows(lesson);
  const feedbackSent = feedbackRows.some((item) => item.status === "已发送");
  const feedbackDraft = feedbackRows.length && !feedbackSent;
  const riskStudents = lessonClosureAtRiskStudents(lesson);
  const present = attendance?.records?.filter((item) => typeof canDeductAttendance === "function" && canDeductAttendance(item.status)).length || 0;
  const absent = attendance?.records?.length ? attendance.records.length - present : 0;

  return {
    attendance,
    attendanceDone,
    consumeDone,
    feedbackRows,
    feedbackSent,
    feedbackDraft,
    riskStudents,
    present,
    absent
  };
}

function lessonClosureStepTags(state) {
  return [
    tag(state.attendanceDone ? "点名已完成" : "待点名", state.attendanceDone ? "green" : "amber"),
    tag(state.consumeDone ? "消课已完成" : "待确认上课", state.consumeDone ? "green" : "amber"),
    tag(state.feedbackSent ? "反馈已发送" : state.feedbackDraft ? "反馈草稿" : "待反馈", state.feedbackSent ? "green" : state.feedbackDraft ? "amber" : "red"),
    tag(state.riskStudents.length ? `${state.riskStudents.length} 人需跟进` : "无续费风险", state.riskStudents.length ? "amber" : "green")
  ].join("");
}

function lessonClosureRiskActions(riskStudents) {
  const actions = riskStudents.slice(0, 2).map((student) => {
    const label = Number(student.debt || 0) > 0 ? "欠费跟进" : "续费跟进";
    return `<button class="small-button" type="button" data-student-follow="${escapeHtml(student.id)}">${escapeHtml(student.name)} ${label}</button>`;
  });
  if (riskStudents.length > actions.length) actions.push(`<button class="small-button" type="button" data-go="followUp">更多跟进</button>`);
  return actions.join("");
}

function lessonClosureDialogRiskActions(riskStudents) {
  const actions = riskStudents.slice(0, 2).map((student) => {
    const label = Number(student.debt || 0) > 0 ? "欠费跟进" : "续费跟进";
    return `<button class="small-button" type="button" data-closure-follow="${escapeHtml(student.id)}">${escapeHtml(student.name)} ${label}</button>`;
  });
  if (!actions.length) return `<button class="small-button" type="button" disabled>暂无风险</button>`;
  if (riskStudents.length > actions.length) actions.push(`<button class="small-button" type="button" data-closure-go="followUp">更多跟进</button>`);
  return actions.join("");
}

function renderLessonClosurePanel(lesson) {
  const state = lessonClosureStatus(lesson);
  const nextAction = !state.attendanceDone ? "先点名" : !state.consumeDone ? "确认上课" : !state.feedbackSent ? "写反馈" : state.riskStudents.length ? "去跟进" : "已闭环";
  return `<div class="lesson-closure">
    <div class="lesson-closure-title">
      <strong>课节闭环</strong>
      ${tag(nextAction, nextAction === "已闭环" ? "green" : "amber")}
    </div>
    <div class="lesson-closure-steps">${lessonClosureStepTags(state)}</div>
    <div class="lesson-closure-actions">
      <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}">点名</button>
      <button class="small-button" type="button" data-finish-lesson="${escapeHtml(lesson.id)}" ${state.consumeDone ? "disabled" : ""}>确认上课</button>
      <button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">${state.feedbackSent ? "查看反馈" : "写反馈"}</button>
      <button class="small-button" type="button" data-go="consume">消课流水</button>
      ${lessonClosureRiskActions(state.riskStudents)}
    </div>
  </div>`;
}

function renderLessonClosureDialog(lessonId) {
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson || !attendanceDialogBody) return;
  const state = lessonClosureStatus(lesson);
  const riskNames = state.riskStudents.map((student) => student.name).join("、") || "暂无";
  attendanceDialogBody.innerHTML = `
    <form method="dialog" id="closureGuideForm" data-lesson-id="${escapeHtml(lesson.id)}">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">课节闭环</p>
          <h3>${escapeHtml(lesson.target)}</h3>
          <span class="muted">${escapeHtml(lesson.date)} ${escapeHtml(lesson.time)} · ${escapeHtml(lesson.subject)} · ${escapeHtml(lesson.teacher)}</span>
        </div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <div class="closure-dialog-body">
        <div class="closure-dialog-summary">
          <strong>本节课已确认上课</strong>
          <span class="muted">${escapeHtml(state.present)} 人消课，${escapeHtml(state.absent)} 人未消课。下一步建议完成课后反馈，并同步处理低课时或欠费学员。</span>
          <div class="lesson-closure-steps">${lessonClosureStepTags(state)}</div>
        </div>
        <div class="closure-dialog-grid">
          <div class="closure-step-card">
            <strong>1. 核对点名</strong>
            <span class="muted">确认请假、旷课是否和实际一致。</span>
            <button class="small-button" type="button" data-closure-attendance="${escapeHtml(lesson.id)}">打开点名</button>
          </div>
          <div class="closure-step-card">
            <strong>2. 写课后反馈</strong>
            <span class="muted">按考勤生成家长话术，保存草稿或标记已发送。</span>
            <button class="primary-action" type="button" data-closure-feedback="${escapeHtml(lesson.id)}">${state.feedbackSent ? "查看反馈" : "写反馈"}</button>
          </div>
          <div class="closure-step-card">
            <strong>3. 看消课流水</strong>
            <span class="muted">确认每位到课学员的课时扣减记录。</span>
            <button class="small-button" type="button" data-closure-go="consume">查看流水</button>
          </div>
          <div class="closure-step-card">
            <strong>4. 跟进续费风险</strong>
            <span class="muted">需关注：${escapeHtml(riskNames)}</span>
            <div class="lesson-closure-actions">${lessonClosureDialogRiskActions(state.riskStudents)}</div>
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <span class="muted">老师按顺序处理完后，这节课就形成完整留痕。</span>
        <button class="primary-action" value="cancel" type="submit">稍后处理</button>
      </div>
    </form>`;
  attendanceDialog.showModal();
}

const baseRenderScheduleForClosure = renderSchedule;
renderSchedule = function renderScheduleWithClosureGuide() {
  baseRenderScheduleForClosure();
  appContent.querySelectorAll(".lesson-card").forEach((card) => {
    if (card.querySelector(".lesson-closure")) return;
    const lessonId = card.querySelector("[data-finish-lesson]")?.dataset.finishLesson || card.querySelector("[data-feedback-lesson]")?.dataset.feedbackLesson;
    const lesson = appState.lessons.find((item) => item.id === lessonId);
    if (!lesson) return;
    card.insertAdjacentHTML("beforeend", renderLessonClosurePanel(lesson));
  });
};

const baseFinishLessonForClosure = finishLesson;
finishLesson = function finishLessonWithClosureGuide(lessonId) {
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  const wasDone = lesson?.status === "已上课";
  baseFinishLessonForClosure(lessonId);
  if (lesson && !wasDone && lesson.status === "已上课") renderLessonClosureDialog(lessonId);
};

document.addEventListener("click", (event) => {
  const attendanceButton = event.target.closest("[data-closure-attendance]");
  if (attendanceButton) {
    if (attendanceDialog.open) attendanceDialog.close();
    renderAttendanceDialog(attendanceButton.dataset.closureAttendance);
  }

  const feedbackButton = event.target.closest("[data-closure-feedback]");
  if (feedbackButton) {
    if (attendanceDialog.open) attendanceDialog.close();
    openFeedbackDialogForLesson(feedbackButton.dataset.closureFeedback);
  }

  const goButton = event.target.closest("[data-closure-go]");
  if (goButton) {
    if (attendanceDialog.open) attendanceDialog.close();
    setView(goButton.dataset.closureGo);
  }

  const followButton = event.target.closest("[data-closure-follow]");
  if (followButton) {
    if (attendanceDialog.open) attendanceDialog.close();
    openFollowUpFormForStudent(followButton.dataset.closureFollow);
  }
});
