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
  }
};

function renderImportPanel() {
  const report = lastImportReport;
  const selectedType = report?.type || pendingImportType || "students";
  return `
    <div class="import-panel">
      <div class="import-panel-head">
        <div>
          <strong>批量导入</strong>
          <span class="muted">支持 Excel 另存为 CSV 后导入，先校验，错误会逐行说明。</span>
        </div>
        <div class="action-row">
          <button class="small-button" type="button" data-import-sample="students">学员样例</button>
          <button class="small-button" type="button" data-import-sample="orders">订单样例</button>
        </div>
      </div>
      <div class="import-controls">
        <label>导入类型
          <select id="importType">
            <option value="students" ${selectedType === "students" ? "selected" : ""}>学员档案</option>
            <option value="orders" ${selectedType === "orders" ? "selected" : ""}>订单课时</option>
          </select>
        </label>
        <button class="primary-action" type="button" id="chooseImportFile">选择 CSV 文件</button>
        <span class="muted">CSV 表头可使用本系统导出的中文列名。</span>
      </div>
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

function runImport(type, content, fileName) {
  const { records } = csvToObjects(content);
  const result = type === "orders" ? importOrders(records) : importStudents(records);
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

  const sampleButton = event.target.closest("[data-import-sample]");
  if (sampleButton) {
    const profile = importProfiles[sampleButton.dataset.importSample];
    downloadText(profile.fileName, buildImportCsv(profile.sample, profile.headers), "text/csv;charset=utf-8");
  }
});

importFileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importFile(file, pendingImportType);
});
