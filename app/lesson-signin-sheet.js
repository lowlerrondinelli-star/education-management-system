const lessonSigninStyle = document.createElement("style");
lessonSigninStyle.textContent = `
  .lesson-signin-panel {
    margin-top: 16px;
  }

  .lesson-signin-toolbar {
    align-items: end;
  }

  .lesson-signin-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .lesson-signin-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .lesson-signin-title {
    display: grid;
    gap: 4px;
    min-width: 220px;
  }

  .lesson-signin-tags,
  .lesson-signin-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .lesson-signin-note {
    max-width: 360px;
    white-space: normal;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .lesson-signin-toolbar,
    .lesson-signin-toolbar label,
    .lesson-signin-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(lessonSigninStyle);

let lessonSigninLessonId = "";
let lessonSigninRiskFilter = "all";

function lessonSigninLessons() {
  const today = todayIsoDate();
  return appState.lessons
    .filter((lesson) => lesson.status !== "已取消")
    .slice()
    .sort((left, right) => {
      const leftUpcoming = left.date >= today ? 0 : 1;
      const rightUpcoming = right.date >= today ? 0 : 1;
      return leftUpcoming - rightUpcoming || compareLessonTime(left, right);
    });
}

function lessonSigninSelectedLesson() {
  const lessons = lessonSigninLessons();
  if (!lessons.length) return null;
  if (!lessonSigninLessonId || !lessons.some((lesson) => lesson.id === lessonSigninLessonId)) {
    lessonSigninLessonId = lessons[0].id;
  }
  return lessons.find((lesson) => lesson.id === lessonSigninLessonId) || lessons[0];
}

function lessonSigninOrders(student, lesson) {
  return appState.orders.filter((order) => order.student === student.name && (order.className === lesson.target || order.course === student.course));
}

function lessonSigninAttendanceRecord(lesson) {
  return appState.attendance?.find((item) => item.lessonId === lesson.id);
}

function lessonSigninAttendanceStatus(student, lesson) {
  const record = lessonSigninAttendanceRecord(lesson);
  const row = record?.records?.find((item) => item.studentId === student.id || item.student === student.name);
  return row?.status || "未点名";
}

function lessonSigninStudentRows(lesson) {
  const students = typeof lessonStudents === "function" ? lessonStudents(lesson) : [];
  return students.map((student, index) => {
    const orders = lessonSigninOrders(student, lesson);
    const debt = Math.max(Number(student.debt || 0), orders.reduce((sum, order) => sum + Number(order.debt || 0), 0));
    const balance = Number(student.balance || 0);
    const attendanceStatus = lessonSigninAttendanceStatus(student, lesson);
    const orderText = orders.map((order) => order.id).join("、") || "无关联订单";
    return {
      index: index + 1,
      lessonId: lesson.id,
      studentId: student.id,
      student: student.name,
      phone: student.phone,
      relation: student.relation,
      grade: student.grade,
      school: student.school,
      owner: student.owner || "未分配",
      course: student.course,
      className: student.className,
      balance,
      debt,
      attendanceStatus,
      orderText,
      note: lessonSigninStudentNote(student, balance, debt, attendanceStatus, orderText)
    };
  });
}

function lessonSigninStudentNote(student, balance, debt, attendanceStatus, orderText) {
  const notes = [];
  if (attendanceStatus === "未点名") notes.push("课前待点名");
  if (debt > 0) notes.push(`欠费 ${money(debt)}`);
  if (balance <= 3) notes.push(`余额 ${balance} 课时`);
  if (orderText === "无关联订单" && student.status === "已报名") notes.push("已报名但未匹配订单");
  if (!notes.length) notes.push("可正常上课");
  return notes.join("；");
}

function lessonSigninRiskTags(row) {
  const tags = [];
  if (row.attendanceStatus === "未点名") tags.push(tag("待点名", "amber"));
  else tags.push(tag(row.attendanceStatus, row.attendanceStatus === "到课" || row.attendanceStatus === "迟到" ? "green" : "amber"));
  if (row.debt > 0) tags.push(tag(`欠费 ${money(row.debt)}`, "red"));
  if (row.balance <= 3) tags.push(tag(`余额 ${row.balance}`, "amber"));
  if (!tags.length) tags.push(tag("正常", "green"));
  return `<div class="lesson-signin-tags">${tags.join("")}</div>`;
}

function lessonSigninMatchesRisk(row) {
  if (lessonSigninRiskFilter === "all") return true;
  if (lessonSigninRiskFilter === "attendance") return row.attendanceStatus === "未点名";
  if (lessonSigninRiskFilter === "debt") return row.debt > 0;
  if (lessonSigninRiskFilter === "lowBalance") return row.balance <= 3;
  if (lessonSigninRiskFilter === "normal") return row.attendanceStatus !== "未点名" && row.debt <= 0 && row.balance > 3;
  return true;
}

function lessonSigninVisibleRows(lesson) {
  return lessonSigninStudentRows(lesson)
    .filter(lessonSigninMatchesRisk)
    .sort((left, right) => {
      const leftRisk = Number(left.debt > 0) * 3 + Number(left.balance <= 3) * 2 + Number(left.attendanceStatus === "未点名");
      const rightRisk = Number(right.debt > 0) * 3 + Number(right.balance <= 3) * 2 + Number(right.attendanceStatus === "未点名");
      return rightRisk - leftRisk || text(left.student).localeCompare(text(right.student), "zh-CN");
    });
}

function lessonSigninSummary(lesson, rows, visibleRows) {
  const debt = rows.filter((row) => row.debt > 0).length;
  const lowBalance = rows.filter((row) => row.balance <= 3).length;
  const unmarked = rows.filter((row) => row.attendanceStatus === "未点名").length;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 名学员</small></div>
      <div class="metric"><span>待点名</span><strong>${unmarked}</strong><small>${escapeHtml(lesson.date)} ${escapeHtml(lesson.time)}</small></div>
      <div class="metric"><span>欠费提醒</span><strong>${debt}</strong><small>上课前同步教务</small></div>
      <div class="metric"><span>低课时</span><strong>${lowBalance}</strong><small>建议课后跟进续费</small></div>
    </div>`;
}

function renderLessonSigninToolbar(lesson) {
  const lessons = lessonSigninLessons();
  return `
    <div class="filters lesson-signin-toolbar">
      <label>课节
        <select id="lessonSigninLessonId" aria-label="选择课前签到课节">
          ${lessons
            .map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === lesson.id ? "selected" : ""}>${escapeHtml(item.date)} ${escapeHtml(item.time)} ${escapeHtml(item.target)}</option>`)
            .join("")}
        </select>
      </label>
      <label>重点关注
        <select id="lessonSigninRiskFilter" aria-label="课前签到重点关注筛选">
          <option value="all" ${lessonSigninRiskFilter === "all" ? "selected" : ""}>全部学员</option>
          <option value="attendance" ${lessonSigninRiskFilter === "attendance" ? "selected" : ""}>待点名</option>
          <option value="debt" ${lessonSigninRiskFilter === "debt" ? "selected" : ""}>有欠费</option>
          <option value="lowBalance" ${lessonSigninRiskFilter === "lowBalance" ? "selected" : ""}>低课时</option>
          <option value="normal" ${lessonSigninRiskFilter === "normal" ? "selected" : ""}>正常学员</option>
        </select>
      </label>
      <button class="small-button" type="button" data-export="lessonSignin">导出签到单</button>
      <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}">打开点名</button>
    </div>`;
}

function renderLessonSigninRows(rows) {
  return rows.map((row) => `<tr>
    <td>${row.index}</td>
    <td>
      <div class="lesson-signin-title">
        <strong>${escapeHtml(row.student)}</strong>
        <span class="muted">${escapeHtml(row.studentId)} / ${escapeHtml(row.grade)} / ${escapeHtml(row.school || "-")}</span>
      </div>
    </td>
    <td>${escapeHtml(row.phone)}<br><span class="muted">${escapeHtml(row.relation || "-")}</span></td>
    <td>${tag(`余额 ${row.balance}`, row.balance <= 3 ? "amber" : "green")}<br>${row.debt ? tag(money(row.debt), "red") : tag("无欠费", "green")}</td>
    <td>${lessonSigninRiskTags(row)}</td>
    <td class="lesson-signin-note">${escapeHtml(row.orderText)}<br><span class="muted">${escapeHtml(row.note)}</span></td>
    <td>
      <div class="lesson-signin-actions">
        <button class="small-button" type="button" data-student-detail="${escapeHtml(row.studentId)}">详情</button>
        <button class="small-button" type="button" data-go="followUp">跟进</button>
      </div>
    </td>
  </tr>`);
}

function appendLessonSigninPanel() {
  if (currentView !== "schedule" || appContent.querySelector(".lesson-signin-panel")) return;
  const lesson = lessonSigninSelectedLesson();
  if (!lesson) return;
  const rows = lessonSigninStudentRows(lesson);
  const visibleRows = lessonSigninVisibleRows(lesson);
  const panel = `
    <section class="section lesson-signin-panel">
      <div class="section-head">
        <div>
          <h3>课前签到单</h3>
          <span class="muted">按单节课核对上课名单、联系方式、课时余额、欠费和点名状态。</span>
        </div>
        ${tag(`${visibleRows.length} 人`, visibleRows.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${lessonSigninSummary(lesson, rows, visibleRows)}
        ${renderLessonSigninToolbar(lesson)}
        ${table(["序号", "学员", "联系方式", "课时资金", "签到状态", "订单/备注", "操作"], renderLessonSigninRows(visibleRows))}
      </div>
    </section>`;

  const listPanel = appContent.querySelector(".schedule-list-panel");
  if (listPanel) {
    listPanel.insertAdjacentHTML("beforebegin", panel);
  } else {
    appContent.insertAdjacentHTML("beforeend", panel);
  }
}

function flattenLessonSigninRows() {
  const lesson = lessonSigninSelectedLesson();
  if (!lesson) return [];
  return lessonSigninStudentRows(lesson).map((row) => ({
    lessonId: lesson.id,
    lessonDate: lesson.date,
    lessonTime: lesson.time,
    target: lesson.target,
    subject: lesson.subject,
    teacher: lesson.teacher,
    room: lesson.room,
    index: row.index,
    studentId: row.studentId,
    student: row.student,
    phone: row.phone,
    relation: row.relation,
    grade: row.grade,
    school: row.school,
    owner: row.owner,
    balance: row.balance,
    debt: row.debt,
    attendanceStatus: row.attendanceStatus,
    orders: row.orderText,
    note: row.note
  }));
}

const baseRenderScheduleForSigninSheet = renderSchedule;
renderSchedule = function renderScheduleWithSigninSheet() {
  baseRenderScheduleForSigninSheet();
  appendLessonSigninPanel();
};

if (typeof exportDataset === "function") {
  const baseExportDatasetForLessonSignin = exportDataset;
  exportDataset = function exportDatasetWithLessonSignin(type) {
    if (type !== "lessonSignin") {
      baseExportDatasetForLessonSignin(type);
      return;
    }
    const lesson = lessonSigninSelectedLesson();
    const columns = [
      ["lessonDate", "上课日期"],
      ["lessonTime", "上课时间"],
      ["target", "班级/对象"],
      ["subject", "科目"],
      ["teacher", "教师"],
      ["room", "教室"],
      ["index", "序号"],
      ["studentId", "学员编号"],
      ["student", "学员姓名"],
      ["phone", "手机号"],
      ["relation", "手机号归属人"],
      ["grade", "年级"],
      ["school", "学校"],
      ["owner", "负责人"],
      ["balance", "剩余课时"],
      ["debt", "欠费"],
      ["attendanceStatus", "点名状态"],
      ["orders", "关联订单"],
      ["note", "课前提醒"]
    ].map(([key, label]) => ({ key, label }));
    const fileDate = lesson ? `${lesson.date}-${lesson.target}` : "当前课节";
    downloadText(`课前签到单-${fileDate}.csv`, buildCsv(flattenLessonSigninRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", `课前签到单-${fileDate}.csv 已开始下载。`);
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForLessonSignin = renderDataCenter;
  renderDataCenter = function renderDataCenterWithLessonSignin() {
    baseRenderDataCenterForLessonSignin();
    const dataGrid = appContent.querySelector(".data-grid");
    if (dataGrid && !dataGrid.querySelector('[data-export="lessonSignin"]')) {
      const card = document.createElement("article");
      card.className = "data-card";
      card.innerHTML = `<div><span class="muted">课前签到单</span><strong>${flattenLessonSigninRows().length}</strong></div><button class="small-button" type="button" data-export="lessonSignin">导出签到</button>`;
      const lessonCard = dataGrid.querySelector('[data-export="lessons"]')?.closest(".data-card");
      if (lessonCard) {
        lessonCard.after(card);
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
  if (event.target.id === "lessonSigninLessonId") lessonSigninLessonId = event.target.value;
  if (event.target.id === "lessonSigninRiskFilter") lessonSigninRiskFilter = event.target.value;

  if (["lessonSigninLessonId", "lessonSigninRiskFilter"].includes(event.target.id) && currentView === "schedule") {
    renderView();
  }
});

if (currentView === "schedule" || currentView === "data") {
  renderView();
}
