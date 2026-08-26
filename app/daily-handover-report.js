const dailyHandoverStyle = document.createElement("style");
dailyHandoverStyle.textContent = `
  .daily-handover-panel {
    margin-bottom: 16px;
  }

  .daily-handover-toolbar {
    align-items: end;
  }

  .daily-handover-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .daily-handover-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .daily-handover-tags,
  .daily-handover-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .daily-handover-note {
    max-width: 360px;
    line-height: 1.55;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .daily-handover-toolbar,
    .daily-handover-toolbar label,
    .daily-handover-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(dailyHandoverStyle);

let dailyHandoverDateFilter = "";
let dailyHandoverTypeFilter = "all";
let dailyHandoverOwnerFilter = "all";
let dailyHandoverStatusFilter = "open";
let dailyHandoverSortMode = "priority";

const dailyHandoverPriorityWeight = { 高: 1, 中: 2, 低: 3 };

function dailyHandoverNormalizeDate(value) {
  const match = text(value || "").match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
  if (!match) return "";
  return match[0]
    .replace(/\//g, "-")
    .replace(/-(\d)(?=-|$)/g, "-0$1");
}

function dailyHandoverPaymentDate(payment) {
  if (typeof paymentDailyDate === "function") return paymentDailyDate(payment);
  return dailyHandoverNormalizeDate(payment?.paidAt) || "历史订单";
}

function dailyHandoverDateValue(value) {
  const date = new Date(`${value || "9999-12-31"}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date.getTime() : new Date("9999-12-31T00:00:00").getTime();
}

function dailyHandoverDateOptions() {
  if (typeof ensurePaymentData === "function") ensurePaymentData();
  if (typeof ensureLeaveData === "function") ensureLeaveData();
  if (typeof ensureFollowUpData === "function") ensureFollowUpData();
  const dates = new Set([todayIsoDate()]);
  for (const lesson of appState.lessons || []) if (lesson.date) dates.add(lesson.date);
  for (const payment of appState.payments || []) {
    const date = dailyHandoverPaymentDate(payment);
    if (date && date !== "历史订单") dates.add(date);
  }
  for (const leave of appState.leaveRequests || []) {
    if (leave.lessonDate) dates.add(leave.lessonDate);
    if (leave.makeupDate) dates.add(leave.makeupDate);
  }
  for (const item of appState.followUps || []) if (item.dueDate) dates.add(item.dueDate);
  return [...dates].sort();
}

function dailyHandoverSelectedDate() {
  const dates = dailyHandoverDateOptions();
  if (dailyHandoverDateFilter && dates.includes(dailyHandoverDateFilter)) return dailyHandoverDateFilter;
  const today = todayIsoDate();
  const todayRows = dailyHandoverRowsForDate(today);
  dailyHandoverDateFilter = todayRows.length ? today : dates.find((date) => date >= today) || dates[dates.length - 1] || today;
  return dailyHandoverDateFilter;
}

function dailyHandoverPriorityTone(priority) {
  if (priority === "高") return "red";
  if (priority === "中") return "amber";
  return "green";
}

function dailyHandoverStatusTone(status) {
  if (["待处理", "待点名", "待反馈", "未闭环", "欠费"].includes(status)) return "red";
  if (["待上课", "草稿", "待跟进", "请假处理中", "课时不足"].includes(status)) return "amber";
  return "green";
}

function dailyHandoverLessonStatus(lesson) {
  const hasAttendance = typeof lessonHasAttendance === "function" ? lessonHasAttendance(lesson) : Boolean(appState.attendance?.some((record) => record.lessonId === lesson.id));
  const hasFeedback = typeof lessonHasSentFeedback === "function" ? lessonHasSentFeedback(lesson) : false;
  if (lesson.status === "待上课" && !hasAttendance) return "待点名";
  if (lesson.status === "已上课" && !hasFeedback) return "待反馈";
  if (lesson.status === "已上课") return "已上课";
  return lesson.status || "待处理";
}

function dailyHandoverLessonDetail(lesson) {
  const students = typeof lessonStudents === "function" ? lessonStudents(lesson) : [];
  const attendance = typeof attendanceSummary === "function" ? attendanceSummary(lesson) : "未点名";
  return `${lesson.subject || "课程"} / ${students.length || 0} 名学员 / ${attendance} / ${lesson.room || "未分教室"}`;
}

function dailyHandoverStudentByName(name) {
  return appState.students.find((student) => student.name === name);
}

function dailyHandoverFollowAction(item, label = "跟进") {
  const studentId = item.studentId || dailyHandoverStudentByName(item.student)?.id;
  return studentId
    ? `<button class="small-button" type="button" data-student-follow="${escapeHtml(studentId)}">${escapeHtml(label)}</button>`
    : `<button class="small-button" type="button" data-go="followUp">${escapeHtml(label)}</button>`;
}

function dailyHandoverLeaveAction(leave) {
  if (leave.status === "待审批") return `<button class="small-button" type="button" data-leave-approve="${escapeHtml(leave.id)}">批准</button>`;
  if (["待补课", "已批准"].includes(leave.status)) return `<button class="small-button" type="button" data-leave-makeup="${escapeHtml(leave.id)}">安排补课</button>`;
  if (leave.status === "已安排补课") return `<button class="small-button" type="button" data-leave-complete="${escapeHtml(leave.id)}">完成</button>`;
  return `<button class="small-button" type="button" data-go="leaves">请假台</button>`;
}

function dailyHandoverLessonRows(date) {
  return (appState.lessons || [])
    .filter((lesson) => lesson.date === date)
    .map((lesson) => {
      const status = dailyHandoverLessonStatus(lesson);
      return {
        id: `lesson:${lesson.id}`,
        type: "课程",
        priority: status === "待点名" || status === "待反馈" ? "高" : lesson.status === "待上课" ? "中" : "低",
        owner: lesson.teacher || "任课老师",
        date: lesson.date,
        title: `${lesson.target} ${lesson.time}`,
        subtitle: lesson.id,
        status,
        detail: dailyHandoverLessonDetail(lesson),
        note: status === "待点名" ? "交接给老师完成点名，课后再确认消课。" : status === "待反馈" ? "课节已完成，交接给老师补发家长反馈。" : "按课表正常交接。",
        lessonId: lesson.id,
        actions: [
          `<button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}">点名</button>`,
          `<button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">反馈</button>`,
          `<button class="small-button" type="button" data-go="schedule">课表</button>`
        ].join("")
      };
    });
}

function dailyHandoverPaymentRows(date) {
  if (typeof ensurePaymentData === "function") ensurePaymentData();
  return (appState.payments || [])
    .filter((payment) => dailyHandoverPaymentDate(payment) === date)
    .map((payment) => ({
      id: `payment:${payment.id}`,
      type: "收款",
      priority: Number(payment.amount || 0) < 0 ? "高" : "低",
      owner: payment.operator || "前台老师",
      date,
      title: `${payment.student} ${money(payment.amount)}`,
      subtitle: payment.id,
      status: Number(payment.amount || 0) < 0 ? "退费" : "已收款",
      detail: `${payment.type || "收款"} / ${payment.method || "线下收款"} / ${payment.orderId || "无订单号"}`,
      note: payment.note || payment.tradeNo || "收款流水已留档。",
      actions: payment.orderId ? `<button class="small-button" type="button" data-go="orders">订单</button>` : ""
    }));
}

function dailyHandoverLeaveRows(date) {
  if (typeof ensureLeaveData === "function") ensureLeaveData();
  return (appState.leaveRequests || [])
    .filter((leave) => leave.lessonDate === date || leave.makeupDate === date)
    .map((leave) => ({
      id: `leave:${leave.id}`,
      type: "请假",
      priority: ["待审批", "待补课", "已批准"].includes(leave.status) ? "高" : "中",
      owner: leave.operator || leave.teacher || "前台老师",
      date,
      title: `${leave.student} ${leave.status}`,
      subtitle: leave.id,
      status: ["已完成", "已驳回"].includes(leave.status) ? "已闭环" : "请假处理中",
      detail: `${leave.target || "课节"} / ${leave.leaveType || "请假"} / ${leave.makeupPlan || "补课待确认"}`,
      note: leave.status === "已安排补课" ? `补课 ${leave.makeupDate || ""} ${leave.makeupTime || ""}`.trim() : leave.reason || "请假补课需继续跟进。",
      actions: [dailyHandoverLeaveAction(leave), `<button class="small-button" type="button" data-go="leaves">请假台</button>`].join("")
    }));
}

function dailyHandoverFollowRows(date) {
  if (typeof ensureFollowUpData === "function") ensureFollowUpData();
  const rows = typeof activeFollowUps === "function" ? activeFollowUps() : (appState.followUps || []).filter((item) => item.status !== "已完成");
  return rows
    .filter((item) => item.dueDate && item.dueDate <= date)
    .map((item) => ({
      id: `follow:${item.id}`,
      type: "跟进",
      priority: item.priority || (item.dueDate < date ? "高" : "中"),
      owner: item.owner || "前台老师",
      date: item.dueDate,
      title: `${item.student} ${item.type}`,
      subtitle: item.phone || item.id,
      status: item.dueDate < date ? "逾期" : "待跟进",
      detail: item.note || item.result || "待联系",
      note: "交接给下一班继续联系家长。",
      actions: [
        `<button class="small-button" type="button" data-follow-result="${escapeHtml(item.id)}" data-result="已联系">已联系</button>`,
        dailyHandoverFollowAction(item, "跟进")
      ].join("")
    }));
}

function dailyHandoverOrderRows(date) {
  return (appState.orders || []).flatMap((order) => {
    const rows = [];
    const debt = Number(order.debt || 0);
    const remaining = typeof orderHoursRemaining === "function" ? orderHoursRemaining(order) : Math.max(0, Number(order.bought || 0) + Number(order.gift || 0) - Number(order.used || 0));
    if (debt > 0 && order.status !== "已作废") {
      rows.push({
        id: `debt:${order.id}`,
        type: "欠费",
        priority: "高",
        owner: order.owner || "前台老师",
        date,
        title: `${order.student} 待收 ${money(debt)}`,
        subtitle: order.id,
        status: "欠费",
        detail: `${order.course || "课程"} / ${order.className || "未分班"} / 已收 ${money(order.paid)}`,
        note: "交接前台或学管继续补缴沟通。",
        actions: [
          `<button class="small-button" type="button" data-pay-order="${escapeHtml(order.id)}">补缴</button>`,
          `<button class="small-button" type="button" data-go="orders">订单</button>`
        ].join("")
      });
    }
    if (remaining > 0 && remaining <= 3 && order.status !== "已作废") {
      rows.push({
        id: `renew:${order.id}`,
        type: "续费",
        priority: "中",
        owner: order.owner || "教务老师",
        date,
        title: `${order.student} 剩余 ${remaining} 课时`,
        subtitle: order.className || order.course || order.id,
        status: "课时不足",
        detail: `${order.course || "课程"} / 有效期 ${order.expireAt || "未设置"}`,
        note: "交接给学管安排续费提醒。",
        actions: dailyHandoverFollowAction({ student: order.student }, "跟进")
      });
    }
    return rows;
  });
}

function dailyHandoverRowsForDate(date) {
  return [
    ...dailyHandoverLessonRows(date),
    ...dailyHandoverPaymentRows(date),
    ...dailyHandoverLeaveRows(date),
    ...dailyHandoverFollowRows(date),
    ...dailyHandoverOrderRows(date)
  ];
}

function dailyHandoverRows() {
  return dailyHandoverRowsForDate(dailyHandoverSelectedDate());
}

function dailyHandoverMatches(row) {
  if (dailyHandoverTypeFilter !== "all" && row.type !== dailyHandoverTypeFilter) return false;
  if (dailyHandoverOwnerFilter !== "all" && row.owner !== dailyHandoverOwnerFilter) return false;
  if (dailyHandoverStatusFilter === "open" && ["已上课", "已收款", "已闭环"].includes(row.status)) return false;
  if (dailyHandoverStatusFilter === "done" && !["已上课", "已收款", "已闭环"].includes(row.status)) return false;
  if (!searchTerm) return true;
  return [row.type, row.owner, row.title, row.subtitle, row.status, row.detail, row.note].join(" ").toLowerCase().includes(searchTerm.toLowerCase());
}

function compareDailyHandoverRows(left, right) {
  if (dailyHandoverSortMode === "type") return `${left.type}${left.owner}${left.title}`.localeCompare(`${right.type}${right.owner}${right.title}`, "zh-CN");
  if (dailyHandoverSortMode === "owner") return `${left.owner}${left.type}${left.title}`.localeCompare(`${right.owner}${right.type}${right.title}`, "zh-CN");
  if (dailyHandoverSortMode === "time") return dailyHandoverDateValue(left.date) - dailyHandoverDateValue(right.date) || text(left.title).localeCompare(text(right.title), "zh-CN");
  return (dailyHandoverPriorityWeight[left.priority] || 9) - (dailyHandoverPriorityWeight[right.priority] || 9) || text(left.type).localeCompare(text(right.type), "zh-CN");
}

function visibleDailyHandoverRows() {
  return dailyHandoverRows().filter(dailyHandoverMatches).sort(compareDailyHandoverRows);
}

function dailyHandoverOptionValues(rows, key, selectedValue, allLabel) {
  const values = [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function renderDailyHandoverToolbar(rows) {
  return `
    <div class="filters daily-handover-toolbar">
      <label>交接日期
        <select id="dailyHandoverDateFilter" aria-label="交接日报日期">
          ${dailyHandoverDateOptions().map((date) => `<option value="${escapeHtml(date)}" ${dailyHandoverSelectedDate() === date ? "selected" : ""}>${escapeHtml(date)}</option>`).join("")}
        </select>
      </label>
      <label>事项类型
        <select id="dailyHandoverTypeFilter" aria-label="交接事项类型">
          ${dailyHandoverOptionValues(rows, "type", dailyHandoverTypeFilter, "全部类型")}
        </select>
      </label>
      <label>负责人
        <select id="dailyHandoverOwnerFilter" aria-label="交接负责人">
          ${dailyHandoverOptionValues(rows, "owner", dailyHandoverOwnerFilter, "全部负责人")}
        </select>
      </label>
      <label>状态
        <select id="dailyHandoverStatusFilter" aria-label="交接事项状态">
          <option value="open" ${dailyHandoverStatusFilter === "open" ? "selected" : ""}>只看待处理</option>
          <option value="all" ${dailyHandoverStatusFilter === "all" ? "selected" : ""}>全部状态</option>
          <option value="done" ${dailyHandoverStatusFilter === "done" ? "selected" : ""}>已完成/已留档</option>
        </select>
      </label>
      <label>排序
        <select id="dailyHandoverSortMode" aria-label="交接日报排序">
          <option value="priority" ${dailyHandoverSortMode === "priority" ? "selected" : ""}>优先级</option>
          <option value="time" ${dailyHandoverSortMode === "time" ? "selected" : ""}>日期时间</option>
          <option value="type" ${dailyHandoverSortMode === "type" ? "selected" : ""}>事项类型</option>
          <option value="owner" ${dailyHandoverSortMode === "owner" ? "selected" : ""}>负责人</option>
        </select>
      </label>
      <button class="small-button" type="button" data-export="dailyHandover">导出交接</button>
    </div>`;
}

function renderDailyHandoverSummary(rows, visibleRows) {
  const open = rows.filter((row) => !["已上课", "已收款", "已闭环"].includes(row.status)).length;
  const teaching = rows.filter((row) => ["课程", "请假"].includes(row.type)).length;
  const business = rows.filter((row) => ["收款", "欠费", "续费", "跟进"].includes(row.type)).length;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 条交接项</small></div>
      <div class="metric"><span>待处理</span><strong>${open}</strong><small>需要下一班继续跟进</small></div>
      <div class="metric"><span>教学交接</span><strong>${teaching}</strong><small>课程、点名、请假</small></div>
      <div class="metric"><span>经营交接</span><strong>${business}</strong><small>收款、欠费、续费</small></div>
    </div>`;
}

function dailyHandoverTags(row) {
  return `<div class="daily-handover-tags">${tag(row.type, row.type === "欠费" || row.type === "请假" ? "red" : row.type === "课程" ? "amber" : "")}${tag(row.priority, dailyHandoverPriorityTone(row.priority))}${tag(row.status, dailyHandoverStatusTone(row.status))}</div>`;
}

function renderDailyHandoverRows(rows) {
  return rows.map((row) => `<tr>
    <td><strong>${escapeHtml(row.title)}</strong><br><span class="muted">${escapeHtml(row.subtitle || row.id)}</span></td>
    <td>${dailyHandoverTags(row)}</td>
    <td>${escapeHtml(row.owner)}</td>
    <td>${escapeHtml(row.date)}</td>
    <td class="daily-handover-note">${escapeHtml(row.detail)}</td>
    <td class="daily-handover-note">${escapeHtml(row.note)}</td>
    <td><div class="daily-handover-actions">${row.actions}</div></td>
  </tr>`);
}

function flattenDailyHandoverRows() {
  return visibleDailyHandoverRows().map((row) => ({
    handoverDate: dailyHandoverSelectedDate(),
    type: row.type,
    priority: row.priority,
    status: row.status,
    owner: row.owner,
    itemDate: row.date,
    title: row.title,
    subtitle: row.subtitle,
    detail: row.detail,
    note: row.note
  }));
}

function appendDailyHandoverPanel() {
  if (currentView !== "dashboard" || appContent.querySelector(".daily-handover-panel")) return;
  const rows = dailyHandoverRows();
  const visibleRows = visibleDailyHandoverRows();
  const panel = `
    <section class="section daily-handover-panel">
      <div class="section-head">
        <div>
          <h3>校区交接日报</h3>
          <span class="muted">把当天课程、请假、收款、欠费、续费和待办整理成可导出的交接清单。</span>
        </div>
        ${tag(`${visibleRows.length} 条`, visibleRows.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${renderDailyHandoverSummary(rows, visibleRows)}
        ${renderDailyHandoverToolbar(rows)}
        ${table(["事项", "类型/状态", "负责人", "日期", "详情", "交接备注", "操作"], renderDailyHandoverRows(visibleRows))}
      </div>
    </section>`;

  const taskPanel = appContent.querySelector(".task-center-panel");
  if (taskPanel) {
    taskPanel.insertAdjacentHTML("afterend", panel);
    return;
  }
  const flowPanel = appContent.querySelector(".operation-flow-panel");
  if (flowPanel) {
    flowPanel.insertAdjacentHTML("afterend", panel);
    return;
  }
  appContent.insertAdjacentHTML("afterbegin", panel);
}

const baseRenderDashboardForDailyHandover = renderDashboard;
renderDashboard = function renderDashboardWithDailyHandover() {
  baseRenderDashboardForDailyHandover();
  appendDailyHandoverPanel();
};

if (typeof exportDataset === "function") {
  const baseExportDatasetForDailyHandover = exportDataset;
  exportDataset = function exportDatasetWithDailyHandover(type) {
    if (type !== "dailyHandover") {
      baseExportDatasetForDailyHandover(type);
      return;
    }
    const columns = [
      ["handoverDate", "交接日期"],
      ["type", "事项类型"],
      ["priority", "优先级"],
      ["status", "状态"],
      ["owner", "负责人"],
      ["itemDate", "事项日期"],
      ["title", "事项"],
      ["subtitle", "编号/补充"],
      ["detail", "详情"],
      ["note", "交接备注"]
    ].map(([key, label]) => ({ key, label }));
    downloadText(`校区交接日报-${dailyHandoverSelectedDate()}.csv`, buildCsv(flattenDailyHandoverRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", `校区交接日报-${dailyHandoverSelectedDate()}.csv 已开始下载。`);
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForDailyHandover = renderDataCenter;
  renderDataCenter = function renderDataCenterWithDailyHandover() {
    baseRenderDataCenterForDailyHandover();
    const dataGrid = appContent.querySelector(".data-grid");
    if (dataGrid && !dataGrid.querySelector('[data-export="dailyHandover"]')) {
      const card = document.createElement("article");
      card.className = "data-card";
      card.innerHTML = `<div><span class="muted">校区交接日报</span><strong>${flattenDailyHandoverRows().length}</strong></div><button class="small-button" type="button" data-export="dailyHandover">导出交接</button>`;
      const reportCard = dataGrid.querySelector('[data-export="reports"]')?.closest(".data-card");
      if (reportCard) {
        reportCard.after(card);
      } else {
        dataGrid.appendChild(card);
      }
    }
    const metricValue = [...appContent.querySelectorAll(".metric")]
      .find((item) => item.textContent.includes("数据表数量"))
      ?.querySelector("strong");
    if (metricValue && dataGrid) metricValue.textContent = String(dataGrid.querySelectorAll(".data-card").length);
  };
}

document.addEventListener("change", (event) => {
  if (event.target.id === "dailyHandoverDateFilter") dailyHandoverDateFilter = event.target.value;
  if (event.target.id === "dailyHandoverTypeFilter") dailyHandoverTypeFilter = event.target.value;
  if (event.target.id === "dailyHandoverOwnerFilter") dailyHandoverOwnerFilter = event.target.value;
  if (event.target.id === "dailyHandoverStatusFilter") dailyHandoverStatusFilter = event.target.value;
  if (event.target.id === "dailyHandoverSortMode") dailyHandoverSortMode = event.target.value;

  if (["dailyHandoverDateFilter", "dailyHandoverTypeFilter", "dailyHandoverOwnerFilter", "dailyHandoverStatusFilter", "dailyHandoverSortMode"].includes(event.target.id) && currentView === "dashboard") {
    renderView();
  }
});

if (currentView === "dashboard" || currentView === "data") {
  renderView();
}
