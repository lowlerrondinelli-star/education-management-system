const importTemplateInventoryStyle = document.createElement("style");
importTemplateInventoryStyle.textContent = `
  .local-template-panel {
    border-top: 1px solid var(--line);
  }

  .local-template-path {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 6px 9px;
    border: 1px solid var(--line);
    border-radius: 6px;
    color: var(--muted);
    background: var(--soft);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .local-template-toolbar {
    align-items: end;
  }

  .local-template-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .local-template-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .local-template-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 320px;
  }

  .local-template-note {
    max-width: 330px;
    line-height: 1.55;
    white-space: normal;
  }

  .local-template-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 148px;
  }

  @media (max-width: 650px) {
    .local-template-toolbar,
    .local-template-toolbar label,
    .local-template-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(importTemplateInventoryStyle);

const localImportTemplateFolder = "C:\\Users\\6\\Downloads\\导入模板";
const localImportTemplateFiles = [
  "【1对1日程】呦呦鹿鸣工作室 20260821.xls",
  "【按课时导入订单模板】呦呦鹿鸣工作室 20260821.xls",
  "【班级日程】呦呦鹿鸣工作室 20260821.xls",
  "【关联普通课程】呦呦鹿鸣工作室 20260821 (1).xls",
  "【关联普通课程】呦呦鹿鸣工作室 20260821.xls",
  "【关联组合课程】呦呦鹿鸣工作室 20260821 (1).xls",
  "【关联组合课程】呦呦鹿鸣工作室 20260821.xls",
  "【课程报价单按课时模板】呦呦鹿鸣工作室 20260821.xls",
  "【课程报价单更新开启微校售卖模板】.xls",
  "【校区员工导入】呦呦鹿鸣工作室 20260821.xls",
  "呦呦鹿鸣工作室导入意向学员模板-20260821.xls"
];

let localTemplateKindFilter = "all";
let localTemplateProfileFilter = "all";
let localTemplateCheckFilter = "all";
let localTemplateSortMode = "order";

function localTemplateDescriptor(file) {
  const source = text(file);
  if (source.includes("意向学员")) {
    return {
      kind: "学员招生",
      order: 1,
      profile: "students",
      profileLabel: "学员档案",
      checks: [
        { key: "phone", label: "手机号去重", tone: "amber" },
        { key: "dependency", label: "渠道/年级统一", tone: "amber" }
      ],
      action: "先导入意向学员，再在学员页转报名、分班。",
      focus: "姓名、手机号、手机号归属人、年级、学校、渠道、销售员"
    };
  }
  if (source.includes("校区员工")) {
    return {
      kind: "员工权限",
      order: 2,
      profile: "employees",
      profileLabel: "校区员工",
      checks: [
        { key: "phone", label: "手机号", tone: "amber" },
        { key: "permission", label: "角色权限", tone: "red" }
      ],
      action: "导入后到员工权限页核对角色、是否教师和授课科目。",
      focus: "姓名、手机号、部门、员工类型、角色、是否教师、科目"
    };
  }
  if (source.includes("课程报价单")) {
    return {
      kind: "课程报价",
      order: 3,
      profile: "courses",
      profileLabel: "课程资料",
      checks: [
        { key: "number", label: "课时/金额", tone: "amber" },
        { key: "dependency", label: "课程名称统一", tone: "amber" }
      ],
      action: "先维护课程和价格，再让订单、班级引用同一课程名称。",
      focus: "课程名称、课时数、价格、售卖状态、有效期"
    };
  }
  if (source.includes("关联普通课程") || source.includes("关联组合课程")) {
    return {
      kind: "课程关联",
      order: 4,
      profile: "courses",
      profileLabel: "课程资料",
      checks: [
        { key: "dependency", label: "基础资料依赖", tone: "red" },
        { key: "number", label: "课时规则", tone: "amber" }
      ],
      action: "确认普通课程、组合课程和售卖状态一致后再导入。",
      focus: "普通课程、组合课程、课时抵扣、售卖开关"
    };
  }
  if (source.includes("按课时导入订单")) {
    return {
      kind: "订单课时",
      order: 5,
      profile: "orders",
      profileLabel: "订单课时",
      checks: [
        { key: "number", label: "金额/课时", tone: "red" },
        { key: "dependency", label: "学员课程班级", tone: "red" },
        { key: "date", label: "有效期", tone: "amber" }
      ],
      action: "导入前先保证学员、课程、班级都已存在。",
      focus: "学员、手机号、课程、班级、购买课时、实收金额、欠费金额、有效期"
    };
  }
  if (source.includes("班级日程")) {
    return {
      kind: "班级排课",
      order: 6,
      profile: "classSchedules",
      profileLabel: "班级日程",
      checks: [
        { key: "schedule", label: "教师教室冲突", tone: "red" },
        { key: "date", label: "日期时间", tone: "amber" },
        { key: "dependency", label: "班级存在", tone: "red" }
      ],
      action: "导入后重点看冲突检查，避免同一老师或教室重叠。",
      focus: "班级、日期、开始时间、结束时间、教师、教室、科目"
    };
  }
  if (source.includes("1对1日程")) {
    return {
      kind: "1对1排课",
      order: 7,
      profile: "oneToOneSchedules",
      profileLabel: "1对1日程",
      checks: [
        { key: "schedule", label: "教师时间冲突", tone: "red" },
        { key: "date", label: "日期时间", tone: "amber" },
        { key: "dependency", label: "学员存在", tone: "red" }
      ],
      action: "先确认学员已建档，再导入一对一日程。",
      focus: "学员、日期、开始时间、结束时间、教师、教室、科目"
    };
  }
  return {
    kind: "其他模板",
    order: 99,
    profile: "students",
    profileLabel: "待确认",
    checks: [{ key: "required", label: "字段核对", tone: "amber" }],
    action: "先打开模板确认字段，再选择对应导入类型。",
    focus: "模板内必填字段"
  };
}

function localTemplateRows() {
  return localImportTemplateFiles.map((file) => ({
    file,
    extension: file.split(".").pop().toLowerCase(),
    ...localTemplateDescriptor(file)
  }));
}

function localTemplateMatches(row) {
  if (localTemplateKindFilter !== "all" && row.kind !== localTemplateKindFilter) return false;
  if (localTemplateProfileFilter !== "all" && row.profile !== localTemplateProfileFilter) return false;
  if (localTemplateCheckFilter !== "all" && !row.checks.some((check) => check.key === localTemplateCheckFilter)) return false;
  return true;
}

function compareLocalTemplates(left, right) {
  if (localTemplateSortMode === "file") return left.file.localeCompare(right.file, "zh-CN");
  if (localTemplateSortMode === "kind") {
    const kindGap = left.kind.localeCompare(right.kind, "zh-CN");
    return kindGap || left.order - right.order || left.file.localeCompare(right.file, "zh-CN");
  }
  return left.order - right.order || left.file.localeCompare(right.file, "zh-CN");
}

function renderLocalTemplateSummary(allRows, visibleRows) {
  const scheduleCount = allRows.filter((row) => row.checks.some((check) => check.key === "schedule")).length;
  const financeCount = allRows.filter((row) => row.checks.some((check) => check.key === "number")).length;
  const matchedProfiles = new Set(allRows.map((row) => row.profile)).size;
  return `
    <div class="summary-grid compact-metrics template-list-summary">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>本地模板 ${allRows.length} 个</small></div>
      <div class="metric"><span>需要转 CSV</span><strong>${allRows.length}</strong><small>浏览器导入入口支持 CSV</small></div>
      <div class="metric"><span>排课模板</span><strong>${scheduleCount}</strong><small>优先检查冲突</small></div>
      <div class="metric"><span>已匹配入口</span><strong>${matchedProfiles}</strong><small>覆盖招生、订单、课程、员工、日程</small></div>
      <div class="metric"><span>金额课时</span><strong>${financeCount}</strong><small>导入前统一数字格式</small></div>
    </div>`;
}

function renderLocalTemplateToolbar(rows) {
  const kinds = [...new Set(rows.map((row) => row.kind))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const profiles = [...new Map(rows.map((row) => [row.profile, row.profileLabel])).entries()].sort((a, b) => a[1].localeCompare(b[1], "zh-CN"));
  return `
    <div class="filters local-template-toolbar">
      <label>业务类型
        <select id="localTemplateKindFilter" aria-label="按本地模板业务类型筛选">
          <option value="all" ${localTemplateKindFilter === "all" ? "selected" : ""}>全部类型</option>
          ${kinds.map((kind) => `<option value="${escapeHtml(kind)}" ${localTemplateKindFilter === kind ? "selected" : ""}>${escapeHtml(kind)}</option>`).join("")}
        </select>
      </label>
      <label>导入入口
        <select id="localTemplateProfileFilter" aria-label="按系统导入入口筛选">
          <option value="all" ${localTemplateProfileFilter === "all" ? "selected" : ""}>全部入口</option>
          ${profiles.map(([profile, label]) => `<option value="${escapeHtml(profile)}" ${localTemplateProfileFilter === profile ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
        </select>
      </label>
      <label>关键校验
        <select id="localTemplateCheckFilter" aria-label="按本地模板关键校验筛选">
          <option value="all" ${localTemplateCheckFilter === "all" ? "selected" : ""}>全部校验</option>
          <option value="phone" ${localTemplateCheckFilter === "phone" ? "selected" : ""}>手机号</option>
          <option value="permission" ${localTemplateCheckFilter === "permission" ? "selected" : ""}>角色权限</option>
          <option value="number" ${localTemplateCheckFilter === "number" ? "selected" : ""}>金额/课时</option>
          <option value="dependency" ${localTemplateCheckFilter === "dependency" ? "selected" : ""}>基础资料依赖</option>
          <option value="schedule" ${localTemplateCheckFilter === "schedule" ? "selected" : ""}>排课资源</option>
          <option value="date" ${localTemplateCheckFilter === "date" ? "selected" : ""}>日期时间</option>
        </select>
      </label>
      <label>排序
        <select id="localTemplateSortMode" aria-label="本地模板排序">
          <option value="order" ${localTemplateSortMode === "order" ? "selected" : ""}>建议导入顺序</option>
          <option value="kind" ${localTemplateSortMode === "kind" ? "selected" : ""}>业务类型</option>
          <option value="file" ${localTemplateSortMode === "file" ? "selected" : ""}>文件名</option>
        </select>
      </label>
    </div>`;
}

function renderLocalTemplateCheckTags(row) {
  return `<div class="local-template-tags">${row.checks.map((check) => tag(check.label, check.tone)).join("")}</div>`;
}

function renderLocalTemplateRows(rows) {
  return rows.map((row) => `<tr>
    <td><strong>${escapeHtml(row.file)}</strong><br><span class="muted">${escapeHtml(localImportTemplateFolder)}</span></td>
    <td>${tag(row.kind, "")}</td>
    <td>${tag(`#${row.order}`, row.order <= 2 ? "green" : row.order >= 6 ? "red" : "amber")}</td>
    <td><strong>${escapeHtml(row.profileLabel)}</strong><br><span class="muted">${escapeHtml(row.profile)}</span></td>
    <td>${renderLocalTemplateCheckTags(row)}</td>
    <td class="local-template-note">${escapeHtml(row.focus)}</td>
    <td class="local-template-note">${escapeHtml(row.action)}</td>
    <td>
      <div class="local-template-actions">
        <button class="small-button" type="button" data-local-template-profile="${escapeHtml(row.profile)}">设为导入类型</button>
        <button class="small-button" type="button" data-import-sample="${escapeHtml(row.profile)}">CSV样例</button>
      </div>
    </td>
  </tr>`);
}

function renderLocalTemplateInventory() {
  const allRows = localTemplateRows();
  const visibleRows = allRows.filter(localTemplateMatches).sort(compareLocalTemplates);
  return `
    <section class="section local-template-panel">
      <div class="section-head">
        <div>
          <h3>本地导入模板清单</h3>
          <span class="muted">根据电脑里的 Excel 模板文件整理导入顺序、对应入口和导入前校验点。</span>
        </div>
        ${tag(`${visibleRows.length} 个文件`, visibleRows.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        <div class="local-template-path">已发现模板文件夹：${escapeHtml(localImportTemplateFolder)}。当前网页导入入口读取 CSV，Excel 模板建议另存为 CSV 后导入。</div>
        ${renderLocalTemplateSummary(allRows, visibleRows)}
        ${renderLocalTemplateToolbar(allRows)}
        ${table(["文件", "业务类型", "顺序", "对应导入入口", "关键校验", "重点字段", "导入前动作", "操作"], renderLocalTemplateRows(visibleRows))}
      </div>
    </section>`;
}

const baseRenderTemplatesForInventory = renderTemplates;
renderTemplates = function renderTemplatesWithLocalInventory() {
  baseRenderTemplatesForInventory();
  appContent.insertAdjacentHTML("beforeend", renderLocalTemplateInventory());
};

document.addEventListener("change", (event) => {
  if (event.target.id === "localTemplateKindFilter") {
    localTemplateKindFilter = event.target.value;
    renderView();
  }
  if (event.target.id === "localTemplateProfileFilter") {
    localTemplateProfileFilter = event.target.value;
    renderView();
  }
  if (event.target.id === "localTemplateCheckFilter") {
    localTemplateCheckFilter = event.target.value;
    renderView();
  }
  if (event.target.id === "localTemplateSortMode") {
    localTemplateSortMode = event.target.value;
    renderView();
  }
});

document.addEventListener("click", (event) => {
  const profileButton = event.target.closest("[data-local-template-profile]");
  if (!profileButton) return;

  pendingImportType = profileButton.dataset.localTemplateProfile || "students";
  lastImportReport = null;
  setNotice("data", `已切换为${importProfiles[pendingImportType]?.title || "对应"}导入，请下载样例或选择 CSV 文件。`, "green");
  setView("data");
  document.querySelector(".import-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
