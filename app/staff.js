const roleModules = [
  ["dashboard", "运营总览"],
  ["students", "学员档案"],
  ["orders", "订单课时"],
  ["classes", "班级分班"],
  ["schedule", "排课课表"],
  ["attendance", "点名消课"],
  ["consume", "课时流水"],
  ["feedback", "课后反馈"],
  ["masters", "基础资料"],
  ["data", "数据中心"],
  ["templates", "模板字段库"]
];

const defaultRoles = [
  {
    name: "校长/管理员",
    description: "查看和维护全部业务数据",
    permissions: ["dashboard", "students", "orders", "classes", "schedule", "attendance", "consume", "feedback", "masters", "data", "templates"],
    actions: "查看、新增、编辑、导入、导出"
  },
  {
    name: "前台/招生顾问",
    description: "负责建档、报名、收款和分班",
    permissions: ["dashboard", "students", "orders", "classes", "data", "templates"],
    actions: "查看、新增、报名、收款、导入"
  },
  {
    name: "教务/学管师",
    description: "负责分班、排课、点名和课消核对",
    permissions: ["dashboard", "students", "classes", "schedule", "attendance", "consume", "feedback", "masters", "data"],
    actions: "查看、分班、排课、点名、消课、反馈"
  },
  {
    name: "教师",
    description: "查看课表，完成点名、上课确认和课后反馈",
    permissions: ["dashboard", "schedule", "attendance", "consume", "feedback"],
    actions: "查看课表、点名、确认上课、课后反馈"
  },
  {
    name: "财务/收银",
    description: "核对订单、欠费、收款流水和导出报表",
    permissions: ["dashboard", "orders", "consume", "data"],
    actions: "查看、收款、导出"
  }
];

let previewRoleName = "校长/管理员";

const staffStyle = document.createElement("style");
staffStyle.textContent = `
  .staff-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
    gap: 14px;
  }

  .permission-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .permission-list .tag {
    margin: 0;
  }

  .role-preview {
    display: grid;
    gap: 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px;
    background: #fff;
  }

  .role-preview select {
    min-height: 40px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    padding: 0 10px;
  }

  @media (max-width: 1100px) {
    .staff-layout {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(staffStyle);

function uniqueByKey(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = text(item[key]).trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function defaultEmployeesFromCurrentData() {
  const teacherEmployees = (appState.teachers || []).map((teacher) => ({
    name: teacher.name,
    phone: teacher.phone,
    employeeType: "正式员工",
    department: "教学部",
    roles: text(teacher.role).includes("校长") ? "校长/管理员、教师" : "教师",
    subjects: teacher.subjects,
    grades: teacher.grades,
    isTeacher: "是",
    weeklyHours: teacher.weeklyHours,
    status: teacher.status || "在职"
  }));

  const ownerEmployees = [...new Set(appState.students.map((student) => student.owner).filter(Boolean))].map((name) => ({
    name,
    phone: "",
    employeeType: "正式员工",
    department: text(name).includes("校长") ? "校长室" : "招生前台",
    roles: text(name).includes("校长") ? "校长/管理员" : "前台/招生顾问",
    subjects: "",
    grades: "",
    isTeacher: "否",
    weeklyHours: 0,
    status: "在职"
  }));

  const classAssistants = [...new Set(appState.classes.map((item) => item.assistant).filter(Boolean))].map((name) => ({
    name,
    phone: "",
    employeeType: "正式员工",
    department: "教务部",
    roles: "教务/学管师",
    subjects: "",
    grades: "",
    isTeacher: "否",
    weeklyHours: 0,
    status: "在职"
  }));

  return uniqueByKey([...teacherEmployees, ...ownerEmployees, ...classAssistants], "name");
}

function ensureStaffData() {
  appState.roles = uniqueByKey([...(Array.isArray(appState.roles) ? appState.roles : []), ...defaultRoles], "name");
  appState.employees = uniqueByKey([...(Array.isArray(appState.employees) ? appState.employees : []), ...defaultEmployeesFromCurrentData()], "name");
  if (!appState.roles.some((role) => role.name === previewRoleName)) previewRoleName = appState.roles[0]?.name || "";
}

ensureStaffData();

const insertStaffIndex = navItems.findIndex((item) => item.id === "masters");
navItems.splice(insertStaffIndex >= 0 ? insertStaffIndex : navItems.length - 1, 0, { id: "staff", label: "员工权限", icon: "岗" });
viewMeta.staff = ["员工权限", "员工与角色"];

const baseRenderNavForStaff = renderNav;
renderNav = function renderNavWithStaffCount() {
  ensureStaffData();
  baseRenderNavForStaff();
  const countNode = navList.querySelector('[data-view="staff"] .nav-count');
  if (countNode) countNode.textContent = appState.employees.length;
};

const baseRenderViewForStaff = renderView;
renderView = function renderViewWithStaff() {
  if (currentView === "staff") {
    renderStaff();
    return;
  }
  baseRenderViewForStaff();
};

function roleOptions(selectedValue = "") {
  return appState.roles
    .map((role) => `<option value="${escapeHtml(role.name)}" ${role.name === selectedValue ? "selected" : ""}>${escapeHtml(role.name)}</option>`)
    .join("");
}

function employeeTemplatePresets() {
  return {
    academic: {
      label: "教务/学管师",
      name: "教务-刘老师",
      employeeType: "正式员工",
      department: "教务部",
      roles: "教务/学管师",
      isTeacher: "否",
      subjects: "全科",
      grades: "全学段"
    },
    frontDesk: {
      label: "前台/招生顾问",
      name: "前台-王老师",
      employeeType: "正式员工",
      department: "招生前台",
      roles: "前台/招生顾问",
      isTeacher: "否",
      subjects: "招生运营",
      grades: "全学段"
    },
    teacher: {
      label: "任课教师",
      name: "数学-李老师",
      employeeType: "正式员工",
      department: "教学部",
      roles: "教师",
      isTeacher: "是",
      subjects: "数学",
      grades: "初中"
    },
    partTimeTeacher: {
      label: "兼职任课老师",
      name: "英语-赵老师",
      employeeType: "兼职员工",
      department: "教学部",
      roles: "教师",
      isTeacher: "是",
      subjects: "英语",
      grades: "小学"
    },
    cashier: {
      label: "财务/收银",
      name: "财务-陈老师",
      employeeType: "正式员工",
      department: "财务部",
      roles: "财务/收银",
      isTeacher: "否",
      subjects: "财务收款",
      grades: "全学段"
    },
    principal: {
      label: "校长/管理员",
      name: "校长-周老师",
      employeeType: "正式员工",
      department: "校长室",
      roles: "校长/管理员",
      isTeacher: "是",
      subjects: "运营管理",
      grades: "全学段"
    }
  };
}

function setStaffChoice(select, builder, value) {
  if (!select) return;
  select.innerHTML = builder(value);
  select.value = value;
}

function employeeTemplateOptions(selectedValue = "academic") {
  return Object.entries(employeeTemplatePresets())
    .map(([value, item]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function applyEmployeeTemplate(form, key) {
  if (!form) return;
  const template = employeeTemplatePresets()[key];
  if (!template) return;
  if (form.elements.name) {
    form.elements.name.value = template.name;
    form.elements.name.dataset.autoName = template.name;
  }
  if (form.elements.employeeType) form.elements.employeeType.value = template.employeeType;
  setStaffChoice(form.elements.department, employeeDepartmentOptions, template.department);
  setStaffChoice(form.elements.roles, roleOptions, template.roles);
  if (form.elements.isTeacher) form.elements.isTeacher.value = template.isTeacher;
  setStaffChoice(form.elements.subjects, staffSubjectOptions, template.subjects);
  setStaffChoice(form.elements.grades, staffGradeOptions, template.grades);
}

function roleCreateTemplatePresets() {
  return {
    academicLead: {
      label: "分校教务主管",
      name: "分校教务主管",
      description: "负责分校分班、排课、点名和课消复核",
      permissions: ["dashboard", "students", "classes", "schedule", "attendance", "consume", "feedback", "masters", "data"],
      actions: "查看、分班、排课、点名、消课、反馈、导出"
    },
    frontDeskLead: {
      label: "招生前台主管",
      name: "招生前台主管",
      description: "负责线索、建档、报名、收款和导入核对",
      permissions: ["dashboard", "students", "orders", "classes", "data", "templates"],
      actions: "查看、新增、报名、收款、导入、导出"
    },
    partTimeTeacher: {
      label: "兼职教师",
      name: "兼职教师",
      description: "只查看本人课表并完成点名和课后反馈",
      permissions: ["dashboard", "schedule", "attendance", "feedback"],
      actions: "查看课表、点名、课后反馈"
    },
    financeReviewer: {
      label: "财务复核员",
      name: "财务复核员",
      description: "核对订单、欠费、收款流水和财务异常",
      permissions: ["dashboard", "orders", "consume", "data"],
      actions: "查看、收款、审核、导出"
    },
    campusPrincipal: {
      label: "分校校长",
      name: "分校校长",
      description: "查看分校全量运营数据并处理关键审批",
      permissions: ["dashboard", "students", "orders", "classes", "schedule", "attendance", "consume", "feedback", "masters", "data", "templates"],
      actions: "查看、新增、编辑、审核、导入、导出"
    }
  };
}

function selectedRoleCreateTemplate(key = "academicLead") {
  return roleCreateTemplatePresets()[key] || roleCreateTemplatePresets().academicLead;
}

function roleTemplateOptions(selectedValue = "academicLead") {
  return Object.entries(roleCreateTemplatePresets())
    .map(([value, role]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(role.label)}</option>`)
    .join("");
}

function roleDescriptionOptions(selectedValue = selectedRoleCreateTemplate().description) {
  return choiceOptions(
    [
      ...Object.values(roleCreateTemplatePresets()).map((role) => role.description),
      ...defaultRoles.map((role) => role.description),
      "负责校区日常运营协同",
      "按岗位分配可用模块"
    ],
    selectedValue
  );
}

function rolePermissionTemplateOptions(selectedValue = selectedRoleCreateTemplate().permissions.join(",")) {
  return [...Object.values(roleCreateTemplatePresets()), ...defaultRoles]
    .map((role) => {
      const value = role.permissions.join(",");
      const labels = roleModules
        .filter(([id]) => role.permissions.includes(id))
        .map(([, label]) => label)
        .join("、");
      return `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(`${role.name}：${labels}`)}</option>`;
    })
    .join("");
}

function roleActionOptions(selectedValue = selectedRoleCreateTemplate().actions) {
  return choiceOptions(
    [
      ...Object.values(roleCreateTemplatePresets()).map((role) => role.actions),
      ...defaultRoles.map((role) => role.actions),
      "查看、新增、编辑",
      "查看、审核、导出",
      "查看、跟进、分配任务"
    ],
    selectedValue
  );
}

function renderStaff() {
  ensureStaffData();
  const activeEmployees = appState.employees.filter((item) => item.status === "在职").length;
  const teacherCount = appState.employees.filter((item) => item.isTeacher === "是").length;
  const selectedRole = appState.roles.find((role) => role.name === previewRoleName) || appState.roles[0];

  appContent.innerHTML = `
    <div class="summary-grid">
      <div class="metric"><span>员工总数</span><strong>${appState.employees.length}</strong></div>
      <div class="metric"><span>在职员工</span><strong>${activeEmployees}</strong></div>
      <div class="metric"><span>教师员工</span><strong>${teacherCount}</strong></div>
      <div class="metric"><span>角色数量</span><strong>${appState.roles.length}</strong></div>
    </div>
    <section class="section">
      <div class="section-head">
        <div>
          <h3>员工与角色权限</h3>
          <span class="muted">用于区分校长、前台、教务、教师、财务等岗位，后续接登录后即可按角色控制功能。</span>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("staff")}
        <div class="staff-layout">
          ${renderEmployeeForm()}
          ${renderRoleForm()}
        </div>
      </div>
    </section>
    <div class="staff-layout">
      <section class="section">
        <div class="section-head compact-head"><h3>员工资料</h3></div>
        ${renderEmployeeTable()}
      </section>
      <section class="section">
        <div class="section-head compact-head"><h3>角色权限预览</h3></div>
        <div class="section-body">
          ${renderRolePreview(selectedRole)}
        </div>
      </section>
    </div>
    <section class="section">
      <div class="section-head compact-head"><h3>角色权限表</h3></div>
      ${renderRoleTable()}
    </section>`;
}

function renderEmployeeForm() {
  const defaultTemplate = employeeTemplatePresets().academic;
  return `
    <form class="master-card" id="employeeForm">
      <h4>新增员工</h4>
      <div class="operation-grid">
        <label>入职岗位模板<select name="employeeTemplate" id="employeeTemplateSelect">${employeeTemplateOptions("academic")}</select></label>
        <label>员工姓名<input name="name" value="${escapeHtml(defaultTemplate.name)}" data-auto-name="${escapeHtml(defaultTemplate.name)}" required placeholder="例如 教务-刘老师" /></label>
        <label>手机号<input name="phone" maxlength="11" placeholder="11 位手机号" /></label>
        <label>员工类型<select name="employeeType"><option>正式员工</option><option>兼职员工</option><option>外聘老师</option></select></label>
        <label>所属部门<select name="department" required>${employeeDepartmentOptions(defaultTemplate.department)}</select></label>
        <label>校区角色<select name="roles">${roleOptions(defaultTemplate.roles)}</select></label>
        <label>是否教师<select name="isTeacher"><option>否</option><option>是</option></select></label>
        <label>科目<select name="subjects">${staffSubjectOptions(defaultTemplate.subjects)}</select></label>
        <label>年级<select name="grades">${staffGradeOptions(defaultTemplate.grades)}</select></label>
      </div>
      <button class="primary-action" type="submit">保存员工</button>
    </form>`;
}

function renderRoleForm() {
  const defaultRole = selectedRoleCreateTemplate("academicLead");
  return `
    <form class="master-card" id="roleForm">
      <h4>新增角色</h4>
      <div class="operation-grid">
        <label>角色模板<select name="template" id="roleTemplateSelect">${roleTemplateOptions("academicLead")}</select></label>
        <label>角色名称<input name="name" value="${escapeHtml(defaultRole.name)}" data-auto-name="${escapeHtml(defaultRole.name)}" required placeholder="例如 分校教务主管" /></label>
        <label>角色说明<select name="description" id="roleDescriptionSelect">${roleDescriptionOptions(defaultRole.description)}</select></label>
        <label>可用模块<select name="permissions" id="rolePermissionsSelect">${rolePermissionTemplateOptions(defaultRole.permissions.join(","))}</select></label>
        <label>允许动作<select name="actions" id="roleActionsSelect">${roleActionOptions(defaultRole.actions)}</select></label>
      </div>
      <span class="muted">普通员工按岗位模板选择即可，系统会自动保存对应模块权限。</span>
      <button class="primary-action" type="submit">保存角色</button>
    </form>`;
}

function renderEmployeeTable() {
  const rows = appState.employees
    .filter(matchesRow)
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${escapeHtml(item.phone)}</span></td>
        <td>${escapeHtml(item.department)}</td>
        <td>${escapeHtml(item.employeeType)}</td>
        <td>${escapeHtml(item.roles)}</td>
        <td>${escapeHtml(item.isTeacher)}</td>
        <td>${escapeHtml(item.subjects || "-")}</td>
        <td>${tag(item.status, item.status === "在职" ? "green" : "amber")}</td>
      </tr>`
    );
  return table(["员工", "部门", "类型", "角色", "教师", "科目", "状态"], rows);
}

function renderPermissionTags(permissions) {
  return `<div class="permission-list">${roleModules
    .filter(([id]) => permissions.includes(id))
    .map(([, label]) => tag(label, "green"))
    .join("")}</div>`;
}

function renderRolePreview(role) {
  if (!role) return `<div class="role-preview"><span class="muted">暂无角色。</span></div>`;
  return `
    <div class="role-preview">
      <label>预览角色
        <select id="rolePreviewSelect">${roleOptions(role.name)}</select>
      </label>
      <div>
        <strong>${escapeHtml(role.name)}</strong>
        <p class="muted">${escapeHtml(role.description)}</p>
      </div>
      ${renderPermissionTags(role.permissions)}
      <div class="stack-item">
        <strong>允许动作</strong>
        <span class="muted">${escapeHtml(role.actions)}</span>
      </div>
    </div>`;
}

function renderRoleTable() {
  const rows = appState.roles
    .filter(matchesRow)
    .map(
      (role) => `<tr>
        <td><strong>${escapeHtml(role.name)}</strong><br><span class="muted">${escapeHtml(role.description)}</span></td>
        <td>${renderPermissionTags(role.permissions)}</td>
        <td>${escapeHtml(role.actions)}</td>
      </tr>`
    );
  return table(["角色", "可用模块", "允许动作"], rows);
}

function addEmployee(formData) {
  const name = text(formData.get("name")).trim();
  const phone = text(formData.get("phone")).trim();
  if (appState.employees.some((employee) => employee.name === name)) {
    setNotice("staff", `员工 ${name} 已存在。`, "red");
    renderView();
    return;
  }
  if (phone && !/^1\d{10}$/.test(phone)) {
    setNotice("staff", "手机号必须是 1 开头的 11 位数字。", "red");
    renderView();
    return;
  }

  const employee = {
    name,
    phone,
    employeeType: text(formData.get("employeeType")),
    department: text(formData.get("department")).trim(),
    roles: text(formData.get("roles")),
    subjects: text(formData.get("subjects")).trim(),
    grades: text(formData.get("grades")).trim(),
    isTeacher: text(formData.get("isTeacher")),
    weeklyHours: text(formData.get("isTeacher")) === "是" ? 20 : 0,
    status: "在职"
  };
  appState.employees.unshift(employee);

  if (employee.isTeacher === "是" && !appState.teachers.some((teacher) => teacher.name === employee.name)) {
    appState.teachers.unshift({
      name: employee.name,
      phone: employee.phone,
      subjects: employee.subjects || "待维护",
      grades: employee.grades || "待维护",
      role: "任课老师",
      weeklyHours: employee.weeklyHours,
      status: "在职"
    });
  }

  setNotice("staff", `员工 ${name} 已保存。`);
  saveState();
  setView("staff");
}

function addRole(formData) {
  const name = text(formData.get("name")).trim();
  if (appState.roles.some((role) => role.name === name)) {
    setNotice("staff", `角色 ${name} 已存在。`, "red");
    renderView();
    return;
  }
  const permissions = text(formData.get("permissions"))
    .split(",")
    .map((item) => item.trim())
    .filter((item) => roleModules.some(([id]) => id === item));
  if (!permissions.length) {
    setNotice("staff", "请至少填写一个有效模块，例如 dashboard,students,data。", "red");
    renderView();
    return;
  }
  appState.roles.unshift({
    name,
    description: text(formData.get("description")).trim(),
    permissions,
    actions: text(formData.get("actions")).trim()
  });
  previewRoleName = name;
  setNotice("staff", `角色 ${name} 已保存。`);
  saveState();
  setView("staff");
}

function flattenEmployeeRows() {
  ensureStaffData();
  return appState.employees.map((employee) => ({
    name: employee.name,
    phone: employee.phone,
    employeeType: employee.employeeType,
    department: employee.department,
    roles: employee.roles,
    subjects: employee.subjects,
    grades: employee.grades,
    isTeacher: employee.isTeacher,
    weeklyHours: employee.weeklyHours,
    status: employee.status
  }));
}

function flattenRoleRows() {
  ensureStaffData();
  return appState.roles.flatMap((role) =>
    role.permissions.map((permission) => {
      const moduleItem = roleModules.find(([id]) => id === permission);
      return {
        role: role.name,
        description: role.description,
        module: moduleItem?.[1] || permission,
        moduleId: permission,
        actions: role.actions
      };
    })
  );
}

document.addEventListener("submit", (event) => {
  if (event.target.id === "employeeForm") {
    event.preventDefault();
    addEmployee(new FormData(event.target));
  }

  if (event.target.id === "roleForm") {
    event.preventDefault();
    addRole(new FormData(event.target));
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "employeeTemplateSelect") {
    applyEmployeeTemplate(event.target.form, event.target.value);
    return;
  }

  if (event.target.id === "roleTemplateSelect") {
    const template = selectedRoleCreateTemplate(event.target.value);
    if (!template) return;
    const nameInput = event.target.form?.elements?.name;
    const descriptionSelect = document.querySelector("#roleDescriptionSelect");
    const permissionsSelect = document.querySelector("#rolePermissionsSelect");
    const actionsSelect = document.querySelector("#roleActionsSelect");
    if (nameInput) {
      nameInput.value = template.name;
      nameInput.dataset.autoName = template.name;
    }
    if (descriptionSelect) descriptionSelect.innerHTML = roleDescriptionOptions(template.description);
    if (permissionsSelect) permissionsSelect.innerHTML = rolePermissionTemplateOptions(template.permissions.join(","));
    if (actionsSelect) actionsSelect.innerHTML = roleActionOptions(template.actions);
    if (descriptionSelect) descriptionSelect.value = template.description;
    if (permissionsSelect) permissionsSelect.value = template.permissions.join(",");
    if (actionsSelect) actionsSelect.value = template.actions;
    return;
  }

  if (event.target.id !== "rolePreviewSelect") return;
  previewRoleName = event.target.value;
  renderView();
});

saveState();
renderNav();
