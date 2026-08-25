const teacherRosterStyle = document.createElement("style");
teacherRosterStyle.textContent = `
  .teacher-roster-panel {
    margin-top: 16px;
  }

  .teacher-roster-toolbar {
    align-items: end;
  }

  .teacher-roster-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .teacher-roster-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .teacher-roster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
    margin-top: 12px;
  }

  .teacher-roster-card {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    padding: 12px;
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .teacher-roster-card.warn {
    border-color: #f2b8a2;
    background: #fff7f2;
  }

  .teacher-roster-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
  }

  .teacher-roster-title strong {
    overflow-wrap: anywhere;
    line-height: 1.45;
  }

  .teacher-roster-students {
    display: grid;
    gap: 7px;
    max-height: 260px;
    overflow: auto;
  }

  .teacher-roster-student {
    border-top: 1px solid var(--line);
    padding-top: 7px;
    display: grid;
    gap: 5px;
  }

  .teacher-roster-student:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .teacher-roster-student strong,
  .teacher-roster-note {
    overflow-wrap: anywhere;
  }

  .teacher-roster-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .teacher-roster-table-note {
    max-width: 280px;
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 1.5;
  }

  @media (max-width: 650px) {
    .teacher-roster-toolbar,
    .teacher-roster-toolbar label,
    .teacher-roster-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(teacherRosterStyle);

let teacherRosterClassFilter = "all";
let teacherRosterRiskFilter = "all";
let teacherRosterSortMode = "nextLesson";

function teacherRosterClassNames() {
  const lessonTargets = teacherDeskLessons()
    .filter((lesson) => lesson.type !== "1对1")
    .map((lesson) => lesson.target);
  const studentClasses = teacherDeskStudents().map((student) => student.className);
  return [...new Set([...lessonTargets, ...studentClasses].filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
}

function teacherRosterClassItem(className) {
  return typeof classByName === "function" ? classByName(className) : appState.classes.find((item) => item.name === className);
}

function teacherRosterStudents(className) {
  return appState.students
    .filter((student) => student.className === className)
    .sort((left, right) => {
      const riskGap = teacherRosterStudentRiskScore(right) - teacherRosterStudentRiskScore(left);
      return riskGap || text(left.name).localeCompare(text(right.name), "zh-CN");
    });
}

function teacherRosterLessons(className) {
  return teacherDeskLessons()
    .filter((lesson) => lesson.target === className)
    .sort(compareLessonTime);
}

function teacherRosterNextLesson(className) {
  const today = todayIsoDate();
  return teacherRosterLessons(className).find((lesson) => lesson.status === "待上课" && lesson.date >= today);
}

function teacherRosterLastLesson(className) {
  return teacherRosterLessons(className)
    .filter((lesson) => lesson.status === "已上课")
    .slice(-1)[0];
}

function teacherRosterStudentRiskScore(student) {
  const debt = Number(student.debt || 0);
  const balance = Number(student.balance || 0);
  if (debt > 0 && balance <= 3) return 3;
  if (debt > 0) return 2;
  if (balance <= 3) return 1;
  return 0;
}

function teacherRosterStudentRiskTags(student) {
  const tags = [];
  const debt = Number(student.debt || 0);
  const balance = Number(student.balance || 0);
  if (debt > 0) tags.push(tag(`欠费 ${money(debt)}`, "red"));
  if (balance <= 3) tags.push(tag(`余额 ${balance}`, "amber"));
  if (!tags.length) tags.push(tag(`余额 ${balance}`, "green"));
  return tags.join("");
}

function teacherRosterClassStats(className) {
  const classItem = teacherRosterClassItem(className);
  const students = teacherRosterStudents(className);
  const nextLesson = teacherRosterNextLesson(className);
  const lastLesson = teacherRosterLastLesson(className);
  const debtTotal = students.reduce((sum, student) => sum + Number(student.debt || 0), 0);
  const lowBalance = students.filter((student) => Number(student.balance || 0) <= 3).length;
  const capacity = Number(classItem?.capacity || 0);
  const fillRate = capacity ? Math.round((students.length / capacity) * 100) : 0;
  return { classItem, students, nextLesson, lastLesson, debtTotal, lowBalance, capacity, fillRate };
}

function teacherRosterClassRisk(className) {
  const stats = teacherRosterClassStats(className);
  const reasons = [];
  if (!stats.students.length) reasons.push({ key: "empty", label: "无学员", tone: "amber" });
  if (stats.debtTotal > 0) reasons.push({ key: "debt", label: "有欠费", tone: "red" });
  if (stats.lowBalance > 0) reasons.push({ key: "lowBalance", label: "课时不足", tone: "amber" });
  if (!stats.nextLesson) reasons.push({ key: "noNext", label: "无未来课", tone: "amber" });
  if (stats.capacity && stats.fillRate >= 80) reasons.push({ key: "nearFull", label: "容量高", tone: "amber" });
  if (!reasons.length) reasons.push({ key: "stable", label: "正常", tone: "green" });
  return reasons;
}

function teacherRosterMatchesRisk(className) {
  if (teacherRosterRiskFilter === "all") return true;
  return teacherRosterClassRisk(className).some((item) => item.key === teacherRosterRiskFilter);
}

function teacherRosterVisibleClassNames() {
  return teacherRosterClassNames()
    .filter((className) => teacherRosterClassFilter === "all" || className === teacherRosterClassFilter)
    .filter(teacherRosterMatchesRisk)
    .sort((left, right) => {
      if (teacherRosterSortMode === "name") return text(left).localeCompare(text(right), "zh-CN");
      if (teacherRosterSortMode === "risk") {
        const leftRisk = teacherRosterClassRisk(left).some((item) => item.key === "debt") ? 0 : teacherRosterClassRisk(left).some((item) => item.key !== "stable") ? 1 : 2;
        const rightRisk = teacherRosterClassRisk(right).some((item) => item.key === "debt") ? 0 : teacherRosterClassRisk(right).some((item) => item.key !== "stable") ? 1 : 2;
        return leftRisk - rightRisk || text(left).localeCompare(text(right), "zh-CN");
      }
      if (teacherRosterSortMode === "studentsDesc") return teacherRosterStudents(right).length - teacherRosterStudents(left).length;
      const leftNext = teacherRosterNextLesson(left);
      const rightNext = teacherRosterNextLesson(right);
      if (!leftNext && !rightNext) return text(left).localeCompare(text(right), "zh-CN");
      if (!leftNext) return 1;
      if (!rightNext) return -1;
      return compareLessonTime(leftNext, rightNext);
    });
}

function teacherRosterSummary(allClasses, visibleClasses) {
  const allStudents = allClasses.flatMap(teacherRosterStudents);
  const debtClasses = allClasses.filter((className) => teacherRosterClassRisk(className).some((item) => item.key === "debt")).length;
  const lowBalanceStudents = allStudents.filter((student) => Number(student.balance || 0) <= 3).length;
  const upcomingLessons = allClasses.filter((className) => teacherRosterNextLesson(className)).length;

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleClasses.length}</strong><small>全部 ${allClasses.length} 个班级</small></div>
      <div class="metric"><span>花名册学员</span><strong>${allStudents.length}</strong><small>当前老师范围内</small></div>
      <div class="metric"><span>欠费班级</span><strong>${debtClasses}</strong><small>课前需要提醒教务</small></div>
      <div class="metric"><span>未来有课</span><strong>${upcomingLessons}</strong><small>${lowBalanceStudents} 名低课时学员</small></div>
    </div>`;
}

function renderTeacherRosterToolbar() {
  const classOptions = teacherRosterClassNames()
    .map((className) => `<option value="${escapeHtml(className)}" ${teacherRosterClassFilter === className ? "selected" : ""}>${escapeHtml(className)}</option>`)
    .join("");

  return `
    <div class="filters teacher-roster-toolbar">
      <label>班级
        <select id="teacherRosterClassFilter" aria-label="老师花名册班级筛选">
          <option value="all" ${teacherRosterClassFilter === "all" ? "selected" : ""}>全部班级</option>
          ${classOptions}
        </select>
      </label>
      <label>重点关注
        <select id="teacherRosterRiskFilter" aria-label="老师花名册风险筛选">
          <option value="all" ${teacherRosterRiskFilter === "all" ? "selected" : ""}>全部情况</option>
          <option value="debt" ${teacherRosterRiskFilter === "debt" ? "selected" : ""}>有欠费</option>
          <option value="lowBalance" ${teacherRosterRiskFilter === "lowBalance" ? "selected" : ""}>课时不足</option>
          <option value="noNext" ${teacherRosterRiskFilter === "noNext" ? "selected" : ""}>无未来课</option>
          <option value="nearFull" ${teacherRosterRiskFilter === "nearFull" ? "selected" : ""}>容量高</option>
          <option value="stable" ${teacherRosterRiskFilter === "stable" ? "selected" : ""}>正常</option>
        </select>
      </label>
      <label>排序
        <select id="teacherRosterSortMode" aria-label="老师花名册排序">
          <option value="nextLesson" ${teacherRosterSortMode === "nextLesson" ? "selected" : ""}>下次上课</option>
          <option value="risk" ${teacherRosterSortMode === "risk" ? "selected" : ""}>风险优先</option>
          <option value="studentsDesc" ${teacherRosterSortMode === "studentsDesc" ? "selected" : ""}>人数降序</option>
          <option value="name" ${teacherRosterSortMode === "name" ? "selected" : ""}>班级名称</option>
        </select>
      </label>
    </div>`;
}

function renderTeacherRosterRiskTags(className) {
  return `<div class="teacher-task-tags">${teacherRosterClassRisk(className).map((item) => tag(item.label, item.tone)).join("")}</div>`;
}

function renderTeacherRosterStudentRows(students) {
  return students
    .slice(0, 8)
    .map(
      (student) => `<div class="teacher-roster-student">
        <strong>${escapeHtml(student.name)} ${tag(student.status, statusTone(student.status))}</strong>
        <span class="muted">${escapeHtml(student.grade)} / ${escapeHtml(student.phone)} / ${escapeHtml(student.owner || "未分配")}</span>
        <span>${teacherRosterStudentRiskTags(student)}</span>
      </div>`
    )
    .join("");
}

function renderTeacherRosterCard(className) {
  const stats = teacherRosterClassStats(className);
  const nextText = stats.nextLesson ? `${stats.nextLesson.date} ${stats.nextLesson.time}` : "暂无未来待上课节";
  const lastText = stats.lastLesson ? `${stats.lastLesson.date} ${stats.lastLesson.time}` : "暂无已上课记录";
  const warn = teacherRosterClassRisk(className).some((item) => item.key !== "stable");
  return `<article class="teacher-roster-card ${warn ? "warn" : ""}">
    <div class="teacher-roster-title">
      <div>
        <strong>${escapeHtml(className)}</strong>
        <div class="muted">${escapeHtml(stats.classItem?.course || "未关联课程")} / ${escapeHtml(stats.classItem?.teacher || "未分配老师")}</div>
      </div>
      ${tag(`${stats.students.length}/${stats.capacity || "-"}`, stats.fillRate >= 80 ? "amber" : "green")}
    </div>
    ${renderTeacherRosterRiskTags(className)}
    <div class="teacher-roster-note">
      <span class="muted">下次上课：${escapeHtml(nextText)}；最近已上：${escapeHtml(lastText)}</span>
    </div>
    <div class="teacher-roster-students">
      ${renderTeacherRosterStudentRows(stats.students) || `<div class="stack-item"><span class="muted">当前班级暂无学员。</span></div>`}
    </div>
    <div class="teacher-roster-actions">
      <button class="small-button" type="button" data-class-detail="${escapeHtml(className)}">班级详情</button>
      ${stats.students[0] ? `<button class="small-button" type="button" data-class-student-detail="${escapeHtml(stats.students[0].id)}">学员详情</button>` : ""}
      ${stats.nextLesson ? `<button class="small-button" type="button" data-attendance-lesson="${escapeHtml(stats.nextLesson.id)}">下节点名</button>` : `<button class="small-button" type="button" data-go="schedule">去排课</button>`}
    </div>
  </article>`;
}

function renderTeacherRosterRows(classNames) {
  return classNames.map((className) => {
    const stats = teacherRosterClassStats(className);
    const nextText = stats.nextLesson ? `${stats.nextLesson.date} ${stats.nextLesson.time}` : "暂无未来课节";
    const riskText = teacherRosterClassRisk(className).map((item) => item.label).join("、");
    return `<tr>
      <td><strong>${escapeHtml(className)}</strong><br><span class="muted">${escapeHtml(stats.classItem?.course || "-")}</span></td>
      <td>${escapeHtml(stats.classItem?.teacher || "-")}<br><span class="muted">${escapeHtml(stats.classItem?.room || "-")}</span></td>
      <td>${stats.students.length}/${escapeHtml(stats.capacity || "-")}<br><span class="muted">满班率 ${stats.fillRate}%</span></td>
      <td>${escapeHtml(nextText)}</td>
      <td>${stats.debtTotal ? tag(money(stats.debtTotal), "red") : tag("无欠费", "green")}<br><span class="muted">${stats.lowBalance} 名低课时</span></td>
      <td class="teacher-roster-table-note">${escapeHtml(riskText)}</td>
      <td>
        <div class="teacher-roster-actions">
          <button class="small-button" type="button" data-class-detail="${escapeHtml(className)}">详情</button>
          ${stats.nextLesson ? `<button class="small-button" type="button" data-attendance-lesson="${escapeHtml(stats.nextLesson.id)}">点名</button>` : `<button class="small-button" type="button" data-go="schedule">排课</button>`}
        </div>
      </td>
    </tr>`;
  });
}

function appendTeacherRosterBoard() {
  if (currentView !== "teacherDesk" || appContent.querySelector(".teacher-roster-panel")) return;
  const allClasses = teacherRosterClassNames();
  const visibleClasses = teacherRosterVisibleClassNames();

  const panel = `
    <section class="section teacher-roster-panel">
      <div class="section-head">
        <div>
          <h3>老师班级花名册</h3>
          <span class="muted">按当前老师范围汇总班级、学员、课时余额、欠费和下次上课，课前可以直接核名单。</span>
        </div>
        ${tag(`${visibleClasses.length} 个班`, visibleClasses.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${teacherRosterSummary(allClasses, visibleClasses)}
        ${renderTeacherRosterToolbar()}
        <div class="teacher-roster-grid">
          ${visibleClasses.slice(0, 6).map(renderTeacherRosterCard).join("") || `<div class="stack-item"><strong>暂无班级花名册</strong><span class="muted">当前筛选条件下没有可查看的班级。</span></div>`}
        </div>
        ${table(["班级", "老师/教室", "人数", "下次上课", "课时资金", "重点关注", "操作"], renderTeacherRosterRows(visibleClasses))}
      </div>
    </section>`;

  const executionPanel = appContent.querySelector(".lesson-execution-panel");
  if (executionPanel) {
    executionPanel.insertAdjacentHTML("beforebegin", panel);
  } else {
    appContent.insertAdjacentHTML("beforeend", panel);
  }
}

const baseRenderTeacherDeskForRosterBoard = renderTeacherDesk;
renderTeacherDesk = function renderTeacherDeskWithRosterBoard() {
  baseRenderTeacherDeskForRosterBoard();
  appendTeacherRosterBoard();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "teacherRosterClassFilter") teacherRosterClassFilter = event.target.value;
  if (event.target.id === "teacherRosterRiskFilter") teacherRosterRiskFilter = event.target.value;
  if (event.target.id === "teacherRosterSortMode") teacherRosterSortMode = event.target.value;

  if (["teacherRosterClassFilter", "teacherRosterRiskFilter", "teacherRosterSortMode"].includes(event.target.id) && currentView === "teacherDesk") {
    renderView();
  }
});

if (currentView === "teacherDesk") {
  renderView();
}
