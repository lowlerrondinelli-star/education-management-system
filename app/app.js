const storageKey = "edu-admin-local-prototype-v1";

const navItems = [
  { id: "dashboard", label: "运营总览", icon: "▦" },
  { id: "students", label: "学员", icon: "人" },
  { id: "orders", label: "订单课时", icon: "￥" },
  { id: "classes", label: "班级", icon: "班" },
  { id: "schedule", label: "课表", icon: "日" },
  { id: "consume", label: "消课", icon: "扣" },
  { id: "templates", label: "模板字段库", icon: "表" }
];

const viewMeta = {
  dashboard: ["运营总览", "今日校区"],
  students: ["学员管理", "学员档案"],
  orders: ["订单课时", "报名与余额"],
  classes: ["班级管理", "分班与容量"],
  schedule: ["排课管理", "本周课表"],
  consume: ["消课管理", "课时流水"],
  templates: ["导入导出", "Excel 模板字段库"]
};

let appState = loadState();
let currentView = "dashboard";
let searchTerm = "";
let excelPreview = null;
let selectedWorkbookIndex = 0;
let selectedSheetIndex = 0;

const appContent = document.querySelector("#appContent");
const viewTitle = document.querySelector("#viewTitle");
const viewEyebrow = document.querySelector("#viewEyebrow");
const navList = document.querySelector("#navList");
const globalSearch = document.querySelector("#globalSearch");
const studentDialog = document.querySelector("#studentDialog");
const studentForm = document.querySelector("#studentForm");

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(window.seedData);
  try {
    return { ...structuredClone(window.seedData), ...JSON.parse(saved) };
  } catch {
    return structuredClone(window.seedData);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(appState));
}

function text(value) {
  return String(value ?? "");
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return Number(value).toLocaleString("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
}

function tag(label, tone = "") {
  return `<span class="tag ${tone}">${escapeHtml(label)}</span>`;
}

function statusTone(value) {
  if (["已报名", "开课中", "已上课", "消课"].includes(value)) return "green";
  if (["意向", "招生中", "待上课"].includes(value)) return "amber";
  if (["欠费", "课时不足"].includes(value)) return "red";
  return "";
}

function matchesRow(row) {
  if (!searchTerm) return true;
  const haystack = Object.values(row).join(" ").toLowerCase();
  return haystack.includes(searchTerm.toLowerCase());
}

function renderNav() {
  const counts = {
    dashboard: "",
    students: appState.students.length,
    orders: appState.orders.length,
    classes: appState.classes.length,
    schedule: appState.lessons.length,
    consume: appState.ledger.length,
    templates: appState.templates.length
  };

  navList.innerHTML = navItems
    .map(
      (item) => `
      <button class="nav-button" type="button" data-view="${item.id}" aria-current="${currentView === item.id ? "page" : "false"}">
        <span aria-hidden="true">${item.icon}</span>
        <span>${item.label}</span>
        <span class="nav-count">${counts[item.id] ?? ""}</span>
      </button>`
    )
    .join("");
}

function setView(view) {
  currentView = view;
  const [eyebrow, title] = viewMeta[view];
  viewEyebrow.textContent = eyebrow;
  viewTitle.textContent = title;
  renderNav();
  renderView();
}

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.join("") || `<tr><td colspan="${headers.length}">没有匹配数据</td></tr>`}</tbody>
      </table>
    </div>`;
}

function renderDashboard() {
  const debtTotal = appState.orders.reduce((sum, order) => sum + Number(order.debt || 0), 0);
  const lowBalance = appState.students.filter((student) => Number(student.balance) > 0 && Number(student.balance) <= 3).length;
  const pendingLessons = appState.lessons.filter((lesson) => lesson.status === "待上课").length;
  const activeClasses = appState.classes.filter((item) => item.status === "开课中").length;

  const lessonRows = appState.lessons
    .filter((lesson) => lesson.status === "待上课")
    .slice(0, 5)
    .map(
      (lesson) => `<tr>
        <td>${escapeHtml(lesson.date)}</td>
        <td>${escapeHtml(lesson.time)}</td>
        <td>${escapeHtml(lesson.target)}</td>
        <td>${escapeHtml(lesson.teacher)}</td>
        <td>${escapeHtml(lesson.room)}</td>
      </tr>`
    );

  const reminders = [
    ...appState.students.filter((student) => student.debt > 0).map((student) => ({ title: `${student.name} 有欠费`, detail: `${money(student.debt)}，跟进人：${student.owner}`, tone: "red" })),
    ...appState.students.filter((student) => student.balance > 0 && student.balance <= 3).map((student) => ({ title: `${student.name} 课时不足`, detail: `剩余 ${student.balance} 课时，建议提醒续费`, tone: "amber" })),
    { title: "导入前校验", detail: "手机号、日期、课时、金额、字典值必须先检查", tone: "" }
  ];

  appContent.innerHTML = `
    <div class="summary-grid">
      <div class="metric"><span>学员总数</span><strong>${appState.students.length}</strong></div>
      <div class="metric"><span>待上课节</span><strong>${pendingLessons}</strong></div>
      <div class="metric"><span>开课班级</span><strong>${activeClasses}</strong></div>
      <div class="metric"><span>待收欠费</span><strong>${money(debtTotal)}</strong></div>
    </div>
    <div class="layout-two">
      <section class="section">
        <div class="section-head"><h3>待处理课表</h3><button class="small-button" data-go="schedule" type="button">查看课表</button></div>
        <div class="section-body">${table(["日期", "时间", "班级/1对1", "教师", "教室"], lessonRows)}</div>
      </section>
      <section class="section">
        <div class="section-head"><h3>运营提醒</h3><span>${tag(`${lowBalance} 个课时不足`, lowBalance ? "amber" : "green")}</span></div>
        <div class="section-body stack-list">
          ${reminders.map((item) => `<div class="stack-item"><strong>${tag(item.title, item.tone)}</strong><span class="muted">${escapeHtml(item.detail)}</span></div>`).join("")}
        </div>
      </section>
    </div>`;
}

function renderStudents() {
  const rows = appState.students
    .filter(matchesRow)
    .map(
      (student) => `<tr>
        <td><strong>${escapeHtml(student.name)}</strong><br><span class="muted">${escapeHtml(student.id)}</span></td>
        <td>${escapeHtml(student.phone)}<br><span class="muted">${escapeHtml(student.relation)}</span></td>
        <td>${escapeHtml(student.grade)}</td>
        <td>${escapeHtml(student.school)}</td>
        <td>${escapeHtml(student.channel)}</td>
        <td>${escapeHtml(student.course)}</td>
        <td>${escapeHtml(student.className)}</td>
        <td>${tag(student.status, statusTone(student.status))}</td>
        <td>${student.balance}</td>
        <td>${student.debt ? tag(money(student.debt), "red") : tag("无欠费", "green")}</td>
      </tr>`
    );

  appContent.innerHTML = `
    <section class="section">
      <div class="section-head">
        <h3>学员列表</h3>
        <div class="action-row">
          <button class="small-button" type="button" id="resetDemo">恢复演示数据</button>
          <button class="primary-action" type="button" id="newStudentInline">新增学员</button>
        </div>
      </div>
      <div class="section-body">
        ${table(["学员", "手机号", "年级", "学校", "渠道", "意向/报读课程", "班级", "状态", "剩余课时", "欠费"], rows)}
      </div>
    </section>`;
}

function renderOrders() {
  const rows = appState.orders
    .filter(matchesRow)
    .map((order) => {
      const balance = Number(order.bought) + Number(order.gift) - Number(order.used);
      return `<tr>
        <td><strong>${escapeHtml(order.id)}</strong><br><span class="muted">${escapeHtml(order.owner)}</span></td>
        <td>${escapeHtml(order.student)}</td>
        <td>${escapeHtml(order.course)}</td>
        <td>${escapeHtml(order.className)}</td>
        <td>${order.bought} + ${order.gift}</td>
        <td>${order.used}</td>
        <td>${tag(balance, balance <= 3 ? "amber" : "green")}</td>
        <td>${money(order.paid)}</td>
        <td>${order.debt ? tag(money(order.debt), "red") : tag("无", "green")}</td>
        <td>${escapeHtml(order.expireAt)}</td>
      </tr>`;
    });

  appContent.innerHTML = `
    <section class="section">
      <div class="section-head"><h3>报名订单与课时账户</h3><span class="muted">余额 = 购买 + 赠送 - 已上</span></div>
      <div class="section-body">${table(["订单号", "学员", "课程", "班级", "购买+赠送", "已上", "余额", "实收", "欠费", "有效期"], rows)}</div>
    </section>`;
}

function renderClasses() {
  const rows = appState.classes
    .filter(matchesRow)
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${escapeHtml(item.stage)}</span></td>
        <td>${escapeHtml(item.course)}</td>
        <td>${escapeHtml(item.teacher)}</td>
        <td>${escapeHtml(item.assistant)}</td>
        <td>${escapeHtml(item.room)}</td>
        <td>${item.students}/${item.capacity}</td>
        <td>${item.deduct}</td>
        <td>${item.teacherHours}</td>
        <td>${tag(item.status, statusTone(item.status))}</td>
      </tr>`
    );

  appContent.innerHTML = `
    <section class="section">
      <div class="section-head"><h3>班级与容量</h3><span class="muted">支持普通课程和组合课程</span></div>
      <div class="section-body">${table(["班级", "关联课程", "教师", "助教", "教室", "人数", "学生扣课", "教师课时", "状态"], rows)}</div>
    </section>`;
}

function renderSchedule() {
  const days = ["周一", "周二", "周三", "周四", "周五"];
  appContent.innerHTML = `
    <section class="section">
      <div class="section-head">
        <h3>本周课表</h3>
        <span class="muted">班级课与 1 对 1 共用冲突视图</span>
      </div>
      <div class="section-body">
        <div class="board">
          ${days
            .map((day) => {
              const lessons = appState.lessons.filter((lesson) => lesson.day === day && matchesRow(lesson));
              return `<div class="day-column">
                <div class="day-head">${day}</div>
                ${lessons
                  .map(
                    (lesson) => `<article class="lesson-card ${lesson.status === "已上课" ? "done" : ""}">
                      <strong>${escapeHtml(lesson.time)} ${tag(lesson.status, statusTone(lesson.status))}</strong>
                      <span>${escapeHtml(lesson.target)}</span>
                      <span class="muted">${escapeHtml(lesson.subject)} / ${escapeHtml(lesson.teacher)}</span>
                      <span class="muted">${escapeHtml(lesson.room)}</span>
                      <button class="small-button" type="button" data-finish-lesson="${lesson.id}">确认上课</button>
                    </article>`
                  )
                  .join("") || `<div class="lesson-card"><span class="muted">暂无课程</span></div>`}
              </div>`;
            })
            .join("")}
        </div>
      </div>
    </section>`;
}

function renderConsume() {
  const rows = appState.ledger
    .filter(matchesRow)
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.time)}</td>
        <td>${escapeHtml(item.student)}</td>
        <td>${escapeHtml(item.lesson)}</td>
        <td>${tag(item.type, statusTone(item.type))}</td>
        <td>${item.change}</td>
        <td>${item.before}</td>
        <td>${item.after}</td>
        <td>${escapeHtml(item.operator)}</td>
      </tr>`
    );

  appContent.innerHTML = `
    <section class="section">
      <div class="section-head"><h3>课时流水</h3><span class="muted">每次消课必须可追溯</span></div>
      <div class="section-body">${table(["时间", "学员", "关联课节", "类型", "变动", "变动前", "变动后", "操作人"], rows)}</div>
    </section>`;
}

function renderTemplates() {
  const preview = renderExcelPreview();
  appContent.innerHTML = `
    ${preview}
    <section class="section">
      <div class="section-head">
        <h3>Excel 模板字段库</h3>
        <span class="muted">星号字段为必填项</span>
      </div>
      <div class="section-body">
        <div class="template-grid">
          ${appState.templates
            .filter(matchesRow)
            .map(
              (template) => `<article class="template-card">
                <div>
                  <strong>${escapeHtml(template.name)}</strong>
                  <p class="muted">${escapeHtml(template.file)}</p>
                </div>
                <div class="field-list">
                  ${template.fields
                    .map((field) => `<span class="field-pill ${field.startsWith("*") ? "required" : ""}">${escapeHtml(field)}</span>`)
                    .join("")}
                </div>
                <div class="stack-list">
                  ${template.rules.map((rule) => `<span class="muted">· ${escapeHtml(rule)}</span>`).join("")}
                </div>
              </article>`
            )
            .join("")}
        </div>
      </div>
    </section>`;
}

function renderCellValue(value) {
  const cleanValue = text(value);
  const className = cleanValue.length > 80 || cleanValue.includes("\n") ? "excel-cell excel-cell-long" : "excel-cell";
  return `<div class="${className}">${escapeHtml(cleanValue)}</div>`;
}

function extractSheetNotes(sheet) {
  const notes = [];
  for (const row of sheet.rows || []) {
    for (const cell of row.cells || []) {
      const value = text(cell.value);
      const isInstruction = value.includes("导入提示") || value.includes("填写规范") || value.includes("其他注意") || value.length > 120;
      if (isInstruction) {
        notes.push({ row: row.row, column: cell.column, value });
      }
    }
  }
  return notes.slice(0, 4);
}

function renderWorkbookStats(book, sheet) {
  const requiredCount = (sheet.requiredFields || []).length;
  const sheetCount = (book.sheets || []).length;
  return `
    <div class="excel-stats">
      <div><span>工作表</span><strong>${sheetCount}</strong></div>
      <div><span>已用区域</span><strong>${sheet.usedRows || 0} × ${sheet.usedCols || 0}</strong></div>
      <div><span>捕获区域</span><strong>${sheet.capturedRows || 0} × ${sheet.capturedCols || 0}</strong></div>
      <div><span>必填字段</span><strong>${requiredCount}</strong></div>
    </div>`;
}

function renderExcelPreview() {
  if (!excelPreview) {
    return `
      <section class="section">
        <div class="section-head">
          <h3>真实模板预览</h3>
          <span class="muted">正在读取 app/excel-data.json</span>
        </div>
        <div class="section-body">
          <div class="stack-item">
            <strong>等待模板数据</strong>
            <span class="muted">如果这里一直没有数据，请先运行“启动本地原型.bat”生成 Excel 预览文件。</span>
          </div>
        </div>
      </section>`;
  }

  const books = excelPreview.workbooks || [];
  if (!books.length) {
    return `
      <section class="section">
        <div class="section-head">
          <h3>真实模板预览</h3>
          <span class="muted">未发现工作簿</span>
        </div>
        <div class="section-body">
          <div class="stack-item">
            <strong>没有读取到 Excel 文件</strong>
            <span class="muted">请确认模板目录存在：${escapeHtml(excelPreview.sourceDir || "")}</span>
          </div>
        </div>
      </section>`;
  }

  selectedWorkbookIndex = Math.min(selectedWorkbookIndex, books.length - 1);
  const book = books[selectedWorkbookIndex];
  const sheets = book.sheets || [];
  selectedSheetIndex = Math.min(selectedSheetIndex, Math.max(sheets.length - 1, 0));
  const sheet = sheets[selectedSheetIndex] || { headers: [], rows: [] };
  const visibleCols = Array.from({ length: sheet.capturedCols || sheet.usedCols || 8 }, (_, index) => index + 1);
  const rows = (sheet.rows || []).map((row) => {
    const cells = new Map((row.cells || []).map((cell) => [cell.column, cell.value]));
    return `<tr><td class="row-number">${row.row}</td>${visibleCols.map((col) => `<td>${renderCellValue(cells.get(col) || "")}</td>`).join("")}</tr>`;
  });
  const visibleHeaders = visibleCols.map((col) => `列${col}`);
  const fieldRows = (sheet.headers || []).map(
    (field) => `<tr>
      <td>${field.column}</td>
      <td>${field.required ? tag(field.name, "red") : escapeHtml(field.name)}</td>
      <td>${field.required ? "必填" : "选填"}</td>
    </tr>`
  );
  const notes = extractSheetNotes(sheet);
  const noteCards = notes.map(
    (note) => `<div class="stack-item">
      <strong>第 ${note.row} 行 / 第 ${note.column} 列</strong>
      <pre>${escapeHtml(note.value)}</pre>
    </div>`
  );

  return `
    <section class="section">
      <div class="section-head">
        <div>
          <h3>真实模板预览</h3>
          <span class="muted">来源：${escapeHtml(excelPreview.sourceDir || "")}；生成时间：${escapeHtml(excelPreview.generatedAt || "")}</span>
        </div>
        <span>${tag(`${books.length} 个工作簿`, "green")}</span>
      </div>
      <div class="section-body">
        <div class="filters">
          <select id="workbookSelect" aria-label="选择工作簿">
            ${books.map((item, index) => `<option value="${index}" ${index === selectedWorkbookIndex ? "selected" : ""}>${escapeHtml(item.fileName)}</option>`).join("")}
          </select>
          <select id="sheetSelect" aria-label="选择工作表">
            ${sheets.map((item, index) => `<option value="${index}" ${index === selectedSheetIndex ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
          </select>
        </div>
        ${renderWorkbookStats(book, sheet)}
        <div class="layout-two">
          <div>
            <div class="section-head compact-head">
              <h3>${escapeHtml(sheet.name || "工作表")}</h3>
              <span class="muted">完整展示 ${visibleCols.length} 列，${(sheet.rows || []).length} 个非空行</span>
            </div>
            <div class="excel-grid">${table(["行号", ...visibleHeaders], rows)}</div>
          </div>
          <div>
            <div class="section-head compact-head">
              <h3>字段识别</h3>
              <span class="muted">${(sheet.requiredFields || []).length} 个必填字段</span>
            </div>
            ${table(["列", "字段", "规则"], fieldRows)}
          </div>
        </div>
        <div class="section-head compact-head note-head">
          <h3>填写说明</h3>
          <span class="muted">${notes.length ? "已提取长文本说明" : "当前工作表没有明显说明文本"}</span>
        </div>
        <div class="excel-notes">${noteCards.join("") || `<div class="stack-item"><span class="muted">暂无填写说明。</span></div>`}</div>
      </div>
    </section>`;
}

async function loadExcelPreview() {
  try {
    const response = await fetch("./excel-data.json", { cache: "no-store" });
    if (!response.ok) return;
    excelPreview = await response.json();
    if (currentView === "templates") renderView();
  } catch {
    excelPreview = { workbooks: [] };
  }
}

function renderView() {
  if (currentView === "dashboard") renderDashboard();
  if (currentView === "students") renderStudents();
  if (currentView === "orders") renderOrders();
  if (currentView === "classes") renderClasses();
  if (currentView === "schedule") renderSchedule();
  if (currentView === "consume") renderConsume();
  if (currentView === "templates") renderTemplates();
}

function addStudent(formData) {
  const nextNumber = appState.students.length + 1;
  const student = {
    id: `S${String(nextNumber).padStart(3, "0")}`,
    name: formData.get("name").trim(),
    phone: formData.get("phone").trim(),
    relation: "母亲",
    grade: formData.get("grade").trim(),
    school: "",
    channel: formData.get("channel").trim(),
    owner: formData.get("owner").trim(),
    course: formData.get("course").trim(),
    className: "待分班",
    status: "意向",
    balance: 0,
    debt: 0
  };
  appState.students.unshift(student);
  saveState();
  setView("students");
}

function finishLesson(lessonId) {
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson || lesson.status === "已上课") return;
  lesson.status = "已上课";
  const relatedStudent = appState.students.find((student) => student.className === lesson.target && student.balance > 0);
  if (relatedStudent) {
    const before = Number(relatedStudent.balance);
    relatedStudent.balance = Math.max(0, before - 1);
    appState.ledger.unshift({
      id: `C${Date.now()}`,
      student: relatedStudent.name,
      lesson: `${lesson.target} ${lesson.date}`,
      type: "消课",
      change: -1,
      before,
      after: relatedStudent.balance,
      operator: lesson.teacher,
      time: new Date().toLocaleString("zh-CN", { hour12: false })
    });
  }
  saveState();
  renderView();
  renderNav();
}

document.addEventListener("click", (event) => {
  const navButton = event.target.closest("[data-view]");
  if (navButton) setView(navButton.dataset.view);

  const goButton = event.target.closest("[data-go]");
  if (goButton) setView(goButton.dataset.go);

  const finishButton = event.target.closest("[data-finish-lesson]");
  if (finishButton) finishLesson(finishButton.dataset.finishLesson);

  if (event.target.id === "newStudentInline" || event.target.id === "newStudentBtn") {
    studentDialog.showModal();
  }

  if (event.target.id === "resetDemo") {
    localStorage.removeItem(storageKey);
    appState = structuredClone(window.seedData);
    renderNav();
    renderView();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "workbookSelect") {
    selectedWorkbookIndex = Number(event.target.value);
    selectedSheetIndex = 0;
    renderView();
  }

  if (event.target.id === "sheetSelect") {
    selectedSheetIndex = Number(event.target.value);
    renderView();
  }
});

globalSearch.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim();
  renderView();
});

studentForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!studentForm.reportValidity()) return;
  addStudent(new FormData(studentForm));
  studentForm.reset();
  studentDialog.close();
});

renderNav();
setView("dashboard");
loadExcelPreview();
