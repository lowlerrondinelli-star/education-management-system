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
let selectedStudentForOrder = "";
let selectedStudentForClass = "";
let operationNotice = null;

const appContent = document.querySelector("#appContent");
const viewTitle = document.querySelector("#viewTitle");
const viewEyebrow = document.querySelector("#viewEyebrow");
const navList = document.querySelector("#navList");
const globalSearch = document.querySelector("#globalSearch");
const studentDialog = document.querySelector("#studentDialog");
const studentForm = document.querySelector("#studentForm");

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return normalizeState(structuredClone(window.seedData));
  try {
    return normalizeState({ ...structuredClone(window.seedData), ...JSON.parse(saved) });
  } catch {
    return normalizeState(structuredClone(window.seedData));
  }
}

function normalizeState(state) {
  const next = { ...structuredClone(window.seedData), ...state };
  for (const key of ["students", "orders", "classes", "lessons", "ledger", "templates"]) {
    if (!Array.isArray(next[key])) next[key] = [];
  }

  const classNames = new Set(next.classes.map((item) => item.name));
  for (const seedClass of window.seedData.classes || []) {
    if (!classNames.has(seedClass.name)) next.classes.push(structuredClone(seedClass));
  }
  return next;
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

function setNotice(view, textValue, tone = "green") {
  operationNotice = { view, text: textValue, tone };
}

function renderNotice(view) {
  if (!operationNotice || operationNotice.view !== view) return "";
  return `<div class="notice ${operationNotice.tone}">${escapeHtml(operationNotice.text)}</div>`;
}

function numberFromForm(formData, name, fallback = 0) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function nextId(prefix) {
  return `${prefix}${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`;
}

function classOptions(selectedName = "") {
  return appState.classes
    .map((item) => `<option value="${escapeHtml(item.name)}" ${item.name === selectedName ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
}

function studentOptions(selectedId = "") {
  return appState.students
    .map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}（${escapeHtml(item.grade)}）</option>`)
    .join("");
}

function courseOptions(selectedName = "") {
  const values = [
    ...(appState.courses || []).map((item) => item.name),
    ...appState.classes.map((item) => item.course),
    ...appState.students.map((item) => item.course)
  ]
    .map((item) => text(item).trim())
    .filter(Boolean);
  if (selectedName && !values.includes(selectedName)) values.unshift(selectedName);
  return [...new Set(values)]
    .map((value) => `<option value="${escapeHtml(value)}" ${value === selectedName ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function choiceOptions(values, selectedValue = "") {
  const normalized = values.map((item) => text(item).trim()).filter(Boolean);
  if (selectedValue && !normalized.includes(selectedValue)) normalized.unshift(selectedValue);
  return [...new Set(normalized)]
    .map((value) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function gradeChoiceOptions(selectedValue = "初二年级") {
  return choiceOptions(
    [
      "一年级",
      "二年级",
      "三年级",
      "四年级",
      "五年级",
      "六年级",
      "初一年级",
      "初二年级",
      "初三年级",
      "高一年级",
      "高二年级",
      "高三年级",
      ...(appState.students || []).map((item) => item.grade),
      ...(appState.courses || []).map((item) => item.grade),
      ...(appState.leads || []).map((item) => item.grade)
    ],
    selectedValue
  );
}

function channelChoiceOptions(selectedValue = "转介绍") {
  return choiceOptions(
    [
      "转介绍",
      "入学测评",
      "抖音直连",
      "小红书直连",
      "招生表单",
      "老师介绍",
      "到店咨询",
      ...(appState.students || []).map((item) => item.channel),
      ...(appState.leads || []).map((item) => item.channel)
    ],
    selectedValue
  );
}

function ownerChoiceOptions(selectedValue = "前台老师") {
  return choiceOptions(
    [
      "前台老师",
      ...(appState.employees || []).map((item) => item.name),
      ...(appState.teachers || []).map((item) => item.name),
      ...(appState.students || []).map((item) => item.owner),
      ...(appState.leads || []).map((item) => item.owner)
    ],
    selectedValue
  );
}

function operatorChoiceOptions(selectedValue = "前台老师") {
  return choiceOptions(
    [
      "前台老师",
      "教务老师",
      "校区校长",
      "财务老师",
      ...(appState.employees || []).map((item) => item.name),
      ...(appState.teachers || []).map((item) => item.name),
      ...(appState.students || []).map((item) => item.owner),
      ...(appState.leads || []).map((item) => item.owner)
    ],
    selectedValue
  );
}

function leaveContactOptions(selectedValue = "家长") {
  return choiceOptions(["家长", "妈妈", "爸爸", "学生本人", "老师代登记", "前台代登记"], selectedValue);
}

function leaveReasonOptions(selectedValue = "家长请假，需后续安排补课") {
  return choiceOptions(
    [
      "家长请假，需后续安排补课",
      "学生生病，需请假补课",
      "学校活动冲突，需改期补课",
      "临时家庭安排，待家长确认补课时间",
      "交通/天气原因无法到课",
      "迟到转请假，本节不消课",
      "其他原因，线下备注"
    ],
    selectedValue
  );
}

function scheduleReasonOptions(kind = "reschedule", selectedValue = "") {
  const defaults = {
    reschedule: "临时调整",
    cancel: "学生请假或老师临时调整",
    makeup: "安排补课"
  };
  return choiceOptions(
    [
      defaults[kind] || defaults.reschedule,
      "学生请假或老师临时调整",
      "老师时间冲突，调整课节",
      "教室冲突，调整上课地点",
      "家长要求改期",
      "节假日/校区活动调整",
      "补课安排",
      "其他原因，线下备注"
    ],
    selectedValue || defaults[kind] || defaults.reschedule
  );
}

function followUpNoteOptions(selectedValue = "家长约定周五补缴") {
  return choiceOptions(
    [
      "家长约定周五补缴",
      "已电话沟通，等待家长确认",
      "需要安排试听后再确认报名",
      "课时不足，提醒尽快续费",
      "欠费未缴，需再次提醒",
      "高风险反馈，需校区负责人跟进",
      "家长暂未回复，明天继续联系",
      "其他情况，线下备注"
    ],
    selectedValue
  );
}

function leadNoteOptions(selectedValue = "家长想先试听，关注价格和上课时间。") {
  return choiceOptions(
    [
      "家长想先试听，关注价格和上课时间。",
      "家长关注班型和上课时间，需电话回访。",
      "同学家长介绍，建议优先安排测评。",
      "家长比价中，需同步课程优势和优惠政策。",
      "学生基础薄弱，建议先做入学测评。",
      "高意向咨询，建议当天邀约试听。",
      "暂未接通，明天继续联系。",
      "其他招生备注，线下补充。"
    ],
    selectedValue
  );
}

function leadTrialNoteOptions(selectedValue = "招生试听课，试听后回访报名意向") {
  return choiceOptions(
    [
      "招生试听课，试听后回访报名意向",
      "试听后确认适合班型和上课时间",
      "试听后同步报价和优惠政策",
      "试听后安排学习测评和分班建议",
      "家长需试听后再决定是否报名",
      "试听课后当天电话回访",
      "其他试听备注，线下补充"
    ],
    selectedValue
  );
}

function paymentAccountOptions(selectedValue = "校区收款账户") {
  return choiceOptions(["校区收款账户", "对公账户", "微信收款码", "支付宝收款码", "现金账户", "其他账户"], selectedValue);
}

function paymentNoteOptions(selectedValue = "欠费补缴") {
  return choiceOptions(["欠费补缴", "家长补齐尾款", "分期补缴", "线下收款已核对", "财务复核后入账", "其他收款备注"], selectedValue);
}

function financeReasonOptions(kind = "refund", selectedValue = "") {
  const defaults = {
    refund: "家长退费，扣减剩余课时",
    hours: "人工课时调整",
    void: "误建订单，未开始上课，作废处理"
  };
  return choiceOptions(
    [
      defaults[kind] || defaults.refund,
      "家长退费，扣减剩余课时",
      "误建订单，未开始上课，作废处理",
      "人工课时调整",
      "赠课补录，增加可用课时",
      "消课核对异常，修正剩余课时",
      "报名信息录入错误，需财务调整",
      "家长转班/停课，按协议处理",
      "其他财务原因，线下备注"
    ],
    selectedValue || defaults[kind] || defaults.refund
  );
}

function employeeDepartmentOptions(selectedValue = "教务部") {
  return choiceOptions(
    [
      "教务部",
      "教学部",
      "招生前台",
      "财务部",
      "校区管理",
      "市场部",
      "校长室",
      ...(appState.employees || []).map((item) => item.department)
    ],
    selectedValue
  );
}

function staffSubjectOptions(selectedValue = "数学") {
  return choiceOptions(
    [
      "数学",
      "语文",
      "英语",
      "物理",
      "化学",
      "数学、物理",
      "语文、英语",
      "全科托管",
      ...(appState.teachers || []).map((item) => item.subjects),
      ...(appState.employees || []).map((item) => item.subjects),
      ...(appState.courses || []).map((item) => item.subject)
    ],
    selectedValue
  );
}

function staffGradeOptions(selectedValue = "初中") {
  return choiceOptions(
    [
      "小学",
      "初中",
      "高中",
      "初中、高一",
      "高一、高二",
      "初一、初二、初三",
      "小初",
      ...(appState.teachers || []).map((item) => item.grades),
      ...(appState.employees || []).map((item) => item.grades),
      ...(appState.courses || []).map((item) => item.grade)
    ],
    selectedValue
  );
}

function campusChoiceOptions(selectedValue = "主校区") {
  return choiceOptions(
    [
      "主校区",
      "东校区",
      "西校区",
      "线上",
      "临时校区",
      ...(appState.rooms || []).map((item) => item.campus),
      ...(appState.classes || []).map((item) => (text(item.room).includes("线上") ? "线上" : "主校区")),
      ...(appState.employees || []).map((item) => item.campus)
    ],
    selectedValue
  );
}

function subjectChoiceOptions(selectedValue = "数学") {
  return choiceOptions(
    [
      "数学",
      "语文",
      "英语",
      "物理",
      "化学",
      ...(appState.courses || []).map((item) => item.subject),
      ...(appState.lessons || []).map((item) => item.subject)
    ],
    selectedValue
  );
}

function teacherChoiceOptions(selectedValue = "前台老师") {
  return choiceOptions(
    [
      "前台老师",
      ...(appState.teachers || []).map((item) => item.name),
      ...(appState.employees || [])
        .filter((item) => item.isTeacher === "是" || text(item.roles).includes("教师") || text(item.role).includes("教师"))
        .map((item) => item.name),
      ...(appState.classes || []).map((item) => item.teacher),
      ...(appState.lessons || []).map((item) => item.teacher)
    ],
    selectedValue
  );
}

function roomChoiceOptions(selectedValue = "试听教室") {
  return choiceOptions(
    [
      "试听教室",
      ...(appState.rooms || []).map((item) => item.name),
      ...(appState.classes || []).map((item) => item.room),
      ...(appState.lessons || []).map((item) => item.room)
    ],
    selectedValue
  );
}

function refreshStudentFormChoices() {
  const gradeSelect = document.querySelector("#studentGradeSelect");
  const channelSelect = document.querySelector("#studentChannelSelect");
  const ownerSelect = document.querySelector("#studentOwnerSelect");
  const courseSelect = document.querySelector("#studentCourseSelect");
  if (gradeSelect) gradeSelect.innerHTML = gradeChoiceOptions(gradeSelect.value || "初二年级");
  if (channelSelect) channelSelect.innerHTML = channelChoiceOptions(channelSelect.value || "转介绍");
  if (ownerSelect) ownerSelect.innerHTML = ownerChoiceOptions(ownerSelect.value || "前台老师");
  if (courseSelect) courseSelect.innerHTML = courseOptions(courseSelect.value || "初二小组课/一对一");
}

function getClass(name) {
  return appState.classes.find((item) => item.name === name);
}

function syncClassCounts() {
  for (const classItem of appState.classes) {
    classItem.students = appState.students.filter((student) => student.className === classItem.name).length;
  }
}

function dayFromDate(dateValue) {
  const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const date = new Date(`${dateValue}T00:00:00`);
  return dayNames[date.getDay()] || "";
}

function parseTimeRange(range) {
  const [start, end] = text(range).split("-").map((part) => part.trim());
  const toMinutes = (value) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  return { start: toMinutes(start), end: toMinutes(end) };
}

function timeRangesOverlap(left, right) {
  const a = parseTimeRange(left);
  const b = parseTimeRange(right);
  if (![a.start, a.end, b.start, b.end].every(Number.isFinite)) return left === right;
  return a.start < b.end && b.start < a.end;
}

function findLessonConflicts(candidate) {
  return appState.lessons.filter((lesson) => {
    if (lesson.date !== candidate.date || !timeRangesOverlap(lesson.time, candidate.time)) return false;
    return lesson.teacher === candidate.teacher || lesson.room === candidate.room || lesson.target === candidate.target;
  });
}

function lessonDeduct(lesson) {
  const classItem = getClass(lesson.target);
  return Number(classItem?.deduct || lesson.deduct || 1);
}

function renderNav() {
  syncClassCounts();
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function lessonDateTime(lesson) {
  return new Date(`${lesson.date}T${text(lesson.time).slice(0, 5) || "00:00"}`);
}

function compareLessonTime(a, b) {
  return lessonDateTime(a) - lessonDateTime(b);
}

function dashboardTaskCard(title, detail, tone, action, goView) {
  return `<div class="dashboard-task">
    <div>
      <strong>${tag(title, tone)}</strong>
      <span class="muted">${escapeHtml(detail)}</span>
    </div>
    ${goView ? `<button class="small-button" type="button" data-go="${goView}">${escapeHtml(action)}</button>` : ""}
  </div>`;
}

function dashboardCanAccess(view) {
  return typeof canAccessView !== "function" || canAccessView(view);
}

function renderDashboard() {
  const debtTotal = appState.orders.reduce((sum, order) => sum + Number(order.debt || 0), 0);
  const lowBalance = appState.students.filter((student) => Number(student.balance) > 0 && Number(student.balance) <= 3).length;
  const pendingLessons = appState.lessons.filter((lesson) => lesson.status === "待上课").length;
  const activeClasses = appState.classes.filter((item) => item.status === "开课中").length;
  const today = todayIsoDate();
  const todayLessons = appState.lessons.filter((lesson) => lesson.date === today && lesson.status === "待上课").sort(compareLessonTime);
  const upcomingLessons = appState.lessons
    .filter((lesson) => lesson.status === "待上课" && lesson.date >= today)
    .sort(compareLessonTime);
  const nextLessons = (todayLessons.length ? todayLessons : upcomingLessons).slice(0, 6);
  const overdueLessons = appState.lessons.filter((lesson) => lesson.status === "待上课" && lesson.date < today).length;
  const unpaidStudents = appState.students.filter((student) => Number(student.debt || 0) > 0);
  const lowBalanceStudents = appState.students.filter((student) => Number(student.balance) > 0 && Number(student.balance) <= 3);
  const followUpCount = typeof flattenFollowUpRows === "function" ? flattenFollowUpRows().length : unpaidStudents.length + lowBalanceStudents.length;

  const lessonRows = nextLessons
    .map(
      (lesson) => `<tr>
        <td>${escapeHtml(lesson.date)}</td>
        <td>${escapeHtml(dayFromDate(lesson.date))}</td>
        <td>${escapeHtml(lesson.time)}</td>
        <td>${escapeHtml(lesson.target)}</td>
        <td>${escapeHtml(lesson.teacher)}</td>
        <td>${escapeHtml(lesson.room)}</td>
      </tr>`
    );

  const reminders = [
    ...unpaidStudents.map((student) => ({ title: `${student.name} 有欠费`, detail: `${money(student.debt)}，跟进人：${student.owner}`, tone: "red", go: "orders", action: "处理订单" })),
    ...lowBalanceStudents.map((student) => ({ title: `${student.name} 课时不足`, detail: `剩余 ${student.balance} 课时，建议提醒续费`, tone: "amber", go: "followUp", action: "去跟进" })),
    ...(overdueLessons ? [{ title: `${overdueLessons} 节课未处理`, detail: "存在早于今天但仍为待上课的课节，请核对是否需要补点名。", tone: "red", go: "schedule", action: "看课表" }] : []),
    { title: "导入前校验", detail: "手机号、日期、课时、金额、字典值必须先检查", tone: "", go: "data", action: "去导入" }
  ]
    .filter((item) => !item.go || dashboardCanAccess(item.go))
    .slice(0, 8);

  appContent.innerHTML = `
    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">今日工作台</p>
        <h3>先看课表，再处理欠费和课时不足。</h3>
        <span class="muted">适合前台、教务、老师打开系统后的第一屏。</span>
      </div>
      <div class="dashboard-actions">
        <button class="primary-action" type="button" data-go="students">学员建档</button>
        <button class="small-button" type="button" data-go="orders">报名收款</button>
        <button class="small-button" type="button" data-go="schedule">排课点名</button>
        <button class="small-button" type="button" data-go="leaves">请假补课</button>
      </div>
    </section>
    <div class="summary-grid dashboard-summary">
      <div class="metric"><span>今日待上</span><strong>${todayLessons.length}</strong><small>${pendingLessons} 节未完成</small></div>
      <div class="metric"><span>待办跟进</span><strong>${followUpCount}</strong><small>${lowBalance} 个课时不足</small></div>
      <div class="metric"><span>开课班级</span><strong>${activeClasses}</strong><small>${appState.classes.length} 个班级</small></div>
      <div class="metric"><span>待收欠费</span><strong>${money(debtTotal)}</strong><small>${unpaidStudents.length} 名学员</small></div>
    </div>
    <div class="layout-two">
      <section class="section">
        <div class="section-head">
          <div>
            <h3>${todayLessons.length ? "今日待上课表" : "最近待上课表"}</h3>
            <span class="muted">${todayLessons.length ? "按上课时间排序，方便老师点名。" : "今天没有待上课节，已显示未来最近课节。"}</span>
          </div>
          <button class="small-button" data-go="schedule" type="button">查看课表</button>
        </div>
        <div class="section-body">${table(["日期", "星期", "时间", "班级/1对1", "教师", "教室"], lessonRows)}</div>
      </section>
      <section class="section">
        <div class="section-head"><h3>待办提醒</h3><span>${tag(`${reminders.length} 项`, reminders.length ? "amber" : "green")}</span></div>
        <div class="section-body stack-list">
          ${reminders.map((item) => dashboardTaskCard(item.title, item.detail, item.tone, item.action, item.go)).join("") || `<div class="stack-item"><strong>暂无当前账号可处理提醒</strong><span class="muted">需要处理的教学事项会优先显示在上方统一待办。</span></div>`}
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
        <td>
          <div class="action-row">
            <button class="small-button" type="button" data-student-order="${student.id}">报名</button>
            <button class="small-button" type="button" data-student-class="${student.id}">分班</button>
          </div>
        </td>
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
        ${renderNotice("students")}
        ${table(["学员", "手机号", "年级", "学校", "渠道", "意向/报读课程", "班级", "状态", "剩余课时", "欠费", "操作"], rows)}
      </div>
    </section>`;
}

function renderOrderQuickForm() {
  const selectedStudent = appState.students.find((item) => item.id === selectedStudentForOrder);
  const defaultClass = getClass(selectedStudent?.className) || appState.classes[0] || {};
  return `
    <form class="operation-panel" id="orderForm">
      <div>
        <strong>快速报名</strong>
        <span class="muted">生成订单后同步更新学员状态、班级和课时余额。</span>
      </div>
      <div class="operation-grid">
        <label>学员<select name="studentId" required>${studentOptions(selectedStudentForOrder)}</select></label>
        <label>报读班级<select name="className" id="orderClassSelect" required>${classOptions(defaultClass.name)}</select></label>
        <label>报读课程<select name="course" id="orderCourseSelect" required>${courseOptions(defaultClass.course || selectedStudent?.course || "常规课程")}</select></label>
        <label>购买课时<input name="bought" type="number" min="0" step="0.5" value="20" required /></label>
        <label>赠送课时<input name="gift" type="number" min="0" step="0.5" value="0" /></label>
        <label>实收金额<input name="paid" type="number" min="0" step="1" value="2800" required /></label>
        <label>欠费金额<input name="debt" type="number" min="0" step="1" value="0" /></label>
        <label>有效期至<input name="expireAt" type="date" value="2027-02-28" required /></label>
      </div>
      <div class="dialog-actions">
        <span class="muted">默认收款方式：线下收款，可后续扩展。</span>
        <button class="primary-action" type="submit">确认报名</button>
      </div>
    </form>`;
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
      <div class="section-body">
        ${renderNotice("orders")}
        ${renderOrderQuickForm()}
        ${table(["订单号", "学员", "课程", "班级", "购买+赠送", "已上", "余额", "实收", "欠费", "有效期"], rows)}
      </div>
    </section>`;
}

function renderAssignPanel() {
  const selectedStudent = appState.students.find((item) => item.id === selectedStudentForClass);
  const defaultClassName = selectedStudent?.className || "";
  return `
    <form class="operation-panel" id="assignForm">
      <div>
        <strong>快速分班</strong>
        <span class="muted">适合前台把已报名或意向学员放入正式班级。</span>
      </div>
      <div class="operation-grid compact">
        <label>学员<select name="studentId" required>${studentOptions(selectedStudentForClass)}</select></label>
        <label>目标班级<select name="className" required>${classOptions(defaultClassName)}</select></label>
      </div>
      <div class="dialog-actions">
        <span class="muted">班级人数会按学员档案自动重算。</span>
        <button class="primary-action" type="submit">确认分班</button>
      </div>
    </form>`;
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
      <div class="section-body">
        ${renderNotice("classes")}
        ${renderAssignPanel()}
        ${table(["班级", "关联课程", "教师", "助教", "教室", "人数", "学生扣课", "教师课时", "状态"], rows)}
      </div>
    </section>`;
}

function renderLessonForm() {
  const defaultClass = appState.classes[0] || {};
  return `
    <form class="operation-panel" id="lessonForm">
      <div>
        <strong>新增课节</strong>
        <span class="muted">保存前会检查同一时间的老师、教室和班级冲突。</span>
      </div>
      <div class="operation-grid">
        <label>上课日期<input name="date" type="date" value="2026-09-07" required /></label>
        <label>开始时间<input name="startTime" type="time" value="18:30" required /></label>
        <label>结束时间<input name="endTime" type="time" value="20:00" required /></label>
        <label>班级/对象<select name="target" required>${classOptions(defaultClass.name)}</select></label>
        <label>科目<input name="subject" value="数学" required /></label>
        <label>上课教师<input name="teacher" value="${escapeHtml(defaultClass.teacher || "任课老师")}" required /></label>
        <label>上课教室<input name="room" value="${escapeHtml(defaultClass.room || "默认教室")}" required /></label>
        <label>课节类型<select name="type"><option>班级课</option><option>1对1</option></select></label>
      </div>
      <div class="dialog-actions">
        <span class="muted">确认上课后会自动扣除对应学员课时。</span>
        <button class="primary-action" type="submit">保存课节</button>
      </div>
    </form>`;
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
        ${renderNotice("schedule")}
        ${renderLessonForm()}
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

function enrollStudent(formData) {
  const student = appState.students.find((item) => item.id === formData.get("studentId"));
  const classItem = getClass(formData.get("className"));
  if (!student || !classItem) return;

  const bought = numberFromForm(formData, "bought");
  const gift = numberFromForm(formData, "gift");
  const paid = numberFromForm(formData, "paid");
  const debt = numberFromForm(formData, "debt");
  const course = text(formData.get("course")).trim() || classItem.course;
  const className = classItem.name;

  appState.orders.unshift({
    id: nextId("O"),
    student: student.name,
    course,
    className,
    bought,
    gift,
    used: 0,
    paid,
    debt,
    payMethod: "线下收款",
    expireAt: text(formData.get("expireAt")),
    owner: student.owner || "前台老师"
  });

  student.course = course;
  student.className = className;
  student.status = "已报名";
  student.balance = Number(student.balance || 0) + bought + gift;
  student.debt = debt;
  syncClassCounts();
  selectedStudentForOrder = student.id;
  setNotice("orders", `${student.name} 已报名 ${className}，新增 ${bought + gift} 课时。`);
  saveState();
  setView("orders");
}

function assignStudentToClass(formData) {
  const student = appState.students.find((item) => item.id === formData.get("studentId"));
  const classItem = getClass(formData.get("className"));
  if (!student || !classItem) return;

  student.className = classItem.name;
  student.course = classItem.course;
  if (student.status === "意向") student.status = "已报名";
  selectedStudentForClass = student.id;
  syncClassCounts();
  setNotice("classes", `${student.name} 已分入 ${classItem.name}。`);
  saveState();
  setView("classes");
}

function createLesson(formData) {
  const date = text(formData.get("date"));
  const startTime = text(formData.get("startTime"));
  const endTime = text(formData.get("endTime"));
  const target = text(formData.get("target"));
  const classItem = getClass(target);
  const lesson = {
    id: nextId("L"),
    day: dayFromDate(date),
    date,
    time: `${startTime}-${endTime}`,
    type: text(formData.get("type")) || "班级课",
    target,
    subject: text(formData.get("subject")).trim() || "课程",
    teacher: text(formData.get("teacher")).trim() || classItem?.teacher || "任课老师",
    room: text(formData.get("room")).trim() || classItem?.room || "默认教室",
    status: "待上课",
    deduct: Number(classItem?.deduct || 1)
  };
  const conflicts = findLessonConflicts(lesson);
  if (conflicts.length) {
    const names = conflicts.map((item) => `${item.target} ${item.time}`).join("；");
    setNotice("schedule", `存在排课冲突：${names}`, "red");
    renderView();
    return;
  }

  appState.lessons.unshift(lesson);
  setNotice("schedule", `${lesson.day} ${lesson.time} 已新增 ${lesson.target}。`);
  saveState();
  setView("schedule");
}

function applyLessonDeduction(student, lesson, deduct) {
  const before = Number(student.balance || 0);
  const after = Math.max(0, before - deduct);
  student.balance = after;

  const relatedOrder = appState.orders.find((order) => order.student === student.name && order.className === lesson.target);
  if (relatedOrder) relatedOrder.used = Number(relatedOrder.used || 0) + Math.min(before, deduct);

  appState.ledger.unshift({
    id: nextId("C"),
    student: student.name,
    lesson: `${lesson.target} ${lesson.date}`,
    type: before >= deduct ? "消课" : "课时不足",
    change: -Math.min(before, deduct),
    before,
    after,
    operator: lesson.teacher,
    time: new Date().toLocaleString("zh-CN", { hour12: false })
  });
}

function finishLesson(lessonId) {
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson || lesson.status === "已上课") return;
  lesson.status = "已上课";
  const deduct = lessonDeduct(lesson);
  const classStudents = appState.students.filter((student) => student.className === lesson.target);
  const oneToOneName = lesson.target.split("-")[0];
  const studentsToDeduct = classStudents.length ? classStudents : appState.students.filter((student) => student.name === oneToOneName);
  studentsToDeduct.forEach((student) => applyLessonDeduction(student, lesson, deduct));
  setNotice("schedule", `${lesson.target} 已确认上课，生成 ${studentsToDeduct.length} 条课时流水。`);
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

  const orderShortcut = event.target.closest("[data-student-order]");
  if (orderShortcut) {
    selectedStudentForOrder = orderShortcut.dataset.studentOrder;
    setView("orders");
  }

  const classShortcut = event.target.closest("[data-student-class]");
  if (classShortcut) {
    selectedStudentForClass = classShortcut.dataset.studentClass;
    setView("classes");
  }

  if (event.target.id === "newStudentInline" || event.target.id === "newStudentBtn") {
    refreshStudentFormChoices();
    studentDialog.showModal();
  }

  if (event.target.id === "resetDemo") {
    localStorage.removeItem(storageKey);
    appState = structuredClone(window.seedData);
    operationNotice = null;
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

  if (event.target.id === "orderClassSelect") {
    const courseSelect = document.querySelector("#orderCourseSelect");
    const classItem = getClass(event.target.value);
    if (courseSelect && classItem?.course) courseSelect.value = classItem.course;
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

document.addEventListener("submit", (event) => {
  if (event.target.id === "orderForm") {
    event.preventDefault();
    enrollStudent(new FormData(event.target));
  }

  if (event.target.id === "assignForm") {
    event.preventDefault();
    assignStudentToClass(new FormData(event.target));
  }

  if (event.target.id === "lessonForm") {
    event.preventDefault();
    createLesson(new FormData(event.target));
  }
});

renderNav();
setView("dashboard");
loadExcelPreview();
