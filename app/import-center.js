const importFileInput = document.createElement("input");
importFileInput.id = "importFile";
importFileInput.type = "file";
importFileInput.accept = ".csv,text/csv,.txt";
importFileInput.hidden = true;
document.body.appendChild(importFileInput);

let pendingImportType = "students";
let lastImportReport = null;

const importStyle = document.createElement("style");
importStyle.textContent = `
  .import-panel {
    display: grid;
    gap: 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px;
    background: #f8fbff;
    margin-bottom: 14px;
  }

  .import-panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .import-controls {
    display: grid;
    grid-template-columns: minmax(220px, 320px) auto auto;
    gap: 10px;
    align-items: end;
  }

  .import-controls select {
    min-height: 40px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    padding: 0 10px;
  }

  .import-report {
    display: grid;
    gap: 10px;
  }

  .import-guide-card {
    display: grid;
    grid-template-columns: minmax(210px, 0.9fr) minmax(260px, 1.3fr) minmax(210px, 0.9fr);
    gap: 12px;
    align-items: stretch;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
  }

  .import-guide-block {
    display: grid;
    align-content: start;
    gap: 7px;
    min-width: 0;
  }

  .import-guide-block strong {
    color: var(--ink);
  }

  .import-guide-tags,
  .import-guide-actions,
  .import-guide-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .import-guide-list span {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--soft);
    color: var(--ink);
    font-size: 12px;
    line-height: 1.35;
  }

  .import-result-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(120px, 1fr));
    gap: 10px;
  }

  .import-result-grid .metric {
    padding: 12px;
    box-shadow: none;
  }

  .import-result-grid .metric strong {
    font-size: 24px;
  }

  @media (max-width: 900px) {
    .import-controls,
    .import-guide-card,
    .import-result-grid {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(importStyle);

const importProfiles = {
  students: {
    title: "学员档案",
    fileName: "学员导入样例.csv",
    headers: ["学员姓名", "手机号", "手机号归属人", "年级", "学校", "渠道", "销售员", "课程", "班级", "状态", "剩余课时", "欠费"],
    sample: [
      {
        学员姓名: "测试学员",
        手机号: "13900019999",
        手机号归属人: "母亲",
        年级: "初二年级",
        学校: "示例中学",
        渠道: "转介绍",
        销售员: "前台老师",
        课程: "初二小组课/一对一",
        班级: "待分班",
        状态: "意向",
        剩余课时: "0",
        欠费: "0"
      }
    ]
  },
  orders: {
    title: "订单课时",
    fileName: "订单导入样例.csv",
    headers: ["学员", "手机号", "课程", "班级", "购买课时", "赠送课时", "已上课时", "实收金额", "欠费金额", "收款方式", "有效期至", "经办人"],
    sample: [
      {
        学员: "林梓涵",
        手机号: "13800010001",
        课程: "初二小组课/一对一",
        班级: "25秋初二数学A班",
        购买课时: "10",
        赠送课时: "0",
        已上课时: "0",
        实收金额: "1200",
        欠费金额: "0",
        收款方式: "微信",
        有效期至: "2027-02-28",
        经办人: "前台老师"
      }
    ]
  },
  courses: {
    title: "课程报价",
    fileName: "课程报价导入样例.csv",
    headers: ["课程名称", "售卖状态", "课程类型", "授课方式", "数量（课时）", "总价金额(元）", "科目", "年级", "班型"],
    sample: [
      {
        课程名称: "初一数学同步班",
        售卖状态: "在售",
        课程类型: "普通课程",
        授课方式: "线下",
        "数量（课时）": "20",
        "总价金额(元）": "2600",
        科目: "数学",
        年级: "初一年级",
        班型: "小班"
      }
    ]
  },
  rooms: {
    title: "教室资料",
    fileName: "教室导入样例.csv",
    headers: ["教室名称", "校区", "容量", "教室类型", "状态", "备注"],
    sample: [
      {
        教室名称: "东楼202室",
        校区: "主校区",
        容量: "14",
        教室类型: "线下教室",
        状态: "可排课",
        备注: "初中小班"
      }
    ]
  },
  employees: {
    title: "员工资料",
    fileName: "员工导入样例.csv",
    headers: ["员工姓名", "员工手机号", "员工类型", "所属部门", "校区角色", "科目", "年级", "是否是教师", "每周容量"],
    sample: [
      {
        员工姓名: "数学-李老师",
        员工手机号: "13900018888",
        员工类型: "正式员工",
        所属部门: "教学部",
        校区角色: "教师",
        科目: "数学",
        年级: "初中",
        是否是教师: "是",
        每周容量: "20"
      }
    ]
  },
  classes: {
    title: "班级资料",
    fileName: "班级导入样例.csv",
    headers: ["班级名称", "关联课程", "满班人数", "班主任", "上课教室", "默认上课教师", "学生扣除课时数", "教师记录课时数", "期段", "状态"],
    sample: [
      {
        班级名称: "26春初一数学A班",
        关联课程: "初一数学同步班",
        满班人数: "16",
        班主任: "教务-刘老师",
        上课教室: "东楼202室",
        默认上课教师: "数学-李老师",
        学生扣除课时数: "1",
        教师记录课时数: "1",
        期段: "春季班",
        状态: "招生中"
      }
    ]
  },
  classSchedules: {
    title: "班级日程",
    fileName: "班级日程导入样例.csv",
    headers: ["班级名称", "开始日期", "结束日期", "重复规则", "开始时间", "结束时间", "上课教师", "上课助教", "上课教室", "科目"],
    sample: [
      {
        班级名称: "26春初一数学A班",
        开始日期: "2026-09-07",
        结束日期: "2026-09-28",
        重复规则: "每周重复",
        开始时间: "18:30",
        结束时间: "20:00",
        上课教师: "数学-李老师",
        上课助教: "教务-刘老师",
        上课教室: "东楼202室",
        科目: "数学"
      }
    ]
  },
  oneToOneSchedules: {
    title: "1 对 1 日程",
    fileName: "一对一日程导入样例.csv",
    headers: ["1对1名称", "开始日期", "结束日期", "重复规则", "开始时间", "结束时间", "上课教师", "上课助教", "上课教室", "科目"],
    sample: [
      {
        "1对1名称": "测试学员-初一一对一",
        开始日期: "2026-09-08",
        结束日期: "",
        重复规则: "不重复",
        开始时间: "19:00",
        结束时间: "20:00",
        上课教师: "数学-李老师",
        上课助教: "教务-刘老师",
        上课教室: "东楼202室",
        科目: "数学"
      }
    ]
  }
};

const importProfileGuides = {
  students: {
    order: "第 1 步",
    depends: ["可直接导入"],
    checks: ["手机号去重", "年级渠道统一", "班级可填待分班"],
    prepare: ["先统一手机号格式", "渠道和年级用下拉口径", "未定班级填待分班"],
    after: "导入后到学员列表核对重复，再进入报名办理台完成报名、分班。",
    previewType: "students"
  },
  courses: {
    order: "第 2 步",
    depends: ["可直接导入"],
    checks: ["课程名不重复", "课时为数字", "价格为数字"],
    prepare: ["先定课程命名", "确认售卖状态", "金额课时只填数字"],
    after: "课程会被订单和班级引用，先导入课程能减少后续失败行。",
    previewType: "courses"
  },
  rooms: {
    order: "第 3 步",
    depends: ["可直接导入"],
    checks: ["教室名不重复", "容量大于 0"],
    prepare: ["按校区统一命名", "容量只填数字", "状态选可排课或停用"],
    after: "教室导入后可直接用于班级默认教室和排课冲突检查。",
    previewType: "rooms"
  },
  employees: {
    order: "第 4 步",
    depends: ["角色权限"],
    checks: ["角色已存在", "手机号格式", "是否教师"],
    prepare: ["先核对角色权限", "教师要填科目年级", "每周容量只填数字"],
    after: "标记为教师的员工会同步进入教师资料，用于班级和排课选择。",
    previewType: "employees"
  },
  classes: {
    order: "第 5 步",
    depends: ["课程资料", "教师资料", "教室资料"],
    checks: ["课程存在", "教师存在", "教室存在", "容量扣课为数字"],
    prepare: ["先导入课程教师教室", "班级名称保持唯一", "扣课规则用数字"],
    after: "班级导入后先看容量和默认资源，再做订单分班和批量排课。",
    previewType: "classes"
  },
  orders: {
    order: "第 6 步",
    depends: ["学员档案", "班级资料"],
    checks: ["学员存在", "班级存在", "金额课时", "有效期日期"],
    prepare: ["先导入学员和班级", "购买课时/实收只填数字", "有效期用 2027-02-28"],
    after: "订单导入会更新学员课程、班级、余额和欠费，并生成收款流水。",
    previewType: "orders"
  },
  classSchedules: {
    order: "第 7 步",
    depends: ["班级资料", "教师资料", "教室资料"],
    checks: ["班级存在", "日期时间", "教师教室冲突"],
    prepare: ["先确认班级默认资源", "时间用 18:30 格式", "重复课必须有结束日期"],
    after: "导入后会跳过冲突课节，建议马上查看排课冲突和课表。",
    previewType: "lessons"
  },
  oneToOneSchedules: {
    order: "第 8 步",
    depends: ["教师资料", "教室资料"],
    checks: ["1 对 1 名称", "日期时间", "教师时间冲突"],
    prepare: ["名称包含学员和课程", "先确认教师教室", "不重复课可不填结束日期"],
    after: "一对一导入后可在课表里按学员姓名或老师筛选核对。",
    previewType: "lessons"
  }
};

function fallbackImportGuideBlockers(type) {
  const count = (key) => appState[key]?.length || 0;
  const blockers = [];
  if (type === "orders" && !count("students")) blockers.push("缺少学员档案");
  if (type === "orders" && !count("classes")) blockers.push("缺少班级资料");
  if (type === "employees" && !count("roles")) blockers.push("缺少角色权限");
  if (type === "classes" && !count("courses")) blockers.push("缺少课程资料");
  if (type === "classes" && !count("teachers")) blockers.push("缺少教师资料");
  if (type === "classes" && !count("rooms")) blockers.push("缺少教室资料");
  if (type === "classSchedules" && !count("classes")) blockers.push("缺少班级资料");
  if (type === "classSchedules" && !count("teachers")) blockers.push("缺少教师资料");
  if (type === "classSchedules" && !count("rooms")) blockers.push("缺少教室资料");
  if (type === "oneToOneSchedules" && !count("teachers")) blockers.push("缺少教师资料");
  if (type === "oneToOneSchedules" && !count("rooms")) blockers.push("缺少教室资料");
  return blockers;
}

function importGuideBlockers(type) {
  return typeof importReadyBlockers === "function" ? importReadyBlockers(type) : fallbackImportGuideBlockers(type);
}

function importGuideWarnings(type) {
  return typeof importReadyWarnings === "function" ? importReadyWarnings(type) : [];
}

function importGuideTemplates(type) {
  if (typeof localTemplateRows !== "function") return [];
  return localTemplateRows().filter((row) => row.profile === type).map((row) => row.kind);
}

function renderImportGuide(type) {
  const profile = importProfiles[type] || importProfiles.students;
  const guide = importProfileGuides[type] || importProfileGuides.students;
  const blockers = importGuideBlockers(type);
  const warnings = importGuideWarnings(type);
  const status = blockers.length
    ? { label: "先补资料", tone: "red" }
    : warnings.length
      ? { label: "可导入需注意", tone: "amber" }
      : { label: "可导入", tone: "green" };
  const templateKinds = [...new Set(importGuideTemplates(type))];
  const chooseDisabled = blockers.length ? "disabled" : "";

  return `
    <div class="import-guide-card">
      <div class="import-guide-block">
        <strong>${escapeHtml(profile.title)}导入准备</strong>
        <div class="import-guide-tags">
          ${tag(guide.order, "")}
          ${tag(status.label, status.tone)}
          ${(templateKinds.length ? templateKinds : ["CSV样例"]).map((item) => tag(item, "green")).join("")}
        </div>
        <span class="muted">${escapeHtml(blockers.length ? `先处理：${blockers.join("、")}` : guide.after)}</span>
      </div>
      <div class="import-guide-block">
        <strong>导入前核对</strong>
        <div class="import-guide-list">
          ${guide.depends.map((item) => `<span>依赖：${escapeHtml(item)}</span>`).join("")}
          ${guide.checks.map((item) => `<span>校验：${escapeHtml(item)}</span>`).join("")}
          ${warnings.map((item) => `<span>提醒：${escapeHtml(item)}</span>`).join("")}
        </div>
      </div>
      <div class="import-guide-block">
        <strong>老师下一步</strong>
        <div class="import-guide-list">
          ${guide.prepare.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
        <div class="import-guide-actions">
          <button class="small-button" type="button" data-import-sample="${escapeHtml(type)}">下载样例</button>
          <button class="small-button" type="button" data-import-template-profile="${escapeHtml(type)}">看模板</button>
          <button class="small-button" type="button" data-import-preview="${escapeHtml(guide.previewType)}">看数据</button>
          <button class="primary-action" type="button" data-import-choose="${escapeHtml(type)}" ${chooseDisabled}>选择CSV</button>
        </div>
      </div>
    </div>`;
}

function renderImportPanel() {
  const report = lastImportReport;
  const selectedType = report?.type || pendingImportType || "students";
  const sampleButtons = Object.entries(importProfiles)
    .map(([type, profile]) => `<button class="small-button" type="button" data-import-sample="${type}">${escapeHtml(profile.title)}样例</button>`)
    .join("");
  const typeOptions = Object.entries(importProfiles)
    .map(([type, profile]) => `<option value="${type}" ${selectedType === type ? "selected" : ""}>${escapeHtml(profile.title)}</option>`)
    .join("");
  return `
    <div class="import-panel">
      <div class="import-panel-head">
        <div>
          <strong>批量导入</strong>
          <span class="muted">支持 Excel 另存为 CSV 后导入，先校验，错误会逐行说明。</span>
        </div>
        <div class="action-row">${sampleButtons}</div>
      </div>
      <div class="import-controls">
        <label>导入类型
          <select id="importType">
            ${typeOptions}
          </select>
        </label>
        <button class="primary-action" type="button" id="chooseImportFile">选择 CSV 文件</button>
        <span class="muted">CSV 表头可使用本系统导出的中文列名；批量日程会自动跳过冲突课节。</span>
      </div>
      ${renderImportGuide(selectedType)}
      ${report ? renderImportReport(report) : ""}
    </div>`;
}

function renderImportReport(report) {
  const errorRows = report.errors
    .slice(0, 10)
    .map((item) => `<tr><td>${item.row}</td><td>${escapeHtml(item.reason)}</td><td>${escapeHtml(item.preview)}</td></tr>`);
  return `
    <div class="import-report">
      <div class="notice ${report.failed ? "amber" : "green"}">${escapeHtml(report.message)}</div>
      <div class="import-result-grid">
        <div class="metric"><span>读取行数</span><strong>${report.total}</strong></div>
        <div class="metric"><span>成功导入</span><strong>${report.success}</strong></div>
        <div class="metric"><span>失败行数</span><strong>${report.failed}</strong></div>
      </div>
      ${report.errors.length ? table(["行号", "错误原因", "行内容"], errorRows) : ""}
    </div>`;
}

function parseCsv(content) {
  const rows = [];
  let cell = "";
  let row = [];
  let quoted = false;
  const source = text(content).replace(/^\ufeff/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => text(value).trim())) rows.push(row);
  return rows;
}

function csvToObjects(content) {
  const rows = parseCsv(content);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((item) => text(item).replace(/^\*/, "").trim());
  const records = rows
    .slice(1)
    .filter((row) => row.some((value) => text(value).trim()))
    .map((row, index) => {
      const item = { __row: index + 2, __raw: row.join(" | ") };
      headers.forEach((header, cellIndex) => {
        item[header] = text(row[cellIndex]).trim();
      });
      return item;
    });
  return { headers, records };
}

function readField(row, aliases) {
  for (const name of aliases) {
    const cleanName = name.replace(/^\*/, "");
    if (row[name] !== undefined) return text(row[name]).trim();
    if (row[cleanName] !== undefined) return text(row[cleanName]).trim();
  }
  return "";
}

function readNumber(row, aliases, label, errors, options = {}) {
  const value = readField(row, aliases);
  if (!value && options.required) {
    errors.push(`${label}不能为空`);
    return 0;
  }
  if (!value) return 0;
  const normalized = value.replaceAll(",", "");
  const result = Number(normalized);
  if (!Number.isFinite(result)) {
    errors.push(`${label}必须是数字`);
    return 0;
  }
  if (options.min !== undefined && result < options.min) errors.push(`${label}不能小于 ${options.min}`);
  return result;
}

function normalizeImportDate(value) {
  const cleanValue = text(value).trim();
  if (!cleanValue) return "";
  const compact = cleanValue.replace(/[/.]/g, "-");
  if (/^\d{8}$/.test(cleanValue)) {
    return `${cleanValue.slice(0, 4)}-${cleanValue.slice(4, 6)}-${cleanValue.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(compact)) {
    const [year, month, day] = compact.split("-");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return "";
}

function nextStudentIdFromOffset(offset) {
  const maxNumber = appState.students.reduce((max, student) => {
    const number = Number(text(student.id).replace(/^S/, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  return `S${String(maxNumber + offset).padStart(3, "0")}`;
}

function validateStudentRow(row, importPhones) {
  const errors = [];
  const name = readField(row, ["学员姓名", "姓名", "学生姓名", "name"]);
  const phone = readField(row, ["手机号", "主手机号", "联系电话", "phone"]);
  const balance = readNumber(row, ["剩余课时", "余额", "balance"], "剩余课时", errors, { min: 0 });
  const debt = readNumber(row, ["欠费", "欠费金额", "debt"], "欠费金额", errors, { min: 0 });

  if (!name) errors.push("学员姓名不能为空");
  if (!/^1\d{10}$/.test(phone)) errors.push("手机号必须是 1 开头的 11 位数字");
  if (phone && appState.students.some((student) => student.phone === phone)) errors.push("手机号已存在，避免重复建档");
  if (phone && importPhones.has(phone)) errors.push("本次文件内手机号重复");

  const className = readField(row, ["班级", "报读班级", "className"]) || "待分班";
  if (className !== "待分班" && !getClass(className)) errors.push(`班级不存在：${className}`);

  return {
    errors,
    data: {
      name,
      phone,
      relation: readField(row, ["手机号归属人", "关系", "relation"]) || "母亲",
      grade: readField(row, ["年级", "grade"]) || "未填写",
      school: readField(row, ["学校", "就读学校", "school"]),
      channel: readField(row, ["渠道", "来源渠道", "channel"]) || "导入",
      owner: readField(row, ["销售员", "经办人", "owner"]) || "前台老师",
      course: readField(row, ["课程", "意向/报读课程", "报读课程", "course"]) || "待确认课程",
      className,
      status: readField(row, ["状态", "当前状态", "status"]) || (className === "待分班" ? "意向" : "已报名"),
      balance,
      debt
    }
  };
}

function importStudents(records) {
  const importPhones = new Set();
  let success = 0;
  const errors = [];
  const validRows = [];

  records.forEach((row) => {
    const result = validateStudentRow(row, importPhones);
    if (result.errors.length) {
      errors.push({ row: row.__row, reason: result.errors.join("；"), preview: row.__raw });
      return;
    }
    importPhones.add(result.data.phone);
    validRows.push(result.data);
  });

  validRows.forEach((student, index) => {
    appState.students.unshift({
      id: nextStudentIdFromOffset(index + 1),
      ...student
    });
    success += 1;
  });

  syncClassCounts();
  return { success, errors };
}

function findStudentForImportOrder(row) {
  const phone = readField(row, ["手机号", "主手机号", "phone"]);
  const name = readField(row, ["学员", "学员姓名", "学生姓名", "student"]);
  if (phone) {
    const byPhone = appState.students.find((student) => student.phone === phone);
    if (byPhone) return byPhone;
  }
  return appState.students.find((student) => student.name === name);
}

function validateOrderRow(row) {
  const errors = [];
  const student = findStudentForImportOrder(row);
  const className = readField(row, ["班级", "报读班级", "className"]);
  const course = readField(row, ["课程", "报读课程", "course"]) || getClass(className)?.course || "待确认课程";
  const bought = readNumber(row, ["购买课时", "购买课时数", "bought"], "购买课时", errors, { required: true, min: 0 });
  const gift = readNumber(row, ["赠送课时", "赠送课时数", "gift"], "赠送课时", errors, { min: 0 });
  const used = readNumber(row, ["已上课时", "已上课时数", "used"], "已上课时", errors, { min: 0 });
  const paid = readNumber(row, ["实收金额", "实收", "paid"], "实收金额", errors, { required: true, min: 0 });
  const debt = readNumber(row, ["欠费金额", "欠费", "debt"], "欠费金额", errors, { min: 0 });
  const expireAtRaw = readField(row, ["有效期至", "有效期", "expireAt"]);
  const expireAt = normalizeImportDate(expireAtRaw);

  if (!student) errors.push("找不到学员，请先导入或创建学员档案");
  if (!className) errors.push("班级不能为空");
  if (className && !getClass(className)) errors.push(`班级不存在：${className}`);
  if (used > bought + gift) errors.push("已上课时不能大于购买课时加赠送课时");
  if (!expireAt) errors.push("有效期至格式不正确，建议使用 2027-02-28");

  return {
    errors,
    data: {
      student,
      order: {
        id: nextId("O"),
        student: student?.name || readField(row, ["学员", "学员姓名"]),
        course,
        className,
        bought,
        gift,
        used,
        paid,
        debt,
        payMethod: readField(row, ["收款方式", "payMethod"]) || "线下收款",
        account: readField(row, ["收款账户", "account"]),
        tradeNo: readField(row, ["支付单号", "tradeNo"]),
        expireAt,
        owner: readField(row, ["经办人", "销售员", "owner"]) || student?.owner || "前台老师"
      }
    }
  };
}

function importOrders(records) {
  let success = 0;
  const errors = [];

  records.forEach((row) => {
    const result = validateOrderRow(row);
    if (result.errors.length) {
      errors.push({ row: row.__row, reason: result.errors.join("；"), preview: row.__raw });
      return;
    }

    const { student, order } = result.data;
    appState.orders.unshift(order);
    student.course = order.course;
    student.className = order.className;
    student.status = "已报名";
    student.balance = Number(student.balance || 0) + Math.max(0, order.bought + order.gift - order.used);
    student.debt = Number(student.debt || 0) + order.debt;
    if (typeof addPaymentRecord === "function" && order.paid > 0) {
      addPaymentRecord({
        orderId: order.id,
        student: order.student,
        amount: order.paid,
        method: order.payMethod,
        account: order.account,
        tradeNo: order.tradeNo,
        type: "导入订单收款",
        beforeDebt: order.debt,
        afterDebt: order.debt,
        operator: order.owner,
        note: "由订单 CSV 导入生成"
      });
    }
    success += 1;
  });

  syncClassCounts();
  return { success, errors };
}

function ensureImportDependencies() {
  if (typeof ensureMasterData === "function") ensureMasterData();
  if (typeof ensureStaffData === "function") ensureStaffData();
  if (!Array.isArray(appState.scheduleBatches)) appState.scheduleBatches = [];
}

function splitImportList(value) {
  return text(value)
    .split(/[、,，;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeImportTime(value) {
  const cleanValue = text(value).trim();
  const match = cleanValue.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function yesNoValue(value) {
  return ["是", "Y", "YES", "TRUE", "1"].includes(text(value).trim().toUpperCase()) ? "是" : "否";
}

function validateCourseRow(row, importNames) {
  const errors = [];
  const name = readField(row, ["课程名称", "报价单名称", "courseName", "name"]);
  const hours = readNumber(row, ["数量（课时）", "数量(课时)", "标准课时", "课时", "hours"], "数量（课时）", errors, { required: true, min: 1 });
  const price = readNumber(row, ["总价金额(元）", "总价金额(元)", "总价金额", "标准价", "price"], "总价金额", errors, { required: true, min: 0 });

  if (!name) errors.push("课程名称不能为空");
  if (name.length > 50) errors.push("课程名称不能超过 50 个字");
  if (name && appState.courses.some((item) => item.name === name)) errors.push(`课程已存在：${name}`);
  if (name && importNames.has(name)) errors.push(`本次文件内课程重复：${name}`);

  return {
    errors,
    data: {
      name,
      subject: readField(row, ["科目", "subject"]) || "待维护",
      grade: readField(row, ["年级", "学段", "grade"]) || "未分年级",
      type: readField(row, ["课程类型", "班型", "type"]) || "普通课程",
      mode: readField(row, ["授课方式", "mode"]) || "线下",
      hours,
      price,
      status: readField(row, ["售卖状态", "状态", "status"]) || "在售"
    }
  };
}

function importCourses(records) {
  ensureImportDependencies();
  const importNames = new Set();
  const validRows = [];
  const errors = [];

  records.forEach((row) => {
    const result = validateCourseRow(row, importNames);
    if (result.errors.length) {
      errors.push({ row: row.__row, reason: result.errors.join("；"), preview: row.__raw });
      return;
    }
    importNames.add(result.data.name);
    validRows.push(result.data);
  });

  validRows.forEach((item) => appState.courses.unshift(item));
  return { success: validRows.length, errors };
}

function validateRoomRow(row, importNames) {
  const errors = [];
  const name = readField(row, ["教室名称", "上课教室", "room", "name"]);
  const capacity = readNumber(row, ["容量", "满班人数", "capacity"], "容量", errors, { required: true, min: 1 });

  if (!name) errors.push("教室名称不能为空");
  if (name && appState.rooms.some((item) => item.name === name)) errors.push(`教室已存在：${name}`);
  if (name && importNames.has(name)) errors.push(`本次文件内教室重复：${name}`);

  return {
    errors,
    data: {
      name,
      campus: readField(row, ["校区", "campus"]) || "主校区",
      capacity,
      type: readField(row, ["教室类型", "类型", "type"]) || "线下教室",
      status: readField(row, ["状态", "status"]) || "可排课",
      note: readField(row, ["备注", "note"])
    }
  };
}

function importRooms(records) {
  ensureImportDependencies();
  const importNames = new Set();
  const validRows = [];
  const errors = [];

  records.forEach((row) => {
    const result = validateRoomRow(row, importNames);
    if (result.errors.length) {
      errors.push({ row: row.__row, reason: result.errors.join("；"), preview: row.__raw });
      return;
    }
    importNames.add(result.data.name);
    validRows.push(result.data);
  });

  validRows.forEach((item) => appState.rooms.unshift(item));
  return { success: validRows.length, errors };
}

function validateEmployeeRow(row, importNames) {
  const errors = [];
  const name = readField(row, ["员工姓名", "教师姓名", "姓名", "name"]);
  const phone = readField(row, ["员工手机号", "手机号", "phone"]);
  const roles = readField(row, ["校区角色", "角色", "roles"]) || "教师";
  const roleNames = splitImportList(roles);
  const existingRoles = new Set((appState.roles || []).map((item) => item.name));
  const weeklyHours = readNumber(row, ["每周容量", "每周课时", "weeklyHours"], "每周容量", errors, { min: 0 });

  if (!name) errors.push("员工姓名不能为空");
  if (phone && !/^1\d{10}$/.test(phone)) errors.push("员工手机号必须是 1 开头的 11 位数字");
  if (name && appState.employees?.some((item) => item.name === name)) errors.push(`员工已存在：${name}`);
  if (name && importNames.has(name)) errors.push(`本次文件内员工重复：${name}`);
  roleNames.forEach((role) => {
    if (!existingRoles.has(role)) errors.push(`角色不存在：${role}`);
  });

  return {
    errors,
    data: {
      name,
      phone,
      employeeType: readField(row, ["员工类型", "employeeType"]) || "正式员工",
      department: readField(row, ["所属部门", "部门", "department"]) || "教学部",
      roles,
      subjects: readField(row, ["科目", "subjects"]),
      grades: readField(row, ["年级", "grades"]),
      isTeacher: yesNoValue(readField(row, ["是否是教师", "是否教师", "isTeacher"])),
      weeklyHours: weeklyHours || 20,
      status: readField(row, ["状态", "status"]) || "在职"
    }
  };
}

function importEmployees(records) {
  ensureImportDependencies();
  const importNames = new Set();
  const validRows = [];
  const errors = [];

  records.forEach((row) => {
    const result = validateEmployeeRow(row, importNames);
    if (result.errors.length) {
      errors.push({ row: row.__row, reason: result.errors.join("；"), preview: row.__raw });
      return;
    }
    importNames.add(result.data.name);
    validRows.push(result.data);
  });

  validRows.forEach((employee) => {
    appState.employees.unshift(employee);
    if (employee.isTeacher === "是" && !appState.teachers.some((item) => item.name === employee.name)) {
      appState.teachers.unshift({
        name: employee.name,
        phone: employee.phone,
        subjects: employee.subjects || "待维护",
        grades: employee.grades || "待维护",
        role: "任课老师",
        weeklyHours: employee.weeklyHours,
        status: employee.status
      });
    }
  });
  return { success: validRows.length, errors };
}

function validateClassRow(row, importNames) {
  const errors = [];
  const name = readField(row, ["班级名称", "班级", "className", "name"]);
  const course = readField(row, ["关联课程", "课程", "报读课程", "course"]);
  const teacher = readField(row, ["默认上课教师", "上课教师", "教师", "teacher"]);
  const room = readField(row, ["上课教室", "教室", "room"]);
  const capacity = readNumber(row, ["满班人数", "容量", "capacity"], "满班人数", errors, { required: true, min: 1 });
  const deduct = readNumber(row, ["学生扣除课时数", "扣课课时", "deduct"], "学生扣除课时数", errors, { required: true, min: 0 });
  const teacherHours = readNumber(row, ["教师记录课时数", "教师课时", "teacherHours"], "教师记录课时数", errors, { required: true, min: 0 });

  if (!name) errors.push("班级名称不能为空");
  if (name && appState.classes.some((item) => item.name === name)) errors.push(`班级已存在：${name}`);
  if (name && importNames.has(name)) errors.push(`本次文件内班级重复：${name}`);
  if (!course) errors.push("关联课程不能为空");
  if (course && !appState.courses.some((item) => item.name === course)) errors.push(`课程不存在：${course}`);
  if (!teacher) errors.push("默认上课教师不能为空");
  if (teacher && !appState.teachers.some((item) => item.name === teacher)) errors.push(`教师不存在：${teacher}`);
  if (!room) errors.push("上课教室不能为空");
  if (room && !appState.rooms.some((item) => item.name === room)) errors.push(`教室不存在：${room}`);

  return {
    errors,
    data: {
      name,
      course,
      teacher,
      assistant: readField(row, ["班主任", "上课助教", "助教", "assistant"]),
      room,
      capacity,
      students: 0,
      deduct,
      teacherHours,
      stage: readField(row, ["期段", "学段", "stage"]) || "常规班",
      status: readField(row, ["状态", "status"]) || "招生中"
    }
  };
}

function importClasses(records) {
  ensureImportDependencies();
  const importNames = new Set();
  const validRows = [];
  const errors = [];

  records.forEach((row) => {
    const result = validateClassRow(row, importNames);
    if (result.errors.length) {
      errors.push({ row: row.__row, reason: result.errors.join("；"), preview: row.__raw });
      return;
    }
    importNames.add(result.data.name);
    validRows.push(result.data);
  });

  validRows.forEach((item) => appState.classes.unshift(item));
  syncClassCounts();
  return { success: validRows.length, errors };
}

function scheduleRepeatStep(rule) {
  const cleanRule = text(rule).trim();
  if (!cleanRule || cleanRule === "不重复") return 0;
  if (cleanRule.includes("每天")) return 1;
  if (cleanRule.includes("隔周")) return 14;
  if (cleanRule.includes("每周")) return 7;
  return NaN;
}

function scheduleDatesFromRow(row, errors) {
  const startDate = normalizeImportDate(readField(row, ["开始日期", "上课日期", "date"]));
  const endDate = normalizeImportDate(readField(row, ["结束日期", "endDate"]));
  const rule = readField(row, ["重复规则", "repeatRule"]) || "不重复";
  const step = scheduleRepeatStep(rule);

  if (!startDate) errors.push("开始日期格式不正确");
  if (!Number.isFinite(step)) errors.push(`重复规则不支持：${rule}`);
  if (step > 0 && !endDate) errors.push("非不重复日程必须填写结束日期");
  if (errors.length) return [];

  const firstDate = dateFromIso(startDate);
  const lastDate = dateFromIso(step > 0 ? endDate : startDate);
  if (!Number.isFinite(firstDate.getTime()) || !Number.isFinite(lastDate.getTime()) || firstDate > lastDate) {
    errors.push("日期范围不正确");
    return [];
  }

  const dates = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, step || 1)) {
    dates.push(isoFromDate(date));
    if (!step) break;
  }
  return dates;
}

function validateScheduleRow(row, scheduleType) {
  ensureImportDependencies();
  const errors = [];
  const target = scheduleType === "classSchedules"
    ? readField(row, ["班级名称", "班级", "target"])
    : readField(row, ["1对1名称", "一对一名称", "班级名称", "target"]);
  const classItem = scheduleType === "classSchedules" ? getClass(target) : null;
  const teacher = readField(row, ["上课教师", "教师", "teacher"]);
  const room = readField(row, ["上课教室", "教室", "room"]);
  const startTime = normalizeImportTime(readField(row, ["开始时间", "startTime"]));
  const endTime = normalizeImportTime(readField(row, ["结束时间", "endTime"]));
  const dates = scheduleDatesFromRow(row, errors);

  if (!target) errors.push(scheduleType === "classSchedules" ? "班级名称不能为空" : "1 对 1 名称不能为空");
  if (scheduleType === "classSchedules" && target && !classItem) errors.push(`班级不存在：${target}`);
  if (!teacher) errors.push("上课教师不能为空");
  if (teacher && !appState.teachers.some((item) => item.name === teacher)) errors.push(`教师不存在：${teacher}`);
  if (!room) errors.push("上课教室不能为空");
  if (room && !appState.rooms.some((item) => item.name === room)) errors.push(`教室不存在：${room}`);
  if (!startTime || !endTime) errors.push("开始时间和结束时间必须形如 18:30");

  const time = `${startTime}-${endTime}`;
  const subject = readField(row, ["科目", "subject"]) || classItem?.course || "课程";
  const candidates = dates.map((date, index) => ({
    id: `${nextId("L")}${String(index + 1).padStart(2, "0")}`,
    day: dayFromDate(date),
    date,
    time,
    type: scheduleType === "classSchedules" ? "班级课" : "1对1",
    target,
    subject,
    teacher,
    room,
    assistant: readField(row, ["上课助教", "助教", "assistant"]),
    status: "待上课",
    deduct: Number(classItem?.deduct || 1)
  }));

  if (candidates.some((lesson) => typeof isValidLessonRange === "function" && !isValidLessonRange(lesson))) errors.push("结束时间必须晚于开始时间");

  return { errors, candidates, rule: readField(row, ["重复规则", "repeatRule"]) || "不重复" };
}

function importSchedules(records, scheduleType) {
  ensureImportDependencies();
  let success = 0;
  const errors = [];

  records.forEach((row) => {
    const result = validateScheduleRow(row, scheduleType);
    if (result.errors.length) {
      errors.push({ row: row.__row, reason: result.errors.join("；"), preview: row.__raw });
      return;
    }

    const created = [];
    const skipped = [];
    result.candidates.forEach((candidate) => {
      const conflicts = findLessonConflicts(candidate);
      if (conflicts.length) {
        skipped.push(`${candidate.date} ${candidate.time}：${conflicts.map((item) => `${item.target} ${item.reasons?.join("、") || ""}`).join("；")}`);
        return;
      }
      appState.lessons.push(candidate);
      created.push(candidate);
    });

    if (created.length) {
      success += created.length;
      appState.scheduleBatches.unshift({
        id: nextId("B"),
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        target: created[0].target,
        subject: created[0].subject,
        teacher: created[0].teacher,
        room: created[0].room,
        startDate: created[0].date,
        endDate: created[created.length - 1].date,
        weekdays: [...new Set(created.map((lesson) => lesson.day))],
        time: created[0].time,
        createdCount: created.length,
        skippedCount: skipped.length,
        skippedDetail: skipped.join(" | "),
        operator: "导入"
      });
    }

    if (skipped.length) {
      errors.push({ row: row.__row, reason: `已新增 ${created.length} 节，跳过 ${skipped.length} 节冲突课：${skipped.join("；")}`, preview: row.__raw });
    }
    if (!created.length && !skipped.length) {
      errors.push({ row: row.__row, reason: "没有生成任何课节，请检查日期和重复规则", preview: row.__raw });
    }
  });

  return { success, errors };
}

function runImportByType(type, records) {
  const importers = {
    students: importStudents,
    orders: importOrders,
    courses: importCourses,
    rooms: importRooms,
    employees: importEmployees,
    classes: importClasses,
    classSchedules: (items) => importSchedules(items, "classSchedules"),
    oneToOneSchedules: (items) => importSchedules(items, "oneToOneSchedules")
  };
  return (importers[type] || importStudents)(records);
}

function runImport(type, content, fileName) {
  const { records } = csvToObjects(content);
  const result = runImportByType(type, records);
  lastImportReport = {
    type,
    fileName,
    total: records.length,
    success: result.success,
    failed: result.errors.length,
    errors: result.errors,
    message: `${importProfiles[type].title}导入完成：成功 ${result.success} 行，失败 ${result.errors.length} 行。`
  };

  saveState();
  renderNav();
  operationNotice = null;
  setView("data");
}

function importFile(file, type) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      runImport(type, reader.result, file.name);
    } catch {
      lastImportReport = {
        type,
        fileName: file.name,
        total: 0,
        success: 0,
        failed: 1,
        errors: [{ row: "-", reason: "文件读取失败，请确认是 UTF-8 CSV 文件", preview: file.name }],
        message: "导入失败，请检查文件格式。"
      };
      operationNotice = null;
      setView("data");
    } finally {
      importFileInput.value = "";
    }
  });
  reader.readAsText(file, "utf-8");
}

function buildImportCsv(rows, headers) {
  const csvRows = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ];
  return `\ufeff${csvRows.join("\n")}`;
}

document.addEventListener("click", (event) => {
  if (event.target.id === "chooseImportFile") {
    pendingImportType = document.querySelector("#importType")?.value || "students";
    importFileInput.click();
  }

  const chooseButton = event.target.closest("[data-import-choose]");
  if (chooseButton && !chooseButton.disabled) {
    pendingImportType = chooseButton.dataset.importChoose || "students";
    const importTypeSelect = document.querySelector("#importType");
    if (importTypeSelect) importTypeSelect.value = pendingImportType;
    importFileInput.click();
  }

  const sampleButton = event.target.closest("[data-import-sample]");
  if (sampleButton) {
    const profile = importProfiles[sampleButton.dataset.importSample];
    downloadText(profile.fileName, buildImportCsv(profile.sample, profile.headers), "text/csv;charset=utf-8");
  }

  const previewButton = event.target.closest("[data-import-preview]");
  if (previewButton) {
    if (typeof dataPreviewType !== "undefined") dataPreviewType = previewButton.dataset.importPreview || "students";
    if (typeof dataPreviewOnlyIssues !== "undefined") dataPreviewOnlyIssues = false;
    renderView();
  }

  const templateButton = event.target.closest("[data-import-template-profile]");
  if (templateButton) {
    pendingImportType = templateButton.dataset.importTemplateProfile || "students";
    if (typeof localTemplateProfileFilter !== "undefined") localTemplateProfileFilter = pendingImportType;
    if (typeof localTemplateKindFilter !== "undefined") localTemplateKindFilter = "all";
    if (typeof localTemplateCheckFilter !== "undefined") localTemplateCheckFilter = "all";
    if (typeof localTemplateSortMode !== "undefined") localTemplateSortMode = "order";
    if (typeof cleanUiActiveSupportPanels !== "undefined") cleanUiActiveSupportPanels.templates = "templates:local";
    setNotice("templates", `已筛选 ${importProfiles[pendingImportType]?.title || "对应"} 的本地 Excel 模板，可对照后另存为 CSV。`, "green");
    setView("templates");
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "importType") {
    pendingImportType = event.target.value || "students";
    lastImportReport = null;
    renderView();
  }
});

importFileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importFile(file, pendingImportType);
});
