const dataHealthStyle = document.createElement("style");
dataHealthStyle.textContent = `
  .data-health-panel {
    margin-top: 16px;
  }

  .data-health-toolbar {
    align-items: end;
  }

  .data-health-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .data-health-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .data-health-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .data-health-note {
    max-width: 330px;
    white-space: normal;
    line-height: 1.55;
  }

  @media (max-width: 650px) {
    .data-health-toolbar,
    .data-health-toolbar label,
    .data-health-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(dataHealthStyle);

let dataHealthCategoryFilter = "all";
let dataHealthRiskFilter = "all";
let dataHealthSortMode = "issues";

const dataHealthCategories = {
  students: "招生学员",
  orders: "财务课时",
  classes: "教学资源",
  courses: "基础资料",
  teachers: "基础资料",
  rooms: "基础资料",
  employees: "员工权限",
  roles: "员工权限",
  attendance: "教学过程",
  payments: "财务课时",
  lessons: "教学过程",
  scheduleConflicts: "教学过程",
  scheduleBatches: "教学过程",
  followUps: "续费服务",
  studentDetails: "汇总报表",
  reports: "汇总报表",
  ledger: "财务课时",
  feedback: "续费服务",
  leaves: "教学过程",
  leads: "招生学员"
};

function dataHealthCategory(type) {
  return dataHealthCategories[type] || "其他数据";
}

function dataHealthImportable(type) {
  return Boolean(typeof importProfiles === "object" && importProfiles[type]);
}

function dataHealthRows(configs) {
  return Object.entries(configs).map(([type, config]) => {
    const issueCount = config.rows.filter((row) => dataIssueReasons(type, row).length).length;
    const empty = config.rows.length === 0;
    return {
      type,
      title: config.file.replace(/\.csv$/, ""),
      category: dataHealthCategory(type),
      count: config.rows.length,
      issueCount,
      empty,
      importable: dataHealthImportable(type),
      exportable: true
    };
  });
}

function dataHealthStatus(row) {
  if (row.empty) return { key: "empty", label: "暂无数据", tone: "amber" };
  if (row.issueCount > 0) return { key: "issues", label: `${row.issueCount} 行需处理`, tone: "amber" };
  return { key: "healthy", label: "正常", tone: "green" };
}

function dataHealthNextStep(row) {
  if (row.empty && row.importable) return "可以下载样例 CSV，整理 Excel 后导入这张表。";
  if (row.empty) return "暂无记录，通常由业务操作自动生成，先检查相关模块是否已使用。";
  if (row.issueCount > 0) return "点击查看问题行，先处理缺字段、欠费、冲突或课时异常后再导出。";
  return "数据状态正常，可按需导出 CSV 或做完整备份。";
}

function dataHealthMatches(row) {
  if (dataHealthCategoryFilter !== "all" && row.category !== dataHealthCategoryFilter) return false;
  if (dataHealthRiskFilter === "issues" && row.issueCount === 0) return false;
  if (dataHealthRiskFilter === "empty" && !row.empty) return false;
  if (dataHealthRiskFilter === "healthy" && (row.issueCount > 0 || row.empty)) return false;
  if (dataHealthRiskFilter === "importable" && !row.importable) return false;
  return true;
}

function compareDataHealthRows(left, right) {
  if (dataHealthSortMode === "countDesc") return right.count - left.count || text(left.title).localeCompare(text(right.title), "zh-CN");
  if (dataHealthSortMode === "name") return text(left.title).localeCompare(text(right.title), "zh-CN");
  if (dataHealthSortMode === "category") {
    const categoryGap = text(left.category).localeCompare(text(right.category), "zh-CN");
    return categoryGap || text(left.title).localeCompare(text(right.title), "zh-CN");
  }
  return right.issueCount - left.issueCount || Number(right.empty) - Number(left.empty) || text(left.title).localeCompare(text(right.title), "zh-CN");
}

function renderDataHealthToolbar(rows) {
  const categories = [...new Set(rows.map((row) => row.category))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return `
    <div class="filters data-health-toolbar">
      <label>业务分组
        <select id="dataHealthCategoryFilter" aria-label="按业务分组筛选数据表">
          <option value="all" ${dataHealthCategoryFilter === "all" ? "selected" : ""}>全部分组</option>
          ${categories.map((category) => `<option value="${escapeHtml(category)}" ${dataHealthCategoryFilter === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
        </select>
      </label>
      <label>数据状态
        <select id="dataHealthRiskFilter" aria-label="按数据状态筛选">
          <option value="all" ${dataHealthRiskFilter === "all" ? "selected" : ""}>全部状态</option>
          <option value="issues" ${dataHealthRiskFilter === "issues" ? "selected" : ""}>有问题行</option>
          <option value="empty" ${dataHealthRiskFilter === "empty" ? "selected" : ""}>暂无数据</option>
          <option value="healthy" ${dataHealthRiskFilter === "healthy" ? "selected" : ""}>正常数据</option>
          <option value="importable" ${dataHealthRiskFilter === "importable" ? "selected" : ""}>支持导入</option>
        </select>
      </label>
      <label>排序
        <select id="dataHealthSortMode" aria-label="数据表健康清单排序">
          <option value="issues" ${dataHealthSortMode === "issues" ? "selected" : ""}>问题优先</option>
          <option value="countDesc" ${dataHealthSortMode === "countDesc" ? "selected" : ""}>记录数降序</option>
          <option value="category" ${dataHealthSortMode === "category" ? "selected" : ""}>分组排序</option>
          <option value="name" ${dataHealthSortMode === "name" ? "selected" : ""}>名称顺序</option>
        </select>
      </label>
    </div>`;
}

function renderDataHealthSummary(rows, visibleRows) {
  const issues = rows.filter((row) => row.issueCount > 0).length;
  const empty = rows.filter((row) => row.empty).length;
  const importable = rows.filter((row) => row.importable).length;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 张数据表</small></div>
      <div class="metric"><span>有问题行</span><strong>${issues}</strong><small>建议先核对再导出</small></div>
      <div class="metric"><span>暂无数据</span><strong>${empty}</strong><small>可能尚未使用对应模块</small></div>
      <div class="metric"><span>支持导入</span><strong>${importable}</strong><small>可下载样例 CSV</small></div>
    </div>`;
}

function renderDataHealthTableRows(rows) {
  return rows.map((row) => {
    const status = dataHealthStatus(row);
    return `<tr>
      <td>${tag(row.category, "")}</td>
      <td><strong>${escapeHtml(row.title)}</strong><br><span class="muted">${escapeHtml(row.type)}</span></td>
      <td>${row.count}</td>
      <td>${tag(status.label, status.tone)}</td>
      <td>${row.importable ? tag("可导入", "green") : tag("仅导出", "")}</td>
      <td class="data-health-note">${escapeHtml(dataHealthNextStep(row))}</td>
      <td>
        <div class="data-health-actions">
          <button class="small-button" type="button" data-preview-table="${escapeHtml(row.type)}">查看</button>
          <button class="small-button" type="button" data-export="${escapeHtml(row.type)}">导出</button>
          ${row.importable ? `<button class="small-button" type="button" data-import-sample="${escapeHtml(row.type)}">样例</button>` : ""}
        </div>
      </td>
    </tr>`;
  });
}

function appendDataHealthList() {
  if (currentView !== "data" || appContent.querySelector(".data-health-panel")) return;
  const configs = dataCenterDatasetConfigs();
  const rows = dataHealthRows(configs);
  const visibleRows = rows.filter(dataHealthMatches).sort(compareDataHealthRows);
  const previewPanel = [...appContent.querySelectorAll(".section")].find((section) => section.innerText.includes("全量数据表"));
  const panelHtml = `
    <section class="section data-health-panel">
      <div class="section-head">
        <div>
          <h3>数据表健康清单</h3>
          <span class="muted">按业务分组查看每张表的记录数、问题行、导入导出能力和下一步动作。</span>
        </div>
        ${tag(`${visibleRows.length} 张表`, visibleRows.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${renderDataHealthSummary(rows, visibleRows)}
        ${renderDataHealthToolbar(rows)}
        ${table(["分组", "数据表", "记录数", "状态", "导入", "下一步", "操作"], renderDataHealthTableRows(visibleRows))}
      </div>
    </section>`;

  if (previewPanel) {
    previewPanel.insertAdjacentHTML("beforebegin", panelHtml);
  } else {
    appContent.insertAdjacentHTML("beforeend", panelHtml);
  }
}

const baseRenderDataCenterForHealthList = renderDataCenter;
renderDataCenter = function renderDataCenterWithHealthList() {
  baseRenderDataCenterForHealthList();
  appendDataHealthList();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "dataHealthCategoryFilter") dataHealthCategoryFilter = event.target.value;
  if (event.target.id === "dataHealthRiskFilter") dataHealthRiskFilter = event.target.value;
  if (event.target.id === "dataHealthSortMode") dataHealthSortMode = event.target.value;

  if (["dataHealthCategoryFilter", "dataHealthRiskFilter", "dataHealthSortMode"].includes(event.target.id) && currentView === "data") {
    renderView();
  }
});

if (currentView === "data") {
  renderView();
}
