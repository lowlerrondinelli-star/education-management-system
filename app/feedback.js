const feedbackPerformances = ["进步明显", "课堂稳定", "需加强", "缺勤未评"];
const feedbackRisks = ["低", "中", "高"];

const feedbackStyle = document.createElement("style");
feedbackStyle.textContent = `
  .feedback-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.42fr);gap:14px}
  .feedback-card{border:1px solid var(--line);border-radius:8px;background:#fff;padding:12px;display:grid;gap:8px}
  .feedback-card.warn{border-color:#f2b8a2;background:#fff7f2}
  .feedback-actions{display:flex;gap:8px;flex-wrap:wrap}
  .feedback-note{line-height:1.55;white-space:normal;overflow-wrap:anywhere}
  .feedback-quickbar{border:1px solid var(--line);border-radius:8px;background:#fbfdff;padding:10px;display:grid;gap:10px}
  .feedback-quickbar .feedback-actions{align-items:center}
  .feedback-draft-summary{display:flex;gap:6px;flex-wrap:wrap}
  .feedback-student-row{display:grid;grid-template-columns:minmax(120px,.7fr) 130px 110px minmax(180px,1fr);gap:10px;align-items:start;border:1px solid var(--line);border-radius:8px;padding:10px;background:#fff}
  .feedback-student-row textarea{min-height:72px;resize:vertical}
  .feedback-dialog-body{padding:0 18px 18px;display:grid;gap:12px;max-height:min(76vh,780px);overflow:auto}
  @media (max-width:1080px){.feedback-layout,.feedback-student-row{grid-template-columns:1fr}}
`;
document.head.appendChild(feedbackStyle);

function ensureFeedbackData() {
  if (!Array.isArray(appState.lessonFeedbacks)) appState.lessonFeedbacks = [];
  const completedLessons = appState.lessons.filter((lesson) => lesson.status === "已上课");
  if (!appState.lessonFeedbacks.length && completedLessons.length) {
    const lesson = completedLessons[0];
    const students = feedbackLessonStudents(lesson).slice(0, 2);
    students.forEach((student, index) => {
      appState.lessonFeedbacks.push({
        id: nextId("FB"),
        lessonId: lesson.id,
        date: lesson.date,
        time: lesson.time,
        target: lesson.target,
        subject: lesson.subject,
        teacher: lesson.teacher,
        studentId: student.id || "",
        student: student.name,
        attendanceStatus: feedbackAttendanceStatus(lesson, student.id),
        performance: index === 0 ? "课堂稳定" : "需加强",
        homework: "完成课后练习并订正错题。",
        parentMessage: `${student.name} 本节课整体跟得上，建议课后把错题再复盘一遍。`,
        risk: index === 0 ? "低" : "中",
        status: index === 0 ? "已发送" : "草稿",
        operator: lesson.teacher,
        updatedAt: new Date().toLocaleString("zh-CN", { hour12: false })
      });
    });
  }
}

function feedbackLessonStudents(lesson) {
  if (typeof lessonStudents === "function") {
    const students = lessonStudents(lesson);
    if (students.length) return students;
  }
  const name = text(lesson.target).split("-")[0];
  const matched = appState.students.filter((student) => student.name === name || student.className === lesson.target);
  return matched.length ? matched : [{ id: "", name: lesson.target, balance: "", phone: "" }];
}

function feedbackAttendanceStatus(lesson, studentId) {
  const record = (appState.attendance || []).find((item) => item.lessonId === lesson.id);
  if (!record) return "未点名";
  if (!studentId) return attendanceSummary(lesson);
  return record.records?.find((item) => item.studentId === studentId)?.status || "未点名";
}

function lessonFeedbacks(lessonId) {
  ensureFeedbackData();
  return appState.lessonFeedbacks.filter((item) => item.lessonId === lessonId);
}

function sentFeedbacks() {
  ensureFeedbackData();
  return appState.lessonFeedbacks.filter((item) => item.status === "已发送");
}

function draftFeedbacks() {
  ensureFeedbackData();
  return appState.lessonFeedbacks.filter((item) => item.status !== "已发送");
}

function pendingFeedbackLessons() {
  ensureFeedbackData();
  return appState.lessons
    .filter((lesson) => lesson.status === "已上课")
    .filter((lesson) => !lessonFeedbacks(lesson.id).some((item) => item.status === "已发送"))
    .sort(compareLessonTime);
}

function feedbackTone(item) {
  if (item.status === "已发送") return "green";
  if (item.risk === "高") return "red";
  if (item.risk === "中" || item.status === "草稿") return "amber";
  return "";
}

function feedbackLessonTone(lesson) {
  const records = lessonFeedbacks(lesson.id);
  if (records.some((item) => item.status === "已发送")) return "green";
  if (records.length) return "amber";
  return "red";
}

function flattenFeedbackRows() {
  ensureFeedbackData();
  return appState.lessonFeedbacks.map((item) => ({
    id: item.id,
    lessonId: item.lessonId,
    date: item.date,
    time: item.time,
    target: item.target,
    subject: item.subject,
    teacher: item.teacher,
    student: item.student,
    attendanceStatus: item.attendanceStatus,
    performance: item.performance,
    homework: item.homework,
    parentMessage: item.parentMessage,
    risk: item.risk,
    status: item.status,
    operator: item.operator,
    updatedAt: item.updatedAt
  }));
}

function renderFeedback() {
  ensureFeedbackData();
  const pending = pendingFeedbackLessons();
  const drafts = draftFeedbacks();
  const sent = sentFeedbacks();
  const highRisk = appState.lessonFeedbacks.filter((item) => item.risk === "高" && item.status !== "已发送").length;
  const recentLessons = appState.lessons
    .filter((lesson) => lesson.status === "已上课" && matchesRow(lesson))
    .sort((a, b) => compareLessonTime(b, a));
  const rows = appState.lessonFeedbacks
    .filter(matchesRow)
    .sort((a, b) => text(b.updatedAt).localeCompare(text(a.updatedAt)))
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.student)}</strong><br><span class="muted">${escapeHtml(item.target)}</span></td>
        <td>${escapeHtml(item.date)}<br><span class="muted">${escapeHtml(item.time)}</span></td>
        <td>${escapeHtml(item.subject)}<br><span class="muted">${escapeHtml(item.teacher)}</span></td>
        <td>${tag(item.attendanceStatus, item.attendanceStatus === "到课" || item.attendanceStatus === "迟到" ? "green" : "amber")}</td>
        <td>${tag(item.performance, feedbackTone(item))}<br>${tag(`风险${item.risk}`, item.risk === "高" ? "red" : item.risk === "中" ? "amber" : "green")}</td>
        <td class="feedback-note">${escapeHtml(item.parentMessage)}</td>
        <td>${tag(item.status, feedbackTone(item))}<br><span class="muted">${escapeHtml(item.updatedAt)}</span></td>
        <td><button class="small-button" type="button" data-feedback-lesson="${escapeHtml(item.lessonId)}">编辑</button></td>
      </tr>`
    );
  const lessonCards = pending.slice(0, 5).map(
    (lesson) => `<div class="feedback-card warn">
      <strong>${escapeHtml(lesson.target)} ${tag("待反馈", "red")}</strong>
      <span class="muted">${escapeHtml(lesson.date)} ${escapeHtml(lesson.time)} / ${escapeHtml(lesson.subject)} / ${escapeHtml(lesson.teacher)}</span>
      <div class="feedback-actions">
        <button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">写反馈</button>
      </div>
    </div>`
  );
  const recentRows = recentLessons.slice(0, 8).map(
    (lesson) => `<tr>
      <td>${escapeHtml(lesson.date)}<br><span class="muted">${escapeHtml(lesson.time)}</span></td>
      <td>${escapeHtml(lesson.target)}</td>
      <td>${escapeHtml(lesson.subject)}</td>
      <td>${escapeHtml(lesson.teacher)}</td>
      <td>${tag(lessonFeedbacks(lesson.id).some((item) => item.status === "已发送") ? "已发送" : lessonFeedbacks(lesson.id).length ? "草稿" : "待反馈", feedbackLessonTone(lesson))}</td>
      <td><button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">反馈</button></td>
    </tr>`
  );

  appContent.innerHTML = `
    <div class="summary-grid">
      <div class="metric"><span>待反馈课节</span><strong>${pending.length}</strong></div>
      <div class="metric"><span>反馈草稿</span><strong>${drafts.length}</strong></div>
      <div class="metric"><span>已发送反馈</span><strong>${sent.length}</strong></div>
      <div class="metric"><span>高风险未发</span><strong>${highRisk}</strong></div>
    </div>
    <section class="section">
      <div class="section-head">
        <div>
          <h3>课后反馈工作台</h3>
          <span class="muted">上完课后记录课堂表现、作业、家长话术和续读风险。</span>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("feedback")}
        <div class="feedback-layout">
          <div class="stack-list">${lessonCards.join("") || `<div class="feedback-card"><strong>没有待反馈课节</strong><span class="muted">已上课的课节都会自动出现在这里，老师可以从下方近期课节继续查看。</span></div>`}</div>
          <div class="feedback-card">
            <strong>使用方式</strong>
            <span class="muted">先在课表完成点名和确认上课，再到这里写反馈。标记已发送后，数据中心可导出留档。</span>
            <span class="muted">续读风险为高的学员，建议同步在续费跟进里建待办。</span>
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-head compact-head"><h3>近期已上课节</h3><span class="muted">支持搜索班级、学员、科目和老师</span></div>
      ${table(["日期", "班级/对象", "科目", "教师", "反馈状态", "操作"], recentRows)}
    </section>
    <section class="section">
      <div class="section-head compact-head"><h3>反馈记录</h3><span class="muted">按学员留存，可导出给教务复盘</span></div>
      ${table(["学员", "课节", "科目教师", "考勤", "表现/风险", "家长话术", "状态", "操作"], rows)}
    </section>`;
}

function existingFeedbackMap(lesson) {
  return new Map(lessonFeedbacks(lesson.id).map((item) => [item.studentId || item.student, item]));
}

function defaultParentMessage(student, lesson, attendanceStatus) {
  if (attendanceStatus === "请假") return `${student.name} 本节课请假，建议补看课堂内容并预约补课。`;
  if (attendanceStatus === "旷课") return `${student.name} 本节课未到课，建议尽快联系家长确认原因。`;
  return `${student.name} 本节 ${lesson.subject} 课堂参与正常，课后请完成作业并复盘错题。`;
}

function feedbackDraftCounts(form) {
  const performances = Object.fromEntries(feedbackPerformances.map((item) => [item, 0]));
  const risks = Object.fromEntries(feedbackRisks.map((item) => [item, 0]));
  let missingMessage = 0;
  let missingHomework = 0;
  form.querySelectorAll('select[name^="performance:"]').forEach((select) => {
    performances[select.value] = Number(performances[select.value] || 0) + 1;
  });
  form.querySelectorAll('select[name^="risk:"]').forEach((select) => {
    risks[select.value] = Number(risks[select.value] || 0) + 1;
  });
  form.querySelectorAll('textarea[name^="message:"]').forEach((textarea) => {
    if (!textarea.value.trim()) missingMessage += 1;
  });
  form.querySelectorAll('input[name^="homework:"]').forEach((input) => {
    if (!input.value.trim()) missingHomework += 1;
  });
  return { performances, risks, missingMessage, missingHomework };
}

function renderFeedbackDraftSummary(counts) {
  return `<div class="feedback-draft-summary">
    ${tag(`稳定 ${counts.performances["课堂稳定"] || 0}`, "green")}
    ${tag(`需加强 ${counts.performances["需加强"] || 0}`, "amber")}
    ${tag(`高风险 ${counts.risks["高"] || 0}`, counts.risks["高"] ? "red" : "green")}
    ${tag(`缺话术 ${counts.missingMessage}`, counts.missingMessage ? "red" : "green")}
    ${tag(`缺作业 ${counts.missingHomework}`, counts.missingHomework ? "amber" : "green")}
  </div>`;
}

function updateFeedbackDraftSummary(form) {
  const target = form.querySelector("[data-feedback-draft-summary]");
  if (target) target.innerHTML = renderFeedbackDraftSummary(feedbackDraftCounts(form));
}

function feedbackStudentKeyFromField(field) {
  return text(field?.name).split(":").slice(1).join(":");
}

function feedbackStudentNameForKey(form, key) {
  return text(form.querySelector(`[name="studentName:${CSS.escape(key)}"]`)?.value).trim() || "学员";
}

function feedbackAttendanceForKey(form, key) {
  return text(form.querySelector(`[data-feedback-student-key="${CSS.escape(key)}"]`)?.dataset.attendance || "");
}

function feedbackTemplateMessage(studentName, lesson, attendanceStatus, template) {
  if (template === "progress") return `${studentName} 本节 ${lesson.subject} 状态不错，课堂参与积极，课后继续保持练习节奏。`;
  if (template === "review") return `${studentName} 本节 ${lesson.subject} 基础掌握还需要巩固，建议课后重点复盘错题并完成订正。`;
  return defaultParentMessage({ name: studentName }, lesson, attendanceStatus);
}

function renderFeedbackDialog(lessonId) {
  ensureFeedbackData();
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson) return;
  const existing = existingFeedbackMap(lesson);
  const initialRows = [];
  const rows = feedbackLessonStudents(lesson).map((student) => {
    const record = existing.get(student.id || student.name);
    const attendanceStatus = record?.attendanceStatus || feedbackAttendanceStatus(lesson, student.id);
    const performance = record?.performance || (attendanceStatus === "到课" || attendanceStatus === "迟到" ? "课堂稳定" : "缺勤未评");
    const homework = record?.homework || "完成课后练习并订正错题。";
    const risk = record?.risk || "低";
    const message = record?.parentMessage || defaultParentMessage(student, lesson, attendanceStatus);
    initialRows.push({ performance, risk, homework, message });
    return `<div class="feedback-student-row" data-feedback-student-key="${escapeHtml(student.id || student.name)}" data-attendance="${escapeHtml(attendanceStatus)}">
      <div>
        <strong>${escapeHtml(student.name)}</strong>
        <input type="hidden" name="studentId:${escapeHtml(student.id || student.name)}" value="${escapeHtml(student.id || "")}" />
        <input type="hidden" name="studentName:${escapeHtml(student.id || student.name)}" value="${escapeHtml(student.name)}" />
        <span class="muted">${escapeHtml(attendanceStatus)}</span>
      </div>
      <label>课堂表现<select name="performance:${escapeHtml(student.id || student.name)}">${feedbackPerformances
        .map((item) => `<option ${item === performance ? "selected" : ""}>${escapeHtml(item)}</option>`)
        .join("")}</select></label>
      <label>续读风险<select name="risk:${escapeHtml(student.id || student.name)}">${feedbackRisks
        .map((item) => `<option ${item === risk ? "selected" : ""}>${escapeHtml(item)}</option>`)
        .join("")}</select></label>
      <label>家长话术<textarea name="message:${escapeHtml(student.id || student.name)}">${escapeHtml(message)}</textarea></label>
      <label style="grid-column:1 / -1">课后作业<input name="homework:${escapeHtml(student.id || student.name)}" value="${escapeHtml(homework)}" /></label>
    </div>`;
  });

  attendanceDialogBody.innerHTML = `
    <form method="dialog" id="feedbackForm" data-lesson-id="${escapeHtml(lesson.id)}">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">课后反馈</p>
          <h3>${escapeHtml(lesson.target)}</h3>
          <span class="muted">${escapeHtml(lesson.date)} ${escapeHtml(lesson.time)} · ${escapeHtml(lesson.subject)} · ${escapeHtml(lesson.teacher)}</span>
        </div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <div class="feedback-dialog-body">
        <div class="feedback-quickbar">
          <div class="feedback-actions">
            <button class="small-button" type="button" data-feedback-bulk-performance="课堂稳定">全部稳定</button>
            <button class="small-button" type="button" data-feedback-bulk-performance="需加强">全部需加强</button>
            <button class="small-button" type="button" data-feedback-bulk-risk="低">风险低</button>
            <button class="small-button" type="button" data-feedback-bulk-risk="中">风险中</button>
            <button class="small-button" type="button" data-feedback-bulk-risk="高">风险高</button>
            <button class="small-button" type="button" data-feedback-bulk-homework="完成课后练习并订正错题。">统一作业</button>
            <button class="small-button" type="button" data-feedback-template="normal">按考勤生成话术</button>
            <button class="small-button" type="button" data-feedback-template="progress">进步话术</button>
            <button class="small-button" type="button" data-feedback-template="review">巩固话术</button>
          </div>
          <div data-feedback-draft-summary>${renderFeedbackDraftSummary({
            performances: Object.fromEntries(feedbackPerformances.map((item) => [item, initialRows.filter((row) => row.performance === item).length])),
            risks: Object.fromEntries(feedbackRisks.map((item) => [item, initialRows.filter((row) => row.risk === item).length])),
            missingMessage: initialRows.filter((row) => !text(row.message).trim()).length,
            missingHomework: initialRows.filter((row) => !text(row.homework).trim()).length
          })}</div>
        </div>
        ${rows.join("") || `<div class="stack-item"><span class="muted">当前课节没有匹配学员。</span></div>`}
      </div>
      <div class="dialog-actions">
        <span class="muted">保存草稿不会算已发送；标记已发送适合老师已经微信/短信通知家长后留档。</span>
        <button value="draft" type="submit">保存草稿</button>
        <button class="primary-action" value="sent" type="submit">标记已发送</button>
      </div>
    </form>`;
  attendanceDialog.showModal();
}

function saveLessonFeedback(form, status) {
  ensureFeedbackData();
  const lesson = appState.lessons.find((item) => item.id === form.dataset.lessonId);
  if (!lesson) return;
  const formData = new FormData(form);
  const students = feedbackLessonStudents(lesson);
  const now = new Date().toLocaleString("zh-CN", { hour12: false });
  students.forEach((student) => {
    const key = student.id || student.name;
    const studentId = text(formData.get(`studentId:${key}`));
    const studentName = text(formData.get(`studentName:${key}`)) || student.name;
    const existing = appState.lessonFeedbacks.find((item) => item.lessonId === lesson.id && (studentId ? item.studentId === studentId : item.student === studentName));
    const payload = {
      lessonId: lesson.id,
      date: lesson.date,
      time: lesson.time,
      target: lesson.target,
      subject: lesson.subject,
      teacher: lesson.teacher,
      studentId,
      student: studentName,
      attendanceStatus: feedbackAttendanceStatus(lesson, studentId),
      performance: text(formData.get(`performance:${key}`)),
      homework: text(formData.get(`homework:${key}`)).trim(),
      parentMessage: text(formData.get(`message:${key}`)).trim(),
      risk: text(formData.get(`risk:${key}`)),
      status,
      operator: lesson.teacher,
      updatedAt: now
    };
    if (existing) {
      Object.assign(existing, payload);
    } else {
      appState.lessonFeedbacks.unshift({ id: nextId("FB"), ...payload });
    }
  });
  setNotice("feedback", `${lesson.target} 的课后反馈已${status === "已发送" ? "标记发送" : "保存草稿"}。`);
  saveState();
  attendanceDialog.close();
  setView("feedback");
}

ensureFeedbackData();

const feedbackInsertIndex = navItems.findIndex((item) => item.id === "consume");
navItems.splice(feedbackInsertIndex >= 0 ? feedbackInsertIndex + 1 : navItems.length - 1, 0, { id: "feedback", label: "课后反馈", icon: "评" });
viewMeta.feedback = ["课后服务", "反馈与家长通知"];

const baseRenderNavForFeedback = renderNav;
renderNav = function renderNavWithFeedbackCount() {
  ensureFeedbackData();
  baseRenderNavForFeedback();
  const countNode = navList.querySelector('[data-view="feedback"] .nav-count');
  if (countNode) countNode.textContent = pendingFeedbackLessons().length + draftFeedbacks().length;
};

const baseRenderViewForFeedback = renderView;
renderView = function renderViewWithFeedback() {
  if (currentView === "feedback") {
    renderFeedback();
    return;
  }
  baseRenderViewForFeedback();
};

const baseRenderScheduleForFeedback = renderSchedule;
renderSchedule = function renderScheduleWithFeedbackButtons() {
  baseRenderScheduleForFeedback();
  appContent.querySelectorAll(".lesson-card").forEach((card) => {
    const finishButton = card.querySelector("[data-finish-lesson]");
    const lessonId = finishButton?.dataset.finishLesson;
    const lesson = appState.lessons.find((item) => item.id === lessonId);
    if (!lesson || card.querySelector("[data-feedback-lesson]")) return;
    finishButton?.closest(".attendance-actions")?.insertAdjacentHTML(
      "beforeend",
      `<button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">${lesson.status === "已上课" ? "课后反馈" : "预填反馈"}</button>`
    );
  });
};

if (typeof showStudentProfile === "function") {
  const baseShowStudentProfileForFeedback = showStudentProfile;
  showStudentProfile = function showStudentProfileWithFeedback(studentId) {
    baseShowStudentProfileForFeedback(studentId);
    const student = studentById(studentId);
    if (!student || !studentProfileDialog.open) return;
    const rows = appState.lessonFeedbacks
      .filter((item) => item.studentId === student.id || item.student === student.name)
      .slice(0, 6)
      .map(
        (item) => `<tr>
          <td>${escapeHtml(item.date)}<br><span class="muted">${escapeHtml(item.time)}</span></td>
          <td>${escapeHtml(item.subject)}<br><span class="muted">${escapeHtml(item.teacher)}</span></td>
          <td>${tag(item.performance, feedbackTone(item))}</td>
          <td>${tag(`风险${item.risk}`, item.risk === "高" ? "red" : item.risk === "中" ? "amber" : "green")}</td>
          <td class="feedback-note">${escapeHtml(item.parentMessage)}</td>
          <td>${tag(item.status, feedbackTone(item))}</td>
        </tr>`
      );
    studentProfileDialog.querySelector(".dialog-body")?.insertAdjacentHTML(
      "beforeend",
      `<section class="profile-card">
        <h4>课后反馈</h4>
        ${renderProfileTable(["日期", "科目教师", "表现", "风险", "家长话术", "状态"], rows)}
      </section>`
    );
  };
}

if (typeof exportDataset === "function") {
  const baseExportDatasetForFeedback = exportDataset;
  exportDataset = function exportDatasetWithFeedback(type) {
    if (type !== "lessonFeedbacks") {
      baseExportDatasetForFeedback(type);
      return;
    }
    const columns = [
      ["id", "反馈编号"],
      ["lessonId", "课节编号"],
      ["date", "日期"],
      ["time", "时间"],
      ["target", "班级/对象"],
      ["subject", "科目"],
      ["teacher", "教师"],
      ["student", "学员"],
      ["attendanceStatus", "考勤"],
      ["performance", "课堂表现"],
      ["homework", "课后作业"],
      ["parentMessage", "家长话术"],
      ["risk", "续读风险"],
      ["status", "发送状态"],
      ["operator", "操作人"],
      ["updatedAt", "更新时间"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("课后反馈.csv", buildCsv(flattenFeedbackRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "课后反馈.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForFeedback = renderDataCenter;
  renderDataCenter = function renderDataCenterWithFeedback() {
    baseRenderDataCenterForFeedback();
    const metricValue = [...appContent.querySelectorAll(".metric")]
      .find((item) => item.textContent.includes("数据表数量"))
      ?.querySelector("strong");
    if (metricValue) metricValue.textContent = "23";

    const dataGrid = appContent.querySelector(".data-grid");
    if (!dataGrid || dataGrid.querySelector('[data-export="lessonFeedbacks"]')) return;
    const card = document.createElement("article");
    card.className = "data-card";
    card.innerHTML = `<div><span class="muted">课后反馈</span><strong>${flattenFeedbackRows().length}</strong></div><button class="small-button" type="button" data-export="lessonFeedbacks">导出反馈</button>`;
    const attendanceCard = dataGrid.querySelector('[data-export="attendance"]')?.closest(".data-card");
    if (attendanceCard) {
      attendanceCard.after(card);
    } else {
      dataGrid.appendChild(card);
    }
  };
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-feedback-lesson]");
  if (button) renderFeedbackDialog(button.dataset.feedbackLesson);

  const performanceButton = event.target.closest("[data-feedback-bulk-performance]");
  if (performanceButton) {
    const form = performanceButton.closest("#feedbackForm");
    if (!form) return;
    form.querySelectorAll('select[name^="performance:"]').forEach((select) => {
      select.value = performanceButton.dataset.feedbackBulkPerformance;
    });
    updateFeedbackDraftSummary(form);
  }

  const riskButton = event.target.closest("[data-feedback-bulk-risk]");
  if (riskButton) {
    const form = riskButton.closest("#feedbackForm");
    if (!form) return;
    form.querySelectorAll('select[name^="risk:"]').forEach((select) => {
      select.value = riskButton.dataset.feedbackBulkRisk;
    });
    updateFeedbackDraftSummary(form);
  }

  const homeworkButton = event.target.closest("[data-feedback-bulk-homework]");
  if (homeworkButton) {
    const form = homeworkButton.closest("#feedbackForm");
    if (!form) return;
    form.querySelectorAll('input[name^="homework:"]').forEach((input) => {
      input.value = homeworkButton.dataset.feedbackBulkHomework;
    });
    updateFeedbackDraftSummary(form);
  }

  const templateButton = event.target.closest("[data-feedback-template]");
  if (templateButton) {
    const form = templateButton.closest("#feedbackForm");
    if (!form) return;
    const lesson = appState.lessons.find((item) => item.id === form.dataset.lessonId);
    if (!lesson) return;
    form.querySelectorAll('textarea[name^="message:"]').forEach((textarea) => {
      const key = feedbackStudentKeyFromField(textarea);
      textarea.value = feedbackTemplateMessage(feedbackStudentNameForKey(form, key), lesson, feedbackAttendanceForKey(form, key), templateButton.dataset.feedbackTemplate);
    });
    updateFeedbackDraftSummary(form);
  }
});

document.addEventListener("input", (event) => {
  if (!event.target.matches('textarea[name^="message:"], input[name^="homework:"]')) return;
  const form = event.target.closest("#feedbackForm");
  if (form) updateFeedbackDraftSummary(form);
});

document.addEventListener("change", (event) => {
  if (!event.target.matches('select[name^="performance:"], select[name^="risk:"]')) return;
  const form = event.target.closest("#feedbackForm");
  if (form) updateFeedbackDraftSummary(form);
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "feedbackForm") return;
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  saveLessonFeedback(event.target, event.submitter?.value === "sent" ? "已发送" : "草稿");
});

saveState();
renderNav();
