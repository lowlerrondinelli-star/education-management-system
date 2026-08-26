const lessonPrepStyle = document.createElement("style");
lessonPrepStyle.textContent = `
  .lesson-prep-panel {
    margin-top: 16px;
  }

  .lesson-prep-toolbar {
    align-items: end;
  }

  .lesson-prep-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .lesson-prep-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .lesson-prep-tags,
  .lesson-prep-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .lesson-prep-note {
    max-width: 320px;
    line-height: 1.55;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .lesson-prep-toolbar,
    .lesson-prep-toolbar label,
    .lesson-prep-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(lessonPrepStyle);

let lessonPrepWindowFilter = "next7";
let lessonPrepRiskFilter = "focus";
let lessonPrepSortMode = "time";

function lessonPrepDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function lessonPrepDiffDays(lesson) {
  const today = lessonPrepDate(todayIsoDate());
  const lessonDate = lessonPrepDate(lesson.date);
  if (!today || !lessonDate) return 0;
  return Math.floor((lessonDate - today) / 86400000);
}

function lessonPrepLessonStudents(lesson) {
  return typeof lessonStudents === "function" ? lessonStudents(lesson) : [];
}

function lessonPrepAttendanceRecord(lesson) {
  if (typeof ensureAttendanceData === "function") ensureAttendanceData();
  return appState.attendance?.find((record) => record.lessonId === lesson.id);
}

function lessonPrepStudentAttendance(lesson, student) {
  if (!student) return null;
  return lessonPrepAttendanceRecord(lesson)?.records?.find((record) => record.studentId === student.id) || null;
}

function lessonPrepLeaveFor(lesson, student) {
  if (!student) return null;
  if (typeof ensureLeaveData === "function") ensureLeaveData();
  return (appState.leaveRequests || []).find((item) => item.lessonId === lesson.id && item.studentId === student.id) || null;
}

function lessonPrepMakeupText(leave) {
  if (!leave) return "";
  if (!leave.newLessonId) return leave.makeupPlan || "未安排补课";
  const makeupLesson = appState.lessons.find((lesson) => lesson.id === leave.newLessonId);
  return makeupLesson ? `${makeupLesson.date} ${makeupLesson.time} ${makeupLesson.status}` : leave.newLessonId;
}

function lessonPrepRowReasons(row) {
  const reasons = [];
  if (row.rosterMissing) reasons.push({ key: "roster", label: "名单缺失", tone: "red", score: 0 });
  if (row.attendanceStatus === "未点名" && row.lessonStatus !== "已取消") reasons.push({ key: "attendance", label: "待点名", tone: "amber", score: 1 });
  if (row.leaveStatus && !["已完成", "已驳回"].includes(row.leaveStatus)) reasons.push({ key: "leave", label: "请假待闭环", tone: "amber", score: 2 });
  if (row.makeupStatus && row.makeupStatus !== "已上课" && row.leaveStatus !== "已完成") reasons.push({ key: "makeup", label: "补课待上", tone: "amber", score: 3 });
  if (row.debt > 0) reasons.push({ key: "debt", label: "欠费", tone: "red", score: 4 });
  if (row.balance <= 3 && !row.rosterMissing) reasons.push({ key: "lowBalance", label: "低课时", tone: "amber", score: 5 });
  if (row.lessonStatus === "已上课" && typeof lessonHasSentFeedback === "function" && !lessonHasSentFeedback(row.lesson)) reasons.push({ key: "feedback", label: "课后待反馈", tone: "red", score: 6 });
  if (!reasons.length) reasons.push({ key: "ready", label: "准备正常", tone: "green", score: 9 });
  return reasons;
}

function lessonPrepPrimaryReason(row) {
  return lessonPrepRowReasons(row).slice().sort((left, right) => left.score - right.score)[0];
}

function lessonPrepNote(row) {
  if (row.rosterMissing) return "没有匹配到学员，课前先核对班级名称或 1 对 1 学员姓名。";
  if (row.leaveStatus && !["已完成", "已驳回"].includes(row.leaveStatus)) return "本节课有关联请假单，课前确认是否到课，并跟进补课安排。";
  if (row.attendanceStatus === "请假" && !row.leaveStatus) return "考勤已标请假但没有请假单，建议补登记，避免补课遗漏。";
  if (row.debt > 0) return "学员存在欠费，课后同步学管或前台跟进缴费。";
  if (row.balance <= 3) return "剩余课时偏低，课后提醒续费跟进。";
  if (row.attendanceStatus === "未点名") return "课前确认到课名单，课后及时保存点名和消课。";
  if (row.lessonStatus === "已上课") return "课节已完成，确认课后反馈和家长沟通是否留痕。";
  return "课前准备正常，按常规点名、授课和反馈。";
}

function lessonPrepRowsForLesson(lesson) {
  const students = lessonPrepLessonStudents(lesson);
  if (!students.length) {
    return [
      {
        lesson,
        lessonId: lesson.id,
        date: lesson.date,
        time: lesson.time,
        target: lesson.target,
        subject: lesson.subject,
        teacher: lesson.teacher,
        room: lesson.room,
        lessonStatus: lesson.status,
        studentId: "",
        student: "未匹配学员",
        phone: "",
        grade: "",
        balance: 0,
        debt: 0,
        attendanceStatus: "未点名",
        deduct: "待确认",
        leaveId: "",
        leaveStatus: "",
        makeup: "",
        makeupStatus: "",
        rosterMissing: true
      }
    ];
  }

  return students.map((student) => {
    const attendance = lessonPrepStudentAttendance(lesson, student);
    const leave = lessonPrepLeaveFor(lesson, student);
    const makeupLesson = leave?.newLessonId ? appState.lessons.find((item) => item.id === leave.newLessonId) : null;
    return {
      lesson,
      lessonId: lesson.id,
      date: lesson.date,
      time: lesson.time,
      target: lesson.target,
      subject: lesson.subject,
      teacher: lesson.teacher,
      room: lesson.room,
      lessonStatus: lesson.status,
      studentId: student.id,
      student: student.name,
      phone: student.phone,
      grade: student.grade,
      balance: Number(student.balance || 0),
      debt: Number(student.debt || 0),
      attendanceStatus: attendance?.status || "未点名",
      deduct: attendance ? (attendance.deduct ? "是" : "否") : "待确认",
      leaveId: leave?.id || "",
      leaveStatus: leave?.status || "",
      makeup: lessonPrepMakeupText(leave),
      makeupStatus: makeupLesson?.status || "",
      rosterMissing: false
    };
  });
}

function lessonPrepRows(lessons = appState.lessons) {
  return lessons.flatMap(lessonPrepRowsForLesson).map((row) => ({
    ...row,
    note: lessonPrepNote(row),
    prepStatus: lessonPrepRowReasons(row).map((reason) => reason.label).join("、")
  }));
}

function lessonPrepMatchesWindow(row) {
  const diffDays = lessonPrepDiffDays(row.lesson);
  if (lessonPrepWindowFilter === "today") return diffDays === 0;
  if (lessonPrepWindowFilter === "next7") return diffDays >= 0 && diffDays <= 7;
  if (lessonPrepWindowFilter === "past") return diffDays < 0;
  if (lessonPrepWindowFilter === "completed") return row.lessonStatus === "已上课";
  return true;
}

function lessonPrepMatchesRisk(row) {
  const keys = new Set(lessonPrepRowReasons(row).map((reason) => reason.key));
  if (lessonPrepRiskFilter === "all") return true;
  if (lessonPrepRiskFilter === "focus") return !keys.has("ready");
  return keys.has(lessonPrepRiskFilter);
}

function compareLessonPrepRows(left, right) {
  if (lessonPrepSortMode === "risk") {
    const riskGap = lessonPrepPrimaryReason(left).score - lessonPrepPrimaryReason(right).score;
    return riskGap || compareLessonTime(left.lesson, right.lesson) || text(left.student).localeCompare(text(right.student), "zh-CN");
  }
  if (lessonPrepSortMode === "student") return text(left.student).localeCompare(text(right.student), "zh-CN") || compareLessonTime(left.lesson, right.lesson);
  if (lessonPrepSortMode === "teacher") return text(left.teacher).localeCompare(text(right.teacher), "zh-CN") || compareLessonTime(left.lesson, right.lesson);
  return compareLessonTime(left.lesson, right.lesson) || text(left.student).localeCompare(text(right.student), "zh-CN");
}

function visibleLessonPrepRows() {
  const lessons = typeof teacherDeskLessons === "function" ? teacherDeskLessons() : appState.lessons;
  return lessonPrepRows(lessons)
    .filter((row) => lessonPrepMatchesWindow(row) && lessonPrepMatchesRisk(row))
    .sort(compareLessonPrepRows);
}

function lessonPrepSummary(allRows, visibleRows) {
  const focus = allRows.filter((row) => !lessonPrepRowReasons(row).some((reason) => reason.key === "ready")).length;
  const attendance = allRows.filter((row) => lessonPrepRowReasons(row).some((reason) => reason.key === "attendance")).length;
  const finance = allRows.filter((row) => lessonPrepRowReasons(row).some((reason) => ["debt", "lowBalance"].includes(reason.key))).length;

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${allRows.length} 条准备项</small></div>
      <div class="metric"><span>需关注</span><strong>${focus}</strong><small>名单、请假、欠费或低课时</small></div>
      <div class="metric"><span>待点名</span><strong>${attendance}</strong><small>课前课后需保存考勤</small></div>
      <div class="metric"><span>资金提醒</span><strong>${finance}</strong><small>欠费或余额不高</small></div>
    </div>`;
}

function renderLessonPrepToolbar() {
  return `
    <div class="filters lesson-prep-toolbar">
      <label>时间范围
        <select id="lessonPrepWindowFilter" aria-label="课前准备时间范围">
          <option value="next7" ${lessonPrepWindowFilter === "next7" ? "selected" : ""}>未来 7 天</option>
          <option value="today" ${lessonPrepWindowFilter === "today" ? "selected" : ""}>今天</option>
          <option value="past" ${lessonPrepWindowFilter === "past" ? "selected" : ""}>历史课节</option>
          <option value="completed" ${lessonPrepWindowFilter === "completed" ? "selected" : ""}>已上课节</option>
          <option value="all" ${lessonPrepWindowFilter === "all" ? "selected" : ""}>全部课节</option>
        </select>
      </label>
      <label>关注类型
        <select id="lessonPrepRiskFilter" aria-label="课前准备关注类型">
          <option value="focus" ${lessonPrepRiskFilter === "focus" ? "selected" : ""}>只看需关注</option>
          <option value="all" ${lessonPrepRiskFilter === "all" ? "selected" : ""}>全部准备项</option>
          <option value="attendance" ${lessonPrepRiskFilter === "attendance" ? "selected" : ""}>待点名</option>
          <option value="leave" ${lessonPrepRiskFilter === "leave" ? "selected" : ""}>请假待闭环</option>
          <option value="makeup" ${lessonPrepRiskFilter === "makeup" ? "selected" : ""}>补课待上</option>
          <option value="debt" ${lessonPrepRiskFilter === "debt" ? "selected" : ""}>欠费</option>
          <option value="lowBalance" ${lessonPrepRiskFilter === "lowBalance" ? "selected" : ""}>低课时</option>
          <option value="roster" ${lessonPrepRiskFilter === "roster" ? "selected" : ""}>名单缺失</option>
        </select>
      </label>
      <label>排序
        <select id="lessonPrepSortMode" aria-label="课前准备排序">
          <option value="time" ${lessonPrepSortMode === "time" ? "selected" : ""}>按上课时间</option>
          <option value="risk" ${lessonPrepSortMode === "risk" ? "selected" : ""}>按风险优先</option>
          <option value="student" ${lessonPrepSortMode === "student" ? "selected" : ""}>按学员姓名</option>
          <option value="teacher" ${lessonPrepSortMode === "teacher" ? "selected" : ""}>按老师姓名</option>
        </select>
      </label>
      <button class="small-button" type="button" data-export="lessonPrep">导出清单</button>
    </div>`;
}

function lessonPrepReasonTags(row) {
  return `<div class="lesson-prep-tags">${lessonPrepRowReasons(row).map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function renderLessonPrepRows(rows) {
  return rows.map((row) => {
    const finance = `${tag(`余额 ${row.balance}`, row.balance <= 3 && !row.rosterMissing ? "amber" : "green")} ${row.debt > 0 ? tag(`欠费 ${money(row.debt)}`, "red") : tag("无欠费", "green")}`;
    return `<tr>
      <td><strong>${escapeHtml(row.date)}</strong><br><span class="muted">${escapeHtml(dayFromDate(row.date))} ${escapeHtml(row.time)}</span></td>
      <td>${escapeHtml(row.target)}<br><span class="muted">${escapeHtml(row.subject)} / ${escapeHtml(row.teacher)} / ${escapeHtml(row.room || "未分教室")}</span></td>
      <td><strong>${escapeHtml(row.student)}</strong><br><span class="muted">${escapeHtml([row.grade, row.phone].filter(Boolean).join(" / ") || "-")}</span></td>
      <td>${tag(row.attendanceStatus, row.attendanceStatus === "未点名" ? "amber" : statusTone(row.attendanceStatus))}<br><span class="muted">消课：${escapeHtml(row.deduct)}</span></td>
      <td>${row.leaveStatus ? tag(row.leaveStatus, statusTone(row.leaveStatus)) : tag("无请假", "green")}<br><span class="muted">${escapeHtml(row.makeup || "-")}</span></td>
      <td>${finance}</td>
      <td class="lesson-prep-note">${lessonPrepReasonTags(row)}<span class="muted">${escapeHtml(row.note)}</span></td>
      <td>
        <div class="lesson-prep-actions">
          <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(row.lessonId)}" ${row.lessonStatus === "已取消" ? "disabled" : ""}>点名</button>
          <button class="small-button" type="button" data-student-detail="${escapeHtml(row.studentId)}" ${row.studentId ? "" : "disabled"}>详情</button>
          <button class="small-button" type="button" data-schedule-leave="${escapeHtml(row.lessonId)}" ${row.lessonStatus === "已取消" || row.rosterMissing ? "disabled" : ""}>请假</button>
          <button class="small-button" type="button" data-go="followUp" ${row.rosterMissing ? "disabled" : ""}>跟进</button>
        </div>
      </td>
    </tr>`;
  });
}

function appendLessonPrepPanel() {
  if (currentView !== "teacherDesk" || appContent.querySelector(".lesson-prep-panel")) return;
  const lessons = typeof teacherDeskLessons === "function" ? teacherDeskLessons() : appState.lessons;
  const allRows = lessonPrepRows(lessons);
  const visibleRows = visibleLessonPrepRows();
  const panel = `
    <section class="section lesson-prep-panel">
      <div class="section-head">
        <div>
          <h3>课前准备清单</h3>
          <span class="muted">给老师课前检查名单、点名、请假补课、欠费和低课时提醒。</span>
        </div>
        ${tag(`${visibleRows.length} 项`, visibleRows.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${lessonPrepSummary(allRows, visibleRows)}
        ${renderLessonPrepToolbar()}
        ${table(["课节时间", "班级/课程", "学员", "考勤", "请假/补课", "课时资金", "提醒", "操作"], renderLessonPrepRows(visibleRows))}
      </div>
    </section>`;

  const executionPanel = appContent.querySelector(".lesson-execution-panel");
  if (executionPanel) {
    executionPanel.insertAdjacentHTML("beforebegin", panel);
  } else {
    appContent.insertAdjacentHTML("beforeend", panel);
  }
}

function flattenLessonPrepRows(lessons = appState.lessons) {
  return lessonPrepRows(lessons).map((row) => ({
    lessonId: row.lessonId,
    date: row.date,
    time: row.time,
    target: row.target,
    subject: row.subject,
    teacher: row.teacher,
    room: row.room,
    lessonStatus: row.lessonStatus,
    studentId: row.studentId,
    student: row.student,
    phone: row.phone,
    grade: row.grade,
    attendanceStatus: row.attendanceStatus,
    deduct: row.deduct,
    leaveId: row.leaveId,
    leaveStatus: row.leaveStatus,
    makeup: row.makeup,
    balance: row.balance,
    debt: row.debt,
    prepStatus: row.prepStatus,
    note: row.note
  }));
}

const baseRenderTeacherDeskForLessonPrep = renderTeacherDesk;
renderTeacherDesk = function renderTeacherDeskWithLessonPrep() {
  baseRenderTeacherDeskForLessonPrep();
  appendLessonPrepPanel();
};

if (typeof exportDataset === "function") {
  const baseExportDatasetForLessonPrep = exportDataset;
  exportDataset = function exportDatasetWithLessonPrep(type) {
    if (type !== "lessonPrep") {
      baseExportDatasetForLessonPrep(type);
      return;
    }
    const columns = [
      ["lessonId", "课节编号"],
      ["date", "日期"],
      ["time", "时间"],
      ["target", "班级/对象"],
      ["subject", "科目"],
      ["teacher", "老师"],
      ["room", "教室"],
      ["lessonStatus", "课节状态"],
      ["studentId", "学员编号"],
      ["student", "学员"],
      ["phone", "手机号"],
      ["grade", "年级"],
      ["attendanceStatus", "考勤状态"],
      ["deduct", "是否消课"],
      ["leaveId", "请假编号"],
      ["leaveStatus", "请假状态"],
      ["makeup", "补课安排"],
      ["balance", "剩余课时"],
      ["debt", "欠费"],
      ["prepStatus", "课前提醒"],
      ["note", "处理建议"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("课前准备清单.csv", buildCsv(flattenLessonPrepRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "课前准备清单.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForLessonPrep = renderDataCenter;
  renderDataCenter = function renderDataCenterWithLessonPrep() {
    baseRenderDataCenterForLessonPrep();
    const dataGrid = appContent.querySelector(".data-grid");
    if (dataGrid && !dataGrid.querySelector('[data-export="lessonPrep"]')) {
      const card = document.createElement("article");
      card.className = "data-card";
      card.innerHTML = `<div><span class="muted">课前准备清单</span><strong>${flattenLessonPrepRows().length}</strong></div><button class="small-button" type="button" data-export="lessonPrep">导出课前</button>`;
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
  if (event.target.id === "lessonPrepWindowFilter") lessonPrepWindowFilter = event.target.value;
  if (event.target.id === "lessonPrepRiskFilter") lessonPrepRiskFilter = event.target.value;
  if (event.target.id === "lessonPrepSortMode") lessonPrepSortMode = event.target.value;

  if (["lessonPrepWindowFilter", "lessonPrepRiskFilter", "lessonPrepSortMode"].includes(event.target.id) && currentView === "teacherDesk") {
    renderView();
  }
});

if (currentView === "teacherDesk" || currentView === "data") {
  renderView();
}
