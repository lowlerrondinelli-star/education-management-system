const restoreFile = document.querySelector("#restoreFile");

navItems.splice(navItems.length - 1, 0, { id: "data", label: "数据中心", icon: "存" });
viewMeta.data = ["本地数据", "备份与导出"];

const baseRenderView = renderView;
renderView = function renderViewWithDataCenter() {
  if (currentView === "data") {
    renderDataCenter();
    return;
  }
  baseRenderView();
};

let dataPreviewType = "students";
let dataPreviewSearchTerm = "";
let dataPreviewOnlyIssues = false;

function csvCell(value) {
  const cleanValue = text(value).replaceAll('"', '""');
  return `"${cleanValue}"`;
}

function buildCsv(rows, columns) {
  const header = columns.map((item) => csvCell(item.label)).join(",");
  const body = rows.map((row) => columns.map((item) => csvCell(row[item.key])).join(",")).join("\n");
  return `\ufeff${header}${body ? `\n${body}` : ""}`;
}

function downloadText(fileName, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function dataCenterDatasetConfigs() {
  return {
    students: {
      file: "学员档案.csv",
      rows: appState.students,
      columns: [
        ["id", "学员编号"],
        ["name", "学员姓名"],
        ["phone", "手机号"],
        ["relation", "手机号归属人"],
        ["grade", "年级"],
        ["school", "学校"],
        ["channel", "渠道"],
        ["owner", "销售员"],
        ["course", "课程"],
        ["className", "班级"],
        ["status", "状态"],
        ["balance", "剩余课时"],
        ["debt", "欠费"]
      ]
    },
    orders: {
      file: "订单课时.csv",
      rows: appState.orders,
      columns: [
        ["id", "订单号"],
        ["student", "学员"],
        ["course", "课程"],
        ["className", "班级"],
        ["bought", "购买课时"],
        ["gift", "赠送课时"],
        ["used", "已上课时"],
        ["paid", "实收金额"],
        ["debt", "欠费金额"],
        ["payMethod", "收款方式"],
        ["expireAt", "有效期至"],
        ["owner", "经办人"]
      ]
    },
    classes: {
      file: "班级列表.csv",
      rows: appState.classes,
      columns: [
        ["name", "班级名称"],
        ["course", "关联课程"],
        ["teacher", "教师"],
        ["assistant", "助教"],
        ["room", "教室"],
        ["capacity", "满班人数"],
        ["students", "当前人数"],
        ["deduct", "学生扣课"],
        ["teacherHours", "教师课时"],
        ["stage", "期段"],
        ["status", "状态"]
      ]
    },
    courses: {
      file: "课程资料.csv",
      rows: appState.courses || [],
      columns: [
        ["name", "课程名称"],
        ["subject", "科目"],
        ["grade", "年级"],
        ["type", "课程类型"],
        ["mode", "授课方式"],
        ["hours", "标准课时"],
        ["price", "标准价"],
        ["status", "状态"]
      ]
    },
    teachers: {
      file: "教师资料.csv",
      rows: appState.teachers || [],
      columns: [
        ["name", "教师姓名"],
        ["phone", "手机号"],
        ["subjects", "科目"],
        ["grades", "年级"],
        ["role", "角色"],
        ["weeklyHours", "每周容量"],
        ["status", "状态"]
      ]
    },
    rooms: {
      file: "教室资料.csv",
      rows: appState.rooms || [],
      columns: [
        ["name", "教室名称"],
        ["campus", "校区"],
        ["capacity", "容量"],
        ["type", "教室类型"],
        ["status", "状态"],
        ["note", "备注"]
      ]
    },
    employees: {
      file: "员工资料.csv",
      rows: flattenEmployeeRows(),
      columns: [
        ["name", "员工姓名"],
        ["phone", "员工手机号"],
        ["employeeType", "员工类型"],
        ["department", "所属部门"],
        ["roles", "校区角色"],
        ["subjects", "科目"],
        ["grades", "年级"],
        ["isTeacher", "是否教师"],
        ["weeklyHours", "每周容量"],
        ["status", "状态"]
      ]
    },
    roles: {
      file: "角色权限.csv",
      rows: flattenRoleRows(),
      columns: [
        ["role", "角色名称"],
        ["description", "角色说明"],
        ["module", "可用模块"],
        ["moduleId", "模块编号"],
        ["actions", "允许动作"]
      ]
    },
    attendance: {
      file: "点名考勤.csv",
      rows: flattenAttendanceRows(),
      columns: [
        ["lessonId", "课节编号"],
        ["date", "日期"],
        ["time", "时间"],
        ["target", "班级/对象"],
        ["student", "学员"],
        ["status", "考勤状态"],
        ["deduct", "是否消课"],
        ["operator", "点名人"],
        ["updatedAt", "点名时间"]
      ]
    },
    payments: {
      file: "收款流水.csv",
      rows: flattenPaymentRows(),
      columns: [
        ["id", "流水号"],
        ["orderId", "订单号"],
        ["student", "学员"],
        ["type", "收款类型"],
        ["amount", "收款金额"],
        ["method", "收款方式"],
        ["account", "收款账户"],
        ["tradeNo", "支付单号"],
        ["beforeDebt", "收款前欠费"],
        ["afterDebt", "收款后欠费"],
        ["operator", "经办人"],
        ["paidAt", "收款时间"],
        ["note", "备注"]
      ]
    },
    lessons: {
      file: "课表.csv",
      rows: appState.lessons,
      columns: [
        ["id", "课节编号"],
        ["day", "星期"],
        ["date", "日期"],
        ["time", "时间"],
        ["type", "课节类型"],
        ["target", "班级/对象"],
        ["subject", "科目"],
        ["teacher", "教师"],
        ["room", "教室"],
        ["status", "状态"]
      ]
    },
    scheduleConflicts: {
      file: "排课冲突检查.csv",
      rows: typeof flattenScheduleConflictRows === "function" ? flattenScheduleConflictRows() : [],
      columns: [
        ["date", "日期"],
        ["time", "冲突时间"],
        ["reason", "冲突原因"],
        ["firstTarget", "课节一对象"],
        ["firstTeacher", "课节一教师"],
        ["firstRoom", "课节一教室"],
        ["secondTarget", "课节二对象"],
        ["secondTeacher", "课节二教师"],
        ["secondRoom", "课节二教室"],
        ["status", "处理状态"]
      ]
    },
    scheduleBatches: {
      file: "周期排课.csv",
      rows: typeof flattenScheduleBatchRows === "function" ? flattenScheduleBatchRows() : [],
      columns: [
        ["id", "批次编号"],
        ["createdAt", "生成时间"],
        ["target", "班级/对象"],
        ["subject", "科目"],
        ["teacher", "上课教师"],
        ["room", "上课教室"],
        ["dateRange", "日期范围"],
        ["weekdays", "重复星期"],
        ["time", "上课时间"],
        ["createdCount", "新增课节数"],
        ["skippedCount", "跳过冲突数"],
        ["skippedDetail", "冲突明细"],
        ["operator", "操作人"]
      ]
    },
    followUps: {
      file: "续费跟进.csv",
      rows: typeof flattenFollowUpRows === "function" ? flattenFollowUpRows() : [],
      columns: [
        ["id", "跟进编号"],
        ["student", "学员姓名"],
        ["phone", "手机号"],
        ["type", "跟进类型"],
        ["owner", "跟进人"],
        ["dueDate", "下次跟进"],
        ["status", "状态"],
        ["result", "跟进结果"],
        ["priority", "优先级"],
        ["source", "来源"],
        ["note", "备注"],
        ["updatedAt", "更新时间"]
      ]
    },
    studentDetails: {
      file: "学员详情汇总.csv",
      rows: typeof flattenStudentDetailRows === "function" ? flattenStudentDetailRows() : [],
      columns: [
        ["id", "学员编号"],
        ["name", "学员姓名"],
        ["phone", "手机号"],
        ["grade", "年级"],
        ["school", "学校"],
        ["channel", "渠道"],
        ["owner", "负责人"],
        ["course", "课程"],
        ["className", "班级"],
        ["status", "状态"],
        ["balance", "剩余课时"],
        ["debt", "学员欠费"],
        ["orderCount", "订单数"],
        ["bought", "购买课时"],
        ["gift", "赠送课时"],
        ["used", "已上课时"],
        ["remaining", "订单余额"],
        ["paid", "累计实收"],
        ["lessonCount", "相关课节"],
        ["ledgerCount", "流水数"],
        ["followUpStatus", "最近跟进"],
        ["nextFollowUp", "下次跟进"],
        ["latestAttendance", "最近考勤"],
        ["latestLedger", "最近流水"]
      ]
    },
    reports: {
      file: "经营报表.csv",
      rows: typeof flattenOperationReportRows === "function" ? flattenOperationReportRows() : [],
      columns: [
        ["section", "报表分组"],
        ["item", "项目"],
        ["value", "指标值"],
        ["amount", "数值"],
        ["note", "说明"]
      ]
    },
    ledger: {
      file: "消课流水.csv",
      rows: appState.ledger,
      columns: [
        ["id", "流水编号"],
        ["time", "时间"],
        ["student", "学员"],
        ["lesson", "关联课节"],
        ["type", "类型"],
        ["change", "变动"],
        ["before", "变动前"],
        ["after", "变动后"],
        ["operator", "操作人"]
      ]
    }
  };
}

function exportDataset(type) {
  const configs = dataCenterDatasetConfigs();
  const config = configs[type];
  if (!config) return;
  const columns = config.columns.map(([key, label]) => ({ key, label }));
  downloadText(config.file, buildCsv(config.rows, columns), "text/csv;charset=utf-8");
  setNotice("data", `${config.file} 已开始下载。`);
  renderView();
}

function normalizeDataColumns(config) {
  return config.columns.map(([key, label]) => ({ key, label }));
}

function rowValue(row, key) {
  return text(row?.[key]).trim();
}

function hasKnownClass(className) {
  return !className || className === "待分班" || Boolean(getClass(className));
}

function hasKnownStudent(name) {
  return !name || appState.students.some((student) => student.name === name);
}

function dataIssueReasons(type, row) {
  const reasons = [];
  if (!row) return reasons;

  if (type === "students") {
    const phone = rowValue(row, "phone");
    if (!rowValue(row, "name")) reasons.push("缺学员姓名");
    if (!/^1\d{10}$/.test(phone)) reasons.push("手机号格式异常");
    if (!hasKnownClass(rowValue(row, "className"))) reasons.push("班级不存在");
    if (Number(row.balance || 0) > 0 && Number(row.balance || 0) <= 3) reasons.push("课时不足");
    if (Number(row.debt || 0) > 0) reasons.push("存在欠费");
  }

  if (type === "orders") {
    const remaining = Number(row.bought || 0) + Number(row.gift || 0) - Number(row.used || 0);
    if (!hasKnownStudent(rowValue(row, "student"))) reasons.push("学员不存在");
    if (!hasKnownClass(rowValue(row, "className"))) reasons.push("班级不存在");
    if (remaining < 0) reasons.push("已上超过购买课时");
    if (remaining >= 0 && remaining <= 3) reasons.push("订单余额偏低");
    if (Number(row.debt || 0) > 0) reasons.push("订单欠费");
  }

  if (type === "classes") {
    if (!rowValue(row, "course")) reasons.push("缺关联课程");
    if (!rowValue(row, "teacher")) reasons.push("缺默认教师");
    if (!rowValue(row, "room")) reasons.push("缺上课教室");
    if (Number(row.students || 0) > Number(row.capacity || 0)) reasons.push("人数超过容量");
  }

  if (["courses", "teachers", "rooms", "employees"].includes(type)) {
    if (!rowValue(row, "name")) reasons.push("缺名称");
    if (type === "courses" && Number(row.hours || 0) <= 0) reasons.push("标准课时异常");
    if (type === "rooms" && Number(row.capacity || 0) <= 0) reasons.push("容量异常");
    if (type === "teachers" && Number(row.weeklyHours || 0) <= 0) reasons.push("每周容量异常");
  }

  if (type === "lessons") {
    const sameTimeLessons = appState.lessons.filter((lesson) => lesson.id !== row.id && lesson.date === row.date && timeRangesOverlap(lesson.time, row.time));
    if (!rowValue(row, "date") || !rowValue(row, "time")) reasons.push("缺上课时间");
    if (!rowValue(row, "teacher")) reasons.push("缺教师");
    if (!rowValue(row, "room")) reasons.push("缺教室");
    if (row.status === "待上课" && row.date < todayIsoDate()) reasons.push("历史课节未处理");
    if (sameTimeLessons.some((lesson) => lesson.teacher === row.teacher || lesson.room === row.room || lesson.target === row.target)) reasons.push("存在时间冲突");
  }

  if (type === "payments") {
    if (!hasKnownStudent(rowValue(row, "student"))) reasons.push("学员不存在");
    if (Number(row.amount || 0) <= 0) reasons.push("收款金额异常");
  }

  if (type === "attendance" && !rowValue(row, "status")) reasons.push("缺考勤状态");
  if (type === "followUps" && ["待跟进", "逾期"].includes(rowValue(row, "status"))) reasons.push(rowValue(row, "status"));
  if (type === "scheduleConflicts" && rowValue(row, "status") !== "已处理") reasons.push("待处理冲突");

  return reasons;
}

function renderDataPreviewCell(value) {
  const cleanValue = text(value);
  const className = cleanValue.length > 70 || cleanValue.includes("\n") ? "data-preview-cell long" : "data-preview-cell";
  return `<div class="${className}">${escapeHtml(cleanValue || "-")}</div>`;
}

function dataPreviewRows(type, config, columns) {
  const keyword = dataPreviewSearchTerm.trim().toLowerCase();
  return config.rows
    .map((row) => ({ row, reasons: dataIssueReasons(type, row) }))
    .filter((item) => {
      if (dataPreviewOnlyIssues && !item.reasons.length) return false;
      if (!keyword) return true;
      const haystack = [
        ...columns.map((column) => rowValue(item.row, column.key)),
        ...item.reasons
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
}

function renderDataPreviewPanel(configs) {
  if (!configs[dataPreviewType]) dataPreviewType = Object.keys(configs)[0] || "students";
  const config = configs[dataPreviewType];
  const columns = normalizeDataColumns(config);
  const rows = dataPreviewRows(dataPreviewType, config, columns);
  const issueCount = config.rows.filter((row) => dataIssueReasons(dataPreviewType, row).length).length;
  const headers = ["数据提示", ...columns.map((column) => column.label)];
  const tableRows = rows.map((item) => `<tr>
    <td>${item.reasons.length ? tag(item.reasons.join("、"), "amber") : tag("正常", "green")}</td>
    ${columns.map((column) => `<td>${renderDataPreviewCell(item.row[column.key])}</td>`).join("")}
  </tr>`);

  return `
    <section class="section">
      <div class="section-head">
        <div>
          <h3>全量数据表</h3>
          <span class="muted">不用导出 Excel，也能在系统内核对每张业务表。</span>
        </div>
        <span>${tag(`${rows.length}/${config.rows.length} 行`, issueCount ? "amber" : "green")}</span>
      </div>
      <div class="section-body">
        <div class="filters data-preview-toolbar">
          <select id="dataPreviewType" aria-label="选择数据表">
            ${Object.entries(configs)
              .map(([type, item]) => `<option value="${type}" ${type === dataPreviewType ? "selected" : ""}>${escapeHtml(item.file.replace(/\.csv$/, ""))}</option>`)
              .join("")}
          </select>
          <input id="dataPreviewSearch" value="${escapeHtml(dataPreviewSearchTerm)}" placeholder="在当前数据表内搜索" />
          <label class="check-row">
            <input id="dataPreviewIssues" type="checkbox" ${dataPreviewOnlyIssues ? "checked" : ""} />
            只看需要处理
          </label>
          <button class="small-button" type="button" data-export="${dataPreviewType}">导出当前表</button>
        </div>
        <div class="data-preview-table">${table(headers, tableRows)}</div>
      </div>
    </section>`;
}

function duplicatePhoneIssues() {
  const phones = new Map();
  for (const student of appState.students) {
    const phone = rowValue(student, "phone");
    if (!phone) continue;
    if (!phones.has(phone)) phones.set(phone, []);
    phones.get(phone).push(student.name);
  }
  return [...phones.entries()].filter(([, names]) => names.length > 1);
}

function renderDataQualityPanel(configs) {
  const tableIssues = Object.entries(configs)
    .map(([type, config]) => ({
      type,
      title: config.file.replace(/\.csv$/, ""),
      count: config.rows.filter((row) => dataIssueReasons(type, row).length).length,
      total: config.rows.length
    }))
    .filter((item) => item.count > 0);
  const duplicatePhones = duplicatePhoneIssues();
  const allIssueCount = tableIssues.reduce((sum, item) => sum + item.count, 0) + duplicatePhones.length;
  const issueCards = [
    ...tableIssues.slice(0, 8).map((item) => `<div class="quality-card">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${tag(`${item.count} 行需处理`, "amber")}</span>
      <button class="small-button" type="button" data-preview-table="${item.type}">查看</button>
    </div>`),
    ...duplicatePhones.slice(0, 3).map(([phone, names]) => `<div class="quality-card">
      <strong>手机号重复</strong>
      <span class="muted">${escapeHtml(phone)}：${escapeHtml(names.join("、"))}</span>
      <button class="small-button" type="button" data-preview-table="students">查看学员</button>
    </div>`)
  ];

  return `
    <section class="section">
      <div class="section-head">
        <div>
          <h3>数据体检</h3>
          <span class="muted">自动标记欠费、课时不足、冲突、缺字段等常见运营风险。</span>
        </div>
        <span>${tag(allIssueCount ? `${allIssueCount} 项提醒` : "数据正常", allIssueCount ? "amber" : "green")}</span>
      </div>
      <div class="section-body">
        <div class="quality-grid">
          ${issueCards.join("") || `<div class="stack-item"><strong>暂无明显问题</strong><span class="muted">当前数据没有发现常见异常。</span></div>`}
        </div>
      </div>
    </section>`;
}

function exportBackup() {
  const payload = {
    app: "教务管理系统本地原型",
    version: 1,
    exportedAt: new Date().toISOString(),
    state: appState
  };
  const date = new Date().toISOString().slice(0, 10);
  downloadText(`教务管理系统备份-${date}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  setNotice("data", "完整备份已开始下载。");
  renderView();
}

function restoreBackupFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(reader.result);
      const nextState = parsed.state || parsed;
      appState = normalizeState(nextState);
      saveState();
      operationNotice = { view: "data", text: "备份已恢复，本地数据已更新。", tone: "green" };
      setView("data");
    } catch {
      setNotice("data", "备份文件无法读取，请确认是本系统导出的 JSON 文件。", "red");
      renderView();
    } finally {
      restoreFile.value = "";
    }
  });
  reader.readAsText(file, "utf-8");
}

function renderDataCenter() {
  if (typeof ensurePaymentData === "function") ensurePaymentData();
  if (typeof ensureStaffData === "function") ensureStaffData();
  if (typeof ensureFollowUpData === "function") ensureFollowUpData();
  const configs = dataCenterDatasetConfigs();
  const pendingLessons = appState.lessons.filter((lesson) => lesson.status === "待上课").length;
  const debtTotal = appState.orders.reduce((sum, order) => sum + Number(order.debt || 0), 0);
  const dataCards = Object.entries(configs).map(([type, config]) => [config.file.replace(/\.csv$/, ""), config.rows.length, type, `导出${config.file.replace(/\.csv$/, "")}`]);

  appContent.innerHTML = `
    <section class="section">
      <div class="section-head">
        <div>
          <h3>本地数据中心</h3>
          <span class="muted">数据保存在当前浏览器本地，可随时备份到文件。</span>
        </div>
        <div class="action-row">
          <button class="small-button" type="button" id="restoreData">恢复备份</button>
          <button class="primary-action" type="button" id="backupData">完整备份</button>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("data")}
        ${typeof renderImportPanel === "function" ? renderImportPanel() : ""}
        <div class="summary-grid compact-metrics">
          <div class="metric"><span>数据表数量</span><strong>${Object.keys(configs).length}</strong></div>
          <div class="metric"><span>待上课节</span><strong>${pendingLessons}</strong></div>
          <div class="metric"><span>待收欠费</span><strong>${money(debtTotal)}</strong></div>
          <div class="metric"><span>存储方式</span><strong>本地</strong></div>
        </div>
        <div class="data-grid">
          ${dataCards
            .map(
              ([title, count, type, action]) => `<article class="data-card">
                <div>
                  <span class="muted">${escapeHtml(title)}</span>
                  <strong>${count}</strong>
                </div>
                <button class="small-button" type="button" data-export="${type}">${escapeHtml(action)}</button>
              </article>`
            )
            .join("")}
        </div>
        <div class="stack-list data-help">
          <div class="stack-item">
            <strong>完整备份</strong>
            <span class="muted">导出 JSON 文件，适合每天收工后保存一份；恢复时会覆盖当前浏览器本地数据。</span>
          </div>
          <div class="stack-item">
            <strong>CSV 导出</strong>
            <span class="muted">导出的表格可以用 Excel 打开，用于对账、打印或交给其他老师核对。</span>
          </div>
        </div>
      </div>
    </section>
    ${renderDataQualityPanel(configs)}
    ${renderDataPreviewPanel(configs)}`;
}

document.addEventListener("click", (event) => {
  const exportButton = event.target.closest("[data-export]");
  if (exportButton) exportDataset(exportButton.dataset.export);

  if (event.target.id === "backupData") exportBackup();

  if (event.target.id === "restoreData") restoreFile.click();

  const previewButton = event.target.closest("[data-preview-table]");
  if (previewButton) {
    dataPreviewType = previewButton.dataset.previewTable;
    dataPreviewOnlyIssues = true;
    renderView();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "dataPreviewSearch") {
    const cursor = event.target.selectionStart || 0;
    dataPreviewSearchTerm = event.target.value;
    renderView();
    const input = document.querySelector("#dataPreviewSearch");
    input?.focus();
    input?.setSelectionRange(cursor, cursor);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "dataPreviewType") {
    dataPreviewType = event.target.value;
    renderView();
  }

  if (event.target.id === "dataPreviewIssues") {
    dataPreviewOnlyIssues = event.target.checked;
    renderView();
  }
});

restoreFile.addEventListener("change", (event) => {
  if (event.target.files?.[0]) restoreBackupFile(event.target.files[0]);
});

renderNav();
