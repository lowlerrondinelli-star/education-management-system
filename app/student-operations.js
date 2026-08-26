const studentOpsStyle = document.createElement("style");
studentOpsStyle.textContent = `
  .student-ops-panel {
    margin-bottom: 16px;
  }

  .student-ops-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .student-ops-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .student-ops-tags,
  .student-ops-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .student-ops-note {
    max-width: 280px;
    line-height: 1.5;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .student-ops-toolbar,
    .student-ops-toolbar label,
    .student-ops-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(studentOpsStyle);

let studentOpsActionFilter = "all";
let studentOpsOwnerFilter = "all";
let studentOpsSortMode = "priority";

function studentOpsOrders(student) {
  if (typeof studentOrders === "function") return studentOrders(student);
  return appState.orders.filter((order) => order.student === student.name);
}

function studentOpsLessons(student) {
  if (typeof studentLessons === "function") return studentLessons(student);
  const classNames = new Set([student.className, ...studentOpsOrders(student).map((order) => order.className)].filter(Boolean));
  return appState.lessons.filter((lesson) => classNames.has(lesson.target) || text(lesson.target).startsWith(`${student.name}-`));
}

function studentOpsFollowUps(student) {
  if (typeof studentFollowUps === "function") return studentFollowUps(student);
  if (typeof ensureFollowUpData === "function") ensureFollowUpData();
  return (appState.followUps || []).filter((item) => item.studentId === student.id || item.student === student.name);
}

function studentOpsDebt(student) {
  const orderDebt = studentOpsOrders(student).reduce((sum, order) => sum + Number(order.debt || 0), 0);
  return Math.max(Number(student.debt || 0), orderDebt);
}

function studentOpsLastLesson(student) {
  return studentOpsLessons(student).sort((left, right) => compareLessonTime(right, left))[0];
}

function studentOpsNextLesson(student) {
  const today = todayIsoDate();
  return studentOpsLessons(student)
    .filter((lesson) => lesson.status === "待上课" && lesson.date >= today)
    .sort(compareLessonTime)[0];
}

function studentOpsLastFollowUp(student) {
  return studentOpsFollowUps(student).sort((left, right) => text(right.updatedAt || right.dueDate).localeCompare(text(left.updatedAt || left.dueDate)))[0];
}

function studentOpsActions(student) {
  const actions = [];
  const debt = studentOpsDebt(student);
  const balance = Number(student.balance || 0);
  const className = text(student.className).trim();

  if (debt > 0) actions.push({ key: "debt", label: "补缴欠费", tone: "red", priority: 1, note: `待收 ${money(debt)}，建议当天联系确认。` });
  if (balance > 0 && balance <= 3) actions.push({ key: "renew", label: "续费沟通", tone: "amber", priority: 2, note: `仅剩 ${balance} 课时，先安排续费沟通。` });
  if (student.status === "意向") actions.push({ key: "intent", label: "意向回访", tone: "amber", priority: 3, note: `意向课程：${student.course || "待确认"}，建议确认试听或报名。` });
  if (!className || className === "待分班") actions.push({ key: "class", label: "安排分班", tone: "amber", priority: 4, note: "还没有进入正式班级，需要教务分班。" });
  if (!student.phone || !/^1\d{10}$/.test(text(student.phone))) actions.push({ key: "data", label: "补全资料", tone: "red", priority: 5, note: "手机号或基础资料异常，导入和回访前先核对。" });
  if (!studentOpsNextLesson(student) && student.status === "已报名") actions.push({ key: "schedule", label: "核对排课", tone: "", priority: 6, note: "没有未来待上课节，建议核对是否已排课。" });
  if (!actions.length) actions.push({ key: "stable", label: "正常在读", tone: "green", priority: 9, note: "课时和欠费正常，保持常规课堂反馈。" });

  return actions;
}

function studentOpsPrimaryAction(student) {
  return studentOpsActions(student).sort((left, right) => left.priority - right.priority)[0];
}

function studentOpsOwnerOptions() {
  const owners = [...new Set(appState.students.map((student) => student.owner).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return [
    `<option value="all" ${studentOpsOwnerFilter === "all" ? "selected" : ""}>全部负责人</option>`,
    ...owners.map((owner) => `<option value="${escapeHtml(owner)}" ${studentOpsOwnerFilter === owner ? "selected" : ""}>${escapeHtml(owner)}</option>`)
  ].join("");
}

function studentOpsMatches(student) {
  if (!matchesRow(student)) return false;
  if (studentOpsOwnerFilter !== "all" && student.owner !== studentOpsOwnerFilter) return false;
  if (studentOpsActionFilter === "all") return true;
  return studentOpsActions(student).some((action) => action.key === studentOpsActionFilter);
}

function compareStudentOps(left, right) {
  if (studentOpsSortMode === "balanceAsc") return Number(left.balance || 0) - Number(right.balance || 0);
  if (studentOpsSortMode === "debtDesc") return studentOpsDebt(right) - studentOpsDebt(left);
  if (studentOpsSortMode === "name") return text(left.name).localeCompare(text(right.name), "zh-CN");
  if (studentOpsSortMode === "owner") {
    const ownerGap = text(left.owner).localeCompare(text(right.owner), "zh-CN");
    return ownerGap || text(left.name).localeCompare(text(right.name), "zh-CN");
  }
  const priorityGap = studentOpsPrimaryAction(left).priority - studentOpsPrimaryAction(right).priority;
  return priorityGap || text(left.name).localeCompare(text(right.name), "zh-CN");
}

function renderStudentOpsSummary(allStudents, visibleStudents) {
  const debt = allStudents.filter((student) => studentOpsActions(student).some((action) => action.key === "debt")).length;
  const renew = allStudents.filter((student) => studentOpsActions(student).some((action) => action.key === "renew")).length;
  const intent = allStudents.filter((student) => studentOpsActions(student).some((action) => action.key === "intent")).length;
  const classTodo = allStudents.filter((student) => studentOpsActions(student).some((action) => action.key === "class")).length;

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleStudents.length}</strong><small>全部 ${allStudents.length} 名学员</small></div>
      <div class="metric"><span>欠费/续费</span><strong>${debt + renew}</strong><small>${debt} 名欠费，${renew} 名课时不足</small></div>
      <div class="metric"><span>意向回访</span><strong>${intent}</strong><small>需要转化报名</small></div>
      <div class="metric"><span>待分班</span><strong>${classTodo}</strong><small>需要教务安排班级</small></div>
    </div>`;
}

function renderStudentOpsToolbar() {
  return `
    <div class="filters student-ops-toolbar">
      <label>行动类型
        <select id="studentOpsActionFilter" aria-label="学员运营行动类型筛选">
          <option value="all" ${studentOpsActionFilter === "all" ? "selected" : ""}>全部行动</option>
          <option value="debt" ${studentOpsActionFilter === "debt" ? "selected" : ""}>补缴欠费</option>
          <option value="renew" ${studentOpsActionFilter === "renew" ? "selected" : ""}>续费沟通</option>
          <option value="intent" ${studentOpsActionFilter === "intent" ? "selected" : ""}>意向回访</option>
          <option value="class" ${studentOpsActionFilter === "class" ? "selected" : ""}>安排分班</option>
          <option value="schedule" ${studentOpsActionFilter === "schedule" ? "selected" : ""}>核对排课</option>
          <option value="stable" ${studentOpsActionFilter === "stable" ? "selected" : ""}>正常在读</option>
        </select>
      </label>
      <label>负责人
        <select id="studentOpsOwnerFilter" aria-label="学员运营负责人筛选">${studentOpsOwnerOptions()}</select>
      </label>
      <label>排序
        <select id="studentOpsSortMode" aria-label="学员运营排序">
          <option value="priority" ${studentOpsSortMode === "priority" ? "selected" : ""}>处理优先级</option>
          <option value="balanceAsc" ${studentOpsSortMode === "balanceAsc" ? "selected" : ""}>剩余课时升序</option>
          <option value="debtDesc" ${studentOpsSortMode === "debtDesc" ? "selected" : ""}>欠费金额降序</option>
          <option value="owner" ${studentOpsSortMode === "owner" ? "selected" : ""}>负责人分组</option>
          <option value="name" ${studentOpsSortMode === "name" ? "selected" : ""}>姓名顺序</option>
        </select>
      </label>
    </div>`;
}

function renderStudentOpsTags(student) {
  return `<div class="student-ops-tags">${studentOpsActions(student).map((action) => tag(action.label, action.tone)).join("")}</div>`;
}

function renderStudentOpsRows(students) {
  return students.map((student) => {
    const debt = studentOpsDebt(student);
    const nextLesson = studentOpsNextLesson(student);
    const lastFollowUp = studentOpsLastFollowUp(student);
    const primaryAction = studentOpsPrimaryAction(student);
    const followText = lastFollowUp ? `${lastFollowUp.type || "跟进"} / ${lastFollowUp.result || lastFollowUp.status || "待联系"}` : "暂无跟进";
    const lessonText = nextLesson ? `${nextLesson.date} ${nextLesson.time}` : "暂无未来课节";

    return `<tr>
      <td><strong>${escapeHtml(student.name)}</strong><br><span class="muted">${escapeHtml(student.phone)} · ${escapeHtml(student.relation)}</span><br><span class="muted">${escapeHtml(student.grade || "未填年级")} / ${escapeHtml(student.school || "未填学校")}</span></td>
      <td>${escapeHtml(student.owner || "未分配")}<br><span class="muted">${escapeHtml(student.className || "待分班")}</span></td>
      <td>${tag(`余额 ${student.balance}`, Number(student.balance || 0) <= 3 && Number(student.balance || 0) > 0 ? "amber" : "green")}<br>${debt ? tag(`欠费 ${money(debt)}`, "red") : tag("无欠费", "green")}</td>
      <td><strong>${escapeHtml(lessonText)}</strong><br><span class="muted">${escapeHtml(followText)}</span></td>
      <td class="student-ops-note">${renderStudentOpsTags(student)}<span class="muted">${escapeHtml(primaryAction.note)}</span></td>
      <td>
        <div class="student-ops-actions">
          <button class="small-button" type="button" data-student-detail="${escapeHtml(student.id)}">详情</button>
          <button class="small-button" type="button" data-student-order="${escapeHtml(student.id)}">报名</button>
          <button class="small-button" type="button" data-student-class="${escapeHtml(student.id)}">分班</button>
          <button class="small-button" type="button" data-go="followUp">跟进</button>
        </div>
      </td>
    </tr>`;
  });
}

function prependStudentOpsPanel() {
  if (currentView !== "students" || appContent.querySelector(".student-ops-panel")) return;
  const allStudents = appState.students.filter(matchesRow);
  const visibleStudents = appState.students.filter(studentOpsMatches).sort(compareStudentOps);

  appContent.insertAdjacentHTML(
    "afterbegin",
    `<section class="section student-ops-panel">
      <div class="section-head">
        <div>
          <h3>学员运营看板</h3>
          <span class="muted">把报名、分班、续费、欠费和排课状态合成老师能直接处理的行动清单。</span>
        </div>
        ${tag(`${visibleStudents.length} 名`, visibleStudents.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${renderStudentOpsSummary(allStudents, visibleStudents)}
        ${renderStudentOpsToolbar()}
        ${table(["学员/学校", "负责人/班级", "课时资金", "最近动态", "建议动作", "操作"], renderStudentOpsRows(visibleStudents))}
      </div>
    </section>`
  );
}

const baseRenderStudentsForOps = renderStudents;
renderStudents = function renderStudentsWithOpsPanel() {
  baseRenderStudentsForOps();
  prependStudentOpsPanel();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "studentOpsActionFilter") studentOpsActionFilter = event.target.value;
  if (event.target.id === "studentOpsOwnerFilter") studentOpsOwnerFilter = event.target.value;
  if (event.target.id === "studentOpsSortMode") studentOpsSortMode = event.target.value;

  if (["studentOpsActionFilter", "studentOpsOwnerFilter", "studentOpsSortMode"].includes(event.target.id) && currentView === "students") {
    renderView();
  }
});

if (currentView === "students") {
  renderView();
}
