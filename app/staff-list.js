const staffListStyle = document.createElement("style");
staffListStyle.textContent = `
  .staff-list-summary {
    margin-bottom: 14px;
  }

  .staff-filter-toolbar {
    align-items: end;
  }

  .staff-filter-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 145px;
  }

  .staff-filter-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .staff-risk-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 280px;
  }

  .staff-permission-note {
    max-width: 320px;
    white-space: normal;
    line-height: 1.55;
  }

  @media (max-width: 650px) {
    .staff-filter-toolbar,
    .staff-filter-toolbar label,
    .staff-filter-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(staffListStyle);

let staffStatusFilter = "active";
let staffDepartmentFilter = "all";
let staffRoleFilter = "all";
let staffTeacherFilter = "all";
let staffRiskFilter = "all";
let staffSortMode = "risk";

function staffRoleNames(employee) {
  return text(employee.roles)
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function staffRolePermissionIds(employee) {
  const ids = new Set();
  staffRoleNames(employee).forEach((roleName) => {
    const role = appState.roles.find((item) => item.name === roleName);
    (role?.permissions || []).forEach((permission) => ids.add(permission));
  });
  return [...ids];
}

function staffEmployeeRiskReasons(employee) {
  const reasons = [];
  const phone = text(employee.phone).trim();
  const roles = staffRoleNames(employee);
  const permissions = staffRolePermissionIds(employee);
  const isTeacherRole = roles.some((role) => role.includes("教师")) || text(employee.subjects).trim();
  const isManager = roles.some((role) => role.includes("校长") || role.includes("管理员"));

  if (employee.status !== "在职") reasons.push({ key: "inactive", label: "非在职", tone: "amber" });
  if (!phone) reasons.push({ key: "phone", label: "缺手机号", tone: "amber" });
  if (phone && !/^1\d{10}$/.test(phone)) reasons.push({ key: "phone", label: "手机号异常", tone: "red" });
  if (!roles.length) reasons.push({ key: "role", label: "缺角色", tone: "red" });
  if (isTeacherRole && employee.isTeacher !== "是") reasons.push({ key: "teacher", label: "教师标记不一致", tone: "amber" });
  if (employee.isTeacher === "是" && Number(employee.weeklyHours || 0) <= 0) reasons.push({ key: "capacity", label: "容量异常", tone: "red" });
  if (!isManager && permissions.includes("data")) reasons.push({ key: "dataAccess", label: "有数据中心权限", tone: "amber" });
  if (!isManager && permissions.length >= 8) reasons.push({ key: "wideAccess", label: "权限偏宽", tone: "amber" });

  return reasons;
}

function staffHasRisk(employee, riskKey) {
  const reasons = staffEmployeeRiskReasons(employee);
  if (riskKey === "all") return true;
  if (riskKey === "none") return reasons.length === 0;
  return reasons.some((reason) => reason.key === riskKey);
}

function staffMatchesStatus(employee) {
  if (staffStatusFilter === "all") return true;
  if (staffStatusFilter === "active") return employee.status === "在职";
  return employee.status === staffStatusFilter;
}

function staffMatchesListFilters(employee) {
  if (!matchesRow(employee)) return false;
  if (!staffMatchesStatus(employee)) return false;
  if (staffDepartmentFilter !== "all" && employee.department !== staffDepartmentFilter) return false;
  if (staffRoleFilter !== "all" && !staffRoleNames(employee).includes(staffRoleFilter)) return false;
  if (staffTeacherFilter !== "all" && employee.isTeacher !== staffTeacherFilter) return false;
  return staffHasRisk(employee, staffRiskFilter);
}

function staffRiskScore(employee) {
  const weights = { role: 1, capacity: 2, phone: 3, dataAccess: 4, wideAccess: 5, teacher: 6, inactive: 7 };
  const scores = staffEmployeeRiskReasons(employee).map((reason) => weights[reason.key] || 9);
  return Math.min(...scores, 99);
}

function compareStaffEmployees(left, right) {
  if (staffSortMode === "name") return text(left.name).localeCompare(text(right.name), "zh-CN");
  if (staffSortMode === "department") {
    const departmentGap = text(left.department).localeCompare(text(right.department), "zh-CN");
    return departmentGap || text(left.name).localeCompare(text(right.name), "zh-CN");
  }
  if (staffSortMode === "permissionDesc") return staffRolePermissionIds(right).length - staffRolePermissionIds(left).length || text(left.name).localeCompare(text(right.name), "zh-CN");
  const riskGap = staffRiskScore(left) - staffRiskScore(right);
  return riskGap || text(left.name).localeCompare(text(right.name), "zh-CN");
}

function staffRiskTags(employee) {
  const reasons = staffEmployeeRiskReasons(employee);
  if (!reasons.length) return tag("正常", "green");
  return `<div class="staff-risk-tags">${reasons.map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function staffSelectOptions(values, selectedValue, allLabel) {
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function renderStaffFilterToolbar(rows) {
  const departments = [...new Set(rows.map((employee) => employee.department).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  const roles = [...new Set(rows.flatMap(staffRoleNames))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  const statuses = [...new Set(rows.map((employee) => employee.status).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));

  return `
    <div class="filters staff-filter-toolbar">
      <label>状态
        <select id="staffStatusFilter" aria-label="按员工状态筛选">
          <option value="active" ${staffStatusFilter === "active" ? "selected" : ""}>在职员工</option>
          ${staffSelectOptions(statuses, staffStatusFilter, "全部状态").replace('<option value="all"', '<option value="all"')}
        </select>
      </label>
      <label>部门
        <select id="staffDepartmentFilter" aria-label="按部门筛选员工">${staffSelectOptions(departments, staffDepartmentFilter, "全部部门")}</select>
      </label>
      <label>角色
        <select id="staffRoleFilter" aria-label="按角色筛选员工">${staffSelectOptions(roles, staffRoleFilter, "全部角色")}</select>
      </label>
      <label>教师
        <select id="staffTeacherFilter" aria-label="按是否教师筛选">
          <option value="all" ${staffTeacherFilter === "all" ? "selected" : ""}>全部员工</option>
          <option value="是" ${staffTeacherFilter === "是" ? "selected" : ""}>教师员工</option>
          <option value="否" ${staffTeacherFilter === "否" ? "selected" : ""}>非教师员工</option>
        </select>
      </label>
      <label>待处理
        <select id="staffRiskFilter" aria-label="按员工资料待处理事项筛选">
          <option value="all" ${staffRiskFilter === "all" ? "selected" : ""}>全部情况</option>
          <option value="phone" ${staffRiskFilter === "phone" ? "selected" : ""}>手机号问题</option>
          <option value="role" ${staffRiskFilter === "role" ? "selected" : ""}>缺角色</option>
          <option value="teacher" ${staffRiskFilter === "teacher" ? "selected" : ""}>教师标记</option>
          <option value="capacity" ${staffRiskFilter === "capacity" ? "selected" : ""}>容量异常</option>
          <option value="dataAccess" ${staffRiskFilter === "dataAccess" ? "selected" : ""}>数据中心权限</option>
          <option value="wideAccess" ${staffRiskFilter === "wideAccess" ? "selected" : ""}>权限偏宽</option>
          <option value="inactive" ${staffRiskFilter === "inactive" ? "selected" : ""}>非在职</option>
          <option value="none" ${staffRiskFilter === "none" ? "selected" : ""}>无待处理</option>
        </select>
      </label>
      <label>排序
        <select id="staffSortMode" aria-label="员工列表排序">
          <option value="risk" ${staffSortMode === "risk" ? "selected" : ""}>待处理优先</option>
          <option value="name" ${staffSortMode === "name" ? "selected" : ""}>姓名顺序</option>
          <option value="department" ${staffSortMode === "department" ? "selected" : ""}>部门分组</option>
          <option value="permissionDesc" ${staffSortMode === "permissionDesc" ? "selected" : ""}>权限数量降序</option>
        </select>
      </label>
    </div>`;
}

function staffPermissionNote(employee) {
  const permissions = staffRolePermissionIds(employee);
  if (!permissions.length) return "尚未匹配到角色权限，请先为员工分配有效角色。";
  const labels = permissions
    .map((permission) => roleModules.find(([id]) => id === permission)?.[1] || viewMeta[permission]?.[0] || permission)
    .slice(0, 5)
    .join("、");
  return `${permissions.length} 个模块：${labels}${permissions.length > 5 ? "等" : ""}`;
}

function staffListSummary(rows, visibleRows) {
  const active = rows.filter((employee) => employee.status === "在职").length;
  const teachers = rows.filter((employee) => employee.isTeacher === "是").length;
  const issues = rows.filter((employee) => staffEmployeeRiskReasons(employee).length).length;
  const dataAccess = rows.filter((employee) => staffEmployeeRiskReasons(employee).some((reason) => reason.key === "dataAccess")).length;

  return `
    <div class="summary-grid compact-metrics staff-list-summary">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 名员工</small></div>
      <div class="metric"><span>在职/教师</span><strong>${active}/${teachers}</strong><small>用于账号切换和排课</small></div>
      <div class="metric"><span>待补资料</span><strong>${issues}</strong><small>手机号、角色、容量等</small></div>
      <div class="metric"><span>数据权限</span><strong>${dataAccess}</strong><small>非管理员持有数据中心权限</small></div>
    </div>`;
}

function renderStaffEmployeeRows(rows) {
  return rows.map((employee) => `<tr>
    <td><strong>${escapeHtml(employee.name)}</strong><br><span class="muted">${escapeHtml(employee.phone || "未填手机号")}</span></td>
    <td>${escapeHtml(employee.department || "未填部门")}<br><span class="muted">${escapeHtml(employee.employeeType || "-")}</span></td>
    <td>${escapeHtml(employee.roles || "未分配角色")}</td>
    <td>${escapeHtml(employee.isTeacher)}<br><span class="muted">${escapeHtml(employee.subjects || "-")}</span></td>
    <td>${tag(employee.status || "未知", employee.status === "在职" ? "green" : "amber")}</td>
    <td>${staffRiskTags(employee)}</td>
    <td class="staff-permission-note">${escapeHtml(staffPermissionNote(employee))}</td>
  </tr>`);
}

renderEmployeeTable = function renderEmployeeTableWithFilters() {
  ensureStaffData();
  const rows = appState.employees.filter(matchesRow);
  const visibleRows = appState.employees.filter(staffMatchesListFilters).sort(compareStaffEmployees);

  return `
    <div class="section-body">
      ${staffListSummary(rows, visibleRows)}
      ${renderStaffFilterToolbar(rows)}
      ${table(["员工", "部门/类型", "角色", "教师/科目", "状态", "待处理", "可用模块"], renderStaffEmployeeRows(visibleRows))}
    </div>`;
};

document.addEventListener("change", (event) => {
  if (event.target.id === "staffStatusFilter") staffStatusFilter = event.target.value;
  if (event.target.id === "staffDepartmentFilter") staffDepartmentFilter = event.target.value;
  if (event.target.id === "staffRoleFilter") staffRoleFilter = event.target.value;
  if (event.target.id === "staffTeacherFilter") staffTeacherFilter = event.target.value;
  if (event.target.id === "staffRiskFilter") staffRiskFilter = event.target.value;
  if (event.target.id === "staffSortMode") staffSortMode = event.target.value;

  if (["staffStatusFilter", "staffDepartmentFilter", "staffRoleFilter", "staffTeacherFilter", "staffRiskFilter", "staffSortMode"].includes(event.target.id) && currentView === "staff") {
    renderView();
  }
});

if (currentView === "staff") {
  renderView();
}
