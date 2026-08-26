const roleQuickLaunchStyle = document.createElement("style");
roleQuickLaunchStyle.textContent = `
  .role-launch-panel {
    margin-bottom: 16px;
  }

  .role-launch-toolbar {
    align-items: end;
  }

  .role-launch-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .role-launch-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .role-launch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .role-launch-card {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    padding: 12px;
    display: grid;
    gap: 10px;
    align-content: start;
    min-width: 0;
  }

  .role-launch-card.warn {
    border-color: #f2b8a2;
    background: #fff7f2;
  }

  .role-launch-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
  }

  .role-launch-top strong {
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .role-launch-card p {
    margin: 0;
    line-height: 1.55;
    color: var(--muted);
  }

  .role-launch-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  @media (max-width: 650px) {
    .role-launch-toolbar,
    .role-launch-toolbar label,
    .role-launch-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(roleQuickLaunchStyle);

let roleQuickLaunchFilter = "";
let roleQuickLastUserName = "";

const roleQuickLaunchProfiles = [
  { id: "teacher", label: "老师", roles: ["教师"], module: "teacherDesk", view: "teacherDesk" },
  { id: "front", label: "前台/招生", roles: ["前台/招生顾问"], module: "leads", view: "leads" },
  { id: "academic", label: "教务/学管", roles: ["教务/学管师"], module: "schedule", view: "schedule" },
  { id: "finance", label: "财务/收银", roles: ["财务/收银"], module: "orders", view: "orders" },
  { id: "principal", label: "校长", roles: ["校长/管理员"], module: "reports", view: "reports" }
];

function roleQuickCanAccess(viewId) {
  return typeof canAccessView !== "function" || canAccessView(viewId);
}

function roleQuickCurrentRoles() {
  return typeof authRoleNames === "function" ? authRoleNames() : ["校长/管理员"];
}

function roleQuickDefaultRole() {
  const currentRoles = roleQuickCurrentRoles();
  const matched = roleQuickLaunchProfiles.find((profile) => profile.roles.some((role) => currentRoles.includes(role)));
  return matched?.id || "teacher";
}

function roleQuickSelectedRole() {
  const currentUserName = typeof currentAuthEmployee === "function" ? currentAuthEmployee()?.name || "" : appState.currentUserName || "";
  if (currentUserName !== roleQuickLastUserName) {
    roleQuickLastUserName = currentUserName;
    roleQuickLaunchFilter = "";
  }
  if (!roleQuickLaunchFilter) roleQuickLaunchFilter = roleQuickDefaultRole();
  return roleQuickLaunchFilter;
}

function roleQuickTaskCount(type) {
  const tasks = typeof buildTaskCenterRows === "function" ? buildTaskCenterRows() : [];
  if (type === "teacher") return tasks.filter((task) => ["点名", "反馈"].includes(task.type)).length;
  if (type === "front") return tasks.filter((task) => ["跟进", "续费"].includes(task.type)).length + (appState.leads || []).filter((lead) => lead.status !== "已转学员" && lead.status !== "无效").length;
  if (type === "academic") return tasks.filter((task) => ["点名", "请假"].includes(task.type)).length + appState.lessons.filter((lesson) => lesson.status === "待上课").length;
  if (type === "finance") return tasks.filter((task) => task.type === "收款").length + appState.orders.filter((order) => Number(order.debt || 0) > 0 && order.status !== "已作废").length;
  if (type === "principal") return tasks.filter((task) => task.priority === "高").length;
  return 0;
}

function roleQuickLessonsToday() {
  const today = todayIsoDate();
  return appState.lessons.filter((lesson) => lesson.date === today && lesson.status === "待上课").length;
}

function roleQuickLaunchItems() {
  const debtCount = appState.orders.filter((order) => Number(order.debt || 0) > 0 && order.status !== "已作废").length;
  const lowBalance = appState.students.filter((student) => Number(student.balance || 0) > 0 && Number(student.balance || 0) <= 3).length;
  const pendingFeedback = typeof pendingFeedbackLessons === "function" ? pendingFeedbackLessons().length : 0;
  const pendingLeaves = (appState.leaveRequests || []).filter((leave) => ["待审批", "待补课", "已批准", "已安排补课"].includes(leave.status)).length;
  const pendingLeads = (appState.leads || []).filter((lead) => lead.status !== "已转学员" && lead.status !== "无效").length;
  const importIssues = typeof flattenDataFieldAuditRows === "function" ? flattenDataFieldAuditRows().filter((row) => row.status !== "完整").length : 0;

  return [
    {
      role: "teacher",
      title: "老师上课入口",
      count: roleQuickTaskCount("teacher"),
      countLabel: "待处理",
      tone: roleQuickTaskCount("teacher") ? "amber" : "green",
      detail: `今日 ${roleQuickLessonsToday()} 节待上，优先完成课前准备、点名和课后反馈。`,
      actions: [
        ["teacherDesk", "老师工作台", "primary"],
        ["schedule", "排课点名"],
        ["feedback", "课后反馈"],
        ["consume", "课时流水"]
      ]
    },
    {
      role: "front",
      title: "前台招生入口",
      count: pendingLeads + lowBalance,
      countLabel: "线索/续费",
      tone: pendingLeads + lowBalance ? "amber" : "green",
      detail: `${pendingLeads} 条线索需维护，${lowBalance} 名学员课时偏低。`,
      actions: [
        ["leads", "招生线索", "primary"],
        ["students", "学员档案"],
        ["orders", "报名收款"],
        ["followUp", "续费跟进"]
      ]
    },
    {
      role: "academic",
      title: "教务排课入口",
      count: appState.lessons.filter((lesson) => lesson.status === "待上课").length + pendingLeaves,
      countLabel: "课程/请假",
      tone: pendingLeaves ? "red" : "amber",
      detail: `${appState.lessons.filter((lesson) => lesson.status === "待上课").length} 节待上课，${pendingLeaves} 条请假补课需闭环。`,
      actions: [
        ["schedule", "排课管理", "primary"],
        ["classes", "班级花名册"],
        ["leaves", "请假补课"],
        ["data", "导入校验"]
      ]
    },
    {
      role: "finance",
      title: "财务收款入口",
      count: debtCount,
      countLabel: "欠费订单",
      tone: debtCount ? "red" : "green",
      detail: `${debtCount} 笔订单仍有欠费，收款日报可用于每日对账。`,
      actions: [
        ["orders", "订单收款", "primary"],
        ["reports", "经营报表"],
        ["data", "导出表格"],
        ["consume", "消课流水"]
      ]
    },
    {
      role: "principal",
      title: "校长复盘入口",
      count: roleQuickTaskCount("principal") + importIssues,
      countLabel: "高优先/数据",
      tone: roleQuickTaskCount("principal") || importIssues ? "amber" : "green",
      detail: `高优先待办 ${roleQuickTaskCount("principal")} 项，数据字段待核对 ${importIssues} 项。`,
      actions: [
        ["dashboard", "运营总览", "primary"],
        ["reports", "经营报表"],
        ["staff", "员工权限"],
        ["data", "数据中心"]
      ]
    }
  ];
}

function roleQuickVisibleItems() {
  const selected = roleQuickSelectedRole();
  return roleQuickLaunchItems()
    .filter((item) => selected === "all" || item.role === selected)
    .map((item) => ({
      ...item,
      actions: item.actions.filter(([view]) => roleQuickCanAccess(view))
    }))
    .filter((item) => item.actions.length);
}

function renderRoleQuickToolbar() {
  const selected = roleQuickSelectedRole();
  return `
    <div class="filters role-launch-toolbar">
      <label>角色入口
        <select id="roleQuickLaunchFilter" aria-label="按角色查看快捷入口">
          <option value="all" ${selected === "all" ? "selected" : ""}>全部角色</option>
          ${roleQuickLaunchProfiles
            .map((profile) => `<option value="${escapeHtml(profile.id)}" ${selected === profile.id ? "selected" : ""}>${escapeHtml(profile.label)}</option>`)
            .join("")}
        </select>
      </label>
    </div>`;
}

function renderRoleQuickCards(items) {
  return `<div class="role-launch-grid">
    ${items
      .map(
        (item) => `<article class="role-launch-card ${item.tone === "green" ? "" : "warn"}">
          <div class="role-launch-top">
            <strong>${escapeHtml(item.title)}</strong>
            ${tag(`${item.count} ${item.countLabel}`, item.tone)}
          </div>
          <p>${escapeHtml(item.detail)}</p>
          <div class="role-launch-actions">
            ${item.actions
              .map(([view, label, kind]) => `<button class="${kind === "primary" ? "primary-action" : "small-button"}" type="button" data-go="${escapeHtml(view)}">${escapeHtml(label)}</button>`)
              .join("")}
          </div>
        </article>`
      )
      .join("") || `<div class="stack-item"><strong>当前账号没有匹配入口</strong><span class="muted">请切换账号或在员工权限中检查角色授权。</span></div>`}
  </div>`;
}

function insertRoleQuickLaunch() {
  if (currentView !== "dashboard" || appContent.querySelector(".role-launch-panel")) return;
  const items = roleQuickVisibleItems();
  const panel = `
    <section class="section role-launch-panel">
      <div class="section-head">
        <div>
          <h3>角色快捷入口</h3>
          <span class="muted">按岗位把高频操作放到第一屏，老师和教务不用在长导航里找功能。</span>
        </div>
        ${tag(`${items.length} 组`, items.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${renderRoleQuickToolbar()}
        ${renderRoleQuickCards(items)}
      </div>
    </section>`;

  const dailyPanel = appContent.querySelector(".daily-handover-panel");
  if (dailyPanel) {
    dailyPanel.insertAdjacentHTML("beforebegin", panel);
    return;
  }
  const flowPanel = appContent.querySelector(".operation-flow-panel");
  if (flowPanel) {
    flowPanel.insertAdjacentHTML("afterend", panel);
    return;
  }
  const hero = appContent.querySelector(".dashboard-hero");
  if (hero) {
    hero.insertAdjacentHTML("afterend", panel);
    return;
  }
  appContent.insertAdjacentHTML("afterbegin", panel);
}

const baseRenderDashboardForRoleQuickLaunch = renderDashboard;
renderDashboard = function renderDashboardWithRoleQuickLaunch() {
  baseRenderDashboardForRoleQuickLaunch();
  insertRoleQuickLaunch();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "authUserSelect") roleQuickLaunchFilter = "";
  if (event.target.id === "roleQuickLaunchFilter") roleQuickLaunchFilter = event.target.value;
  if (event.target.id === "roleQuickLaunchFilter" && currentView === "dashboard") renderView();
});

if (currentView === "dashboard") {
  renderView();
}
