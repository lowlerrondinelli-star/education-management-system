const teacherTaskStyle = document.createElement("style");
teacherTaskStyle.textContent = `
  .teacher-task-panel {
    margin-top: 16px;
  }

  .teacher-task-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .teacher-task-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .teacher-task-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .teacher-task-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .teacher-task-note {
    max-width: 260px;
    line-height: 1.5;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .teacher-task-toolbar,
    .teacher-task-toolbar label,
    .teacher-task-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(teacherTaskStyle);

let teacherTaskKindFilter = "all";
let teacherTaskDateFilter = "all";
let teacherTaskSortMode = "urgent";

function teacherTaskTodayDate() {
  return new Date(`${todayIsoDate()}T00:00:00`);
}

function teacherTaskDateOnly(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function teacherTaskDiffDays(lesson) {
  const today = teacherTaskTodayDate();
  const lessonDate = teacherTaskDateOnly(lesson.date);
  if (!lessonDate || !Number.isFinite(today.getTime())) return 0;
  return Math.floor((lessonDate - today) / 86400000);
}

function teacherTaskAttendanceText(lesson) {
  if (lesson.status === "已取消") return "已取消";
  if (typeof attendanceSummary === "function" && lessonHasAttendance(lesson)) return attendanceSummary(lesson);
  return lessonHasAttendance(lesson) ? "已点名" : "未点名";
}

function teacherTaskFeedbackText(lesson) {
  if (lesson.status === "已取消") return "已取消";
  if (lesson.status !== "已上课") return "未到反馈";
  return lessonHasSentFeedback(lesson) ? "已反馈" : "待反馈";
}

function teacherTaskReasonItems(lesson) {
  const reasons = [];
  const diffDays = teacherTaskDiffDays(lesson);
  const hasAttendance = lessonHasAttendance(lesson);
  const hasFeedback = lessonHasSentFeedback(lesson);

  if (lesson.status === "待上课" && diffDays < 0) reasons.push({ key: "overdue", label: "历史未处理", tone: "red", score: 0 });
  if (lesson.status === "待上课" && !hasAttendance) reasons.push({ key: "attendance", label: "待点名", tone: "amber", score: 1 });
  if (lesson.status === "已上课" && !hasFeedback) reasons.push({ key: "feedback", label: "待反馈", tone: "red", score: 2 });
  if (!lesson.teacher || !lesson.room) reasons.push({ key: "data", label: "资料缺项", tone: "amber", score: 3 });
  if (!reasons.length && lesson.status === "已上课" && hasFeedback) reasons.push({ key: "done", label: "已完成", tone: "green", score: 9 });
  if (!reasons.length && lesson.status === "已取消") reasons.push({ key: "closed", label: "已取消", tone: "", score: 8 });
  if (!reasons.length) reasons.push({ key: "pending", label: "待上课", tone: "amber", score: 5 });

  return reasons;
}

function teacherTaskPrimaryReason(lesson) {
  return teacherTaskReasonItems(lesson).sort((a, b) => a.score - b.score)[0];
}

function teacherTaskMatchesKind(lesson) {
  const reasonKeys = new Set(teacherTaskReasonItems(lesson).map((item) => item.key));
  if (teacherTaskKindFilter === "all") return true;
  if (teacherTaskKindFilter === "today") return lesson.date === todayIsoDate();
  if (teacherTaskKindFilter === "upcoming") return lesson.status === "待上课";
  if (teacherTaskKindFilter === "done") return reasonKeys.has("done");
  return reasonKeys.has(teacherTaskKindFilter);
}

function teacherTaskMatchesDate(lesson) {
  if (teacherTaskDateFilter === "all") return true;
  const diffDays = teacherTaskDiffDays(lesson);
  if (teacherTaskDateFilter === "today") return diffDays === 0;
  if (teacherTaskDateFilter === "next7") return diffDays >= 0 && diffDays <= 7;
  if (teacherTaskDateFilter === "past") return diffDays < 0;
  if (teacherTaskDateFilter === "completed") return lesson.status === "已上课";
  return true;
}

function teacherTaskMatches(lesson) {
  return matchesRow(lesson) && teacherTaskMatchesKind(lesson) && teacherTaskMatchesDate(lesson);
}

function compareTeacherTasks(left, right) {
  if (teacherTaskSortMode === "timeAsc") return compareLessonTime(left, right);
  if (teacherTaskSortMode === "timeDesc") return compareLessonTime(right, left);
  if (teacherTaskSortMode === "target") {
    const targetGap = text(left.target).localeCompare(text(right.target), "zh-CN");
    return targetGap || compareLessonTime(left, right);
  }
  if (teacherTaskSortMode === "subject") {
    const subjectGap = text(left.subject).localeCompare(text(right.subject), "zh-CN");
    return subjectGap || compareLessonTime(left, right);
  }
  const leftReason = teacherTaskPrimaryReason(left);
  const rightReason = teacherTaskPrimaryReason(right);
  return leftReason.score - rightReason.score || compareLessonTime(left, right);
}

function teacherTaskStats(lessons, visibleLessons) {
  const attendance = lessons.filter((lesson) => teacherTaskReasonItems(lesson).some((item) => item.key === "attendance")).length;
  const feedback = lessons.filter((lesson) => teacherTaskReasonItems(lesson).some((item) => item.key === "feedback")).length;
  const overdue = lessons.filter((lesson) => teacherTaskReasonItems(lesson).some((item) => item.key === "overdue")).length;
  const today = lessons.filter((lesson) => lesson.date === todayIsoDate()).length;

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleLessons.length}</strong><small>全部 ${lessons.length} 节</small></div>
      <div class="metric"><span>待点名</span><strong>${attendance}</strong><small>${today} 节今天相关</small></div>
      <div class="metric"><span>待反馈</span><strong>${feedback}</strong><small>已上课未发送</small></div>
      <div class="metric"><span>历史未处理</span><strong>${overdue}</strong><small>需教务核对</small></div>
    </div>`;
}

function renderTeacherTaskToolbar() {
  return `
    <div class="filters teacher-task-toolbar">
      <label>任务类型
        <select id="teacherTaskKindFilter" aria-label="老师任务类型筛选">
          <option value="all" ${teacherTaskKindFilter === "all" ? "selected" : ""}>全部任务</option>
          <option value="attendance" ${teacherTaskKindFilter === "attendance" ? "selected" : ""}>待点名</option>
          <option value="feedback" ${teacherTaskKindFilter === "feedback" ? "selected" : ""}>待反馈</option>
          <option value="overdue" ${teacherTaskKindFilter === "overdue" ? "selected" : ""}>历史未处理</option>
          <option value="today" ${teacherTaskKindFilter === "today" ? "selected" : ""}>今日课节</option>
          <option value="upcoming" ${teacherTaskKindFilter === "upcoming" ? "selected" : ""}>待上课</option>
          <option value="done" ${teacherTaskKindFilter === "done" ? "selected" : ""}>已完成</option>
        </select>
      </label>
      <label>日期范围
        <select id="teacherTaskDateFilter" aria-label="老师任务日期筛选">
          <option value="all" ${teacherTaskDateFilter === "all" ? "selected" : ""}>全部日期</option>
          <option value="today" ${teacherTaskDateFilter === "today" ? "selected" : ""}>今天</option>
          <option value="next7" ${teacherTaskDateFilter === "next7" ? "selected" : ""}>未来 7 天</option>
          <option value="past" ${teacherTaskDateFilter === "past" ? "selected" : ""}>历史课节</option>
          <option value="completed" ${teacherTaskDateFilter === "completed" ? "selected" : ""}>已上课节</option>
        </select>
      </label>
      <label>排序
        <select id="teacherTaskSortMode" aria-label="老师任务排序">
          <option value="urgent" ${teacherTaskSortMode === "urgent" ? "selected" : ""}>优先处理</option>
          <option value="timeAsc" ${teacherTaskSortMode === "timeAsc" ? "selected" : ""}>时间升序</option>
          <option value="timeDesc" ${teacherTaskSortMode === "timeDesc" ? "selected" : ""}>时间降序</option>
          <option value="target" ${teacherTaskSortMode === "target" ? "selected" : ""}>班级/对象</option>
          <option value="subject" ${teacherTaskSortMode === "subject" ? "selected" : ""}>科目分组</option>
        </select>
      </label>
    </div>`;
}

function teacherTaskReasonTags(lesson) {
  return `<div class="teacher-task-tags">${teacherTaskReasonItems(lesson).map((item) => tag(item.label, item.tone)).join("")}</div>`;
}

function teacherTaskStudentCount(lesson) {
  if (typeof lessonStudents !== "function") return "";
  const count = lessonStudents(lesson).length;
  return count ? `${count} 人` : "";
}

function renderTeacherTaskRows(lessons) {
  return lessons.map((lesson) => {
    const done = lesson.status === "已上课";
    const canceled = lesson.status === "已取消";
    const attendanceText = teacherTaskAttendanceText(lesson);
    const feedbackText = teacherTaskFeedbackText(lesson);
    const studentCount = teacherTaskStudentCount(lesson);
    return `<tr>
      <td><strong>${escapeHtml(lesson.date)}</strong><br><span class="muted">${escapeHtml(dayFromDate(lesson.date))} ${escapeHtml(lesson.time)}</span></td>
      <td>${escapeHtml(lesson.target)}<br><span class="muted">${escapeHtml(lesson.type || "班级课")}${studentCount ? ` · ${escapeHtml(studentCount)}` : ""}</span></td>
      <td>${escapeHtml(lesson.subject)}<br><span class="muted">${escapeHtml(lesson.teacher)}</span></td>
      <td>${escapeHtml(lesson.room || "未分配")}</td>
      <td>${tag(lesson.status, statusTone(lesson.status))}<br><span class="muted">${escapeHtml(attendanceText)}</span></td>
      <td>${tag(feedbackText, feedbackText === "待反馈" ? "red" : feedbackText === "已反馈" ? "green" : "")}</td>
      <td class="teacher-task-note">${teacherTaskReasonTags(lesson)}</td>
      <td>
        <div class="teacher-task-actions">
          <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}" ${canceled ? "disabled" : ""}>点名</button>
          <button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}" ${canceled ? "disabled" : ""}>反馈</button>
          <button class="small-button" type="button" data-schedule-adjust="reschedule" data-lesson-id="${escapeHtml(lesson.id)}" ${done || canceled ? "disabled" : ""}>调课</button>
        </div>
      </td>
    </tr>`;
  });
}

function appendTeacherTaskPanel() {
  if (currentView !== "teacherDesk" || appContent.querySelector(".teacher-task-panel")) return;
  const lessons = teacherDeskLessons();
  const visibleLessons = lessons.filter(teacherTaskMatches).sort(compareTeacherTasks);

  appContent.insertAdjacentHTML(
    "beforeend",
    `<section class="section teacher-task-panel">
      <div class="section-head">
        <div>
          <h3>老师任务清单</h3>
          <span class="muted">按当前查看范围汇总课节、点名、反馈和异常处理。</span>
        </div>
        ${tag(`${visibleLessons.length} 项`, visibleLessons.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${teacherTaskStats(lessons, visibleLessons)}
        ${renderTeacherTaskToolbar()}
        ${table(["日期时间", "班级/对象", "科目老师", "教室", "上课/点名", "反馈", "待处理", "操作"], renderTeacherTaskRows(visibleLessons))}
      </div>
    </section>`
  );
}

const baseRenderTeacherDeskForTaskList = renderTeacherDesk;
renderTeacherDesk = function renderTeacherDeskWithTaskList() {
  baseRenderTeacherDeskForTaskList();
  appendTeacherTaskPanel();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "teacherTaskKindFilter") teacherTaskKindFilter = event.target.value;
  if (event.target.id === "teacherTaskDateFilter") teacherTaskDateFilter = event.target.value;
  if (event.target.id === "teacherTaskSortMode") teacherTaskSortMode = event.target.value;

  if (["teacherTaskKindFilter", "teacherTaskDateFilter", "teacherTaskSortMode"].includes(event.target.id) && currentView === "teacherDesk") {
    renderView();
  }
});

if (currentView === "teacherDesk") {
  renderView();
}
