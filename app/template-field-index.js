const templateFieldIndexStyle = document.createElement("style");
templateFieldIndexStyle.textContent = `
  .template-field-index {
    margin-bottom: 16px;
  }

  .field-index-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .field-index-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .field-index-tags,
  .field-index-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .field-index-note {
    max-width: 340px;
    line-height: 1.55;
    white-space: normal;
  }

  @media (max-width: 650px) {
    .field-index-toolbar,
    .field-index-toolbar label,
    .field-index-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(templateFieldIndexStyle);

let fieldIndexWorkbookFilter = "all";
let fieldIndexRequiredFilter = "all";
let fieldIndexCheckFilter = "all";
let fieldIndexSortMode = "workbook";

function fieldIndexCleanName(name) {
  return text(name).replace(/^\*/, "").trim();
}

function fieldIndexImportEntrance(book, sheet) {
  const source = `${book.fileName || ""} ${sheet.name || ""}`;
  if (source.includes("1对1")) return "一对一日程导入";
  if (source.includes("班级日程") || source.includes("日程")) return "班级日程导入";
  if (source.includes("订单")) return "订单导入";
  if (source.includes("员工")) return "员工导入";
  if (source.includes("课程报价") || source.includes("课程")) return "课程报价导入";
  if (source.includes("班级")) return "班级导入";
  if (source.includes("意向") || source.includes("学员")) return "学员/意向学员导入";
  return "待确认导入入口";
}

function fieldIndexChecks(row) {
  const field = fieldIndexCleanName(row.field);
  const source = `${field} ${row.workbook} ${row.sheet} ${row.entrance}`;
  const checks = [];

  if (source.includes("手机号") || source.includes("电话")) checks.push({ key: "phone", label: "手机号", tone: "amber" });
  if (source.includes("日期") || source.includes("生日") || source.includes("有效期")) checks.push({ key: "date", label: "日期", tone: "amber" });
  if (source.includes("时间") || source.includes("重复规则")) checks.push({ key: "time", label: "时间规则", tone: "amber" });
  if (source.includes("金额") || source.includes("价格") || source.includes("售价") || source.includes("实收") || source.includes("欠费") || source.includes("总价")) checks.push({ key: "money", label: "金额", tone: "amber" });
  if (source.includes("课时") || source.includes("消耗") || source.includes("购买") || source.includes("赠送")) checks.push({ key: "hours", label: "课时", tone: "amber" });
  if (source.includes("班级") || source.includes("课程") || source.includes("学员") || source.includes("教师") || source.includes("教室") || source.includes("校区")) checks.push({ key: "dependency", label: "基础资料", tone: "amber" });
  if (source.includes("日程") || source.includes("排课") || source.includes("1对1")) checks.push({ key: "schedule", label: "排课资源", tone: "red" });
  if (!checks.length) checks.push({ key: "text", label: "文本核对", tone: "green" });

  return checks;
}

function fieldIndexBuildRows() {
  const books = excelPreview?.workbooks || [];
  const rows = [];
  books.forEach((book, workbookIndex) => {
    (book.sheets || []).forEach((sheet, sheetIndex) => {
      (sheet.headers || []).forEach((field) => {
        const row = {
          key: `${workbookIndex}:${sheetIndex}:${field.column}`,
          workbookIndex,
          sheetIndex,
          workbook: book.fileName || "未命名工作簿",
          sheet: sheet.name || "工作表",
          column: Number(field.column || 0),
          field: text(field.name),
          cleanField: fieldIndexCleanName(field.name),
          required: Boolean(field.required),
          entrance: fieldIndexImportEntrance(book, sheet),
          usedRows: Number(sheet.usedRows || 0),
          usedCols: Number(sheet.usedCols || 0)
        };
        row.checks = fieldIndexChecks(row);
        rows.push(row);
      });
    });
  });
  return rows;
}

function fieldIndexMatches(row) {
  const haystack = [row.workbook, row.sheet, row.field, row.entrance, ...row.checks.map((check) => check.label)].join(" ").toLowerCase();
  if (searchTerm && !haystack.includes(searchTerm.toLowerCase())) return false;
  if (fieldIndexWorkbookFilter !== "all" && row.workbook !== fieldIndexWorkbookFilter) return false;
  if (fieldIndexRequiredFilter === "required" && !row.required) return false;
  if (fieldIndexRequiredFilter === "optional" && row.required) return false;
  if (fieldIndexCheckFilter !== "all" && !row.checks.some((check) => check.key === fieldIndexCheckFilter)) return false;
  return true;
}

function compareFieldIndexRows(left, right) {
  if (fieldIndexSortMode === "required") return Number(right.required) - Number(left.required) || left.workbook.localeCompare(right.workbook, "zh-CN") || left.column - right.column;
  if (fieldIndexSortMode === "field") return left.cleanField.localeCompare(right.cleanField, "zh-CN") || left.workbook.localeCompare(right.workbook, "zh-CN");
  if (fieldIndexSortMode === "entrance") return left.entrance.localeCompare(right.entrance, "zh-CN") || left.workbook.localeCompare(right.workbook, "zh-CN") || left.column - right.column;
  if (fieldIndexSortMode === "column") return left.column - right.column || left.workbook.localeCompare(right.workbook, "zh-CN");
  return left.workbook.localeCompare(right.workbook, "zh-CN") || left.sheet.localeCompare(right.sheet, "zh-CN") || left.column - right.column;
}

function fieldIndexUniqueOptions(rows, key, selectedValue, allLabel) {
  const values = [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function renderFieldIndexToolbar(rows) {
  return `
    <div class="filters field-index-toolbar">
      <label>工作簿
        <select id="fieldIndexWorkbookFilter" aria-label="按 Excel 工作簿筛选字段">${fieldIndexUniqueOptions(rows, "workbook", fieldIndexWorkbookFilter, "全部工作簿")}</select>
      </label>
      <label>必填
        <select id="fieldIndexRequiredFilter" aria-label="按是否必填筛选字段">
          <option value="all" ${fieldIndexRequiredFilter === "all" ? "selected" : ""}>全部字段</option>
          <option value="required" ${fieldIndexRequiredFilter === "required" ? "selected" : ""}>只看必填</option>
          <option value="optional" ${fieldIndexRequiredFilter === "optional" ? "selected" : ""}>只看选填</option>
        </select>
      </label>
      <label>校验重点
        <select id="fieldIndexCheckFilter" aria-label="按字段校验重点筛选">
          <option value="all" ${fieldIndexCheckFilter === "all" ? "selected" : ""}>全部校验</option>
          <option value="phone" ${fieldIndexCheckFilter === "phone" ? "selected" : ""}>手机号</option>
          <option value="date" ${fieldIndexCheckFilter === "date" ? "selected" : ""}>日期</option>
          <option value="time" ${fieldIndexCheckFilter === "time" ? "selected" : ""}>时间规则</option>
          <option value="money" ${fieldIndexCheckFilter === "money" ? "selected" : ""}>金额</option>
          <option value="hours" ${fieldIndexCheckFilter === "hours" ? "selected" : ""}>课时</option>
          <option value="dependency" ${fieldIndexCheckFilter === "dependency" ? "selected" : ""}>基础资料</option>
          <option value="schedule" ${fieldIndexCheckFilter === "schedule" ? "selected" : ""}>排课资源</option>
          <option value="text" ${fieldIndexCheckFilter === "text" ? "selected" : ""}>文本核对</option>
        </select>
      </label>
      <label>排序
        <select id="fieldIndexSortMode" aria-label="模板字段总览排序">
          <option value="workbook" ${fieldIndexSortMode === "workbook" ? "selected" : ""}>工作簿顺序</option>
          <option value="required" ${fieldIndexSortMode === "required" ? "selected" : ""}>必填优先</option>
          <option value="entrance" ${fieldIndexSortMode === "entrance" ? "selected" : ""}>导入入口</option>
          <option value="field" ${fieldIndexSortMode === "field" ? "selected" : ""}>字段名称</option>
          <option value="column" ${fieldIndexSortMode === "column" ? "selected" : ""}>列号</option>
        </select>
      </label>
    </div>`;
}

function renderFieldIndexSummary(rows, visibleRows) {
  const required = rows.filter((row) => row.required).length;
  const workbooks = new Set(rows.map((row) => row.workbook)).size;
  const sheets = new Set(rows.map((row) => `${row.workbook}:${row.sheet}`)).size;
  const highRisk = rows.filter((row) => row.checks.some((check) => ["schedule", "money", "phone"].includes(check.key))).length;

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 个字段</small></div>
      <div class="metric"><span>工作簿/表</span><strong>${workbooks}/${sheets}</strong><small>来自真实 Excel 模板</small></div>
      <div class="metric"><span>必填字段</span><strong>${required}</strong><small>导入前逐项核对</small></div>
      <div class="metric"><span>重点校验</span><strong>${highRisk}</strong><small>手机号、金额和排课资源</small></div>
    </div>`;
}

function renderFieldIndexTags(row) {
  return `<div class="field-index-tags">${row.checks.map((check) => tag(check.label, check.tone)).join("")}</div>`;
}

function fieldIndexNote(row) {
  if (row.checks.some((check) => check.key === "schedule")) return "导入前确认教师、教室、学员或班级已存在，并在课表页核对资源冲突。";
  if (row.checks.some((check) => check.key === "phone")) return "手机号建议统一为 11 位数字，避免重复学员和家长档案。";
  if (row.checks.some((check) => check.key === "money")) return "金额只保留数字，避免输入货币符号、逗号或中文单位。";
  if (row.checks.some((check) => check.key === "hours")) return "课时字段统一使用数字，小数课时需要和班级扣课规则一致。";
  if (row.checks.some((check) => check.key === "dependency")) return "导入前先在基础资料或学员档案中维护同名数据。";
  return "按模板原字段填写，导入后在数据中心核对记录数和异常提示。";
}

function renderFieldIndexRows(rows) {
  return rows.map((row) => `<tr>
    <td><strong>${escapeHtml(row.workbook)}</strong><br><span class="muted">${escapeHtml(row.sheet)} · ${row.usedRows} 行 × ${row.usedCols} 列</span></td>
    <td>${row.column}</td>
    <td>${row.required ? tag(row.field, "red") : escapeHtml(row.field)}</td>
    <td>${row.required ? tag("必填", "red") : tag("选填", "green")}</td>
    <td>${renderFieldIndexTags(row)}</td>
    <td>${escapeHtml(row.entrance)}</td>
    <td class="field-index-note">${escapeHtml(fieldIndexNote(row))}</td>
    <td>
      <div class="field-index-actions">
        <button class="small-button" type="button" data-field-index-workbook="${row.workbookIndex}" data-field-index-sheet="${row.sheetIndex}">看原表</button>
      </div>
    </td>
  </tr>`);
}

function renderTemplateFieldIndexPanel() {
  if (!excelPreview) {
    return `
      <section class="section template-field-index">
        <div class="section-head">
          <h3>模板字段总览</h3>
          <span class="muted">等待真实 Excel 模板数据</span>
        </div>
        <div class="section-body">
          <div class="stack-item"><strong>正在读取字段索引</strong><span class="muted">字段总览会在 app/excel-data.json 加载后自动出现。</span></div>
        </div>
      </section>`;
  }

  const rows = fieldIndexBuildRows();
  if (!rows.length) {
    return `
      <section class="section template-field-index">
        <div class="section-head">
          <h3>模板字段总览</h3>
          <span class="muted">未识别到字段</span>
        </div>
        <div class="section-body">
          <div class="stack-item"><strong>没有可汇总字段</strong><span class="muted">请确认 Excel 预览文件包含 headers 数据。</span></div>
        </div>
      </section>`;
  }

  const visibleRows = rows.filter(fieldIndexMatches).sort(compareFieldIndexRows);
  return `
    <section class="section template-field-index">
      <div class="section-head">
        <div>
          <h3>模板字段总览</h3>
          <span class="muted">跨工作簿汇总真实 Excel 字段、必填项、校验重点和对应导入入口。</span>
        </div>
        ${tag(`${visibleRows.length} 个字段`, visibleRows.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${renderFieldIndexSummary(rows, visibleRows)}
        ${renderFieldIndexToolbar(rows)}
        ${table(["工作簿/工作表", "列", "字段", "必填", "校验重点", "对应导入入口", "导入前提示", "操作"], renderFieldIndexRows(visibleRows))}
      </div>
    </section>`;
}

function insertTemplateFieldIndexPanel() {
  if (currentView !== "templates" || appContent.querySelector(".template-field-index")) return;
  const firstSection = appContent.querySelector(".section");
  if (firstSection) {
    firstSection.insertAdjacentHTML("afterend", renderTemplateFieldIndexPanel());
  } else {
    appContent.insertAdjacentHTML("afterbegin", renderTemplateFieldIndexPanel());
  }
}

const baseRenderTemplatesForFieldIndex = renderTemplates;
renderTemplates = function renderTemplatesWithFieldIndex() {
  baseRenderTemplatesForFieldIndex();
  insertTemplateFieldIndexPanel();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "fieldIndexWorkbookFilter") fieldIndexWorkbookFilter = event.target.value;
  if (event.target.id === "fieldIndexRequiredFilter") fieldIndexRequiredFilter = event.target.value;
  if (event.target.id === "fieldIndexCheckFilter") fieldIndexCheckFilter = event.target.value;
  if (event.target.id === "fieldIndexSortMode") fieldIndexSortMode = event.target.value;

  if (["fieldIndexWorkbookFilter", "fieldIndexRequiredFilter", "fieldIndexCheckFilter", "fieldIndexSortMode"].includes(event.target.id) && currentView === "templates") {
    renderView();
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-field-index-workbook]");
  if (!button) return;
  selectedWorkbookIndex = Number(button.dataset.fieldIndexWorkbook);
  selectedSheetIndex = Number(button.dataset.fieldIndexSheet);
  renderView();
});

if (currentView === "templates") renderView();
