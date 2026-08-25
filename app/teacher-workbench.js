const teacherDeskStyle = document.createElement("style");
teacherDeskStyle.textContent = `
  .teacher-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.42fr);
    gap: 14px;
  }

  .teacher-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }

  .teacher-lesson-card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px;
    background: #fff;
    display: grid;
    gap: 9px;
  }

  .teacher-lesson-card.warn {
    border-color: #f2b8a2;
    background: #fff7f2;
  }

  .teacher-student-list {
    display: grid;
    gap: 8px;
    max-height: 460px;
    overflow: auto;
  }

  .teacher-student-row {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px;
    background: #fff;
    display: grid;
    gap: 6px;
  }

  .teacher-action-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  @media (max-width: 1080px) {
    .teacher-layout {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(teacherDeskStyle);

navItems.splice(1, 0, { id: "teacherDesk", label: "老师工作台", icon: "师" });
viewMeta.teacherDesk = ["老师工作台", "我的课与学生"];

function ensureTeacherDeskPermissions() {
  if (Array.isArray(roleModules) && !roleModules.some(([id]) => id === "teacherDesk")) {
    roleModules.splice(1, 0, ["teacherDesk", "老师工作台"]);
  }
  if (!Array.isArray(appState.roles)) return;
  for (const role of appState.roles) {
    const shouldHaveDesk = ["校长/管理员", "教务/学管师", "教师"].includes(role.name);
    if (shouldHaveDesk && Array.isArray(role.permissions) && !role.permissions.includes("teacherDesk")) {
      role.permissions.splice(1, 0, "teacherDesk");
    }
  }
}

function currentTeacherEmployee() {
  const employee = typeof currentAuthEmployee === "function" ? currentAuthEmployee() : null;
  if (employee?.isTeacher === "是" || text(employee?.roles).includes("教师")) return employee;
  return null;
}

function teacherDeskName() {
  const employee = currentTeacherEmployee();
  if (employee?.name) return employee.name;
  return appState.teachers?.[0]?.name || appState.lessons[0]?.teacher || "";
}

function teacherDeskIsPersonal() {
  return Boolean(currentTeacherEmployee());
}

function teacherDeskLessons() {
  const teacherName = teacherDeskName();
  const lessons = appState.lessons.filter((lesson) => (teacherDeskIsPersonal() ? lesson.teacher === teacherName : true));
  return lessons.sort(compareLessonTime);
}

function lessonHasAttendance(lesson) {
  const record = appState.attendance?.find((item) => item.lessonId === lesson.id);
  return Boolean(record?.updatedAt || record?.records?.length);
}

function lessonHasSentFeedback(lesson) {
  return appState.lessonFeedbacks?.some((item) => item.lessonId === lesson.id && item.status === "已发送");
}

function teacherDeskStudents() {
  const lessons = teacherDeskLessons();
  const classNames = new Set(lessons.map((lesson) => lesson.target));
  const oneToOneNames = new Set(
    lessons
      .filter((lesson) => lesson.type === "1对1")
      .map((lesson) => text(lesson.target).split("-")[0])
      .filter(Boolean)
  );
  return appState.students
    .filter((student) => classNames.has(student.className) || oneToOneNames.has(student.name))
    .sort((a, b) => text(a.className).localeCompare(text(b.className), "zh-CN") || text(a.name).localeCompare(text(b.name), "zh-CN"));
}

function teacherDeskStats() {
  const today = todayIsoDate();
  const lessons = teacherDeskLessons();
  const pendingLessons = lessons.filter((lesson) => lesson.status === "待上课");
  const todayLessons = pendingLessons.filter((lesson) => lesson.date === today);
  const pendingAttendance = pendingLessons.filter((lesson) => !lessonHasAttendance(lesson));
  const pendingFeedback = lessons.filter((lesson) => lesson.status === "已上课" && !lessonHasSentFeedback(lesson));
  return { lessons, pendingLessons, todayLessons, pendingAttendance, pendingFeedback, students: teacherDeskStudents() };
}

function teacherDeskLessonCard(lesson, mode = "normal") {
  const attendanceText = typeof attendanceSummary === "function" ? attendanceSummary(lesson) : lessonHasAttendance(lesson) ? "已点名" : "未点名";
  const feedbackText = lesson.status === "已上课" ? (lessonHasSentFeedback(lesson) ? "已反馈" : "待反馈") : "课后反馈";
  const warn = mode === "attendance" || mode === "feedback";
  return `<article class="teacher-lesson-card ${warn ? "warn" : ""}">
    <div>
      <strong>${escapeHtml(lesson.target)}</strong>
      <div class="muted">${escapeHtml(lesson.date)} ${escapeHtml(dayFromDate(lesson.date))} ${escapeHtml(lesson.time)}</div>
    </div>
    <div class="teacher-action-row">
      ${tag(lesson.status, statusTone(lesson.status))}
      ${tag(attendanceText, attendanceText === "未点名" ? "amber" : "green")}
      ${tag(feedbackText, feedbackText === "待反馈" ? "red" : feedbackText === "已反馈" ? "green" : "")}
    </div>
    <span class="muted">${escapeHtml(lesson.subject)} / ${escapeHtml(lesson.teacher)} / ${escapeHtml(lesson.room)}</span>
    <div class="teacher-action-row">
      <button class="small-button" type="button" data-go="schedule">看课表</button>
      <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}">点名</button>
      <button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">反馈</button>
    </div>
  </article>`;
}

function renderTeacherDeskStudents(students) {
  return students
    .slice(0, 18)
    .map(
      (student) => `<div class="teacher-student-row">
        <strong>${escapeHtml(student.name)} ${tag(student.status, statusTone(student.status))}</strong>
        <span class="muted">${escapeHtml(student.className)} / ${escapeHtml(student.grade)}</span>
        <span>${tag(`余额 ${student.balance}`, Number(student.balance) <= 3 ? "amber" : "green")} ${Number(student.debt || 0) > 0 ? tag(`欠费 ${money(student.debt)}`, "red") : tag("无欠费", "green")}</span>
      </div>`
    )
    .join("");
}

function renderTeacherDesk() {
  ensureTeacherDeskPermissions();
  if (typeof ensureAttendanceData === "function") ensureAttendanceData();
  if (typeof ensureFeedbackData === "function") ensureFeedbackData();

  const teacherName = teacherDeskName();
  const stats = teacherDeskStats();
  const nextLessons = (stats.todayLessons.length ? stats.todayLessons : stats.pendingLessons).slice(0, 6);
  const doneLessons = stats.lessons.filter((lesson) => lesson.status === "已上课").slice(-5).reverse();
  const displayName = teacherDeskIsPersonal() ? teacherName : "全校教师";

  appContent.innerHTML = `
    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">${teacherDeskIsPersonal() ? "当前老师" : "管理视角"}</p>
        <h3>${escapeHtml(displayName)}的上课工作台</h3>
        <span class="muted">把课表、点名、课后反馈和学生风险集中到一屏。</span>
      </div>
      <div class="dashboard-actions">
        <button class="primary-action" type="button" data-go="schedule">排课点名</button>
        <button class="small-button" type="button" data-go="feedback">课后反馈</button>
        <button class="small-button" type="button" data-go="consume">课时流水</button>
      </div>
    </section>
    <div class="summary-grid">
      <div class="metric"><span>待上课节</span><strong>${stats.pendingLessons.length}</strong><small>今日 ${stats.todayLessons.length} 节</small></div>
      <div class="metric"><span>待点名</span><strong>${stats.pendingAttendance.length}</strong><small>未保存考勤</small></div>
      <div class="metric"><span>待反馈</span><strong>${stats.pendingFeedback.length}</strong><small>已上课未发送</small></div>
      <div class="metric"><span>关联学员</span><strong>${stats.students.length}</strong><small>含班课和 1 对 1</small></div>
    </div>
    <div class="teacher-layout">
      <section class="section">
        <div class="section-head">
          <div>
            <h3>${stats.todayLessons.length ? "今日待上" : "最近待上"}</h3>
            <span class="muted">${stats.todayLessons.length ? "按时间顺序准备点名。" : "今天没有待上课节，显示最近未完成课节。"}</span>
          </div>
        </div>
        <div class="section-body">
          <div class="teacher-card-grid">
            ${nextLessons.map((lesson) => teacherDeskLessonCard(lesson, lessonHasAttendance(lesson) ? "normal" : "attendance")).join("") || `<div class="stack-item"><strong>暂无待上课节</strong><span class="muted">当前老师没有未完成课节。</span></div>`}
          </div>
        </div>
      </section>
      <section class="section">
        <div class="section-head"><h3>我的学生</h3><span>${tag(`${stats.students.length} 人`, stats.students.some((student) => Number(student.balance) <= 3 || Number(student.debt) > 0) ? "amber" : "green")}</span></div>
        <div class="section-body teacher-student-list">
          ${renderTeacherDeskStudents(stats.students) || `<div class="stack-item"><span class="muted">暂无关联学员。</span></div>`}
        </div>
      </section>
    </div>
    <section class="section">
      <div class="section-head compact-head"><h3>待写反馈</h3><span class="muted">完成上课后给家长留痕</span></div>
      <div class="section-body">
        <div class="teacher-card-grid">
          ${stats.pendingFeedback.map((lesson) => teacherDeskLessonCard(lesson, "feedback")).join("") || `<div class="stack-item"><strong>暂无待反馈</strong><span class="muted">已上课节都已经发送反馈或当前没有已上课节。</span></div>`}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-head compact-head"><h3>最近已上</h3><span class="muted">便于老师回看消课和反馈状态</span></div>
      <div class="section-body">
        <div class="teacher-card-grid">
          ${doneLessons.map((lesson) => teacherDeskLessonCard(lesson)).join("") || `<div class="stack-item"><span class="muted">暂无已上课节。</span></div>`}
        </div>
      </div>
    </section>`;
}

function teacherDeskPendingCount() {
  const stats = teacherDeskStats();
  return stats.pendingAttendance.length + stats.pendingFeedback.length;
}

ensureTeacherDeskPermissions();

const baseRenderNavForTeacherDesk = renderNav;
renderNav = function renderNavWithTeacherDeskCount() {
  ensureTeacherDeskPermissions();
  baseRenderNavForTeacherDesk();
  const countNode = navList.querySelector('[data-view="teacherDesk"] .nav-count');
  if (countNode) countNode.textContent = teacherDeskPendingCount();
};

const baseRenderViewForTeacherDesk = renderView;
renderView = function renderViewWithTeacherDesk() {
  if (currentView === "teacherDesk") {
    renderTeacherDesk();
    return;
  }
  baseRenderViewForTeacherDesk();
};

renderNav();
