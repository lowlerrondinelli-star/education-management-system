const teacherHourAuditStyle = document.createElement("style");
teacherHourAuditStyle.textContent = `
  .teacher-hour-panel {
    margin-top: 16px;
  }

  .teacher-hour-toolbar {
    align-items: end;
  }

  .teacher-hour-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .teacher-hour-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .teacher-hour-tags,
  .teacher-hour-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .teacher-hour-note {
    max-width: 320px;
    line-height: 1.55;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .teacher-hour-toolbar,
    .teacher-hour-toolbar label,
    .teacher-hour-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(teacherHourAuditStyle);

let teacherHourTeacherFilter = "all";
let teacherHourStatusFilter = "all";
let teacherHourDateFilter = "all";
let teacherHourSortMode = "issue";

function teacherHourRows() {
  return appState.lessons.map((lesson) => {
    const hours = typeof lessonHours === "function" ? lessonHours(lesson) : Number(lesson.teacherHours || 1);
    const attendanceDone = typeof lessonHasAttendance === "function" ? lessonHasAttendance(lesson) : false;
    const feedbackDone = typeof lessonHasSentFeedback === "function" ? lessonHasSentFeedback(lesson) : false;
    const studentCount = typeof lessonStudents === "function" ? lessonStudents(lesson).length : 0;
    return {
      lessonId: lesson.id,
      date: lesson.date,
      day: lesson.day || dayFromDate(lesson.date),
      time: lesson.time,
      teacher: lesson.teacher || "未分配",
      target: lesson.target,
      subject: lesson.subject,
      room: lesson.room,
      status: lesson.status,
      type: lesson.type || "班级课",
      hours,
      studentCount,
      attendanceDone,
      feedbackDone
    };
  });
}

function teacherHourDateDiff(row) {
  const today = new Date(`${todayIsoDate()}T00:00:00`);
  const date = new Date(`${row.date}T00:00:00`);
  if (!Number.isFinite(today.getTime()) || !Number.isFinite(date.getTime())) return 0;
  return Math.floor((date - today) / 86400000);
}

function teacherHourReasons(row) {
  const reasons = [];
  const diffDays = teacherHourDateDiff(row);
  if (!row.teacher || row.teacher === "未分配") reasons.push({ key: "missingTeacher", label: "缺教师", tone: "red" });
  if (row.status === "待上课" && diffDays < 0) reasons.push({ key: "overdue", label: "历史未处理", tone: "red" });
  if (row.status === "待上课" && !row.attendanceDone) reasons.push({ key: "attendance", label: "待点名", tone: "amber" });
  if (row.status === "已上课" && !row.feedbackDone) reasons.push({ key: "feedback", label: "待反馈", tone: "amber" });
  if (row.status === "已上课" && row.attendanceDone) reasons.push({ key: "settleReady", label: "可核课酬", tone: "green" });
  if (row.status === "已取消") reasons.push({ key: "canceled", label: "已取消", tone: "" });
  if (!reasons.length) reasons.push({ key: "normal", label: "正常", tone: "green" });
  return reasons;
}

function teacherHourMatchesDate(row) {
  const diffDays = teacherHourDateDiff(row);
  if (teacherHourDateFilter === "today") return diffDays === 0;
  if (teacherHourDateFilter === "next7") return diffDays >= 0 && diffDays <= 7;
  if (teacherHourDateFilter === "past") return diffDays < 0;
  if (teacherHourDateFilter === "completed") return row.status === "已上课";
  return true;
}

function teacherHourMatches(row) {
  if (!matchesRow(row)) return false;
  if (teacherHourTeacherFilter !== "all" && row.teacher !== teacherHourTeacherFilter) return false;
  if (teacherHourStatusFilter !== "all" && !teacherHourReasons(row).some((reason) => reason.key === teacherHourStatusFilter)) return false;
  return teacherHourMatchesDate(row);
}

function teacherHourRiskScore(row) {
  const weights = { missingTeacher: 1, overdue: 2, attendance: 3, feedback: 4, settleReady: 6, normal: 7, canceled: 8 };
  return Math.min(...teacherHourReasons(row).map((reason) => weights[reason.key] || 9));
}

function compareTeacherHourRows(left, right) {
  if (teacherHourSortMode === "timeAsc") return compareLessonTime(left, right);
  if (teacherHourSortMode === "timeDesc") return compareLessonTime(right, left);
  if (teacherHourSortMode === "teacher") {
    const teacherGap = text(left.teacher).localeCompare(text(right.teacher), "zh-CN");
    return teacherGap || compareLessonTime(left, right);
  }
  if (teacherHourSortMode === "hoursDesc") return Number(right.hours || 0) - Number(left.hours || 0);
  const issueGap = teacherHourRiskScore(left) - teacherHourRiskScore(right);
  return issueGap || compareLessonTime(left, right);
}

function teacherHourSelectOptions(values, selectedValue, allLabel) {
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function renderTeacherHourToolbar(rows) {
  const teachers = [...new Set(rows.map((row) => row.teacher).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return `
    <div class="filters teacher-hour-toolbar">
      <label>教师
        <select id="teacherHourTeacherFilter" aria-label="教师课时核对教师筛选">
          ${teacherHourSelectOptions(teachers, teacherHourTeacherFilter, "全部教师")}
        </select>
      </label>
      <label>核对状态
        <select id="teacherHourStatusFilter" aria-label="教师课时核对状态筛选">
          <option value="all" ${teacherHourStatusFilter === "all" ? "selected" : ""}>全部状态</option>
          <option value="overdue" ${teacherHourStatusFilter === "overdue" ? "selected" : ""}>历史未处理</option>
          <option value="attendance" ${teacherHourStatusFilter === "attendance" ? "selected" : ""}>待点名</option>
          <option value="feedback" ${teacherHourStatusFilter === "feedback" ? "selected" : ""}>待反馈</option>
          <option value="settleReady" ${teacherHourStatusFilter === "settleReady" ? "selected" : ""}>可核课酬</option>
          <option value="canceled" ${teacherHourStatusFilter === "canceled" ? "selected" : ""}>已取消</option>
          <option value="normal" ${teacherHourStatusFilter === "normal" ? "selected" : ""}>正常</option>
        </select>
      </label>
      <label>日期范围
        <select id="teacherHourDateFilter" aria-label="教师课时核对日期筛选">
          <option value="all" ${teacherHourDateFilter === "all" ? "selected" : ""}>全部日期</option>
          <option value="today" ${teacherHourDateFilter === "today" ? "selected" : ""}>今天</option>
          <option value="next7" ${teacherHourDateFilter === "next7" ? "selected" : ""}>未来 7 天</option>
          <option value="past" ${teacherHourDateFilter === "past" ? "selected" : ""}>历史课节</option>
          <option value="completed" ${teacherHourDateFilter === "completed" ? "selected" : ""}>已上课节</option>
        </select>
      </label>
      <label>排序
        <select id="teacherHourSortMode" aria-label="教师课时核对排序">
          <option value="issue" ${teacherHourSortMode === "issue" ? "selected" : ""}>问题优先</option>
          <option value="timeAsc" ${teacherHourSortMode === "timeAsc" ? "selected" : ""}>时间升序</option>
          <option value="timeDesc" ${teacherHourSortMode === "timeDesc" ? "selected" : ""}>时间降序</option>
          <option value="teacher" ${teacherHourSortMode === "teacher" ? "selected" : ""}>教师分组</option>
          <option value="hoursDesc" ${teacherHourSortMode === "hoursDesc" ? "selected" : ""}>课时降序</option>
        </select>
      </label>
    </div>`;
}

function teacherHourSummary(rows, visibleRows) {
  const doneHours = rows.filter((row) => row.status === "已上课").reduce((sum, row) => sum + Number(row.hours || 0), 0);
  const readyHours = rows
    .filter((row) => teacherHourReasons(row).some((reason) => reason.key === "settleReady"))
    .reduce((sum, row) => sum + Number(row.hours || 0), 0);
  const attendance = rows.filter((row) => teacherHourReasons(row).some((reason) => reason.key === "attendance")).length;
  const feedback = rows.filter((row) => teacherHourReasons(row).some((reason) => reason.key === "feedback")).length;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 节课</small></div>
      <div class="metric"><span>已上课时</span><strong>${doneHours}</strong><small>可核课酬 ${readyHours} 小时</small></div>
      <div class="metric"><span>待点名</span><strong>${attendance}</strong><small>先补考勤再结算</small></div>
      <div class="metric"><span>待反馈</span><strong>${feedback}</strong><small>课后服务留痕</small></div>
    </div>`;
}

function renderTeacherHourTags(row) {
  return `<div class="teacher-hour-tags">${teacherHourReasons(row).map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function renderTeacherHourRows(rows) {
  return rows.map((row) => `<tr>
    <td><strong>${escapeHtml(row.date)}</strong><br><span class="muted">${escapeHtml(row.day)} ${escapeHtml(row.time)}</span></td>
    <td>${escapeHtml(row.teacher)}<br><span class="muted">${escapeHtml(row.room || "-")}</span></td>
    <td>${escapeHtml(row.target)}<br><span class="muted">${escapeHtml(row.type)} / ${escapeHtml(row.subject)} / ${row.studentCount} 人</span></td>
    <td>${tag(row.status, statusTone(row.status))}</td>
    <td>${row.hours}</td>
    <td>${tag(row.attendanceDone ? "已点名" : "未点名", row.attendanceDone ? "green" : "amber")}</td>
    <td>${tag(row.feedbackDone ? "已反馈" : row.status === "已上课" ? "待反馈" : "未到反馈", row.feedbackDone ? "green" : row.status === "已上课" ? "amber" : "")}</td>
    <td class="teacher-hour-note">${renderTeacherHourTags(row)}</td>
    <td>
      <div class="teacher-hour-actions">
        <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(row.lessonId)}" ${row.status === "已取消" ? "disabled" : ""}>点名</button>
        <button class="small-button" type="button" data-feedback-lesson="${escapeHtml(row.lessonId)}">反馈</button>
      </div>
    </td>
  </tr>`);
}

function appendTeacherHourAudit() {
  if (currentView !== "reports" || appContent.querySelector(".teacher-hour-panel")) return;
  const rows = teacherHourRows();
  const visibleRows = rows.filter(teacherHourMatches).sort(compareTeacherHourRows);

  appContent.insertAdjacentHTML(
    "beforeend",
    `<section class="section teacher-hour-panel">
      <div class="section-head">
        <div>
          <h3>教师课时核对</h3>
          <span class="muted">按课节核对教师排课小时、点名、反馈和可核课酬状态，便于月底结算前查漏。</span>
        </div>
        ${tag(`${visibleRows.length} 节`, visibleRows.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${teacherHourSummary(rows, visibleRows)}
        ${renderTeacherHourToolbar(rows)}
        ${table(["日期时间", "教师/教室", "班级/对象", "课节状态", "小时", "点名", "反馈", "核对状态", "操作"], renderTeacherHourRows(visibleRows))}
      </div>
    </section>`
  );
}

const baseRenderReportsForTeacherHourAudit = renderReports;
renderReports = function renderReportsWithTeacherHourAudit() {
  baseRenderReportsForTeacherHourAudit();
  appendTeacherHourAudit();
};

function flattenTeacherHourAuditRows() {
  return teacherHourRows().map((row) => ({
    ...row,
    attendanceStatus: row.attendanceDone ? "已点名" : "未点名",
    feedbackStatus: row.feedbackDone ? "已反馈" : row.status === "已上课" ? "待反馈" : "未到反馈",
    auditStatus: teacherHourReasons(row).map((reason) => reason.label).join("、")
  }));
}

if (typeof exportDataset === "function") {
  const baseExportDatasetForTeacherHourAudit = exportDataset;
  exportDataset = function exportDatasetWithTeacherHourAudit(type) {
    if (type !== "teacherHourAudit") {
      baseExportDatasetForTeacherHourAudit(type);
      return;
    }
    const columns = [
      ["lessonId", "课节编号"],
      ["date", "日期"],
      ["day", "星期"],
      ["time", "时间"],
      ["teacher", "教师"],
      ["target", "班级/对象"],
      ["subject", "科目"],
      ["room", "教室"],
      ["type", "课节类型"],
      ["studentCount", "学员数"],
      ["status", "课节状态"],
      ["hours", "教师小时"],
      ["attendanceStatus", "点名状态"],
      ["feedbackStatus", "反馈状态"],
      ["auditStatus", "核对状态"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("教师课时核对.csv", buildCsv(flattenTeacherHourAuditRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "教师课时核对.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForTeacherHourAudit = renderDataCenter;
  renderDataCenter = function renderDataCenterWithTeacherHourAudit() {
    baseRenderDataCenterForTeacherHourAudit();
    const metricValue = [...appContent.querySelectorAll(".metric")]
      .find((item) => item.textContent.includes("数据表数量"))
      ?.querySelector("strong");
    if (metricValue) metricValue.textContent = "25";

    const dataGrid = appContent.querySelector(".data-grid");
    if (!dataGrid || dataGrid.querySelector('[data-export="teacherHourAudit"]')) return;
    const card = document.createElement("article");
    card.className = "data-card";
    card.innerHTML = `<div><span class="muted">教师课时核对</span><strong>${flattenTeacherHourAuditRows().length}</strong></div><button class="small-button" type="button" data-export="teacherHourAudit">导出课时</button>`;
    const reportCard = dataGrid.querySelector('[data-export="reports"]')?.closest(".data-card");
    if (reportCard) {
      reportCard.after(card);
    } else {
      dataGrid.appendChild(card);
    }
  };
}

document.addEventListener("change", (event) => {
  if (event.target.id === "teacherHourTeacherFilter") teacherHourTeacherFilter = event.target.value;
  if (event.target.id === "teacherHourStatusFilter") teacherHourStatusFilter = event.target.value;
  if (event.target.id === "teacherHourDateFilter") teacherHourDateFilter = event.target.value;
  if (event.target.id === "teacherHourSortMode") teacherHourSortMode = event.target.value;

  if (["teacherHourTeacherFilter", "teacherHourStatusFilter", "teacherHourDateFilter", "teacherHourSortMode"].includes(event.target.id) && currentView === "reports") {
    renderView();
  }
});

if (currentView === "reports" || currentView === "data") {
  renderView();
}
