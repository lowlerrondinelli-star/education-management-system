const reportStyle = document.createElement("style");
reportStyle.textContent = `
  .report-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.5fr);
    gap: 14px;
  }

  .report-panel {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px;
    background: #fff;
    display: grid;
    gap: 12px;
  }

  .chart-list {
    display: grid;
    gap: 10px;
  }

  .chart-row {
    display: grid;
    grid-template-columns: minmax(92px, 0.35fr) minmax(160px, 1fr) auto;
    gap: 10px;
    align-items: center;
  }

  .bar-track {
    height: 12px;
    border-radius: 999px;
    background: var(--soft);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    width: var(--bar-width);
    border-radius: 999px;
    background: var(--blue);
  }

  .bar-fill.green {
    background: var(--green);
  }

  .bar-fill.amber {
    background: var(--amber);
  }

  .bar-fill.red {
    background: var(--red);
  }

  .report-note {
    line-height: 1.55;
    white-space: normal;
  }

  @media (max-width: 1040px) {
    .report-layout {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(reportStyle);

function ensureReportInputs() {
  if (typeof ensurePaymentData === "function") ensurePaymentData();
  if (typeof ensureFollowUpData === "function") ensureFollowUpData();
  syncClassCounts();
}

function sumNumbers(items, picker) {
  return items.reduce((sum, item) => sum + Number(picker(item) || 0), 0);
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function lessonHours(lesson) {
  const range = parseTimeRange(lesson.time);
  if (![range.start, range.end].every(Number.isFinite) || range.end <= range.start) return Number(lesson.teacherHours || 1);
  return Math.round(((range.end - range.start) / 60) * 10) / 10;
}

function paidTotal() {
  ensureReportInputs();
  if (Array.isArray(appState.payments) && appState.payments.length) return sumNumbers(appState.payments, (payment) => payment.amount);
  return sumNumbers(appState.orders, (order) => order.paid);
}

function debtTotal() {
  return sumNumbers(appState.orders, (order) => order.debt);
}

function consumedHoursTotal() {
  return sumNumbers(appState.ledger.filter((item) => Number(item.change || 0) < 0), (item) => Math.abs(Number(item.change || 0)));
}

function enrolledStudents() {
  return appState.students.filter((student) => student.status === "已报名").length;
}

function reportSummary() {
  ensureReportInputs();
  const capacity = sumNumbers(appState.classes, (item) => item.capacity);
  const classStudents = sumNumbers(appState.classes, (item) => item.students);
  const followUps = typeof activeFollowUps === "function" ? activeFollowUps().length : 0;
  return {
    paid: paidTotal(),
    debt: debtTotal(),
    consumed: consumedHoursTotal(),
    followUps,
    students: appState.students.length,
    enrolled: enrolledStudents(),
    intent: appState.students.filter((student) => student.status === "意向").length,
    pendingLessons: appState.lessons.filter((lesson) => lesson.status === "待上课").length,
    classFillRate: capacity ? clampPercent((classStudents / capacity) * 100) : 0
  };
}

function groupBy(items, keyPicker) {
  const groups = new Map();
  for (const item of items) {
    const key = keyPicker(item) || "未分类";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function courseReportRows() {
  return [...groupBy(appState.orders, (order) => order.course).entries()].map(([course, orders]) => ({
    course,
    orderCount: orders.length,
    paid: sumNumbers(orders, (order) => order.paid),
    debt: sumNumbers(orders, (order) => order.debt),
    bought: sumNumbers(orders, (order) => order.bought),
    used: sumNumbers(orders, (order) => order.used),
    remaining: sumNumbers(orders, (order) => Number(order.bought || 0) + Number(order.gift || 0) - Number(order.used || 0))
  }));
}

function teacherReportRows() {
  return [...groupBy(appState.lessons, (lesson) => lesson.teacher).entries()]
    .map(([teacher, lessons]) => ({
      teacher,
      lessonCount: lessons.length,
      pending: lessons.filter((lesson) => lesson.status === "待上课").length,
      done: lessons.filter((lesson) => lesson.status === "已上课").length,
      scheduledHours: sumNumbers(lessons, lessonHours),
      rooms: [...new Set(lessons.map((lesson) => lesson.room).filter(Boolean))].join("、")
    }))
    .sort((a, b) => b.lessonCount - a.lessonCount);
}

function classReportRows() {
  return appState.classes.map((item) => {
    const lessons = appState.lessons.filter((lesson) => lesson.target === item.name);
    return {
      className: item.name,
      course: item.course,
      teacher: item.teacher,
      students: Number(item.students || 0),
      capacity: Number(item.capacity || 0),
      fillRate: Number(item.capacity || 0) ? clampPercent((Number(item.students || 0) / Number(item.capacity || 0)) * 100) : 0,
      lessonCount: lessons.length,
      status: item.status
    };
  });
}

function channelReportRows() {
  const ordersByStudent = groupBy(appState.orders, (order) => order.student);
  return [...groupBy(appState.students, (student) => student.channel).entries()].map(([channel, students]) => {
    const names = new Set(students.map((student) => student.name));
    const orders = [...names].flatMap((name) => ordersByStudent.get(name) || []);
    return {
      channel,
      students: students.length,
      enrolled: students.filter((student) => student.status === "已报名").length,
      intent: students.filter((student) => student.status === "意向").length,
      paid: sumNumbers(orders, (order) => order.paid),
      debt: sumNumbers(orders, (order) => order.debt)
    };
  });
}

function flattenOperationReportRows() {
  ensureReportInputs();
  const summary = reportSummary();
  const rows = [
    { section: "总览", item: "累计实收", value: money(summary.paid), amount: summary.paid, note: "来自收款流水/订单实收" },
    { section: "总览", item: "待收欠费", value: money(summary.debt), amount: summary.debt, note: "来自订单欠费" },
    { section: "总览", item: "已消课时", value: summary.consumed, amount: summary.consumed, note: "来自消课流水" },
    { section: "总览", item: "待跟进", value: summary.followUps, amount: summary.followUps, note: "来自续费跟进待办" }
  ];
  for (const item of courseReportRows()) rows.push({ section: "课程", item: item.course, value: `订单 ${item.orderCount} / 余额 ${item.remaining}`, amount: item.paid, note: `欠费 ${money(item.debt)}，已上 ${item.used}` });
  for (const item of teacherReportRows()) rows.push({ section: "教师", item: item.teacher, value: `课节 ${item.lessonCount} / 待上 ${item.pending}`, amount: item.scheduledHours, note: `教室：${item.rooms || "-"}` });
  for (const item of classReportRows()) rows.push({ section: "班级", item: item.className, value: `${item.students}/${item.capacity}`, amount: item.fillRate, note: `${item.course}，${item.status}` });
  for (const item of channelReportRows()) rows.push({ section: "渠道", item: item.channel, value: `学员 ${item.students} / 报名 ${item.enrolled}`, amount: item.paid, note: `意向 ${item.intent}，欠费 ${money(item.debt)}` });
  return rows;
}

function renderBarRows(items, maxValue, valueFormatter = (value) => value) {
  return `<div class="chart-list">${items
    .map((item) => {
      const width = maxValue ? clampPercent((Number(item.value || 0) / maxValue) * 100) : 0;
      return `<div class="chart-row">
        <span>${escapeHtml(item.label)}</span>
        <div class="bar-track"><div class="bar-fill ${item.tone || ""}" style="--bar-width:${width}%"></div></div>
        <strong>${escapeHtml(valueFormatter(item.value))}</strong>
      </div>`;
    })
    .join("")}</div>`;
}

function renderReports() {
  ensureReportInputs();
  const summary = reportSummary();
  const courseRows = courseReportRows();
  const teacherRows = teacherReportRows();
  const classRows = classReportRows();
  const channelRows = channelReportRows();
  const maxCoursePaid = Math.max(...courseRows.map((item) => item.paid), 1);
  const maxTeacherLessons = Math.max(...teacherRows.map((item) => item.lessonCount), 1);

  const courseTableRows = courseRows.map(
    (item) => `<tr>
      <td><strong>${escapeHtml(item.course)}</strong></td>
      <td>${item.orderCount}</td>
      <td>${money(item.paid)}</td>
      <td>${item.debt ? tag(money(item.debt), "red") : tag("无", "green")}</td>
      <td>${item.bought}</td>
      <td>${item.used}</td>
      <td>${tag(item.remaining, item.remaining <= 3 ? "amber" : "green")}</td>
    </tr>`
  );
  const teacherTableRows = teacherRows.map(
    (item) => `<tr>
      <td><strong>${escapeHtml(item.teacher)}</strong><br><span class="muted">${escapeHtml(item.rooms || "-")}</span></td>
      <td>${item.lessonCount}</td>
      <td>${item.pending}</td>
      <td>${item.done}</td>
      <td>${item.scheduledHours}</td>
    </tr>`
  );
  const classTableRows = classRows.map(
    (item) => `<tr>
      <td><strong>${escapeHtml(item.className)}</strong><br><span class="muted">${escapeHtml(item.course)}</span></td>
      <td>${escapeHtml(item.teacher)}</td>
      <td>${item.students}/${item.capacity}</td>
      <td>${tag(`${item.fillRate}%`, item.fillRate >= 80 ? "green" : item.fillRate >= 50 ? "amber" : "")}</td>
      <td>${item.lessonCount}</td>
      <td>${tag(item.status, statusTone(item.status))}</td>
    </tr>`
  );
  const channelTableRows = channelRows.map(
    (item) => `<tr>
      <td><strong>${escapeHtml(item.channel)}</strong></td>
      <td>${item.students}</td>
      <td>${item.enrolled}</td>
      <td>${item.intent}</td>
      <td>${money(item.paid)}</td>
      <td>${item.debt ? tag(money(item.debt), "red") : tag("无", "green")}</td>
    </tr>`
  );

  appContent.innerHTML = `
    <div class="summary-grid">
      <div class="metric"><span>累计实收</span><strong>${money(summary.paid)}</strong></div>
      <div class="metric"><span>待收欠费</span><strong>${money(summary.debt)}</strong></div>
      <div class="metric"><span>已消课时</span><strong>${summary.consumed}</strong></div>
      <div class="metric"><span>续费待办</span><strong>${summary.followUps}</strong></div>
    </div>
    <div class="report-layout">
      <section class="section">
        <div class="section-head"><h3>经营概览</h3><span class="muted">收入、课消、续费压力集中查看</span></div>
        <div class="section-body">
          <div class="report-panel">
            <strong>营收结构</strong>
            ${renderBarRows(
              [
                { label: "累计实收", value: summary.paid, tone: "green" },
                { label: "待收欠费", value: summary.debt, tone: "red" }
              ],
              Math.max(summary.paid, summary.debt, 1),
              money
            )}
          </div>
          <div class="report-panel">
            <strong>课程收入</strong>
            ${renderBarRows(courseRows.map((item) => ({ label: item.course, value: item.paid, tone: item.debt ? "amber" : "green" })), maxCoursePaid, money)}
          </div>
        </div>
      </section>
      <section class="section">
        <div class="section-head"><h3>校区健康度</h3><span>${tag(`满班率 ${summary.classFillRate}%`, summary.classFillRate >= 70 ? "green" : "amber")}</span></div>
        <div class="section-body">
          <div class="report-panel">
            <strong>学员状态</strong>
            ${renderBarRows(
              [
                { label: "已报名", value: summary.enrolled, tone: "green" },
                { label: "意向", value: summary.intent, tone: "amber" }
              ],
              Math.max(summary.students, 1)
            )}
          </div>
          <div class="report-panel">
            <strong>教师课节</strong>
            ${renderBarRows(teacherRows.map((item) => ({ label: item.teacher, value: item.lessonCount })), maxTeacherLessons)}
          </div>
        </div>
      </section>
    </div>
    <section class="section">
      <div class="section-head compact-head"><h3>课程经营</h3><span class="muted">按订单课程汇总收入、欠费和课时余额</span></div>
      ${table(["课程", "订单", "实收", "欠费", "购买课时", "已上", "余额"], courseTableRows)}
    </section>
    <section class="section">
      <div class="section-head compact-head"><h3>教师与班级</h3><span class="muted">排课工作量、班级容量和状态</span></div>
      <div class="section-body">
        <div class="layout-two">
          ${table(["教师", "课节", "待上", "已上", "排课小时"], teacherTableRows)}
          ${table(["班级", "教师", "人数", "满班率", "课节", "状态"], classTableRows)}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-head compact-head"><h3>招生渠道</h3><span class="muted">用于判断线索来源质量</span></div>
      ${table(["渠道", "学员", "已报名", "意向", "实收", "欠费"], channelTableRows)}
    </section>`;
}

ensureReportInputs();

const reportInsertIndex = navItems.findIndex((item) => item.id === "dashboard");
navItems.splice(reportInsertIndex >= 0 ? reportInsertIndex + 1 : 1, 0, { id: "reports", label: "经营报表", icon: "报" });
viewMeta.reports = ["经营报表", "数据看板"];

const baseRenderViewForReports = renderView;
renderView = function renderViewWithReports() {
  if (currentView === "reports") {
    renderReports();
    return;
  }
  baseRenderViewForReports();
};

renderNav();
