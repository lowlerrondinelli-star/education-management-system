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

function exportDataset(type) {
  const configs = {
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
  const config = configs[type];
  if (!config) return;
  const columns = config.columns.map(([key, label]) => ({ key, label }));
  downloadText(config.file, buildCsv(config.rows, columns), "text/csv;charset=utf-8");
  setNotice("data", `${config.file} 已开始下载。`);
  renderView();
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
  const pendingLessons = appState.lessons.filter((lesson) => lesson.status === "待上课").length;
  const debtTotal = appState.orders.reduce((sum, order) => sum + Number(order.debt || 0), 0);
  const dataCards = [
    ["学员档案", appState.students.length, "students", "导出学员"],
    ["订单课时", appState.orders.length, "orders", "导出订单"],
    ["班级列表", appState.classes.length, "classes", "导出班级"],
    ["课程资料", appState.courses?.length || 0, "courses", "导出课程"],
    ["教师资料", appState.teachers?.length || 0, "teachers", "导出教师"],
    ["教室资料", appState.rooms?.length || 0, "rooms", "导出教室"],
    ["员工资料", appState.employees?.length || 0, "employees", "导出员工"],
    ["角色权限", appState.roles?.length || 0, "roles", "导出角色"],
    ["点名考勤", appState.attendance?.length || 0, "attendance", "导出考勤"],
    ["收款流水", appState.payments?.length || 0, "payments", "导出收款"],
    ["课表课节", appState.lessons.length, "lessons", "导出课表"],
    ["消课流水", appState.ledger.length, "ledger", "导出流水"]
  ];

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
          <div class="metric"><span>数据表数量</span><strong>12</strong></div>
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
    </section>`;
}

document.addEventListener("click", (event) => {
  const exportButton = event.target.closest("[data-export]");
  if (exportButton) exportDataset(exportButton.dataset.export);

  if (event.target.id === "backupData") exportBackup();

  if (event.target.id === "restoreData") restoreFile.click();
});

restoreFile.addEventListener("change", (event) => {
  if (event.target.files?.[0]) restoreBackupFile(event.target.files[0]);
});

renderNav();
