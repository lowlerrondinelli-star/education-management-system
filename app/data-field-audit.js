const dataFieldAuditStyle = document.createElement("style");
dataFieldAuditStyle.textContent = `
  .data-field-panel {
    margin-top: 16px;
  }

  .data-field-toolbar {
    align-items: end;
  }

  .data-field-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .data-field-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .data-field-samples,
  .data-field-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .data-field-note {
    max-width: 340px;
    white-space: normal;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .data-field-rate {
    display: grid;
    gap: 6px;
    min-width: 140px;
  }

  .data-field-bar {
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--soft);
  }

  .data-field-bar span {
    display: block;
    height: 100%;
    background: var(--green);
  }

  .data-field-bar.warn span {
    background: var(--amber);
  }

  .data-field-bar.bad span {
    background: var(--red);
  }

  @media (max-width: 650px) {
    .data-field-toolbar,
    .data-field-toolbar label,
    .data-field-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(dataFieldAuditStyle);

let dataFieldRiskFilter = "all";
let dataFieldSortMode = "emptyDesc";

function dataFieldCurrentType() {
  const configs = dataCenterDatasetConfigs();
  if (configs[dataPreviewType]) return dataPreviewType;
  return Object.keys(configs)[0] || "students";
}

function dataFieldKnownValues(list, key = "name") {
  return new Set((list || []).map((item) => text(item?.[key] ?? item)).filter(Boolean));
}

function dataFieldDateValid(value) {
  const normalized = text(value).trim().replace(/\./g, "-").replace(/\//g, "-");
  if (!normalized) return true;
  const date = new Date(normalized.includes(" ") ? normalized.replace(" ", "T") : `${normalized}T00:00:00`);
  return Number.isFinite(date.getTime());
}

function dataFieldLooksNumeric(column) {
  return /金额|课时|容量|人数|余额|欠费|实收|购买|赠送|已上|标准价|总价|数量|每周容量|变动/.test(column.label);
}

function dataFieldLooksDate(column) {
  return /日期|有效期/.test(column.label) || /date|At$/i.test(column.key);
}

function dataFieldLooksTime(column) {
  return /时间/.test(column.label) || column.key === "time";
}

function dataFieldTimeValid(value) {
  const cleanValue = text(value).trim();
  if (!cleanValue) return true;
  if (/^\d{1,2}:\d{2}(-\d{1,2}:\d{2})?$/.test(cleanValue)) return true;
  return dataFieldDateValid(cleanValue);
}

function dataFieldReferenceIssue(column, value) {
  if (!value) return "";
  if (column.key === "className" && !hasKnownClass(value)) return "班级不存在";
  if (column.key === "student" && !hasKnownStudent(value)) return "学员不存在";
  if (column.key === "teacher") {
    const teacherNames = dataFieldKnownValues([...(appState.teachers || []), ...(appState.employees || [])], "name");
    if (!teacherNames.has(value) && !appState.lessons.some((lesson) => lesson.teacher === value)) return "教师不存在";
  }
  if (column.key === "room") {
    const roomNames = dataFieldKnownValues(appState.rooms || [], "name");
    if (!roomNames.has(value) && !appState.classes.some((item) => item.room === value) && !appState.lessons.some((lesson) => lesson.room === value)) return "教室不存在";
  }
  if (column.key === "course") {
    const courseNames = dataFieldKnownValues(appState.courses || [], "name");
    if (!courseNames.has(value) && !appState.classes.some((item) => item.course === value) && !appState.orders.some((order) => order.course === value)) return "课程不存在";
  }
  return "";
}

function dataFieldValueIssues(column, rawValue) {
  const value = text(rawValue).trim();
  const issues = [];
  if (!value) issues.push("空值");
  if (value && /手机号/.test(column.label) && !/^1\d{10}$/.test(value)) issues.push("手机号格式");
  if (value && dataFieldLooksNumeric(column) && !Number.isFinite(Number(value))) issues.push("数字格式");
  if (value && dataFieldLooksDate(column) && !dataFieldDateValid(value)) issues.push("日期格式");
  if (value && !dataFieldLooksDate(column) && dataFieldLooksTime(column) && !dataFieldTimeValid(value)) issues.push("时间格式");

  const referenceIssue = dataFieldReferenceIssue(column, value);
  if (referenceIssue) issues.push(referenceIssue);
  return issues;
}

function dataFieldRowsFor(type, config) {
  const rows = config.rows || [];
  const columns = normalizeDataColumns(config);
  return columns.map((column) => {
    const values = rows.map((row) => rowValue(row, column.key));
    const filled = values.filter(Boolean).length;
    const empty = rows.length - filled;
    const uniqueValues = [...new Set(values.filter(Boolean))];
    const issueMap = new Map();
    for (const row of rows) {
      for (const issue of dataFieldValueIssues(column, row?.[column.key])) {
        issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
      }
    }
    const issueCount = [...issueMap.values()].reduce((sum, count) => sum + count, 0);
    const fillRate = rows.length ? Math.round((filled / rows.length) * 100) : 0;
    return {
      type,
      table: config.file.replace(/\.csv$/, ""),
      key: column.key,
      label: column.label,
      total: rows.length,
      filled,
      empty,
      fillRate,
      uniqueCount: uniqueValues.length,
      samples: uniqueValues.slice(0, 4),
      issues: [...issueMap.entries()].map(([label, count]) => `${label} ${count}`).join("、"),
      issueCount,
      suggestion: dataFieldSuggestion(column, rows.length, empty, issueMap, uniqueValues.length)
    };
  });
}

function dataFieldSuggestion(column, total, empty, issueMap, uniqueCount) {
  if (!total) return "当前表暂无记录，先通过业务操作或导入生成数据。";
  if (issueMap.has("手机号格式")) return "手机号建议统一为 1 开头 11 位数字，便于去重和联系家长。";
  if (issueMap.has("数字格式")) return "金额、课时、容量等字段只填数字，不要带元、节等单位。";
  if (issueMap.has("日期格式")) return "日期建议统一为 2026-08-26 或 2026/08/26 这类可识别格式。";
  if (issueMap.has("时间格式")) return "时间建议统一为 18:30 或 18:30-20:00，便于排课冲突校验。";
  if ([...issueMap.keys()].some((item) => item.includes("不存在"))) return "先补齐基础资料，或修正字段里的名称，避免导入后无法关联。";
  if (empty === total) return "整列为空，确认是否暂时不用；若为关键字段，导入前应补齐。";
  if (empty > 0) return "有空值，导入或导出前建议按业务要求补齐。";
  if (uniqueCount <= 1 && total > 1 && !/状态|类型|是否/.test(column.label)) return "取值较单一，可抽查是否被批量填成同一个值。";
  return "字段状态正常，可继续抽查示例值是否符合机构习惯。";
}

function dataFieldRows() {
  const configs = dataCenterDatasetConfigs();
  const type = dataFieldCurrentType();
  return dataFieldRowsFor(type, configs[type]);
}

function dataFieldStatus(row) {
  if (!row.total) return { key: "emptyTable", label: "暂无数据", tone: "amber" };
  if (row.issueCount > row.empty) return { key: "format", label: "有异常", tone: "red" };
  if (row.empty === row.total) return { key: "emptyColumn", label: "整列为空", tone: "red" };
  if (row.empty > 0) return { key: "empty", label: "有空值", tone: "amber" };
  return { key: "healthy", label: "完整", tone: "green" };
}

function dataFieldMatches(row) {
  const status = dataFieldStatus(row).key;
  if (dataFieldRiskFilter === "issues") return row.issueCount > row.empty;
  if (dataFieldRiskFilter === "empty") return row.empty > 0;
  if (dataFieldRiskFilter === "full") return status === "healthy";
  if (dataFieldRiskFilter === "reference") return text(row.issues).includes("不存在");
  return true;
}

function compareDataFieldRows(left, right) {
  if (dataFieldSortMode === "label") return text(left.label).localeCompare(text(right.label), "zh-CN");
  if (dataFieldSortMode === "fillAsc") return left.fillRate - right.fillRate || text(left.label).localeCompare(text(right.label), "zh-CN");
  if (dataFieldSortMode === "uniqueDesc") return right.uniqueCount - left.uniqueCount || text(left.label).localeCompare(text(right.label), "zh-CN");
  if (dataFieldSortMode === "issuesDesc") return right.issueCount - left.issueCount || text(left.label).localeCompare(text(right.label), "zh-CN");
  return right.empty - left.empty || right.issueCount - left.issueCount || text(left.label).localeCompare(text(right.label), "zh-CN");
}

function renderDataFieldSummary(rows, visibleRows) {
  const totalCells = rows.reduce((sum, row) => sum + row.total, 0);
  const emptyCells = rows.reduce((sum, row) => sum + row.empty, 0);
  const issueFields = rows.filter((row) => dataFieldStatus(row).key !== "healthy").length;
  const fillRate = totalCells ? Math.round(((totalCells - emptyCells) / totalCells) * 100) : 0;
  const tableName = rows[0]?.table || "当前数据表";
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前表</span><strong>${escapeHtml(tableName)}</strong><small>显示 ${visibleRows.length}/${rows.length} 个字段</small></div>
      <div class="metric"><span>字段数</span><strong>${rows.length}</strong><small>按导出列核对</small></div>
      <div class="metric"><span>空单元格</span><strong>${emptyCells}</strong><small>${issueFields} 个字段需留意</small></div>
      <div class="metric"><span>整体填充率</span><strong>${fillRate}%</strong><small>越接近 100% 越完整</small></div>
    </div>`;
}

function renderDataFieldToolbar() {
  return `
    <div class="filters data-field-toolbar">
      <label>字段状态
        <select id="dataFieldRiskFilter" aria-label="字段完整度状态筛选">
          <option value="all" ${dataFieldRiskFilter === "all" ? "selected" : ""}>全部字段</option>
          <option value="issues" ${dataFieldRiskFilter === "issues" ? "selected" : ""}>格式或关联异常</option>
          <option value="reference" ${dataFieldRiskFilter === "reference" ? "selected" : ""}>关联不存在</option>
          <option value="empty" ${dataFieldRiskFilter === "empty" ? "selected" : ""}>有空值</option>
          <option value="full" ${dataFieldRiskFilter === "full" ? "selected" : ""}>完整字段</option>
        </select>
      </label>
      <label>排序
        <select id="dataFieldSortMode" aria-label="字段完整度排序">
          <option value="emptyDesc" ${dataFieldSortMode === "emptyDesc" ? "selected" : ""}>空值最多</option>
          <option value="issuesDesc" ${dataFieldSortMode === "issuesDesc" ? "selected" : ""}>异常最多</option>
          <option value="fillAsc" ${dataFieldSortMode === "fillAsc" ? "selected" : ""}>填充率升序</option>
          <option value="uniqueDesc" ${dataFieldSortMode === "uniqueDesc" ? "selected" : ""}>不同值最多</option>
          <option value="label" ${dataFieldSortMode === "label" ? "selected" : ""}>字段名称</option>
        </select>
      </label>
      <button class="small-button" type="button" data-export="dataFieldAudit">导出字段核对</button>
    </div>`;
}

function renderDataFieldRate(row) {
  const tone = row.fillRate < 60 ? "bad" : row.fillRate < 100 ? "warn" : "";
  return `<div class="data-field-rate">
    <strong>${row.fillRate}%</strong>
    <div class="data-field-bar ${tone}"><span style="width:${row.fillRate}%"></span></div>
    <span class="muted">${row.filled}/${row.total} 已填</span>
  </div>`;
}

function renderDataFieldSamples(row) {
  if (!row.samples.length) return `<span class="muted">暂无示例</span>`;
  return `<div class="data-field-samples">${row.samples.map((value) => tag(value, "")).join("")}</div>`;
}

function renderDataFieldRows(rows) {
  return rows.map((row) => {
    const status = dataFieldStatus(row);
    return `<tr>
      <td><strong>${escapeHtml(row.label)}</strong><br><span class="muted">${escapeHtml(row.key)}</span></td>
      <td>${tag(status.label, status.tone)}</td>
      <td>${renderDataFieldRate(row)}</td>
      <td>${row.empty}</td>
      <td>${row.issueCount ? tag(row.issues, status.tone) : tag("无", "green")}</td>
      <td>${row.uniqueCount}</td>
      <td class="data-field-note">${renderDataFieldSamples(row)}</td>
      <td class="data-field-note">${escapeHtml(row.suggestion)}</td>
    </tr>`;
  });
}

function appendDataFieldAuditPanel() {
  if (currentView !== "data" || appContent.querySelector(".data-field-panel")) return;
  const rows = dataFieldRows();
  const visibleRows = rows.filter(dataFieldMatches).sort(compareDataFieldRows);
  const panel = `
    <section class="section data-field-panel">
      <div class="section-head">
        <div>
          <h3>字段完整度核对</h3>
          <span class="muted">跟随当前全量数据表，逐列查看填充率、空值、格式/关联异常和示例值。</span>
        </div>
        ${tag(`${visibleRows.length} 个字段`, visibleRows.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${renderDataFieldSummary(rows, visibleRows)}
        ${renderDataFieldToolbar()}
        ${table(["字段", "状态", "填充率", "空值", "异常", "不同值", "示例值", "建议"], renderDataFieldRows(visibleRows))}
      </div>
    </section>`;
  const previewPanel = [...appContent.querySelectorAll(".section")].find((section) => section.textContent.includes("全量数据表"));
  if (previewPanel) {
    previewPanel.insertAdjacentHTML("beforebegin", panel);
  } else {
    appContent.insertAdjacentHTML("beforeend", panel);
  }
}

function flattenDataFieldAuditRows() {
  return dataFieldRows().map((row) => ({
    table: row.table,
    fieldKey: row.key,
    fieldLabel: row.label,
    totalRows: row.total,
    filledRows: row.filled,
    emptyRows: row.empty,
    fillRate: `${row.fillRate}%`,
    issueCount: row.issueCount,
    issues: row.issues || "无",
    uniqueCount: row.uniqueCount,
    samples: row.samples.join("、"),
    suggestion: row.suggestion,
    status: dataFieldStatus(row).label
  }));
}

if (typeof exportDataset === "function") {
  const baseExportDatasetForDataFieldAudit = exportDataset;
  exportDataset = function exportDatasetWithDataFieldAudit(type) {
    if (type !== "dataFieldAudit") {
      baseExportDatasetForDataFieldAudit(type);
      return;
    }
    const currentRows = flattenDataFieldAuditRows();
    const tableName = currentRows[0]?.table || "当前数据表";
    const columns = [
      ["table", "数据表"],
      ["fieldKey", "字段编码"],
      ["fieldLabel", "字段名称"],
      ["totalRows", "总行数"],
      ["filledRows", "已填行数"],
      ["emptyRows", "空值行数"],
      ["fillRate", "填充率"],
      ["issueCount", "异常数"],
      ["issues", "异常说明"],
      ["uniqueCount", "不同值数"],
      ["samples", "示例值"],
      ["suggestion", "处理建议"],
      ["status", "状态"]
    ].map(([key, label]) => ({ key, label }));
    downloadText(`字段完整度核对-${tableName}.csv`, buildCsv(currentRows, columns), "text/csv;charset=utf-8");
    setNotice("data", `字段完整度核对-${tableName}.csv 已开始下载。`);
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForDataFieldAudit = renderDataCenter;
  renderDataCenter = function renderDataCenterWithDataFieldAudit() {
    baseRenderDataCenterForDataFieldAudit();
    const dataGrid = appContent.querySelector(".data-grid");
    if (dataGrid && !dataGrid.querySelector('[data-export="dataFieldAudit"]')) {
      const card = document.createElement("article");
      card.className = "data-card";
      card.innerHTML = `<div><span class="muted">字段完整度核对</span><strong>${flattenDataFieldAuditRows().length}</strong></div><button class="small-button" type="button" data-export="dataFieldAudit">导出字段</button>`;
      dataGrid.appendChild(card);
    }
    const metricValue = [...appContent.querySelectorAll(".metric")]
      .find((item) => item.textContent.includes("数据表数量"))
      ?.querySelector("strong");
    if (metricValue && dataGrid) metricValue.textContent = String(dataGrid.querySelectorAll(".data-card").length);
    appendDataFieldAuditPanel();
  };
}

document.addEventListener("change", (event) => {
  if (event.target.id === "dataFieldRiskFilter") dataFieldRiskFilter = event.target.value;
  if (event.target.id === "dataFieldSortMode") dataFieldSortMode = event.target.value;

  if (["dataFieldRiskFilter", "dataFieldSortMode"].includes(event.target.id) && currentView === "data") {
    renderView();
  }
});

if (currentView === "data") {
  renderView();
}
