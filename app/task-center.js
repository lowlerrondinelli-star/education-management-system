const taskCenterStyle = document.createElement("style");
taskCenterStyle.textContent = `
  .task-center-panel {
    margin-top: 0;
  }

  .task-center-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 140px;
  }

  .task-center-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .task-title {
    display: grid;
    gap: 4px;
    min-width: 190px;
  }

  .task-detail {
    min-width: 230px;
    max-width: 380px;
    white-space: normal;
    line-height: 1.55;
  }

  .task-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 150px;
  }

  @media (max-width: 650px) {
    .task-center-toolbar,
    .task-center-toolbar label,
    .task-center-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(taskCenterStyle);

let taskCenterTypeFilter = "all";
let taskCenterOwnerFilter = "all";
let taskCenterPriorityFilter = "all";
let taskCenterSortMode = "priority";

const taskPriorityWeight = { 高: 1, 中: 2, 低: 3 };

function taskCenterDateValue(value) {
  const date = new Date(`${value || "9999-12-31"}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date.getTime() : new Date("9999-12-31T00:00:00").getTime();
}

function taskCenterPriorityTone(priority) {
  if (priority === "高") return "red";
  if (priority === "中") return "amber";
  return "green";
}

function taskCenterRoleNames() {
  if (typeof authRoleNames === "function") return authRoleNames();
  return [];
}

function taskCenterCanViewModule(viewId) {
  return typeof canAccessView !== "function" || canAccessView(viewId);
}

function taskCenterCanViewAllTeaching() {
  return taskCenterRoleNames().some((role) => ["校长/管理员", "教务/学管师"].includes(role));
}

function taskCenterCurrentEmployee() {
  return typeof currentAuthEmployee === "function" ? currentAuthEmployee() : null;
}

function taskCenterCurrentTeacherName() {
  const employee = taskCenterCurrentEmployee();
  if (employee?.isTeacher === "是" || text(employee?.roles).includes("教师")) return employee.name;
  return "";
}

function taskCenterCanHandleLesson(lesson) {
  if (taskCenterCanViewAllTeaching()) return true;
  const teacherName = taskCenterCurrentTeacherName();
  return !teacherName || lesson.teacher === teacherName;
}

function taskCenterCanHandleTask(task) {
  if (!taskCenterCanViewModule(task.module)) return false;
  if (task.lessonId) {
    const lesson = appState.lessons.find((item) => item.id === task.lessonId);
    if (lesson && !taskCenterCanHandleLesson(lesson)) return false;
  }
  return true;
}

function normalizeTaskCenterFilters(tasks) {
  const types = new Set(tasks.map((task) => task.type));
  const owners = new Set(tasks.map((task) => task.owner));
  const priorities = new Set(tasks.map((task) => task.priority));
  if (taskCenterTypeFilter !== "all" && !types.has(taskCenterTypeFilter)) taskCenterTypeFilter = "all";
  if (taskCenterOwnerFilter !== "all" && !owners.has(taskCenterOwnerFilter)) taskCenterOwnerFilter = "all";
  if (taskCenterPriorityFilter !== "all" && !priorities.has(taskCenterPriorityFilter)) taskCenterPriorityFilter = "all";
}

function taskCenterLessonHasAttendance(lesson) {
  const record = appState.attendance?.find((item) => item.lessonId === lesson.id);
  return Boolean(record?.updatedAt || record?.locked);
}

function taskCenterLessonPriority(lesson) {
  const today = todayIsoDate();
  if (lesson.date <= today) return "高";
  const dueTime = taskCenterDateValue(lesson.date);
  const todayTime = taskCenterDateValue(today);
  return dueTime - todayTime <= 2 * 86400000 ? "中" : "低";
}

function taskCenterGoAction(view, label = "查看") {
  return `<button class="small-button" type="button" data-go="${escapeHtml(view)}">${escapeHtml(label)}</button>`;
}

function taskCenterStudentByName(name) {
  return appState.students.find((student) => student.name === name);
}

function taskCenterFollowUpTasks() {
  if (typeof activeFollowUps !== "function") return [];
  return activeFollowUps().map((item) => ({
    id: `follow:${item.id}`,
    module: "followUp",
    type: "跟进",
    priority: item.priority || (item.dueDate <= todayIsoDate() ? "高" : "中"),
    owner: item.owner || "未分配",
    dueDate: item.dueDate,
    title: `${item.student} ${item.type}`,
    subtitle: item.phone || "",
    detail: item.note || item.result || "待联系",
    actions: [
      item.studentId || taskCenterStudentByName(item.student)?.id
        ? `<button class="small-button" type="button" data-student-follow="${escapeHtml(item.studentId || taskCenterStudentByName(item.student)?.id)}">打开</button>`
        : taskCenterGoAction("followUp", "打开"),
      `<button class="small-button" type="button" data-follow-result="${escapeHtml(item.id)}" data-result="已联系">已联系</button>`,
      `<button class="small-button" type="button" data-follow-done="${escapeHtml(item.id)}">完成</button>`
    ].join("")
  }));
}

function taskCenterAttendanceTasks() {
  return appState.lessons
    .filter((lesson) => lesson.status === "待上课" && !taskCenterLessonHasAttendance(lesson))
    .map((lesson) => ({
      id: `attendance:${lesson.id}`,
      module: "schedule",
      lessonId: lesson.id,
      type: "点名",
      priority: taskCenterLessonPriority(lesson),
      owner: lesson.teacher || "任课老师",
      dueDate: lesson.date,
      title: `${lesson.target} 待点名`,
      subtitle: `${lesson.date} ${lesson.time}`,
      detail: `${lesson.subject || "课程"} / ${lesson.teacher || "任课老师"} / ${lesson.room || "教室待定"}`,
      actions: [
        `<button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}">点名</button>`,
        taskCenterGoAction("schedule", "课表")
      ].join("")
    }));
}

function taskCenterFeedbackTasks() {
  if (typeof pendingFeedbackLessons !== "function" && typeof draftFeedbacks !== "function") return [];
  const pendingLessons = typeof pendingFeedbackLessons === "function" ? pendingFeedbackLessons() : [];
  const lessonTasks = pendingLessons.map((lesson) => ({
    id: `feedback:${lesson.id}`,
    module: "feedback",
    lessonId: lesson.id,
    type: "反馈",
    priority: lesson.date <= todayIsoDate() ? "高" : "中",
    owner: lesson.teacher || "任课老师",
    dueDate: lesson.date,
    title: `${lesson.target} 待反馈`,
    subtitle: `${lesson.date} ${lesson.time}`,
    detail: `${lesson.subject || "课程"} / 上课后需要给家长留档`,
    actions: [
      `<button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">写反馈</button>`,
      taskCenterGoAction("feedback", "反馈台")
    ].join("")
  }));

  const drafts = typeof draftFeedbacks === "function" ? draftFeedbacks() : [];
  const draftTasks = drafts.map((item) => ({
    id: `feedbackDraft:${item.id}`,
    module: "feedback",
    lessonId: item.lessonId,
    type: "反馈",
    priority: item.risk === "高" ? "高" : "中",
    owner: item.operator || item.teacher || "任课老师",
    dueDate: item.date,
    title: `${item.student} 反馈草稿`,
    subtitle: item.target,
    detail: `${item.subject || "课程"} / 风险${item.risk || "低"} / 还未发送给家长`,
    actions: [
      `<button class="small-button" type="button" data-feedback-lesson="${escapeHtml(item.lessonId)}">编辑</button>`,
      taskCenterGoAction("feedback", "反馈台")
    ].join("")
  }));

  return [...lessonTasks, ...draftTasks];
}

function taskCenterOrderTasks() {
  return appState.orders.flatMap((order) => {
    const tasks = [];
    const debt = Number(order.debt || 0);
    const remaining = typeof orderHoursRemaining === "function" ? orderHoursRemaining(order) : Math.max(0, Number(order.bought || 0) + Number(order.gift || 0) - Number(order.used || 0));
    const owner = order.owner || "前台老师";

    if (debt > 0 && order.status !== "已作废") {
      tasks.push({
        id: `debt:${order.id}`,
        module: "orders",
        type: "收款",
        priority: "高",
        owner,
        dueDate: todayIsoDate(),
        title: `${order.student} 欠费补缴`,
        subtitle: order.id,
        detail: `${order.course || "课程"} / ${order.className || "未分班"} / 待收 ${money(debt)}`,
        actions: [
          `<button class="small-button" type="button" data-pay-order="${escapeHtml(order.id)}">补缴</button>`,
          taskCenterGoAction("orders", "订单")
        ].join("")
      });
    }

    if (remaining > 0 && remaining <= 3 && order.status !== "已作废") {
      const student = taskCenterStudentByName(order.student);
      tasks.push({
        id: `renew:${order.id}`,
        module: "followUp",
        type: "续费",
        priority: "中",
        owner,
        dueDate: order.expireAt || todayIsoDate(),
        title: `${order.student} 课时不足`,
        subtitle: order.className || order.course || "",
        detail: `剩余 ${remaining} 课时 / 有效期 ${order.expireAt || "未设置"}`,
        actions: [
          student
            ? `<button class="small-button" type="button" data-student-follow="${escapeHtml(student.id)}">跟进</button>`
            : taskCenterGoAction("followUp", "跟进"),
          taskCenterGoAction("orders", "订单")
        ].join("")
      });
    }

    return tasks;
  });
}

function taskCenterLeaveTasks() {
  if (typeof ensureLeaveData !== "function") return [];
  ensureLeaveData();
  return (appState.leaveRequests || [])
    .filter((item) => ["待审批", "待补课", "已批准", "已安排补课"].includes(item.status))
    .map((item) => {
      const lesson = appState.lessons.find((lessonItem) => lessonItem.id === item.lessonId);
      const priority = item.status === "待审批" || item.status === "待补课" ? "高" : "中";
      const action =
        item.status === "待审批"
          ? `<button class="small-button" type="button" data-leave-approve="${escapeHtml(item.id)}">批准</button>`
          : item.status === "已安排补课"
            ? `<button class="small-button" type="button" data-leave-complete="${escapeHtml(item.id)}">完成</button>`
            : `<button class="small-button" type="button" data-leave-makeup="${escapeHtml(item.id)}">安排补课</button>`;

      return {
        id: `leave:${item.id}`,
        module: "leaves",
        lessonId: item.lessonId || "",
        type: "请假",
        priority,
        owner: lesson?.teacher || item.operator || "前台老师",
        dueDate: item.lessonDate || todayIsoDate(),
        title: `${item.student} ${item.status}`,
        subtitle: `${item.lessonDate || ""} ${item.lessonTime || ""}`.trim(),
        detail: `${item.target || "关联课节"} / ${item.reason || item.makeupPlan || "待处理"}`,
        actions: [action, taskCenterGoAction("leaves", "请假台")].join("")
      };
    });
}

function buildTaskCenterRows() {
  return [
    ...taskCenterFollowUpTasks(),
    ...taskCenterAttendanceTasks(),
    ...taskCenterFeedbackTasks(),
    ...taskCenterOrderTasks(),
    ...taskCenterLeaveTasks()
  ];
}

function taskCenterMatches(task) {
  if (taskCenterTypeFilter !== "all" && task.type !== taskCenterTypeFilter) return false;
  if (taskCenterOwnerFilter !== "all" && task.owner !== taskCenterOwnerFilter) return false;
  if (taskCenterPriorityFilter !== "all" && task.priority !== taskCenterPriorityFilter) return false;
  if (!searchTerm) return true;
  const haystack = [task.type, task.priority, task.owner, task.dueDate, task.title, task.subtitle, task.detail].join(" ").toLowerCase();
  return haystack.includes(searchTerm.toLowerCase());
}

function compareTaskCenterRows(left, right) {
  if (taskCenterSortMode === "dueDate") return taskCenterDateValue(left.dueDate) - taskCenterDateValue(right.dueDate);
  if (taskCenterSortMode === "type") return `${left.type}${left.dueDate}`.localeCompare(`${right.type}${right.dueDate}`, "zh-CN");
  if (taskCenterSortMode === "owner") return `${left.owner}${left.dueDate}`.localeCompare(`${right.owner}${right.dueDate}`, "zh-CN");
  const priorityGap = (taskPriorityWeight[left.priority] || 9) - (taskPriorityWeight[right.priority] || 9);
  if (priorityGap) return priorityGap;
  return taskCenterDateValue(left.dueDate) - taskCenterDateValue(right.dueDate);
}

function taskCenterOptions(values, selectedValue, allLabel) {
  const unique = [...new Set(values.filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...unique.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function taskCenterToolbar(tasks) {
  return `
    <div class="filters task-center-toolbar">
      <label>事项类型
        <select id="taskCenterTypeFilter" aria-label="筛选待办类型">
          ${taskCenterOptions(tasks.map((task) => task.type), taskCenterTypeFilter, "全部类型")}
        </select>
      </label>
      <label>负责人
        <select id="taskCenterOwnerFilter" aria-label="筛选待办负责人">
          ${taskCenterOptions(tasks.map((task) => task.owner), taskCenterOwnerFilter, "全部负责人")}
        </select>
      </label>
      <label>优先级
        <select id="taskCenterPriorityFilter" aria-label="筛选待办优先级">
          <option value="all" ${taskCenterPriorityFilter === "all" ? "selected" : ""}>全部优先级</option>
          <option value="高" ${taskCenterPriorityFilter === "高" ? "selected" : ""}>高</option>
          <option value="中" ${taskCenterPriorityFilter === "中" ? "selected" : ""}>中</option>
          <option value="低" ${taskCenterPriorityFilter === "低" ? "selected" : ""}>低</option>
        </select>
      </label>
      <label>排序
        <select id="taskCenterSortMode" aria-label="待办排序">
          <option value="priority" ${taskCenterSortMode === "priority" ? "selected" : ""}>优先级</option>
          <option value="dueDate" ${taskCenterSortMode === "dueDate" ? "selected" : ""}>到期日</option>
          <option value="type" ${taskCenterSortMode === "type" ? "selected" : ""}>事项类型</option>
          <option value="owner" ${taskCenterSortMode === "owner" ? "selected" : ""}>负责人</option>
        </select>
      </label>
    </div>`;
}

function taskCenterSummary(tasks) {
  const high = tasks.filter((task) => task.priority === "高").length;
  const lessonTasks = tasks.filter((task) => task.type === "点名" || task.type === "反馈").length;
  const businessTasks = tasks.filter((task) => ["跟进", "收款", "续费"].includes(task.type)).length;
  const leaveTasks = tasks.filter((task) => task.type === "请假").length;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>待办总数</span><strong>${tasks.length}</strong><small>跨模块统一清单</small></div>
      <div class="metric"><span>高优先级</span><strong>${high}</strong><small>建议优先处理</small></div>
      <div class="metric"><span>教学事项</span><strong>${lessonTasks}</strong><small>点名与课后反馈</small></div>
      <div class="metric"><span>经营事项</span><strong>${businessTasks + leaveTasks}</strong><small>跟进、收款、请假</small></div>
    </div>`;
}

function renderTaskCenterRows(tasks) {
  return tasks.map((task) => `<tr>
    <td>
      <div class="task-title">
        <strong>${escapeHtml(task.title)}</strong>
        <span class="muted">${escapeHtml(task.subtitle || task.id)}</span>
      </div>
    </td>
    <td>${tag(task.type, task.type === "收款" || task.type === "请假" ? "red" : task.type === "点名" ? "amber" : "")}</td>
    <td>${escapeHtml(task.owner)}</td>
    <td>${escapeHtml(task.dueDate || "-")}</td>
    <td>${tag(task.priority, taskCenterPriorityTone(task.priority))}</td>
    <td class="task-detail">${escapeHtml(task.detail)}</td>
    <td><div class="task-actions">${task.actions}</div></td>
  </tr>`);
}

function cleanDashboardReminderPermissions() {
  const reminderSection = [...appContent.querySelectorAll(".section")].find((section) => section.querySelector(".section-head h3")?.textContent === "待办提醒");
  if (!reminderSection) return;

  reminderSection.querySelectorAll(".dashboard-task").forEach((item) => {
    const goView = item.querySelector("[data-go]")?.dataset.go;
    if (goView && !taskCenterCanViewModule(goView)) item.remove();
  });

  const tasks = [...reminderSection.querySelectorAll(".dashboard-task")];
  const countTag = reminderSection.querySelector(".section-head .tag");
  if (countTag) {
    countTag.textContent = `${tasks.length} 项`;
    countTag.className = `tag ${tasks.length ? "amber" : "green"}`;
  }

  const body = reminderSection.querySelector(".section-body");
  if (body && !tasks.length && !body.querySelector(".stack-item")) {
    body.insertAdjacentHTML("beforeend", `<div class="stack-item"><strong>暂无当前账号可处理提醒</strong><span class="muted">需要处理的教学事项会优先显示在上方统一待办。</span></div>`);
  }
}

function cleanDashboardHeroForPermissions() {
  const hero = appContent.querySelector(".dashboard-hero");
  if (!hero) return;

  hero.querySelectorAll("[data-go]").forEach((button) => {
    if (!taskCenterCanViewModule(button.dataset.go)) button.remove();
  });

  const shouldUseTeachingCopy = !taskCenterCanViewModule("orders") && !taskCenterCanViewModule("followUp");
  if (shouldUseTeachingCopy) {
    const title = hero.querySelector("h3");
    const subtitle = hero.querySelector(".muted");
    if (title) title.textContent = "先看自己的课表，再完成点名和课后反馈。";
    if (subtitle) subtitle.textContent = "适合老师打开系统后的第一屏。";
  }
}

function cleanDashboardSummaryForPermissions() {
  const summary = appContent.querySelector(".dashboard-summary");
  if (!summary) return;
  const shouldUseTeachingSummary = !taskCenterCanViewModule("orders") && !taskCenterCanViewModule("followUp");
  if (!shouldUseTeachingSummary) return;

  const lessons = appState.lessons.filter((lesson) => lesson.status === "待上课" && taskCenterCanHandleLesson(lesson));
  const todayLessons = lessons.filter((lesson) => lesson.date === todayIsoDate());
  const tasks = buildTaskCenterRows().filter(taskCenterCanHandleTask);
  const attendanceTasks = tasks.filter((task) => task.type === "点名").length;
  const feedbackTasks = tasks.filter((task) => task.type === "反馈").length;
  const leaveTasks = tasks.filter((task) => task.type === "请假").length;

  summary.innerHTML = `
    <div class="metric"><span>今日待上</span><strong>${todayLessons.length}</strong><small>${lessons.length} 节未完成</small></div>
    <div class="metric"><span>待点名</span><strong>${attendanceTasks}</strong><small>当前账号可处理</small></div>
    <div class="metric"><span>待反馈</span><strong>${feedbackTasks}</strong><small>已上课未发送</small></div>
    <div class="metric"><span>请假补课</span><strong>${leaveTasks}</strong><small>需要协同处理</small></div>`;
}

function cleanDashboardScheduleForPermissions() {
  const scheduleSection = [...appContent.querySelectorAll(".section")].find((section) => section.querySelector(".section-head h3")?.textContent.includes("待上课表"));
  if (!scheduleSection) return;

  const today = todayIsoDate();
  const accessibleUpcoming = appState.lessons
    .filter((lesson) => lesson.status === "待上课" && lesson.date >= today && taskCenterCanHandleLesson(lesson))
    .sort(compareLessonTime);
  const accessibleToday = accessibleUpcoming.filter((lesson) => lesson.date === today);
  const nextLessons = (accessibleToday.length ? accessibleToday : accessibleUpcoming).slice(0, 6);
  const heading = scheduleSection.querySelector(".section-head h3");
  const subtitle = scheduleSection.querySelector(".section-head .muted");
  if (heading) heading.textContent = accessibleToday.length ? "今日待上课表" : "最近待上课表";
  if (subtitle) subtitle.textContent = accessibleToday.length ? "按上课时间排序，方便老师点名。" : "今天没有待上课节，已显示当前账号可查看的未来最近课节。";

  const rows = nextLessons.map(
    (lesson) => `<tr>
      <td>${escapeHtml(lesson.date)}</td>
      <td>${escapeHtml(dayFromDate(lesson.date))}</td>
      <td>${escapeHtml(lesson.time)}</td>
      <td>${escapeHtml(lesson.target)}</td>
      <td>${escapeHtml(lesson.teacher)}</td>
      <td>${escapeHtml(lesson.room)}</td>
    </tr>`
  );

  const sectionBody = scheduleSection.querySelector(".section-body");
  if (sectionBody) sectionBody.innerHTML = table(["日期", "星期", "时间", "班级/1对1", "教师", "教室"], rows);
}

function appendTaskCenterPanel() {
  if (currentView !== "dashboard" || appContent.querySelector(".task-center-panel")) return;
  const allTasks = buildTaskCenterRows();
  const tasks = allTasks.filter(taskCenterCanHandleTask);
  normalizeTaskCenterFilters(tasks);
  const visibleTasks = tasks.filter(taskCenterMatches).sort(compareTaskCenterRows);
  const section = `
    <section class="section task-center-panel">
      <div class="section-head">
        <div>
          <h3>今日统一待办</h3>
          <span class="muted">按当前账号权限显示可处理事项，老师每天可以直接从这里开工。</span>
        </div>
        ${tag(`${visibleTasks.length} 项`, visibleTasks.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${taskCenterSummary(tasks)}
        ${taskCenterToolbar(tasks)}
        ${table(["事项", "类型", "负责人", "到期", "优先级", "详情", "操作"], renderTaskCenterRows(visibleTasks))}
      </div>
    </section>`;

  const layout = appContent.querySelector(".layout-two");
  if (layout) {
    layout.insertAdjacentHTML("beforebegin", section);
  } else {
    appContent.insertAdjacentHTML("beforeend", section);
  }
}

const baseRenderDashboardForTaskCenter = renderDashboard;
renderDashboard = function renderDashboardWithTaskCenter() {
  baseRenderDashboardForTaskCenter();
  cleanDashboardHeroForPermissions();
  cleanDashboardSummaryForPermissions();
  cleanDashboardScheduleForPermissions();
  cleanDashboardReminderPermissions();
  appendTaskCenterPanel();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "authUserSelect") {
    taskCenterTypeFilter = "all";
    taskCenterOwnerFilter = "all";
    taskCenterPriorityFilter = "all";
    taskCenterSortMode = "priority";
  }

  if (event.target.id === "taskCenterTypeFilter") taskCenterTypeFilter = event.target.value;
  if (event.target.id === "taskCenterOwnerFilter") taskCenterOwnerFilter = event.target.value;
  if (event.target.id === "taskCenterPriorityFilter") taskCenterPriorityFilter = event.target.value;
  if (event.target.id === "taskCenterSortMode") taskCenterSortMode = event.target.value;

  if (["taskCenterTypeFilter", "taskCenterOwnerFilter", "taskCenterPriorityFilter", "taskCenterSortMode"].includes(event.target.id) && currentView === "dashboard") {
    renderView();
  }
});

if (currentView === "dashboard") {
  renderView();
}
