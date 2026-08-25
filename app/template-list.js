const templateListStyle = document.createElement("style");
templateListStyle.textContent = `
  .template-list-summary {
    margin-bottom: 14px;
  }

  .template-filter-toolbar {
    align-items: end;
  }

  .template-filter-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .template-filter-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .template-check-tags,
  .template-field-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .template-field-chips {
    max-width: 380px;
  }

  .template-next-step {
    max-width: 330px;
    white-space: normal;
    line-height: 1.55;
  }

  @media (max-width: 650px) {
    .template-filter-toolbar,
    .template-filter-toolbar label,
    .template-filter-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(templateListStyle);

let templateKindFilter = "all";
let templateRequiredFilter = "all";
let templateCheckFilter = "all";
let templateSortMode = "requiredDesc";

function templateRequiredFields(template) {
  return (template.fields || []).filter((field) => text(field).trim().startsWith("*"));
}

function templateCleanField(field) {
  return text(field).replace(/^\*/, "").trim();
}

function templateKind(template) {
  const name = `${template.name} ${template.file}`;
  if (name.includes("意向") || name.includes("学员")) return "学员招生";
  if (name.includes("订单") || name.includes("课时订单")) return "订单课时";
  if (name.includes("课程") || name.includes("报价")) return "课程报价";
  if (name.includes("员工")) return "员工权限";
  if (name.includes("日程") || name.includes("排课")) return "排课日程";
  if (name.includes("班级")) return "班级资料";
  return "其他模板";
}

function templateCheckReasons(template) {
  const fields = (template.fields || []).map(templateCleanField);
  const rules = (template.rules || []).join(" ");
  const source = `${fields.join(" ")} ${rules} ${template.name} ${template.file}`;
  const checks = [];

  if (source.includes("手机号")) checks.push({ key: "phone", label: "手机号校验", tone: "amber" });
  if (source.includes("日期") || source.includes("时间") || source.includes("有效期")) checks.push({ key: "date", label: "日期时间校验", tone: "amber" });
  if (source.includes("金额") || source.includes("课时") || source.includes("价格") || source.includes("总价")) checks.push({ key: "number", label: "金额/课时校验", tone: "amber" });
  if (source.includes("班级") || source.includes("课程")) checks.push({ key: "dependency", label: "需先建基础资料", tone: "amber" });
  if (source.includes("教师") || source.includes("教室") || source.includes("冲突")) checks.push({ key: "schedule", label: "排课资源校验", tone: "red" });
  if (templateRequiredFields(template).length >= 8) checks.push({ key: "required", label: "必填字段多", tone: "amber" });

  return checks;
}

function templateHasCheck(template, checkKey) {
  if (checkKey === "all") return true;
  if (checkKey === "none") return templateCheckReasons(template).length === 0;
  return templateCheckReasons(template).some((reason) => reason.key === checkKey);
}

function templateRequiredLevel(template) {
  const count = templateRequiredFields(template).length;
  if (count >= 8) return "high";
  if (count >= 3) return "medium";
  return "low";
}

function templateMatchesFilters(template) {
  if (!matchesRow(template)) return false;
  if (templateKindFilter !== "all" && templateKind(template) !== templateKindFilter) return false;
  if (templateRequiredFilter !== "all" && templateRequiredLevel(template) !== templateRequiredFilter) return false;
  return templateHasCheck(template, templateCheckFilter);
}

function compareTemplates(left, right) {
  if (templateSortMode === "name") return text(left.name).localeCompare(text(right.name), "zh-CN");
  if (templateSortMode === "kind") {
    const kindGap = templateKind(left).localeCompare(templateKind(right), "zh-CN");
    return kindGap || text(left.name).localeCompare(text(right.name), "zh-CN");
  }
  if (templateSortMode === "fieldsDesc") return (right.fields || []).length - (left.fields || []).length || text(left.name).localeCompare(text(right.name), "zh-CN");
  return templateRequiredFields(right).length - templateRequiredFields(left).length || (right.fields || []).length - (left.fields || []).length;
}

function templateNextStep(template) {
  const kind = templateKind(template);
  if (kind === "排课日程") return "导入前先维护教师、教室和班级，导入后重点核对冲突检查表。";
  if (kind === "订单课时") return "导入前确认学员已建档、课程班级存在，金额和课时只填数字。";
  if (kind === "学员招生") return "导入前先统一手机号格式、渠道和年级名称，避免重复建档。";
  if (kind === "员工权限") return "导入后到员工权限页核对角色、是否教师和每周容量。";
  if (kind === "课程报价") return "导入后到基础资料页补齐课程状态、课时和价格。";
  if (kind === "班级资料") return "导入前先维护课程、老师、教室，导入后检查满班人数。";
  return "导入前先核对必填字段和下方规则。";
}

function renderTemplateCheckTags(template) {
  const checks = templateCheckReasons(template);
  if (!checks.length) return tag("普通模板", "green");
  return `<div class="template-check-tags">${checks.map((check) => tag(check.label, check.tone)).join("")}</div>`;
}

function renderTemplateFields(template) {
  const fields = (template.fields || []).slice(0, 8);
  return `<div class="template-field-chips">${fields
    .map((field) => `<span class="field-pill ${field.startsWith("*") ? "required" : ""}">${escapeHtml(field)}</span>`)
    .join("")}${(template.fields || []).length > fields.length ? tag(`+${(template.fields || []).length - fields.length}`, "") : ""}</div>`;
}

function renderTemplateFilterToolbar(templates) {
  const kinds = [...new Set(templates.map(templateKind))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return `
    <div class="filters template-filter-toolbar">
      <label>业务类型
        <select id="templateKindFilter" aria-label="按业务类型筛选模板">
          <option value="all" ${templateKindFilter === "all" ? "selected" : ""}>全部类型</option>
          ${kinds.map((kind) => `<option value="${escapeHtml(kind)}" ${templateKindFilter === kind ? "selected" : ""}>${escapeHtml(kind)}</option>`).join("")}
        </select>
      </label>
      <label>必填强度
        <select id="templateRequiredFilter" aria-label="按必填字段数量筛选模板">
          <option value="all" ${templateRequiredFilter === "all" ? "selected" : ""}>全部强度</option>
          <option value="high" ${templateRequiredFilter === "high" ? "selected" : ""}>必填较多</option>
          <option value="medium" ${templateRequiredFilter === "medium" ? "selected" : ""}>中等必填</option>
          <option value="low" ${templateRequiredFilter === "low" ? "selected" : ""}>必填较少</option>
        </select>
      </label>
      <label>关键校验
        <select id="templateCheckFilter" aria-label="按关键校验筛选模板">
          <option value="all" ${templateCheckFilter === "all" ? "selected" : ""}>全部校验</option>
          <option value="phone" ${templateCheckFilter === "phone" ? "selected" : ""}>手机号</option>
          <option value="date" ${templateCheckFilter === "date" ? "selected" : ""}>日期时间</option>
          <option value="number" ${templateCheckFilter === "number" ? "selected" : ""}>金额/课时</option>
          <option value="dependency" ${templateCheckFilter === "dependency" ? "selected" : ""}>基础资料依赖</option>
          <option value="schedule" ${templateCheckFilter === "schedule" ? "selected" : ""}>排课资源</option>
          <option value="required" ${templateCheckFilter === "required" ? "selected" : ""}>必填字段多</option>
          <option value="none" ${templateCheckFilter === "none" ? "selected" : ""}>普通模板</option>
        </select>
      </label>
      <label>排序
        <select id="templateSortMode" aria-label="模板列表排序">
          <option value="requiredDesc" ${templateSortMode === "requiredDesc" ? "selected" : ""}>必填字段降序</option>
          <option value="fieldsDesc" ${templateSortMode === "fieldsDesc" ? "selected" : ""}>字段数降序</option>
          <option value="kind" ${templateSortMode === "kind" ? "selected" : ""}>业务类型</option>
          <option value="name" ${templateSortMode === "name" ? "selected" : ""}>名称顺序</option>
        </select>
      </label>
    </div>`;
}

function renderTemplateListSummary(allTemplates, visibleTemplates) {
  const requiredTotal = allTemplates.reduce((sum, template) => sum + templateRequiredFields(template).length, 0);
  const scheduleTemplates = allTemplates.filter((template) => templateCheckReasons(template).some((reason) => reason.key === "schedule")).length;
  const phoneTemplates = allTemplates.filter((template) => templateCheckReasons(template).some((reason) => reason.key === "phone")).length;
  return `
    <div class="summary-grid compact-metrics template-list-summary">
      <div class="metric"><span>当前显示</span><strong>${visibleTemplates.length}</strong><small>全部 ${allTemplates.length} 个模板</small></div>
      <div class="metric"><span>必填字段</span><strong>${requiredTotal}</strong><small>导入前必须逐列核对</small></div>
      <div class="metric"><span>排课相关</span><strong>${scheduleTemplates}</strong><small>重点检查教师教室冲突</small></div>
      <div class="metric"><span>手机号校验</span><strong>${phoneTemplates}</strong><small>避免重复学员和家长档案</small></div>
    </div>`;
}

function renderTemplateRows(templates) {
  return templates.map((template) => `<tr>
    <td><strong>${escapeHtml(template.name)}</strong><br><span class="muted">${escapeHtml(template.file)}</span></td>
    <td>${tag(templateKind(template), "")}</td>
    <td>${(template.fields || []).length}</td>
    <td>${tag(templateRequiredFields(template).length, templateRequiredFields(template).length >= 8 ? "amber" : "green")}</td>
    <td>${renderTemplateCheckTags(template)}</td>
    <td>${renderTemplateFields(template)}</td>
    <td class="template-next-step">${escapeHtml(templateNextStep(template))}</td>
  </tr>`);
}

function renderTemplateCards(templates) {
  return `
    <div class="template-grid">
      ${templates
        .map(
          (template) => `<article class="template-card">
            <div>
              <strong>${escapeHtml(template.name)}</strong>
              <p class="muted">${escapeHtml(template.file)}</p>
            </div>
            ${renderTemplateFields(template)}
            <div class="stack-list">
              ${(template.rules || []).map((rule) => `<span class="muted">· ${escapeHtml(rule)}</span>`).join("")}
            </div>
          </article>`
        )
        .join("") || `<div class="stack-item"><strong>没有匹配模板</strong><span class="muted">可以调整筛选条件。</span></div>`}
    </div>`;
}

renderTemplates = function renderTemplatesWithChecklist() {
  const preview = renderExcelPreview();
  const allTemplates = appState.templates.filter(matchesRow);
  const visibleTemplates = appState.templates.filter(templateMatchesFilters).sort(compareTemplates);
  appContent.innerHTML = `
    ${preview}
    <section class="section">
      <div class="section-head">
        <div>
          <h3>导入模板核对清单</h3>
          <span class="muted">按业务类型、必填字段和关键校验筛选，导入前先把容易出错的字段核对完。</span>
        </div>
        ${tag(`${visibleTemplates.length} 个模板`, visibleTemplates.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${renderTemplateListSummary(allTemplates, visibleTemplates)}
        ${renderTemplateFilterToolbar(allTemplates)}
        ${table(["模板", "业务类型", "字段数", "必填", "关键校验", "字段示例", "导入前动作"], renderTemplateRows(visibleTemplates))}
      </div>
    </section>
    <section class="section">
      <div class="section-head compact-head">
        <h3>字段卡片</h3>
        <span class="muted">星号字段为必填项，可配合上方表格逐项核对。</span>
      </div>
      <div class="section-body">
        ${renderTemplateCards(visibleTemplates)}
      </div>
    </section>`;
};

document.addEventListener("change", (event) => {
  if (event.target.id === "templateKindFilter") templateKindFilter = event.target.value;
  if (event.target.id === "templateRequiredFilter") templateRequiredFilter = event.target.value;
  if (event.target.id === "templateCheckFilter") templateCheckFilter = event.target.value;
  if (event.target.id === "templateSortMode") templateSortMode = event.target.value;

  if (["templateKindFilter", "templateRequiredFilter", "templateCheckFilter", "templateSortMode"].includes(event.target.id) && currentView === "templates") {
    renderView();
  }
});

if (currentView === "templates") {
  renderView();
}
