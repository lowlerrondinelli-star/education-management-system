const importReadinessStyle = document.createElement("style");
importReadinessStyle.textContent = `
  .import-readiness-panel {
    margin-top: 16px;
  }

  .import-readiness-toolbar {
    align-items: end;
  }

  .import-readiness-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .import-readiness-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .import-readiness-actions,
  .import-readiness-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .import-readiness-note {
    max-width: 340px;
    white-space: normal;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .import-readiness-toolbar,
    .import-readiness-toolbar label,
    .import-readiness-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(importReadinessStyle);

let importReadyGroupFilter = "all";
let importReadyStatusFilter = "all";
let importReadySortMode = "status";

const importReadyMeta = {
  students: {
    group: "招生学员",
    dependencies: ["可直接导入"],
    checks: ["手机号 11 位", "重复手机号", "班级存在或填待分班"],
    action: "先导入或录入学员档案，再报名收款。"
  },
  orders: {
    group: "财务课时",
    dependencies: ["学员档案", "班级资料"],
    checks: ["学员存在", "班级存在", "课时和金额为数字", "有效期日期"],
    action: "先确保学员和班级已存在，再导入订单。"
  },
  courses: {
    group: "基础资料",
    dependencies: ["可直接导入"],
    checks: ["课程名称不重复", "标准课时大于 0", "标准价为数字"],
    action: "课程先导入，班级资料才能关联课程。"
  },
  rooms: {
    group: "基础资料",
    dependencies: ["可直接导入"],
    checks: ["教室名称不重复", "容量大于 0"],
    action: "教室先导入，排课和班级导入才能校验资源。"
  },
  employees: {
    group: "员工权限",
    dependencies: ["角色权限"],
    checks: ["角色已存在", "手机号格式", "是否教师"],
    action: "教师员工导入后会同步进入教师资料。"
  },
  classes: {
    group: "教学资源",
    dependencies: ["课程资料", "教师资料", "教室资料"],
    checks: ["课程存在", "教师存在", "教室存在", "容量和扣课为数字"],
    action: "先维护课程、教师、教室，再导入班级。"
  },
  classSchedules: {
    group: "排课日程",
    dependencies: ["班级资料", "教师资料", "教室资料"],
    checks: ["班级存在", "教师存在", "教室存在", "日期时间格式", "资源冲突"],
    action: "导入后会跳过冲突课节，请先核对资源。"
  },
  oneToOneSchedules: {
    group: "排课日程",
    dependencies: ["教师资料", "教室资料"],
    checks: ["1 对 1 名称", "教师存在", "教室存在", "日期时间格式", "资源冲突"],
    action: "一对一名称建议包含学员姓名和年级，便于后续检索。"
  }
};

function importReadyProfiles() {
  return typeof importProfiles === "object" ? importProfiles : {};
}

function importReadyCount(key) {
  const counts = {
    students: appState.students?.length || 0,
    orders: appState.orders?.length || 0,
    courses: appState.courses?.length || 0,
    rooms: appState.rooms?.length || 0,
    employees: appState.employees?.length || 0,
    teachers: appState.teachers?.length || 0,
    roles: appState.roles?.length || 0,
    classes: appState.classes?.length || 0,
    lessons: appState.lessons?.length || 0
  };
  return counts[key] || 0;
}

function importReadyBlockers(type) {
  const blockers = [];
  if (type === "orders" && !importReadyCount("students")) blockers.push("缺少学员档案");
  if (type === "orders" && !importReadyCount("classes")) blockers.push("缺少班级资料");
  if (type === "employees" && !importReadyCount("roles")) blockers.push("缺少角色权限");
  if (type === "classes" && !importReadyCount("courses")) blockers.push("缺少课程资料");
  if (type === "classes" && !importReadyCount("teachers")) blockers.push("缺少教师资料");
  if (type === "classes" && !importReadyCount("rooms")) blockers.push("缺少教室资料");
  if (type === "classSchedules" && !importReadyCount("classes")) blockers.push("缺少班级资料");
  if (type === "classSchedules" && !importReadyCount("teachers")) blockers.push("缺少教师资料");
  if (type === "classSchedules" && !importReadyCount("rooms")) blockers.push("缺少教室资料");
  if (type === "oneToOneSchedules" && !importReadyCount("teachers")) blockers.push("缺少教师资料");
  if (type === "oneToOneSchedules" && !importReadyCount("rooms")) blockers.push("缺少教室资料");
  return blockers;
}

function importReadyWarnings(type) {
  const warnings = [];
  if (type === "students" && !importReadyCount("classes")) warnings.push("可先填待分班");
  if (type === "orders" && appState.students?.some((student) => Number(student.debt || 0) > 0)) warnings.push("已有欠费学员，导入后需核对欠费");
  if (type === "classSchedules" && appState.lessons?.some((lesson) => lesson.status === "待上课")) warnings.push("已有待上课课节，注意冲突");
  if (type === "oneToOneSchedules" && appState.lessons?.some((lesson) => lesson.type === "1对1")) warnings.push("已有一对一课节，注意命名重复");
  return warnings;
}

function importReadyRows() {
  return Object.entries(importReadyProfiles()).map(([type, profile]) => {
    const meta = importReadyMeta[type] || { group: "其他导入", dependencies: [], checks: [], action: "按模板字段整理后导入。" };
    const blockers = importReadyBlockers(type);
    const warnings = importReadyWarnings(type);
    const requiredCount = (profile.headers || []).filter((field) => text(field).startsWith("*")).length || importReadyRequiredGuess(type);
    return {
      type,
      title: profile.title,
      group: meta.group,
      dependencies: meta.dependencies,
      checks: meta.checks,
      action: meta.action,
      blockers,
      warnings,
      headers: profile.headers || [],
      requiredCount
    };
  });
}

function importReadyRequiredGuess(type) {
  const guesses = {
    students: 3,
    orders: 6,
    courses: 4,
    rooms: 2,
    employees: 4,
    classes: 6,
    classSchedules: 6,
    oneToOneSchedules: 6
  };
  return guesses[type] || 0;
}

function importReadyStatus(row) {
  if (row.blockers.length) return { key: "blocked", label: "先补资料", tone: "red" };
  if (row.warnings.length) return { key: "warning", label: "可导入需注意", tone: "amber" };
  return { key: "ready", label: "可导入", tone: "green" };
}

function importReadyMatches(row) {
  if (importReadyGroupFilter !== "all" && row.group !== importReadyGroupFilter) return false;
  if (importReadyStatusFilter !== "all" && importReadyStatus(row).key !== importReadyStatusFilter) return false;
  return true;
}

function compareImportReadyRows(left, right) {
  if (importReadySortMode === "title") return text(left.title).localeCompare(text(right.title), "zh-CN");
  if (importReadySortMode === "group") {
    const groupGap = text(left.group).localeCompare(text(right.group), "zh-CN");
    return groupGap || text(left.title).localeCompare(text(right.title), "zh-CN");
  }
  if (importReadySortMode === "fields") return right.headers.length - left.headers.length || text(left.title).localeCompare(text(right.title), "zh-CN");
  const statusWeight = { blocked: 0, warning: 1, ready: 2 };
  return statusWeight[importReadyStatus(left).key] - statusWeight[importReadyStatus(right).key] || text(left.group).localeCompare(text(right.group), "zh-CN");
}

function renderImportReadySummary(rows, visibleRows) {
  const blocked = rows.filter((row) => importReadyStatus(row).key === "blocked").length;
  const warning = rows.filter((row) => importReadyStatus(row).key === "warning").length;
  const ready = rows.filter((row) => importReadyStatus(row).key === "ready").length;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 类导入</small></div>
      <div class="metric"><span>可直接导入</span><strong>${ready}</strong><small>依赖资料已满足</small></div>
      <div class="metric"><span>需注意</span><strong>${warning}</strong><small>导入前建议人工核对</small></div>
      <div class="metric"><span>先补资料</span><strong>${blocked}</strong><small>缺依赖时会失败</small></div>
    </div>`;
}

function renderImportReadyToolbar(rows) {
  const groups = [...new Set(rows.map((row) => row.group))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return `
    <div class="filters import-readiness-toolbar">
      <label>业务分组
        <select id="importReadyGroupFilter" aria-label="导入准备业务分组筛选">
          <option value="all" ${importReadyGroupFilter === "all" ? "selected" : ""}>全部分组</option>
          ${groups.map((group) => `<option value="${escapeHtml(group)}" ${importReadyGroupFilter === group ? "selected" : ""}>${escapeHtml(group)}</option>`).join("")}
        </select>
      </label>
      <label>准备状态
        <select id="importReadyStatusFilter" aria-label="导入准备状态筛选">
          <option value="all" ${importReadyStatusFilter === "all" ? "selected" : ""}>全部状态</option>
          <option value="blocked" ${importReadyStatusFilter === "blocked" ? "selected" : ""}>先补资料</option>
          <option value="warning" ${importReadyStatusFilter === "warning" ? "selected" : ""}>可导入需注意</option>
          <option value="ready" ${importReadyStatusFilter === "ready" ? "selected" : ""}>可导入</option>
        </select>
      </label>
      <label>排序
        <select id="importReadySortMode" aria-label="导入准备排序">
          <option value="status" ${importReadySortMode === "status" ? "selected" : ""}>状态优先</option>
          <option value="group" ${importReadySortMode === "group" ? "selected" : ""}>分组排序</option>
          <option value="fields" ${importReadySortMode === "fields" ? "selected" : ""}>字段数降序</option>
          <option value="title" ${importReadySortMode === "title" ? "selected" : ""}>名称顺序</option>
        </select>
      </label>
    </div>`;
}

function renderImportReadyTags(row) {
  const status = importReadyStatus(row);
  const tags = [tag(status.label, status.tone)];
  if (row.blockers.length) tags.push(...row.blockers.map((item) => tag(item, "red")));
  if (row.warnings.length) tags.push(...row.warnings.map((item) => tag(item, "amber")));
  return `<div class="import-readiness-tags">${tags.join("")}</div>`;
}

function importReadyDependencyText(row) {
  const values = row.dependencies.join("、") || "按模板字段";
  const counts = [];
  if (row.type === "orders") counts.push(`学员 ${importReadyCount("students")}`, `班级 ${importReadyCount("classes")}`);
  if (row.type === "employees") counts.push(`角色 ${importReadyCount("roles")}`);
  if (row.type === "classes") counts.push(`课程 ${importReadyCount("courses")}`, `教师 ${importReadyCount("teachers")}`, `教室 ${importReadyCount("rooms")}`);
  if (row.type === "classSchedules") counts.push(`班级 ${importReadyCount("classes")}`, `教师 ${importReadyCount("teachers")}`, `教室 ${importReadyCount("rooms")}`);
  if (row.type === "oneToOneSchedules") counts.push(`教师 ${importReadyCount("teachers")}`, `教室 ${importReadyCount("rooms")}`);
  return counts.length ? `${values}；当前 ${counts.join("，")}` : values;
}

function renderImportReadyTableRows(rows) {
  return rows.map((row) => `<tr>
    <td>${tag(row.group, "")}</td>
    <td><strong>${escapeHtml(row.title)}</strong><br><span class="muted">${escapeHtml(row.type)} · ${row.headers.length} 列 / 约 ${row.requiredCount} 个必填</span></td>
    <td class="import-readiness-note">${escapeHtml(importReadyDependencyText(row))}</td>
    <td class="import-readiness-note">${escapeHtml(row.checks.join("、"))}</td>
    <td>${renderImportReadyTags(row)}</td>
    <td class="import-readiness-note">${escapeHtml(row.blockers.length ? `先处理：${row.blockers.join("、")}` : row.action)}</td>
    <td>
      <div class="import-readiness-actions">
        <button class="small-button" type="button" data-import-sample="${escapeHtml(row.type)}">样例</button>
        <button class="small-button" type="button" data-import-ready-type="${escapeHtml(row.type)}" ${row.blockers.length ? "disabled" : ""}>选择文件</button>
      </div>
    </td>
  </tr>`);
}

function appendImportReadinessBoard() {
  if (currentView !== "data" || appContent.querySelector(".import-readiness-panel") || typeof importProfiles !== "object") return;
  const rows = importReadyRows();
  const visibleRows = rows.filter(importReadyMatches).sort(compareImportReadyRows);
  const dataHealthPanel = appContent.querySelector(".data-health-panel");
  const panel = `
    <section class="section import-readiness-panel">
      <div class="section-head">
        <div>
          <h3>导入准备看板</h3>
          <span class="muted">导入前检查每类 CSV 是否缺基础资料、哪些字段要重点校验，减少失败行和重复返工。</span>
        </div>
        ${tag(`${visibleRows.length} 类`, visibleRows.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${renderImportReadySummary(rows, visibleRows)}
        ${renderImportReadyToolbar(rows)}
        ${table(["分组", "导入类型", "依赖资料", "校验重点", "准备状态", "下一步", "操作"], renderImportReadyTableRows(visibleRows))}
      </div>
    </section>`;

  if (dataHealthPanel) {
    dataHealthPanel.insertAdjacentHTML("beforebegin", panel);
  } else {
    appContent.insertAdjacentHTML("beforeend", panel);
  }
}

const baseRenderDataCenterForImportReadiness = renderDataCenter;
renderDataCenter = function renderDataCenterWithImportReadiness() {
  baseRenderDataCenterForImportReadiness();
  appendImportReadinessBoard();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "importReadyGroupFilter") importReadyGroupFilter = event.target.value;
  if (event.target.id === "importReadyStatusFilter") importReadyStatusFilter = event.target.value;
  if (event.target.id === "importReadySortMode") importReadySortMode = event.target.value;

  if (["importReadyGroupFilter", "importReadyStatusFilter", "importReadySortMode"].includes(event.target.id) && currentView === "data") {
    renderView();
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-import-ready-type]");
  if (!button || button.disabled) return;
  pendingImportType = button.dataset.importReadyType;
  const importTypeSelect = document.querySelector("#importType");
  if (importTypeSelect) importTypeSelect.value = pendingImportType;
  importFileInput.click();
});

if (currentView === "data") {
  renderView();
}
