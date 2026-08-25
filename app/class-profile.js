const classProfileStyle = document.createElement("style");
classProfileStyle.textContent = `
  .class-profile-dialog {
    width: min(1180px, calc(100vw - 28px));
  }

  .class-profile-dialog .dialog-body {
    padding: 0 18px 18px;
    display: grid;
    gap: 14px;
    max-height: min(78vh, 820px);
    overflow: auto;
  }

  .class-title {
    display: flex;
    gap: 12px;
    align-items: center;
    min-width: 0;
  }

  .class-mark {
    width: 46px;
    height: 46px;
    border-radius: 8px;
    background: #fff2cf;
    color: #7c4a03;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 22px;
    flex: 0 0 auto;
  }

  .class-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(130px, 1fr));
    gap: 10px;
  }

  .class-summary .metric {
    box-shadow: none;
    padding: 13px;
  }

  .class-summary .metric strong {
    font-size: 24px;
  }

  .class-profile-grid {
    display: grid;
    grid-template-columns: minmax(260px, 0.68fr) minmax(0, 1.32fr);
    gap: 14px;
  }

  .class-card {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    padding: 14px;
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .class-card h4 {
    margin: 0;
    font-size: 16px;
  }

  .class-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .class-fact {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .class-fact span {
    color: var(--muted);
    font-size: 12px;
  }

  .class-fact strong {
    overflow-wrap: anywhere;
  }

  .class-card .table-wrap {
    border: 1px solid var(--line);
    border-radius: 8px;
  }

  .class-list-summary {
    margin-bottom: 14px;
  }

  .class-filter-toolbar {
    align-items: end;
  }

  .class-filter-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .class-filter-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .class-risk-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 260px;
  }

  @media (max-width: 900px) {
    .class-summary,
    .class-profile-grid,
    .class-facts {
      grid-template-columns: 1fr;
    }

    .class-filter-toolbar,
    .class-filter-toolbar label,
    .class-filter-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(classProfileStyle);

const classProfileDialog = document.createElement("dialog");
classProfileDialog.id = "classProfileDialog";
classProfileDialog.className = "dialog class-profile-dialog";
document.body.appendChild(classProfileDialog);

let classStatusFilter = "all";
let classTeacherFilter = "all";
let classRiskFilter = "all";
let classSortMode = "risk";

function classByName(className) {
  return appState.classes.find((item) => item.name === className);
}

function classStudents(classItem) {
  return appState.students.filter((student) => student.className === classItem.name);
}

function classOrders(classItem) {
  return appState.orders.filter((order) => order.className === classItem.name);
}

function classLessons(classItem) {
  return appState.lessons
    .filter((lesson) => lesson.target === classItem.name)
    .slice()
    .sort((first, second) => `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`));
}

function classStudentCount(classItem) {
  return classStudents(classItem).length;
}

function classCapacityRate(classItem, count = classStudentCount(classItem)) {
  const capacity = Number(classItem.capacity || 0);
  if (!capacity) return 0;
  return Math.round((count / capacity) * 100);
}

function classDebtTotal(classItem) {
  return classOrders(classItem).reduce((sum, order) => sum + Number(order.debt || 0), 0);
}

function classPendingLessonCount(classItem) {
  return classLessons(classItem).filter((lesson) => lesson.status === "待上课").length;
}

function classRiskReasons(classItem) {
  const reasons = [];
  const count = classStudentCount(classItem);
  const capacity = Number(classItem.capacity || 0);
  const debt = classDebtTotal(classItem);
  const pendingLessons = classPendingLessonCount(classItem);
  const rate = classCapacityRate(classItem, count);

  if (capacity && count >= capacity) reasons.push({ key: "full", label: "已满班", tone: "red" });
  else if (capacity && rate >= 80) reasons.push({ key: "nearFull", label: "接近满班", tone: "amber" });
  if (count === 0) reasons.push({ key: "empty", label: "空班", tone: "amber" });
  if (debt > 0) reasons.push({ key: "debt", label: "有欠费", tone: "red" });
  if (classItem.status === "开课中" && pendingLessons === 0) reasons.push({ key: "noSchedule", label: "待排课", tone: "amber" });

  return reasons;
}

function classHasRisk(classItem, riskKey) {
  if (riskKey === "all") return true;
  if (riskKey === "none") return classRiskReasons(classItem).length === 0;
  return classRiskReasons(classItem).some((reason) => reason.key === riskKey);
}

function classMatchesListFilters(classItem) {
  if (!matchesRow(classItem)) return false;
  if (classStatusFilter !== "all" && classItem.status !== classStatusFilter) return false;
  if (classTeacherFilter !== "all" && classItem.teacher !== classTeacherFilter) return false;
  return classHasRisk(classItem, classRiskFilter);
}

function classRiskScore(classItem) {
  const weights = { full: 1, debt: 2, noSchedule: 3, nearFull: 4, empty: 5 };
  const scores = classRiskReasons(classItem).map((reason) => weights[reason.key] || 9);
  return Math.min(...scores, 99);
}

function compareClassesForList(left, right) {
  if (classSortMode === "name") return text(left.name).localeCompare(text(right.name), "zh-CN");
  if (classSortMode === "teacher") return text(left.teacher).localeCompare(text(right.teacher), "zh-CN") || text(left.name).localeCompare(text(right.name), "zh-CN");
  if (classSortMode === "fillDesc") return classCapacityRate(right) - classCapacityRate(left);
  if (classSortMode === "pendingDesc") return classPendingLessonCount(right) - classPendingLessonCount(left);

  const riskGap = classRiskScore(left) - classRiskScore(right);
  if (riskGap) return riskGap;
  return text(left.status).localeCompare(text(right.status), "zh-CN") || text(left.name).localeCompare(text(right.name), "zh-CN");
}

function renderClassRiskTags(classItem) {
  const reasons = classRiskReasons(classItem);
  if (!reasons.length) return tag("正常", "green");
  return `<div class="class-risk-tags">${reasons.map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function classSelectOptions(values, selectedValue, allLabel) {
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function renderClassFilterToolbar() {
  const statuses = [...new Set(appState.classes.map((item) => item.status).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const teachers = [...new Set(appState.classes.map((item) => item.teacher).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));

  return `
    <div class="filters class-filter-toolbar">
      <label>状态
        <select id="classStatusFilter" aria-label="按状态筛选班级">
          ${classSelectOptions(statuses, classStatusFilter, "全部状态")}
        </select>
      </label>
      <label>老师
        <select id="classTeacherFilter" aria-label="按老师筛选班级">
          ${classSelectOptions(teachers, classTeacherFilter, "全部老师")}
        </select>
      </label>
      <label>待处理
        <select id="classRiskFilter" aria-label="按待处理事项筛选班级">
          <option value="all" ${classRiskFilter === "all" ? "selected" : ""}>全部情况</option>
          <option value="full" ${classRiskFilter === "full" ? "selected" : ""}>已满班</option>
          <option value="nearFull" ${classRiskFilter === "nearFull" ? "selected" : ""}>接近满班</option>
          <option value="debt" ${classRiskFilter === "debt" ? "selected" : ""}>有欠费</option>
          <option value="noSchedule" ${classRiskFilter === "noSchedule" ? "selected" : ""}>待排课</option>
          <option value="empty" ${classRiskFilter === "empty" ? "selected" : ""}>空班</option>
          <option value="none" ${classRiskFilter === "none" ? "selected" : ""}>无待处理</option>
        </select>
      </label>
      <label>排序
        <select id="classSortMode" aria-label="班级列表排序">
          <option value="risk" ${classSortMode === "risk" ? "selected" : ""}>风险优先</option>
          <option value="fillDesc" ${classSortMode === "fillDesc" ? "selected" : ""}>满班率降序</option>
          <option value="pendingDesc" ${classSortMode === "pendingDesc" ? "selected" : ""}>待上课节降序</option>
          <option value="teacher" ${classSortMode === "teacher" ? "selected" : ""}>老师分组</option>
          <option value="name" ${classSortMode === "name" ? "selected" : ""}>班级名称</option>
        </select>
      </label>
    </div>`;
}

function classListSummary(allClasses, visibleClasses) {
  const active = allClasses.filter((item) => item.status === "开课中").length;
  const nearFull = allClasses.filter((item) => classRiskReasons(item).some((reason) => reason.key === "nearFull" || reason.key === "full")).length;
  const debtCount = allClasses.filter((item) => classDebtTotal(item) > 0).length;
  const pendingLessons = allClasses.reduce((sum, item) => sum + classPendingLessonCount(item), 0);

  return `
    <div class="summary-grid compact-metrics class-list-summary">
      <div class="metric"><span>当前显示</span><strong>${visibleClasses.length}</strong><small>全部 ${allClasses.length} 个班级</small></div>
      <div class="metric"><span>开课中</span><strong>${active}</strong><small>需要持续排课和点名</small></div>
      <div class="metric"><span>容量预警</span><strong>${nearFull}</strong><small>满班或接近满班</small></div>
      <div class="metric"><span>待处理</span><strong>${debtCount + pendingLessons}</strong><small>${debtCount} 个班有欠费，${pendingLessons} 节待上</small></div>
    </div>`;
}

function classStudentOrders(student, className) {
  return appState.orders.filter((order) => order.student === student.name && order.className === className);
}

function classStudentSummary(student, className) {
  return classStudentOrders(student, className).reduce(
    (summary, order) => {
      summary.orderCount += 1;
      summary.bought += Number(order.bought || 0);
      summary.gift += Number(order.gift || 0);
      summary.used += Number(order.used || 0);
      summary.paid += Number(order.paid || 0);
      summary.debt += Number(order.debt || 0);
      return summary;
    },
    { orderCount: 0, bought: 0, gift: 0, used: 0, paid: 0, debt: 0 }
  );
}

function classProfileFacts(items) {
  return `<div class="class-facts">${items
    .map(
      ([label, value]) => `<div class="class-fact">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "-")}</strong>
      </div>`
    )
    .join("")}</div>`;
}

function renderClassProfileTable(headers, rows) {
  return table(headers, rows).replace('<div class="table-wrap">', '<div class="table-wrap class-table-wrap">');
}

function classFillRate(classItem, studentCount = Number(classItem.students || 0)) {
  const capacity = Number(classItem.capacity || 0);
  if (!capacity) return "0%";
  return `${Math.round((studentCount / capacity) * 100)}%`;
}

function latestClassLessonDate(classItem) {
  const lessons = classLessons(classItem);
  const latest = lessons[lessons.length - 1];
  return latest ? `${latest.date} ${latest.time}` : "";
}

function flattenClassRosterRows() {
  if (typeof syncClassCounts === "function") syncClassCounts();
  return appState.classes.flatMap((classItem) => {
    const students = classStudents(classItem);
    const lessons = classLessons(classItem);
    const classDebt = classOrders(classItem).reduce((sum, order) => sum + Number(order.debt || 0), 0);
    const baseRow = {
      className: classItem.name,
      course: classItem.course,
      teacher: classItem.teacher,
      assistant: classItem.assistant,
      room: classItem.room,
      stage: classItem.stage,
      status: classItem.status,
      capacity: classItem.capacity,
      classStudents: students.length,
      fillRate: classFillRate(classItem, students.length),
      classDebt,
      pendingLessons: lessons.filter((lesson) => lesson.status === "待上课").length,
      latestLesson: latestClassLessonDate(classItem)
    };

    if (!students.length) {
      return [
        {
          ...baseRow,
          studentId: "",
          student: "",
          phone: "",
          grade: "",
          school: "",
          studentStatus: "",
          balance: "",
          debt: "",
          owner: "",
          orderCount: 0,
          paid: 0,
          bought: 0,
          gift: 0,
          used: 0
        }
      ];
    }

    return students.map((student) => {
      const summary = classStudentSummary(student, classItem.name);
      return {
        ...baseRow,
        studentId: student.id,
        student: student.name,
        phone: student.phone,
        grade: student.grade,
        school: student.school,
        studentStatus: student.status,
        balance: student.balance,
        debt: student.debt || summary.debt,
        owner: student.owner,
        orderCount: summary.orderCount,
        paid: summary.paid,
        bought: summary.bought,
        gift: summary.gift,
        used: summary.used
      };
    });
  });
}

function classRosterExportConfig() {
  return {
    file: "班级花名册.csv",
    rows: flattenClassRosterRows(),
    columns: [
      ["className", "班级名称"],
      ["course", "关联课程"],
      ["teacher", "教师"],
      ["assistant", "助教"],
      ["room", "教室"],
      ["stage", "期段"],
      ["status", "班级状态"],
      ["capacity", "满班人数"],
      ["classStudents", "当前人数"],
      ["fillRate", "满班率"],
      ["classDebt", "班级欠费合计"],
      ["pendingLessons", "待上课节"],
      ["latestLesson", "最近课节"],
      ["studentId", "学员编号"],
      ["student", "学员姓名"],
      ["phone", "手机号"],
      ["grade", "年级"],
      ["school", "学校"],
      ["studentStatus", "学员状态"],
      ["balance", "剩余课时"],
      ["debt", "学员欠费"],
      ["owner", "负责人"],
      ["orderCount", "订单数"],
      ["paid", "累计实收"],
      ["bought", "购买课时"],
      ["gift", "赠送课时"],
      ["used", "已上课时"]
    ].map(([key, label]) => ({ key, label }))
  };
}

if (typeof exportDataset === "function") {
  const baseExportDatasetForClassRoster = exportDataset;
  exportDataset = function exportDatasetWithClassRoster(type) {
    if (type !== "classRosters") {
      baseExportDatasetForClassRoster(type);
      return;
    }

    const config = classRosterExportConfig();
    downloadText(config.file, buildCsv(config.rows, config.columns), "text/csv;charset=utf-8");
    setNotice("data", `${config.file} 已开始下载。`);
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForClassRoster = renderDataCenter;
  renderDataCenter = function renderDataCenterWithClassRoster() {
    baseRenderDataCenterForClassRoster();
    const metric = [...appContent.querySelectorAll(".metric")].find((item) => item.textContent.includes("数据表数量"));
    const metricValue = metric?.querySelector("strong");
    if (metricValue) metricValue.textContent = "18";

    const dataGrid = appContent.querySelector(".data-grid");
    if (!dataGrid || dataGrid.querySelector('[data-export="classRosters"]')) return;
    const rosterCard = document.createElement("article");
    rosterCard.className = "data-card";
    rosterCard.innerHTML = `
      <div>
        <span class="muted">班级花名册</span>
        <strong>${flattenClassRosterRows().length}</strong>
      </div>
      <button class="small-button" type="button" data-export="classRosters">导出花名册</button>`;
    const classCard = dataGrid.querySelector('[data-export="classes"]')?.closest(".data-card");
    if (classCard) {
      classCard.after(rosterCard);
    } else {
      dataGrid.appendChild(rosterCard);
    }
  };
}

function showClassProfile(className) {
  const classItem = classByName(className);
  if (!classItem) return;
  if (typeof syncClassCounts === "function") syncClassCounts();

  const students = classStudents(classItem);
  const orders = classOrders(classItem);
  const lessons = classLessons(classItem);
  const debtTotal = orders.reduce((sum, order) => sum + Number(order.debt || 0), 0);
  const balanceTotal = students.reduce((sum, student) => sum + Number(student.balance || 0), 0);
  const pendingLessons = lessons.filter((lesson) => lesson.status === "待上课").length;

  const studentRows = students.map((student) => {
    const summary = classStudentSummary(student, classItem.name);
    const debt = Number(student.debt || summary.debt || 0);
    return `<tr>
      <td><strong>${escapeHtml(student.name)}</strong><br><span class="muted">${escapeHtml(student.id)}</span></td>
      <td>${escapeHtml(student.phone)}</td>
      <td>${escapeHtml(student.grade)}<br><span class="muted">${escapeHtml(student.school)}</span></td>
      <td>${tag(student.status, statusTone(student.status))}</td>
      <td>${Number(student.balance || 0)}</td>
      <td>${debt ? tag(money(debt), "red") : tag("无", "green")}</td>
      <td>${summary.orderCount}</td>
      <td><button class="small-button" type="button" data-class-student-detail="${escapeHtml(student.id)}">学员详情</button></td>
    </tr>`;
  });

  const lessonRows = lessons.slice(0, 10).map(
    (lesson) => `<tr>
      <td>${escapeHtml(lesson.date)}<br><span class="muted">${escapeHtml(lesson.day)}</span></td>
      <td>${escapeHtml(lesson.time)}</td>
      <td>${escapeHtml(lesson.subject)}</td>
      <td>${escapeHtml(lesson.teacher)}</td>
      <td>${escapeHtml(lesson.room)}</td>
      <td>${tag(lesson.status, statusTone(lesson.status))}</td>
    </tr>`
  );

  const orderRows = orders.slice(0, 8).map(
    (order) => `<tr>
      <td><strong>${escapeHtml(order.student)}</strong><br><span class="muted">${escapeHtml(order.id)}</span></td>
      <td>${Number(order.bought || 0)} + ${Number(order.gift || 0)}</td>
      <td>${Number(order.used || 0)}</td>
      <td>${money(order.paid)}</td>
      <td>${Number(order.debt || 0) ? tag(money(order.debt), "red") : tag("无", "green")}</td>
      <td>${escapeHtml(order.expireAt)}</td>
    </tr>`
  );

  classProfileDialog.innerHTML = `
    <div class="dialog-head" style="padding:18px;">
      <div class="class-title">
        <div class="class-mark" aria-hidden="true">班</div>
        <div>
          <p class="eyebrow">班级详情档案</p>
          <h3>${escapeHtml(classItem.name)} ${tag(classItem.status, statusTone(classItem.status))}</h3>
        </div>
      </div>
      <button class="icon-button" type="button" data-close-class-profile aria-label="关闭">×</button>
    </div>
    <div class="dialog-body">
      <div class="class-summary">
        <div class="metric"><span>班级人数</span><strong>${students.length}/${classItem.capacity}</strong></div>
        <div class="metric"><span>满班率</span><strong>${classFillRate(classItem, students.length)}</strong></div>
        <div class="metric"><span>待收欠费</span><strong>${money(debtTotal)}</strong></div>
        <div class="metric"><span>待上课节</span><strong>${pendingLessons}</strong></div>
      </div>
      <div class="class-profile-grid">
        <section class="class-card">
          <h4>班级信息</h4>
          ${classProfileFacts([
            ["关联课程", classItem.course],
            ["期段", classItem.stage],
            ["教师", classItem.teacher],
            ["助教", classItem.assistant],
            ["教室", classItem.room],
            ["容量", `${students.length}/${classItem.capacity}`],
            ["学生扣课", classItem.deduct],
            ["教师课时", classItem.teacherHours],
            ["班级剩余课时合计", balanceTotal]
          ])}
          <div class="action-row">
            <button class="small-button" type="button" data-go="schedule">去排课</button>
            <button class="small-button" type="button" data-go="data">导出数据</button>
          </div>
        </section>
        <section class="class-card">
          <h4>班级花名册</h4>
          ${renderClassProfileTable(["学员", "手机号", "年级学校", "状态", "剩余课时", "欠费", "订单", "操作"], studentRows)}
        </section>
      </div>
      <section class="class-card">
        <h4>近期课表</h4>
        ${renderClassProfileTable(["日期", "时间", "科目", "教师", "教室", "状态"], lessonRows)}
      </section>
      <section class="class-card">
        <h4>报名订单</h4>
        ${renderClassProfileTable(["学员/订单", "购买+赠送", "已上", "实收", "欠费", "有效期"], orderRows)}
      </section>
    </div>`;
  classProfileDialog.showModal();
}

renderClasses = function renderClassesWithProfile() {
  if (typeof syncClassCounts === "function") syncClassCounts();
  const allClasses = appState.classes.filter(matchesRow);
  const visibleClasses = appState.classes.filter(classMatchesListFilters).sort(compareClassesForList);
  const rows = visibleClasses
    .map(
      (item) => {
        const studentCount = classStudentCount(item);
        const pendingLessons = classPendingLessonCount(item);
        const debtTotal = classDebtTotal(item);
        return `<tr>
        <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${escapeHtml(item.stage)}</span></td>
        <td>${escapeHtml(item.course)}</td>
        <td>${escapeHtml(item.teacher)}</td>
        <td>${escapeHtml(item.assistant)}</td>
        <td>${escapeHtml(item.room)}</td>
        <td>${studentCount}/${item.capacity} 人<br><span class="muted">满班率 ${classCapacityRate(item, studentCount)}%</span></td>
        <td>${item.deduct}</td>
        <td>${item.teacherHours}</td>
        <td>${pendingLessons}</td>
        <td>${debtTotal ? tag(money(debtTotal), "red") : tag("无", "green")}</td>
        <td>${tag(item.status, statusTone(item.status))}</td>
        <td>${renderClassRiskTags(item)}</td>
        <td><button class="small-button" type="button" data-class-detail="${escapeHtml(item.name)}">详情</button></td>
      </tr>`;
      }
    );

  appContent.innerHTML = `
    <section class="section">
      <div class="section-head">
        <div>
          <h3>班级与容量</h3>
          <span class="muted">筛选满班、欠费、待排课等分班排课前需要核对的班级。</span>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("classes")}
        ${renderAssignPanel()}
        ${classListSummary(allClasses, visibleClasses)}
        ${renderClassFilterToolbar()}
        ${table(["班级", "关联课程", "教师", "助教", "教室", "人数", "学生扣课", "教师课时", "待上课节", "欠费合计", "状态", "待处理", "操作"], rows)}
      </div>
    </section>`;
};

document.addEventListener("change", (event) => {
  if (event.target.id === "classStatusFilter") classStatusFilter = event.target.value;
  if (event.target.id === "classTeacherFilter") classTeacherFilter = event.target.value;
  if (event.target.id === "classRiskFilter") classRiskFilter = event.target.value;
  if (event.target.id === "classSortMode") classSortMode = event.target.value;

  if (["classStatusFilter", "classTeacherFilter", "classRiskFilter", "classSortMode"].includes(event.target.id) && currentView === "classes") {
    renderView();
  }
});

document.addEventListener("click", (event) => {
  const classButton = event.target.closest("[data-class-detail]");
  if (classButton) showClassProfile(classButton.dataset.classDetail);

  const studentButton = event.target.closest("[data-class-student-detail]");
  if (studentButton) {
    classProfileDialog.close();
    if (typeof showStudentProfile === "function") showStudentProfile(studentButton.dataset.classStudentDetail);
  }

  if (event.target.closest("[data-close-class-profile]")) classProfileDialog.close();

  if (event.target.closest("[data-go]") && classProfileDialog.open) classProfileDialog.close();
});

if (currentView === "classes") {
  renderView();
}
