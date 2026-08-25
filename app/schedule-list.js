const scheduleListStyle = document.createElement("style");
scheduleListStyle.textContent = `
  .schedule-list-panel {
    margin-top: 16px;
  }

  .schedule-list-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .schedule-list-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .schedule-list-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .schedule-attendance-cell {
    min-width: 90px;
  }

  @media (max-width: 650px) {
    .schedule-list-toolbar,
    .schedule-list-toolbar label,
    .schedule-list-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(scheduleListStyle);

let scheduleTeacherFilter = "all";
let scheduleRoomFilter = "all";
let scheduleStatusFilter = "all";
let scheduleDateFilter = "all";
let scheduleSortMode = "timeAsc";

function uniqueScheduleValues(key, fallbackRows = []) {
  const seedValues = fallbackRows.map((item) => item[key]).filter(Boolean);
  const lessonValues = appState.lessons.map((lesson) => lesson[key]).filter(Boolean);
  return [...new Set([...seedValues, ...lessonValues])].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
}

function scheduleSelectOptions(values, selectedValue, allLabel) {
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function dateOnly(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function lessonMatchesDateFilter(lesson) {
  if (scheduleDateFilter === "all") return true;
  const today = dateOnly(todayIsoDate());
  const lessonDate = dateOnly(lesson.date);
  if (!today || !lessonDate) return true;

  const diffDays = Math.floor((lessonDate - today) / 86400000);
  if (scheduleDateFilter === "today") return diffDays === 0;
  if (scheduleDateFilter === "upcoming") return diffDays >= 0;
  if (scheduleDateFilter === "past") return diffDays < 0;
  if (scheduleDateFilter === "next7") return diffDays >= 0 && diffDays <= 7;
  return true;
}

function lessonMatchesScheduleListFilters(lesson) {
  if (!matchesRow(lesson)) return false;
  if (scheduleTeacherFilter !== "all" && lesson.teacher !== scheduleTeacherFilter) return false;
  if (scheduleRoomFilter !== "all" && lesson.room !== scheduleRoomFilter) return false;
  if (scheduleStatusFilter !== "all" && lesson.status !== scheduleStatusFilter) return false;
  return lessonMatchesDateFilter(lesson);
}

function compareScheduleListLessons(left, right) {
  if (scheduleSortMode === "timeDesc") return compareLessonTime(right, left);
  if (scheduleSortMode === "teacher") {
    const teacherGap = text(left.teacher).localeCompare(text(right.teacher), "zh-CN");
    return teacherGap || compareLessonTime(left, right);
  }
  if (scheduleSortMode === "target") {
    const targetGap = text(left.target).localeCompare(text(right.target), "zh-CN");
    return targetGap || compareLessonTime(left, right);
  }
  return compareLessonTime(left, right);
}

function scheduleListStats(visibleLessons) {
  const pending = appState.lessons.filter((lesson) => lesson.status === "待上课").length;
  const done = appState.lessons.filter((lesson) => lesson.status === "已上课").length;
  const canceled = appState.lessons.filter((lesson) => lesson.status === "已取消").length;
  const conflicts = typeof scheduleConflictPairs === "function" ? scheduleConflictPairs().length : 0;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleLessons.length}</strong><small>全部 ${appState.lessons.length} 节课</small></div>
      <div class="metric"><span>待上课</span><strong>${pending}</strong><small>${done} 节已上课</small></div>
      <div class="metric"><span>取消/冲突</span><strong>${canceled + conflicts}</strong><small>${canceled} 节取消，${conflicts} 个冲突</small></div>
      <div class="metric"><span>涉及资源</span><strong>${uniqueScheduleValues("teacher", appState.teachers || []).length}</strong><small>${uniqueScheduleValues("room", appState.rooms || []).length} 个教室</small></div>
    </div>`;
}

function renderScheduleListToolbar() {
  const teachers = uniqueScheduleValues("teacher", appState.teachers || []);
  const rooms = uniqueScheduleValues("room", appState.rooms || []);
  const statuses = uniqueScheduleValues("status");
  return `
    <div class="filters schedule-list-toolbar">
      <label>老师
        <select id="scheduleTeacherFilter" aria-label="按老师筛选课表">
          ${scheduleSelectOptions(teachers, scheduleTeacherFilter, "全部老师")}
        </select>
      </label>
      <label>教室
        <select id="scheduleRoomFilter" aria-label="按教室筛选课表">
          ${scheduleSelectOptions(rooms, scheduleRoomFilter, "全部教室")}
        </select>
      </label>
      <label>状态
        <select id="scheduleStatusFilter" aria-label="按状态筛选课表">
          ${scheduleSelectOptions(statuses, scheduleStatusFilter, "全部状态")}
        </select>
      </label>
      <label>日期
        <select id="scheduleDateFilter" aria-label="按日期范围筛选课表">
          <option value="all" ${scheduleDateFilter === "all" ? "selected" : ""}>全部日期</option>
          <option value="today" ${scheduleDateFilter === "today" ? "selected" : ""}>今天</option>
          <option value="next7" ${scheduleDateFilter === "next7" ? "selected" : ""}>未来 7 天</option>
          <option value="upcoming" ${scheduleDateFilter === "upcoming" ? "selected" : ""}>未来课节</option>
          <option value="past" ${scheduleDateFilter === "past" ? "selected" : ""}>历史课节</option>
        </select>
      </label>
      <label>排序
        <select id="scheduleSortMode" aria-label="课表清单排序">
          <option value="timeAsc" ${scheduleSortMode === "timeAsc" ? "selected" : ""}>时间升序</option>
          <option value="timeDesc" ${scheduleSortMode === "timeDesc" ? "selected" : ""}>时间降序</option>
          <option value="teacher" ${scheduleSortMode === "teacher" ? "selected" : ""}>老师分组</option>
          <option value="target" ${scheduleSortMode === "target" ? "selected" : ""}>班级/对象分组</option>
        </select>
      </label>
    </div>`;
}

function scheduleListStudentCount(lesson) {
  if (typeof lessonStudents !== "function") return "";
  return lessonStudents(lesson).length;
}

function renderScheduleListRows(lessons) {
  return lessons.map((lesson) => {
    const done = lesson.status === "已上课";
    const canceled = lesson.status === "已取消";
    return `<tr>
      <td><strong>${escapeHtml(lesson.date)}</strong><br><span class="muted">${escapeHtml(lesson.day || dayFromDate(lesson.date))} ${escapeHtml(lesson.time)}</span></td>
      <td>${escapeHtml(lesson.target)}<br><span class="muted">${escapeHtml(lesson.type || "班级课")} · ${escapeHtml(scheduleListStudentCount(lesson))} 人</span></td>
      <td>${escapeHtml(lesson.subject)}</td>
      <td>${escapeHtml(lesson.teacher)}</td>
      <td>${escapeHtml(lesson.room)}</td>
      <td>${tag(lesson.status, statusTone(lesson.status))}</td>
      <td class="schedule-attendance-cell">${escapeHtml(typeof attendanceSummary === "function" ? attendanceSummary(lesson) : "未点名")}</td>
      <td>
        <div class="schedule-list-actions">
          <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}" ${canceled ? "disabled" : ""}>点名</button>
          <button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">反馈</button>
          <button class="small-button" type="button" data-schedule-adjust="reschedule" data-lesson-id="${escapeHtml(lesson.id)}" ${done || canceled ? "disabled" : ""}>调课</button>
        </div>
      </td>
    </tr>`;
  });
}

function appendScheduleListPanel() {
  if (currentView !== "schedule" || appContent.querySelector(".schedule-list-panel")) return;
  const visibleLessons = appState.lessons.filter(lessonMatchesScheduleListFilters).sort(compareScheduleListLessons);
  appContent.insertAdjacentHTML(
    "beforeend",
    `<section class="section schedule-list-panel">
      <div class="section-head">
        <div>
          <h3>课表清单</h3>
          <span class="muted">按老师、教室、状态和日期筛选，适合前台排课核对和老师查课。</span>
        </div>
        ${tag(`${visibleLessons.length} 节`, visibleLessons.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${scheduleListStats(visibleLessons)}
        ${renderScheduleListToolbar()}
        ${table(["日期时间", "班级/对象", "科目", "老师", "教室", "状态", "点名", "操作"], renderScheduleListRows(visibleLessons))}
      </div>
    </section>`
  );
}

const baseRenderScheduleForList = renderSchedule;
renderSchedule = function renderScheduleWithListPanel() {
  baseRenderScheduleForList();
  appendScheduleListPanel();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "scheduleTeacherFilter") scheduleTeacherFilter = event.target.value;
  if (event.target.id === "scheduleRoomFilter") scheduleRoomFilter = event.target.value;
  if (event.target.id === "scheduleStatusFilter") scheduleStatusFilter = event.target.value;
  if (event.target.id === "scheduleDateFilter") scheduleDateFilter = event.target.value;
  if (event.target.id === "scheduleSortMode") scheduleSortMode = event.target.value;

  if (["scheduleTeacherFilter", "scheduleRoomFilter", "scheduleStatusFilter", "scheduleDateFilter", "scheduleSortMode"].includes(event.target.id) && currentView === "schedule") {
    renderView();
  }
});

if (currentView === "schedule") {
  renderView();
}
