const attendanceAuditStyle = document.createElement("style");
attendanceAuditStyle.textContent = `
  .attendance-audit-panel {
    margin-top: 16px;
  }

  .attendance-audit-toolbar {
    align-items: end;
  }

  .attendance-audit-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .attendance-audit-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .attendance-audit-tags,
  .attendance-audit-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .attendance-audit-note {
    max-width: 360px;
    white-space: normal;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .attendance-audit-toolbar,
    .attendance-audit-toolbar label,
    .attendance-audit-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(attendanceAuditStyle);

let attendanceAuditStatusFilter = "all";
let attendanceAuditRiskFilter = "all";
let attendanceAuditDateFilter = "all";
let attendanceAuditSortMode = "risk";

function attendanceAuditDateDiff(dateValue) {
  const today = new Date(`${todayIsoDate()}T00:00:00`);
  const date = new Date(`${dateValue}T00:00:00`);
  if (!Number.isFinite(today.getTime()) || !Number.isFinite(date.getTime())) return 0;
  return Math.floor((date - today) / 86400000);
}

function attendanceAuditLessonRecord(lesson) {
  if (typeof ensureAttendanceData === "function") ensureAttendanceData();
  return appState.attendance?.find((record) => record.lessonId === lesson.id);
}

function attendanceAuditLeaveFor(student, lesson) {
  if (typeof ensureLeaveData === "function") ensureLeaveData();
  return (appState.leaveRequests || []).find((item) => item.studentId === student.id && item.lessonId === lesson.id);
}

function attendanceAuditRowNote(row) {
  if (row.attendanceStatus === "未点名") return row.diffDays < 0 ? "历史课节还未保存点名，建议先补点名再确认消课。" : "课前或课后保存点名，避免后续消课缺依据。";
  if (row.attendanceStatus === "请假" && !row.leaveStatus) return "考勤已标请假，但没有找到请假单，建议补登记或核对来源。";
  if (row.attendanceStatus === "请假" && row.leaveStatus !== "已完成") return "请假已留痕，但补课闭环还未完成。";
  if (row.attendanceStatus === "旷课") return "旷课不消课，建议确认是否需要联系家长或转请假。";
  if (row.attendanceStatus === "迟到") return "迟到通常仍消课，建议老师补充课堂备注。";
  if (row.balance <= 3) return "课时余额偏低，课后可同步续费跟进。";
  return "考勤状态正常，可按常规留痕。";
}

function attendanceAuditRows() {
  if (typeof ensureAttendanceData === "function") ensureAttendanceData();
  if (typeof ensureLeaveData === "function") ensureLeaveData();
  return appState.lessons.flatMap((lesson) => {
    const record = attendanceAuditLessonRecord(lesson);
    const students = typeof lessonStudents === "function" ? lessonStudents(lesson) : [];
    return students.map((student) => {
      const attendanceItem = record?.records?.find((item) => item.studentId === student.id || item.student === student.name);
      const leave = attendanceAuditLeaveFor(student, lesson);
      const makeupLesson = leave?.newLessonId ? appState.lessons.find((item) => item.id === leave.newLessonId) : null;
      const row = {
        lessonId: lesson.id,
        studentId: student.id,
        student: student.name,
        phone: student.phone,
        className: student.className,
        grade: student.grade,
        date: lesson.date,
        day: lesson.day || dayFromDate(lesson.date),
        time: lesson.time,
        target: lesson.target,
        subject: lesson.subject,
        teacher: lesson.teacher,
        room: lesson.room,
        lessonStatus: lesson.status,
        attendanceStatus: attendanceItem?.status || "未点名",
        deduct: attendanceItem ? (attendanceItem.deduct ? "是" : "否") : "待确认",
        balance: Number(student.balance || 0),
        debt: Number(student.debt || 0),
        leaveId: leave?.id || "",
        leaveStatus: leave?.status || "",
        makeupPlan: leave?.makeupPlan || "",
        makeupLessonId: leave?.newLessonId || "",
        makeupStatus: makeupLesson?.status || "",
        diffDays: attendanceAuditDateDiff(lesson.date)
      };
      row.note = attendanceAuditRowNote(row);
      return row;
    });
  });
}

function attendanceAuditReasons(row) {
  const reasons = [];
  if (row.attendanceStatus === "未点名") reasons.push({ key: "unmarked", label: row.diffDays < 0 ? "历史未点名" : "待点名", tone: "amber" });
  if (row.attendanceStatus === "迟到") reasons.push({ key: "late", label: "迟到", tone: "amber" });
  if (row.attendanceStatus === "旷课") reasons.push({ key: "absent", label: "旷课", tone: "red" });
  if (row.attendanceStatus === "请假" && !row.leaveStatus) reasons.push({ key: "leaveMissing", label: "缺请假单", tone: "red" });
  if (row.leaveStatus && !["已完成", "已驳回"].includes(row.leaveStatus)) reasons.push({ key: "makeupOpen", label: "补课未闭环", tone: "amber" });
  if (row.makeupLessonId && row.makeupStatus !== "已上课" && row.leaveStatus !== "已完成") reasons.push({ key: "makeupPending", label: "补课待上", tone: "amber" });
  if (row.balance <= 3) reasons.push({ key: "lowBalance", label: "低课时", tone: "amber" });
  if (row.debt > 0) reasons.push({ key: "debt", label: "有欠费", tone: "red" });
  if (!reasons.length) reasons.push({ key: "healthy", label: "正常", tone: "green" });
  return reasons;
}

function attendanceAuditMatchesDate(row) {
  if (attendanceAuditDateFilter === "today") return row.diffDays === 0;
  if (attendanceAuditDateFilter === "next7") return row.diffDays >= 0 && row.diffDays <= 7;
  if (attendanceAuditDateFilter === "past") return row.diffDays < 0;
  if (attendanceAuditDateFilter === "completed") return row.lessonStatus === "已上课";
  return true;
}

function attendanceAuditMatches(row) {
  if (!matchesRow(row)) return false;
  if (attendanceAuditStatusFilter !== "all" && row.attendanceStatus !== attendanceAuditStatusFilter) return false;
  if (attendanceAuditRiskFilter !== "all" && !attendanceAuditReasons(row).some((reason) => reason.key === attendanceAuditRiskFilter)) return false;
  return attendanceAuditMatchesDate(row);
}

function attendanceAuditRiskScore(row) {
  const weights = { absent: 1, leaveMissing: 2, makeupOpen: 3, makeupPending: 4, unmarked: 5, debt: 6, lowBalance: 7, late: 8, healthy: 99 };
  return Math.min(...attendanceAuditReasons(row).map((reason) => weights[reason.key] || 90));
}

function compareAttendanceAuditRows(left, right) {
  if (attendanceAuditSortMode === "timeAsc") return compareLessonTime(left, right);
  if (attendanceAuditSortMode === "timeDesc") return compareLessonTime(right, left);
  if (attendanceAuditSortMode === "student") return text(left.student).localeCompare(text(right.student), "zh-CN") || compareLessonTime(left, right);
  if (attendanceAuditSortMode === "teacher") return text(left.teacher).localeCompare(text(right.teacher), "zh-CN") || compareLessonTime(left, right);
  return attendanceAuditRiskScore(left) - attendanceAuditRiskScore(right) || compareLessonTime(left, right);
}

function renderAttendanceAuditSummary(rows, visibleRows) {
  const unmarked = rows.filter((row) => row.attendanceStatus === "未点名").length;
  const abnormal = rows.filter((row) => ["迟到", "请假", "旷课"].includes(row.attendanceStatus)).length;
  const makeupOpen = rows.filter((row) => attendanceAuditReasons(row).some((reason) => ["makeupOpen", "makeupPending"].includes(reason.key))).length;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 条学员课节</small></div>
      <div class="metric"><span>待点名</span><strong>${unmarked}</strong><small>未保存考勤</small></div>
      <div class="metric"><span>异常考勤</span><strong>${abnormal}</strong><small>迟到、请假、旷课</small></div>
      <div class="metric"><span>补课未闭环</span><strong>${makeupOpen}</strong><small>请假后仍需处理</small></div>
    </div>`;
}

function renderAttendanceAuditToolbar() {
  return `
    <div class="filters attendance-audit-toolbar">
      <label>考勤状态
        <select id="attendanceAuditStatusFilter" aria-label="考勤异常状态筛选">
          <option value="all" ${attendanceAuditStatusFilter === "all" ? "selected" : ""}>全部状态</option>
          <option value="未点名" ${attendanceAuditStatusFilter === "未点名" ? "selected" : ""}>未点名</option>
          <option value="到课" ${attendanceAuditStatusFilter === "到课" ? "selected" : ""}>到课</option>
          <option value="迟到" ${attendanceAuditStatusFilter === "迟到" ? "selected" : ""}>迟到</option>
          <option value="请假" ${attendanceAuditStatusFilter === "请假" ? "selected" : ""}>请假</option>
          <option value="旷课" ${attendanceAuditStatusFilter === "旷课" ? "selected" : ""}>旷课</option>
        </select>
      </label>
      <label>核对重点
        <select id="attendanceAuditRiskFilter" aria-label="考勤异常核对重点筛选">
          <option value="all" ${attendanceAuditRiskFilter === "all" ? "selected" : ""}>全部情况</option>
          <option value="unmarked" ${attendanceAuditRiskFilter === "unmarked" ? "selected" : ""}>待点名</option>
          <option value="late" ${attendanceAuditRiskFilter === "late" ? "selected" : ""}>迟到</option>
          <option value="absent" ${attendanceAuditRiskFilter === "absent" ? "selected" : ""}>旷课</option>
          <option value="leaveMissing" ${attendanceAuditRiskFilter === "leaveMissing" ? "selected" : ""}>缺请假单</option>
          <option value="makeupOpen" ${attendanceAuditRiskFilter === "makeupOpen" ? "selected" : ""}>补课未闭环</option>
          <option value="lowBalance" ${attendanceAuditRiskFilter === "lowBalance" ? "selected" : ""}>低课时</option>
          <option value="debt" ${attendanceAuditRiskFilter === "debt" ? "selected" : ""}>有欠费</option>
          <option value="healthy" ${attendanceAuditRiskFilter === "healthy" ? "selected" : ""}>正常</option>
        </select>
      </label>
      <label>日期范围
        <select id="attendanceAuditDateFilter" aria-label="考勤异常日期筛选">
          <option value="all" ${attendanceAuditDateFilter === "all" ? "selected" : ""}>全部日期</option>
          <option value="today" ${attendanceAuditDateFilter === "today" ? "selected" : ""}>今天</option>
          <option value="next7" ${attendanceAuditDateFilter === "next7" ? "selected" : ""}>未来 7 天</option>
          <option value="past" ${attendanceAuditDateFilter === "past" ? "selected" : ""}>历史课节</option>
          <option value="completed" ${attendanceAuditDateFilter === "completed" ? "selected" : ""}>已上课节</option>
        </select>
      </label>
      <label>排序
        <select id="attendanceAuditSortMode" aria-label="考勤异常排序">
          <option value="risk" ${attendanceAuditSortMode === "risk" ? "selected" : ""}>风险优先</option>
          <option value="timeAsc" ${attendanceAuditSortMode === "timeAsc" ? "selected" : ""}>时间升序</option>
          <option value="timeDesc" ${attendanceAuditSortMode === "timeDesc" ? "selected" : ""}>时间降序</option>
          <option value="student" ${attendanceAuditSortMode === "student" ? "selected" : ""}>学员分组</option>
          <option value="teacher" ${attendanceAuditSortMode === "teacher" ? "selected" : ""}>老师分组</option>
        </select>
      </label>
      <button class="small-button" type="button" data-export="attendanceAudit">导出核对</button>
    </div>`;
}

function renderAttendanceAuditTags(row) {
  return `<div class="attendance-audit-tags">${attendanceAuditReasons(row).map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function renderAttendanceAuditRows(rows) {
  return rows.map((row) => `<tr>
    <td><strong>${escapeHtml(row.student)}</strong><br><span class="muted">${escapeHtml(row.grade)} / ${escapeHtml(row.phone)}</span></td>
    <td><strong>${escapeHtml(row.date)}</strong><br><span class="muted">${escapeHtml(row.day)} ${escapeHtml(row.time)}</span></td>
    <td>${escapeHtml(row.target)}<br><span class="muted">${escapeHtml(row.subject)} / ${escapeHtml(row.teacher)}</span></td>
    <td>${tag(row.attendanceStatus, row.attendanceStatus === "旷课" ? "red" : row.attendanceStatus === "未点名" || row.attendanceStatus === "请假" || row.attendanceStatus === "迟到" ? "amber" : "green")}<br><span class="muted">消课：${escapeHtml(row.deduct)}</span></td>
    <td>${row.leaveStatus ? tag(row.leaveStatus, statusTone(row.leaveStatus)) : tag("无请假单", row.attendanceStatus === "请假" ? "red" : "")}<br><span class="muted">${escapeHtml(row.makeupPlan || "-")}</span></td>
    <td>${row.makeupLessonId ? `${escapeHtml(row.makeupLessonId)}<br><span class="muted">${escapeHtml(row.makeupStatus || "待上课")}</span>` : `<span class="muted">-</span>`}</td>
    <td>${tag(`余额 ${row.balance}`, row.balance <= 3 ? "amber" : "green")}<br>${row.debt ? tag(money(row.debt), "red") : tag("无欠费", "green")}</td>
    <td class="attendance-audit-note">${renderAttendanceAuditTags(row)}<span class="muted">${escapeHtml(row.note)}</span></td>
    <td>
      <div class="attendance-audit-actions">
        <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(row.lessonId)}">点名</button>
        <button class="small-button" type="button" data-student-detail="${escapeHtml(row.studentId)}">学员详情</button>
        ${row.leaveId ? `<button class="small-button" type="button" data-go="leaves">请假台</button>` : `<button class="small-button" type="button" data-lesson-leave="${escapeHtml(row.lessonId)}">补请假</button>`}
      </div>
    </td>
  </tr>`);
}

function appendAttendanceAuditPanel() {
  if (currentView !== "leaves" || appContent.querySelector(".attendance-audit-panel")) return;
  const rows = attendanceAuditRows();
  const visibleRows = rows.filter(attendanceAuditMatches).sort(compareAttendanceAuditRows);
  appContent.insertAdjacentHTML(
    "beforeend",
    `<section class="section attendance-audit-panel">
      <div class="section-head">
        <div>
          <h3>考勤异常核对</h3>
          <span class="muted">把点名、请假、补课、低课时和欠费放在同一张表里，避免请假补课漏闭环。</span>
        </div>
        ${tag(`${visibleRows.length} 条`, visibleRows.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${renderAttendanceAuditSummary(rows, visibleRows)}
        ${renderAttendanceAuditToolbar()}
        ${table(["学员", "课节时间", "班级/课程", "考勤", "请假单", "补课", "课时资金", "核对状态", "操作"], renderAttendanceAuditRows(visibleRows))}
      </div>
    </section>`
  );
}

function flattenAttendanceAuditRows() {
  return attendanceAuditRows().map((row) => ({
    ...row,
    auditStatus: attendanceAuditReasons(row).map((reason) => reason.label).join("、")
  }));
}

const baseRenderLeaveManagementForAttendanceAudit = renderLeaveManagement;
renderLeaveManagement = function renderLeaveManagementWithAttendanceAudit() {
  baseRenderLeaveManagementForAttendanceAudit();
  appendAttendanceAuditPanel();
};

if (typeof exportDataset === "function") {
  const baseExportDatasetForAttendanceAudit = exportDataset;
  exportDataset = function exportDatasetWithAttendanceAudit(type) {
    if (type !== "attendanceAudit") {
      baseExportDatasetForAttendanceAudit(type);
      return;
    }
    const columns = [
      ["student", "学员姓名"],
      ["phone", "手机号"],
      ["className", "班级"],
      ["date", "课节日期"],
      ["time", "课节时间"],
      ["target", "班级/对象"],
      ["subject", "科目"],
      ["teacher", "教师"],
      ["attendanceStatus", "考勤状态"],
      ["deduct", "是否消课"],
      ["leaveId", "请假编号"],
      ["leaveStatus", "请假状态"],
      ["makeupPlan", "补课建议"],
      ["makeupLessonId", "补课课节"],
      ["makeupStatus", "补课状态"],
      ["balance", "剩余课时"],
      ["debt", "欠费"],
      ["auditStatus", "核对状态"],
      ["note", "处理建议"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("考勤异常核对.csv", buildCsv(flattenAttendanceAuditRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "考勤异常核对.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForAttendanceAudit = renderDataCenter;
  renderDataCenter = function renderDataCenterWithAttendanceAudit() {
    baseRenderDataCenterForAttendanceAudit();
    const dataGrid = appContent.querySelector(".data-grid");
    if (dataGrid && !dataGrid.querySelector('[data-export="attendanceAudit"]')) {
      const card = document.createElement("article");
      card.className = "data-card";
      card.innerHTML = `<div><span class="muted">考勤异常核对</span><strong>${flattenAttendanceAuditRows().length}</strong></div><button class="small-button" type="button" data-export="attendanceAudit">导出考勤</button>`;
      const attendanceCard = dataGrid.querySelector('[data-export="attendance"]')?.closest(".data-card");
      if (attendanceCard) {
        attendanceCard.after(card);
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
  if (event.target.id === "attendanceAuditStatusFilter") attendanceAuditStatusFilter = event.target.value;
  if (event.target.id === "attendanceAuditRiskFilter") attendanceAuditRiskFilter = event.target.value;
  if (event.target.id === "attendanceAuditDateFilter") attendanceAuditDateFilter = event.target.value;
  if (event.target.id === "attendanceAuditSortMode") attendanceAuditSortMode = event.target.value;

  if (["attendanceAuditStatusFilter", "attendanceAuditRiskFilter", "attendanceAuditDateFilter", "attendanceAuditSortMode"].includes(event.target.id) && currentView === "leaves") {
    renderView();
  }
});

if (currentView === "leaves" || currentView === "data") {
  renderView();
}
