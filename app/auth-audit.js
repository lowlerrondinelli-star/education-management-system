const authSessionKey = `${storageKey}-current-user`;

const authRoleDefaults = {
  "校长/管理员": () => navItems.map((item) => item.id),
  "前台/招生顾问": () => ["dashboard", "leads", "students", "orders", "classes", "followUp", "data", "templates"],
  "教务/学管师": () => ["dashboard", "teacherDesk", "leads", "students", "classes", "schedule", "leaves", "consume", "feedback", "followUp", "masters", "data"],
  "教师": () => ["dashboard", "teacherDesk", "schedule", "leaves", "consume", "feedback"],
  "财务/收银": () => ["dashboard", "orders", "consume", "reports", "data"]
};

const authFormModules = {
  studentForm: "students",
  leadForm: "leads",
  leadTrialForm: "leads",
  orderForm: "orders",
  paymentForm: "orders",
  financeAdjustForm: "orders",
  assignForm: "classes",
  lessonForm: "schedule",
  batchScheduleForm: "schedule",
  scheduleAdjustForm: "schedule",
  attendanceForm: "schedule",
  feedbackForm: "feedback",
  leaveRequestForm: "leaves",
  leaveMakeupForm: "leaves",
  followUpForm: "followUp",
  courseForm: "masters",
  teacherForm: "masters",
  roomForm: "masters",
  employeeForm: "staff",
  roleForm: "staff"
};

const authClickPolicies = [
  ["#newStudentBtn, #newStudentInline", "students", "新增学员"],
  ["[data-lead-status], [data-lead-trial], [data-lead-convert], [data-lead-lost], [data-lead-record]", "leads", "招生线索"],
  ["[data-student-order], [data-student-orders], [data-pay-order], [data-finance-adjust], [data-class-orders]", "orders", "订单/收款"],
  ["[data-student-class], [data-class-assign]", "classes", "分班"],
  ["[data-student-follow]", "followUp", "续费跟进"],
  ["[data-attendance-lesson], [data-finish-lesson], [data-schedule-adjust], [data-student-schedule]", "schedule", "排课/上课"],
  ["[data-feedback-lesson]", "feedback", "课后反馈"],
  ["[data-schedule-leave], [data-lesson-leave], [data-leave-approve], [data-leave-reject], [data-leave-makeup], [data-leave-complete]", "leaves", "请假补课"],
  ["[data-export], #backupData, #restoreData, #resetDemo", "data", "数据导入导出"]
];

const authStyle = document.createElement("style");
authStyle.textContent = `
  .auth-bar{display:flex;align-items:center;gap:8px;min-height:40px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:0 10px}
  .auth-bar span{font-size:12px;color:var(--muted);white-space:nowrap}
  .auth-bar select{border:0;background:transparent;min-width:132px;height:32px;color:var(--text);font-weight:700}
  .auth-bar select:focus{outline:none}
  .auth-card{display:grid;gap:10px}
  .auth-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .auth-denied{opacity:.45}
  .auth-hidden-action{display:none!important}
  .audit-table td:first-child{white-space:nowrap}
  @media (max-width: 980px){.auth-bar{width:100%;justify-content:space-between}.auth-bar select{min-width:0;flex:1}}
`;
document.head.appendChild(authStyle);

let authAuditSaving = false;

function ensureAuthAuditData() {
  if (typeof ensureStaffData === "function") ensureStaffData();
  if (!Array.isArray(appState.auditLogs)) appState.auditLogs = [];
  const activeEmployees = activeAuthEmployees();
  const savedUser = text(localStorage.getItem(authSessionKey)).trim();
  const currentIsValid = activeEmployees.some((employee) => employee.name === appState.currentUserName);
  if (!currentIsValid && savedUser && activeEmployees.some((employee) => employee.name === savedUser)) appState.currentUserName = savedUser;
  if (!appState.currentUserName || !activeEmployees.some((employee) => employee.name === appState.currentUserName)) {
    const admin = activeEmployees.find((employee) => text(employee.roles).includes("校长/管理员"));
    appState.currentUserName = (admin || activeEmployees[0])?.name || "校长";
  }
}

function activeAuthEmployees() {
  const employees = Array.isArray(appState.employees) ? appState.employees : [];
  return employees.filter((employee) => employee.status !== "离职" && employee.status !== "停用");
}

function currentAuthEmployee() {
  ensureAuthAuditData();
  return activeAuthEmployees().find((employee) => employee.name === appState.currentUserName) || activeAuthEmployees()[0] || null;
}

function authRoleNames(employee = currentAuthEmployee()) {
  return text(employee?.roles || "校长/管理员")
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function currentAuthRoleLabel() {
  return authRoleNames().join("、") || "未设置角色";
}

function authRolePermissions(roleName) {
  const defaults = authRoleDefaults[roleName]?.() || [];
  const role = (appState.roles || []).find((item) => item.name === roleName);
  return [...defaults, ...(role?.permissions || [])];
}

function currentAuthPermissions() {
  const permissionSet = new Set(["dashboard"]);
  authRoleNames().forEach((roleName) => authRolePermissions(roleName).forEach((permission) => permissionSet.add(permission)));
  return permissionSet;
}

function canAccessView(viewId) {
  if (!viewId || !viewMeta[viewId]) return true;
  const permissions = currentAuthPermissions();
  return permissions.has(viewId) || authRoleNames().some((role) => role === "校长/管理员");
}

function firstAccessibleView() {
  return navItems.find((item) => canAccessView(item.id))?.id || "dashboard";
}

function authViewLabel(viewId) {
  return viewMeta[viewId]?.[0] || navItems.find((item) => item.id === viewId)?.label || viewId || "系统";
}

function authActionAllowed(moduleId) {
  return !moduleId || canAccessView(moduleId);
}

function appendAuditLog(action, target, detail, status = "成功") {
  if (authAuditSaving) return;
  if (!Array.isArray(appState.auditLogs)) appState.auditLogs = [];
  const employee = currentAuthEmployee();
  appState.auditLogs.unshift({
    id: nextId("A"),
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
    operator: employee?.name || appState.currentUserName || "未选择员工",
    roles: currentAuthRoleLabel(),
    module: authViewLabel(currentView),
    action,
    target: text(target),
    detail: text(detail),
    status
  });
  appState.auditLogs = appState.auditLogs.slice(0, 300);
}

function persistAuthState() {
  localStorage.setItem(authSessionKey, appState.currentUserName || "");
  authAuditSaving = true;
  saveState();
  authAuditSaving = false;
}

function renderAuthBar() {
  ensureAuthAuditData();
  const actions = document.querySelector(".topbar-actions");
  if (!actions) return;
  let bar = document.querySelector("#authBar");
  if (!bar) {
    bar = document.createElement("label");
    bar.id = "authBar";
    bar.className = "auth-bar";
    const searchBox = actions.querySelector(".search-box");
    if (searchBox) {
      searchBox.after(bar);
    } else {
      actions.prepend(bar);
    }
  }
  const employees = activeAuthEmployees();
  bar.innerHTML = `
    <span>当前账号</span>
    <select id="authUserSelect" aria-label="切换当前登录员工">
      ${employees
        .map((employee) => `<option value="${escapeHtml(employee.name)}" ${employee.name === appState.currentUserName ? "selected" : ""}>${escapeHtml(employee.name)}</option>`)
        .join("")}
    </select>
    ${tag(currentAuthRoleLabel(), "green")}
  `;
}

function syncPersistentChromeForAuth() {
  const newStudentBtn = document.querySelector("#newStudentBtn");
  if (newStudentBtn) {
    const canCreateStudent = canAccessView("students");
    newStudentBtn.hidden = !canCreateStudent;
    newStudentBtn.disabled = !canCreateStudent;
    newStudentBtn.classList.toggle("auth-hidden-action", !canCreateStudent);
    newStudentBtn.title = canCreateStudent ? "" : "当前账号没有学员档案权限";
  }

  const searchInput = document.querySelector("#globalSearch");
  if (searchInput) {
    searchInput.placeholder = canAccessView("students") || canAccessView("orders") || canAccessView("leads") ? "搜索学员、班级、课程、老师" : "搜索课节、课程、老师、请假";
  }

  const note = document.querySelector(".sidebar-note span");
  if (note) {
    note.textContent = canAccessView("orders") || canAccessView("followUp") ? "先处理待上课、欠费、课时不足三类提醒。" : "先处理待上课、点名、课后反馈。";
  }
}

function blockUnauthorizedAction(moduleId, label) {
  const targetView = firstAccessibleView();
  setNotice(targetView, `当前账号没有“${authViewLabel(moduleId)}”权限，已拦截 ${label}。`, "amber");
  appendAuditLog("权限拦截", authViewLabel(moduleId), label, "拒绝");
  persistAuthState();
  setView(targetView);
}

function disableUnauthorizedActions() {
  authClickPolicies.forEach(([selector, moduleId, label]) => {
    if (authActionAllowed(moduleId)) return;
    document.querySelectorAll(selector).forEach((item) => {
      item.disabled = true;
      item.classList.add("auth-denied");
      item.title = `当前账号没有“${authViewLabel(moduleId)}”权限，不能执行${label}`;
    });
  });
  const newStudentBtn = document.querySelector("#newStudentBtn");
  if (newStudentBtn && !canAccessView("students")) {
    newStudentBtn.disabled = true;
    newStudentBtn.title = "当前账号没有学员档案权限";
  }
  syncPersistentChromeForAuth();
}

function renderAuthAuditPanel() {
  ensureAuthAuditData();
  const employee = currentAuthEmployee();
  const permissions = [...currentAuthPermissions()]
    .filter((permission) => navItems.some((item) => item.id === permission))
    .map((permission) => tag(authViewLabel(permission), permission === "dashboard" ? "green" : ""));
  const rows = appState.auditLogs.slice(0, 12).map(
    (item) => `<tr>
      <td>${escapeHtml(item.time)}</td>
      <td><strong>${escapeHtml(item.operator)}</strong><br><span class="muted">${escapeHtml(item.roles)}</span></td>
      <td>${escapeHtml(item.module)}</td>
      <td>${escapeHtml(item.action)}</td>
      <td>${escapeHtml(item.target)}</td>
      <td>${tag(item.status, item.status === "拒绝" ? "red" : "green")}</td>
    </tr>`
  );
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <h3>登录与操作审计</h3>
          <span class="muted">本地原型使用员工快速切换模拟登录，后续接后端后可替换为账号密码。</span>
        </div>
        ${tag(`${appState.auditLogs.length} 条日志`, appState.auditLogs.length ? "amber" : "green")}
      </div>
      <div class="section-body auth-card">
        <div class="auth-inline">
          <strong>${escapeHtml(employee?.name || "未选择员工")}</strong>
          ${tag(currentAuthRoleLabel(), "green")}
          <span class="muted">可用模块：</span>
          ${permissions.join("")}
        </div>
        ${table(["时间", "操作人", "模块", "动作", "对象", "结果"], rows).replace("table>", "table class=\"audit-table\">")}
      </div>
    </section>`;
}

function flattenAuditLogRows() {
  ensureAuthAuditData();
  return appState.auditLogs.map((item) => ({
    id: item.id,
    time: item.time,
    operator: item.operator,
    roles: item.roles,
    module: item.module,
    action: item.action,
    target: item.target,
    detail: item.detail,
    status: item.status
  }));
}

const baseSaveStateForAuthAudit = saveState;
saveState = function saveStateWithAuditLog() {
  if (!authAuditSaving) {
    appendAuditLog("保存数据", authViewLabel(currentView), operationNotice?.text || "业务数据已保存");
  }
  baseSaveStateForAuthAudit();
};

const baseSetViewForAuthAudit = setView;
setView = function setViewWithAuth(view) {
  ensureAuthAuditData();
  if (!canAccessView(view)) {
    const deniedView = view;
    const fallback = firstAccessibleView();
    appendAuditLog("访问模块", authViewLabel(deniedView), "当前角色无权限", "拒绝");
    operationNotice = { view: fallback, text: `当前账号没有“${authViewLabel(deniedView)}”权限，已切换到可访问模块。`, tone: "amber" };
    view = fallback;
  }
  baseSetViewForAuthAudit(view);
};

const baseRenderNavForAuthAudit = renderNav;
renderNav = function renderNavWithAuth() {
  ensureAuthAuditData();
  baseRenderNavForAuthAudit();
  navList.querySelectorAll("[data-view]").forEach((button) => {
    if (!canAccessView(button.dataset.view)) button.remove();
  });
  renderAuthBar();
  syncPersistentChromeForAuth();
};

const baseRenderViewForAuthAudit = renderView;
renderView = function renderViewWithAuthAudit() {
  baseRenderViewForAuthAudit();
  disableUnauthorizedActions();
};

if (typeof renderStaff === "function") {
  const baseRenderStaffForAuthAudit = renderStaff;
  renderStaff = function renderStaffWithAuthAudit() {
    baseRenderStaffForAuthAudit();
    appContent.insertAdjacentHTML("beforeend", renderAuthAuditPanel());
  };
}

if (typeof exportDataset === "function") {
  const baseExportDatasetForAuthAudit = exportDataset;
  exportDataset = function exportDatasetWithAudit(type) {
    if (type !== "auditLogs") {
      baseExportDatasetForAuthAudit(type);
      return;
    }
    const columns = [
      ["id", "日志编号"],
      ["time", "操作时间"],
      ["operator", "操作人"],
      ["roles", "角色"],
      ["module", "模块"],
      ["action", "动作"],
      ["target", "对象"],
      ["detail", "详情"],
      ["status", "结果"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("操作日志.csv", buildCsv(flattenAuditLogRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "操作日志.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForAuthAudit = renderDataCenter;
  renderDataCenter = function renderDataCenterWithAudit() {
    baseRenderDataCenterForAuthAudit();
    const metricValue = [...appContent.querySelectorAll(".metric")]
      .find((item) => item.textContent.includes("数据表数量"))
      ?.querySelector("strong");
    if (metricValue) metricValue.textContent = "24";

    const dataGrid = appContent.querySelector(".data-grid");
    if (!dataGrid || dataGrid.querySelector('[data-export="auditLogs"]')) return;
    const card = document.createElement("article");
    card.className = "data-card";
    card.innerHTML = `<div><span class="muted">操作日志</span><strong>${flattenAuditLogRows().length}</strong></div><button class="small-button" type="button" data-export="auditLogs">导出日志</button>`;
    const rolesCard = dataGrid.querySelector('[data-export="roles"]')?.closest(".data-card");
    if (rolesCard) {
      rolesCard.after(card);
    } else {
      dataGrid.appendChild(card);
    }
  };
}

document.addEventListener("change", (event) => {
  if (event.target.id !== "authUserSelect") return;
  appState.currentUserName = event.target.value;
  appendAuditLog("切换账号", appState.currentUserName, `当前角色：${currentAuthRoleLabel()}`);
  persistAuthState();
  const nextView = canAccessView(currentView) ? currentView : firstAccessibleView();
  setView(nextView);
});

document.addEventListener(
  "click",
  (event) => {
    const policy = authClickPolicies.find(([selector]) => event.target.closest(selector));
    if (!policy) return;
    const [, moduleId, label] = policy;
    if (authActionAllowed(moduleId)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    blockUnauthorizedAction(moduleId, label);
  },
  true
);

document.addEventListener(
  "submit",
  (event) => {
    const moduleId = authFormModules[event.target.id];
    if (!moduleId || authActionAllowed(moduleId)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    blockUnauthorizedAction(moduleId, `提交 ${event.target.id}`);
  },
  true
);

ensureAuthAuditData();
renderNav();
setView(canAccessView(currentView) ? currentView : firstAccessibleView());
