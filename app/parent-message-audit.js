const parentMessageAuditStyle = document.createElement("style");
parentMessageAuditStyle.textContent = `
  .parent-message-audit-panel {
    margin-top: 16px;
  }

  .parent-message-audit-toolbar {
    align-items: end;
  }

  .parent-message-audit-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .parent-message-audit-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .parent-message-audit-tags,
  .parent-message-audit-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .parent-message-audit-note {
    max-width: 340px;
    line-height: 1.55;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .parent-message-audit-toolbar,
    .parent-message-audit-toolbar label,
    .parent-message-audit-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(parentMessageAuditStyle);

let parentMessageStatusFilter = "open";
let parentMessageRiskFilter = "all";
let parentMessageTeacherFilter = "all";
let parentMessageSortMode = "status";

function parentMessageFeedbackFor(lesson, student) {
  if (typeof ensureFeedbackData === "function") ensureFeedbackData();
  return (appState.lessonFeedbacks || []).find((item) => {
    if (item.lessonId !== lesson.id) return false;
    if (student.id && item.studentId) return item.studentId === student.id;
    return item.student === student.name;
  });
}

function parentMessageRows() {
  if (typeof ensureFeedbackData === "function") ensureFeedbackData();
  const lessons = appState.lessons.filter((lesson) => lesson.status === "已上课");
  return lessons.flatMap((lesson) => {
    const students = typeof feedbackLessonStudents === "function" ? feedbackLessonStudents(lesson) : lessonStudents(lesson);
    const normalizedStudents = students.length ? students : [{ id: "", name: lesson.target, phone: "", balance: 0, debt: 0 }];
    return normalizedStudents.map((student) => {
      const feedback = parentMessageFeedbackFor(lesson, student);
      const attendanceStatus = feedback?.attendanceStatus || (typeof feedbackAttendanceStatus === "function" ? feedbackAttendanceStatus(lesson, student.id) : "未点名");
      const balance = Number(student.balance || 0);
      const debt = Number(student.debt || 0);
      return {
        lesson,
        lessonId: lesson.id,
        date: lesson.date,
        time: lesson.time,
        target: lesson.target,
        subject: lesson.subject,
        teacher: lesson.teacher,
        studentId: student.id || "",
        student: student.name || lesson.target,
        phone: student.phone || "",
        balance,
        debt,
        feedbackId: feedback?.id || "",
        status: feedback?.status || "未生成",
        performance: feedback?.performance || "",
        homework: feedback?.homework || "",
        parentMessage: feedback?.parentMessage || "",
        risk: feedback?.risk || (debt > 0 || balance <= 3 ? "中" : "低"),
        attendanceStatus,
        updatedAt: feedback?.updatedAt || ""
      };
    });
  });
}

function parentMessageReasonItems(row) {
  const reasons = [];
  if (row.status === "未生成") reasons.push({ key: "missing", label: "未生成", tone: "red", score: 0 });
  if (row.status === "草稿") reasons.push({ key: "draft", label: "草稿未发", tone: "amber", score: 1 });
  if (!text(row.parentMessage).trim()) reasons.push({ key: "message", label: "缺家长话术", tone: "red", score: 2 });
  if (!text(row.homework).trim()) reasons.push({ key: "homework", label: "缺作业", tone: "amber", score: 3 });
  if (["请假", "旷课", "未点名"].includes(row.attendanceStatus)) reasons.push({ key: "attendance", label: row.attendanceStatus, tone: row.attendanceStatus === "未点名" ? "red" : "amber", score: 4 });
  if (row.risk === "高") reasons.push({ key: "highRisk", label: "高风险", tone: "red", score: 5 });
  if (row.risk === "中") reasons.push({ key: "midRisk", label: "中风险", tone: "amber", score: 6 });
  if (row.debt > 0) reasons.push({ key: "debt", label: "欠费", tone: "red", score: 7 });
  if (row.balance <= 3) reasons.push({ key: "lowBalance", label: "低课时", tone: "amber", score: 8 });
  if (!reasons.length) reasons.push({ key: "sent", label: "已发送", tone: "green", score: 9 });
  return reasons;
}

function parentMessagePrimaryReason(row) {
  return parentMessageReasonItems(row).slice().sort((left, right) => left.score - right.score)[0];
}

function parentMessageNote(row) {
  if (row.status === "未生成") return "这位学员还没有课后反馈，建议老师打开课节补写家长话术。";
  if (row.status === "草稿") return "反馈已保存但未发送，建议老师确认后标记已发送。";
  if (!text(row.parentMessage).trim()) return "反馈记录缺少家长话术，家长端沟通留痕不完整。";
  if (row.risk === "高") return "高风险学员已反馈后仍需同步续费跟进或教务回访。";
  if (row.debt > 0) return "反馈发送后可提醒前台或学管跟进欠费。";
  if (row.balance <= 3) return "反馈发送后可顺手提醒续费跟进。";
  return "反馈留痕完整，可作为课后沟通记录。";
}

function parentMessageMatchesStatus(row) {
  if (parentMessageStatusFilter === "all") return true;
  if (parentMessageStatusFilter === "open") return row.status !== "已发送" || parentMessageReasonItems(row).some((item) => ["message", "homework", "highRisk", "midRisk", "debt", "lowBalance"].includes(item.key));
  if (parentMessageStatusFilter === "sent") return row.status === "已发送";
  if (parentMessageStatusFilter === "draft") return row.status === "草稿";
  if (parentMessageStatusFilter === "missing") return row.status === "未生成";
  return true;
}

function parentMessageMatchesRisk(row) {
  const keys = new Set(parentMessageReasonItems(row).map((item) => item.key));
  if (parentMessageRiskFilter === "all") return true;
  if (parentMessageRiskFilter === "finance") return keys.has("debt") || keys.has("lowBalance");
  return keys.has(parentMessageRiskFilter) || row.risk === parentMessageRiskFilter;
}

function parentMessageMatchesTeacher(row) {
  return parentMessageTeacherFilter === "all" || row.teacher === parentMessageTeacherFilter;
}

function compareParentMessageRows(left, right) {
  if (parentMessageSortMode === "time") return compareLessonTime(left.lesson, right.lesson) || text(left.student).localeCompare(text(right.student), "zh-CN");
  if (parentMessageSortMode === "student") return text(left.student).localeCompare(text(right.student), "zh-CN") || compareLessonTime(left.lesson, right.lesson);
  if (parentMessageSortMode === "teacher") return text(left.teacher).localeCompare(text(right.teacher), "zh-CN") || compareLessonTime(left.lesson, right.lesson);
  return parentMessagePrimaryReason(left).score - parentMessagePrimaryReason(right).score || compareLessonTime(left.lesson, right.lesson);
}

function visibleParentMessageRows() {
  return parentMessageRows()
    .filter((row) => parentMessageMatchesStatus(row) && parentMessageMatchesRisk(row) && parentMessageMatchesTeacher(row))
    .sort(compareParentMessageRows);
}

function parentMessageSummary(allRows, visibleRows) {
  const missing = allRows.filter((row) => row.status === "未生成").length;
  const draft = allRows.filter((row) => row.status === "草稿").length;
  const sent = allRows.filter((row) => row.status === "已发送").length;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${allRows.length} 条学员反馈</small></div>
      <div class="metric"><span>未生成</span><strong>${missing}</strong><small>每个学员都要有反馈</small></div>
      <div class="metric"><span>草稿未发</span><strong>${draft}</strong><small>需老师确认发送</small></div>
      <div class="metric"><span>已发送</span><strong>${sent}</strong><small>可导出留档</small></div>
    </div>`;
}

function renderParentMessageToolbar() {
  const teachers = [...new Set(appState.lessons.map((lesson) => lesson.teacher).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  return `
    <div class="filters parent-message-audit-toolbar">
      <label>核对状态
        <select id="parentMessageStatusFilter" aria-label="家长通知核对状态">
          <option value="open" ${parentMessageStatusFilter === "open" ? "selected" : ""}>待处理与风险</option>
          <option value="all" ${parentMessageStatusFilter === "all" ? "selected" : ""}>全部记录</option>
          <option value="missing" ${parentMessageStatusFilter === "missing" ? "selected" : ""}>未生成</option>
          <option value="draft" ${parentMessageStatusFilter === "draft" ? "selected" : ""}>草稿未发</option>
          <option value="sent" ${parentMessageStatusFilter === "sent" ? "selected" : ""}>已发送</option>
        </select>
      </label>
      <label>关注类型
        <select id="parentMessageRiskFilter" aria-label="家长通知关注类型">
          <option value="all" ${parentMessageRiskFilter === "all" ? "selected" : ""}>全部关注</option>
          <option value="message" ${parentMessageRiskFilter === "message" ? "selected" : ""}>缺家长话术</option>
          <option value="homework" ${parentMessageRiskFilter === "homework" ? "selected" : ""}>缺作业</option>
          <option value="attendance" ${parentMessageRiskFilter === "attendance" ? "selected" : ""}>考勤异常</option>
          <option value="高" ${parentMessageRiskFilter === "高" ? "selected" : ""}>高风险</option>
          <option value="中" ${parentMessageRiskFilter === "中" ? "selected" : ""}>中风险</option>
          <option value="finance" ${parentMessageRiskFilter === "finance" ? "selected" : ""}>欠费/低课时</option>
        </select>
      </label>
      <label>老师
        <select id="parentMessageTeacherFilter" aria-label="家长通知老师筛选">
          <option value="all" ${parentMessageTeacherFilter === "all" ? "selected" : ""}>全部老师</option>
          ${teachers.map((teacher) => `<option value="${escapeHtml(teacher)}" ${parentMessageTeacherFilter === teacher ? "selected" : ""}>${escapeHtml(teacher)}</option>`).join("")}
        </select>
      </label>
      <label>排序
        <select id="parentMessageSortMode" aria-label="家长通知排序">
          <option value="status" ${parentMessageSortMode === "status" ? "selected" : ""}>优先处理</option>
          <option value="time" ${parentMessageSortMode === "time" ? "selected" : ""}>上课时间</option>
          <option value="teacher" ${parentMessageSortMode === "teacher" ? "selected" : ""}>老师分组</option>
          <option value="student" ${parentMessageSortMode === "student" ? "selected" : ""}>学员姓名</option>
        </select>
      </label>
      <button class="small-button" type="button" data-export="parentMessageAudit">导出核对</button>
    </div>`;
}

function parentMessageReasonTags(row) {
  return `<div class="parent-message-audit-tags">${parentMessageReasonItems(row).map((item) => tag(item.label, item.tone)).join("")}</div>`;
}

function parentMessageFollowAction(row) {
  if (!row.studentId) return `<button class="small-button" type="button" disabled>跟进</button>`;
  let label = "跟进";
  if (row.risk === "高") label = "高风险回访";
  else if (row.debt > 0) label = "欠费跟进";
  else if (row.balance <= 3) label = "续费跟进";
  return `<button class="small-button" type="button" data-student-follow="${escapeHtml(row.studentId)}">${label}</button>`;
}

function renderParentMessageRows(rows) {
  return rows.map((row) => `<tr>
    <td><strong>${escapeHtml(row.date)}</strong><br><span class="muted">${escapeHtml(row.time)} / ${escapeHtml(row.subject)}</span></td>
    <td>${escapeHtml(row.target)}<br><span class="muted">${escapeHtml(row.teacher)}</span></td>
    <td><strong>${escapeHtml(row.student)}</strong><br><span class="muted">${escapeHtml(row.phone || "-")}</span></td>
    <td>${tag(row.status, row.status === "已发送" ? "green" : row.status === "草稿" ? "amber" : "red")}<br><span class="muted">${escapeHtml(row.updatedAt || "-")}</span></td>
    <td>${tag(row.attendanceStatus, row.attendanceStatus === "到课" || row.attendanceStatus === "迟到" ? "green" : "amber")}<br>${tag(`风险${row.risk}`, row.risk === "高" ? "red" : row.risk === "中" ? "amber" : "green")}</td>
    <td class="parent-message-audit-note">${escapeHtml(row.parentMessage || "未填写家长话术")}</td>
    <td class="parent-message-audit-note">${parentMessageReasonTags(row)}<span class="muted">${escapeHtml(parentMessageNote(row))}</span></td>
    <td>
      <div class="parent-message-audit-actions">
        <button class="small-button" type="button" data-feedback-lesson="${escapeHtml(row.lessonId)}">${row.status === "未生成" ? "写反馈" : "编辑"}</button>
        <button class="small-button" type="button" data-student-detail="${escapeHtml(row.studentId)}" ${row.studentId ? "" : "disabled"}>详情</button>
        ${parentMessageFollowAction(row)}
      </div>
    </td>
  </tr>`);
}

function appendParentMessageAuditPanel() {
  if (currentView !== "feedback" || appContent.querySelector(".parent-message-audit-panel")) return;
  const allRows = parentMessageRows();
  const visibleRows = visibleParentMessageRows();
  appContent.insertAdjacentHTML(
    "beforeend",
    `<section class="section parent-message-audit-panel">
      <div class="section-head">
        <div>
          <h3>家长通知核对</h3>
          <span class="muted">按每个学员核对课后反馈是否已生成、已发送，并提示风险沟通。</span>
        </div>
        ${tag(`${visibleRows.length} 条`, visibleRows.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${parentMessageSummary(allRows, visibleRows)}
        ${renderParentMessageToolbar()}
        ${table(["课节", "班级/老师", "学员", "反馈状态", "考勤/风险", "家长话术", "核对建议", "操作"], renderParentMessageRows(visibleRows))}
      </div>
    </section>`
  );
}

function flattenParentMessageAuditRows() {
  return parentMessageRows().map((row) => ({
    lessonId: row.lessonId,
    date: row.date,
    time: row.time,
    target: row.target,
    subject: row.subject,
    teacher: row.teacher,
    studentId: row.studentId,
    student: row.student,
    phone: row.phone,
    attendanceStatus: row.attendanceStatus,
    feedbackStatus: row.status,
    performance: row.performance,
    risk: row.risk,
    homework: row.homework,
    parentMessage: row.parentMessage,
    balance: row.balance,
    debt: row.debt,
    auditStatus: parentMessageReasonItems(row).map((item) => item.label).join("、"),
    note: parentMessageNote(row),
    updatedAt: row.updatedAt
  }));
}

const baseRenderFeedbackForParentMessageAudit = renderFeedback;
renderFeedback = function renderFeedbackWithParentMessageAudit() {
  baseRenderFeedbackForParentMessageAudit();
  appendParentMessageAuditPanel();
};

if (typeof exportDataset === "function") {
  const baseExportDatasetForParentMessageAudit = exportDataset;
  exportDataset = function exportDatasetWithParentMessageAudit(type) {
    if (type !== "parentMessageAudit") {
      baseExportDatasetForParentMessageAudit(type);
      return;
    }
    const columns = [
      ["lessonId", "课节编号"],
      ["date", "日期"],
      ["time", "时间"],
      ["target", "班级/对象"],
      ["subject", "科目"],
      ["teacher", "老师"],
      ["studentId", "学员编号"],
      ["student", "学员"],
      ["phone", "手机号"],
      ["attendanceStatus", "考勤"],
      ["feedbackStatus", "反馈状态"],
      ["performance", "课堂表现"],
      ["risk", "续读风险"],
      ["homework", "课后作业"],
      ["parentMessage", "家长话术"],
      ["balance", "剩余课时"],
      ["debt", "欠费"],
      ["auditStatus", "核对状态"],
      ["note", "处理建议"],
      ["updatedAt", "更新时间"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("家长通知核对.csv", buildCsv(flattenParentMessageAuditRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "家长通知核对.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForParentMessageAudit = renderDataCenter;
  renderDataCenter = function renderDataCenterWithParentMessageAudit() {
    baseRenderDataCenterForParentMessageAudit();
    const dataGrid = appContent.querySelector(".data-grid");
    if (dataGrid && !dataGrid.querySelector('[data-export="parentMessageAudit"]')) {
      const card = document.createElement("article");
      card.className = "data-card";
      card.innerHTML = `<div><span class="muted">家长通知核对</span><strong>${flattenParentMessageAuditRows().length}</strong></div><button class="small-button" type="button" data-export="parentMessageAudit">导出通知</button>`;
      const feedbackCard = dataGrid.querySelector('[data-export="lessonFeedbacks"]')?.closest(".data-card");
      if (feedbackCard) {
        feedbackCard.after(card);
      } else {
        dataGrid.appendChild(card);
      }
    }
    const metricValue = [...appContent.querySelectorAll(".metric")]
      .find((item) => item.textContent.includes("数据表数量"))
      ?.querySelector("strong");
    if (metricValue && dataGrid) metricValue.textContent = String(dataGrid.querySelectorAll(".data-card").length);
  };
}

document.addEventListener("change", (event) => {
  if (event.target.id === "parentMessageStatusFilter") parentMessageStatusFilter = event.target.value;
  if (event.target.id === "parentMessageRiskFilter") parentMessageRiskFilter = event.target.value;
  if (event.target.id === "parentMessageTeacherFilter") parentMessageTeacherFilter = event.target.value;
  if (event.target.id === "parentMessageSortMode") parentMessageSortMode = event.target.value;

  if (["parentMessageStatusFilter", "parentMessageRiskFilter", "parentMessageTeacherFilter", "parentMessageSortMode"].includes(event.target.id) && currentView === "feedback") {
    renderView();
  }
});

if (currentView === "feedback" || currentView === "data") {
  renderView();
}
