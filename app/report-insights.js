const reportInsightStyle = document.createElement("style");
reportInsightStyle.textContent = `
  .report-insight-panel {
    margin-top: 16px;
  }

  .report-insight-toolbar {
    align-items: end;
  }

  .report-insight-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .report-insight-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .report-insight-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 280px;
  }

  .report-insight-note {
    max-width: 340px;
    white-space: normal;
    line-height: 1.55;
  }

  @media (max-width: 650px) {
    .report-insight-toolbar,
    .report-insight-toolbar label,
    .report-insight-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(reportInsightStyle);

let reportDimensionFilter = "all";
let reportRiskFilter = "all";
let reportSortMode = "priority";

function reportInsightRiskTags(reasons) {
  if (!reasons.length) return tag("正常", "green");
  return `<div class="report-insight-tags">${reasons.map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function reportInsightScore(reasons) {
  const weights = { debt: 1, lowHours: 2, lowFill: 3, highPending: 4, lowConvert: 5, noIncome: 6 };
  const scores = reasons.map((reason) => weights[reason.key] || 9);
  return Math.min(...scores, 99);
}

function reportInsightRows() {
  ensureReportInputs();

  const courseRows = courseReportRows().map((item) => {
    const reasons = [];
    if (Number(item.debt || 0) > 0) reasons.push({ key: "debt", label: "有欠费", tone: "red" });
    if (Number(item.remaining || 0) > 0 && Number(item.remaining || 0) <= 3) reasons.push({ key: "lowHours", label: "余额低", tone: "amber" });
    if (Number(item.paid || 0) <= 0) reasons.push({ key: "noIncome", label: "未产生收入", tone: "amber" });
    return {
      dimension: "课程",
      dimensionKey: "course",
      name: item.course,
      primary: money(item.paid),
      secondary: `订单 ${item.orderCount}，余额 ${item.remaining}`,
      reasons,
      nextStep: item.debt > 0 ? "优先核对欠费订单，安排前台或顾问当天补缴跟进。" : item.remaining <= 3 ? "把余额低的学员加入续费跟进，避免上完课后再联系。" : "保持当前售卖节奏，定期复查余额和欠费。",
      amount: Number(item.paid || 0),
      count: Number(item.orderCount || 0)
    };
  });

  const classRows = classReportRows().map((item) => {
    const reasons = [];
    if (Number(item.fillRate || 0) < 50) reasons.push({ key: "lowFill", label: "满班率低", tone: "amber" });
    if (Number(item.lessonCount || 0) === 0 && item.status === "开课中") reasons.push({ key: "highPending", label: "缺课节", tone: "red" });
    return {
      dimension: "班级",
      dimensionKey: "class",
      name: item.className,
      primary: `${item.fillRate}%`,
      secondary: `${item.students}/${item.capacity} 人，${item.course}`,
      reasons,
      nextStep: item.fillRate < 50 ? "班级未满员，建议从同年级意向学员和线索里补招。" : "班级容量较健康，继续关注请假、消课和续费节奏。",
      amount: Number(item.fillRate || 0),
      count: Number(item.students || 0)
    };
  });

  const teacherRows = teacherReportRows().map((item) => {
    const reasons = [];
    if (Number(item.pending || 0) >= 3) reasons.push({ key: "highPending", label: "待上课多", tone: "amber" });
    if (Number(item.lessonCount || 0) === 0) reasons.push({ key: "noIncome", label: "暂无课节", tone: "amber" });
    return {
      dimension: "教师",
      dimensionKey: "teacher",
      name: item.teacher,
      primary: `${item.lessonCount} 节`,
      secondary: `待上 ${item.pending}，已上 ${item.done}，${item.scheduledHours} 小时`,
      reasons,
      nextStep: item.pending >= 3 ? "提醒老师提前核对课表和课后反馈，避免集中补录。" : "课节负荷正常，可继续观察排课饱和度。",
      amount: Number(item.scheduledHours || 0),
      count: Number(item.lessonCount || 0)
    };
  });

  const channelRows = channelReportRows().map((item) => {
    const reasons = [];
    if (Number(item.debt || 0) > 0) reasons.push({ key: "debt", label: "渠道欠费", tone: "red" });
    if (Number(item.students || 0) > 0 && Number(item.enrolled || 0) === 0) reasons.push({ key: "lowConvert", label: "未转化", tone: "amber" });
    if (Number(item.paid || 0) <= 0) reasons.push({ key: "noIncome", label: "无收入", tone: "amber" });
    return {
      dimension: "渠道",
      dimensionKey: "channel",
      name: item.channel,
      primary: money(item.paid),
      secondary: `学员 ${item.students}，报名 ${item.enrolled}，意向 ${item.intent}`,
      reasons,
      nextStep: item.enrolled === 0 ? "复盘渠道话术和试听转化，优先跟进仍在意向阶段的家长。" : item.debt > 0 ? "核对该渠道已报名学员欠费，避免收入统计虚高。" : "渠道表现稳定，可继续跟踪后续转介绍。",
      amount: Number(item.paid || 0),
      count: Number(item.students || 0)
    };
  });

  return [...courseRows, ...classRows, ...teacherRows, ...channelRows];
}

function reportInsightMatches(row) {
  if (reportDimensionFilter !== "all" && row.dimensionKey !== reportDimensionFilter) return false;
  if (reportRiskFilter === "healthy") return row.reasons.length === 0;
  if (reportRiskFilter !== "all" && !row.reasons.some((reason) => reason.key === reportRiskFilter)) return false;
  return true;
}

function compareReportInsights(left, right) {
  if (reportSortMode === "amountDesc") return Number(right.amount || 0) - Number(left.amount || 0);
  if (reportSortMode === "countDesc") return Number(right.count || 0) - Number(left.count || 0);
  if (reportSortMode === "dimension") {
    const dimensionGap = text(left.dimension).localeCompare(text(right.dimension), "zh-CN");
    return dimensionGap || text(left.name).localeCompare(text(right.name), "zh-CN");
  }
  const riskGap = reportInsightScore(left.reasons) - reportInsightScore(right.reasons);
  return riskGap || Number(right.amount || 0) - Number(left.amount || 0);
}

function renderReportInsightToolbar() {
  return `
    <div class="filters report-insight-toolbar">
      <label>维度
        <select id="reportDimensionFilter" aria-label="按报表维度筛选">
          <option value="all" ${reportDimensionFilter === "all" ? "selected" : ""}>全部维度</option>
          <option value="course" ${reportDimensionFilter === "course" ? "selected" : ""}>课程</option>
          <option value="class" ${reportDimensionFilter === "class" ? "selected" : ""}>班级</option>
          <option value="teacher" ${reportDimensionFilter === "teacher" ? "selected" : ""}>教师</option>
          <option value="channel" ${reportDimensionFilter === "channel" ? "selected" : ""}>渠道</option>
        </select>
      </label>
      <label>诊断
        <select id="reportRiskFilter" aria-label="按经营诊断筛选">
          <option value="all" ${reportRiskFilter === "all" ? "selected" : ""}>全部情况</option>
          <option value="debt" ${reportRiskFilter === "debt" ? "selected" : ""}>欠费</option>
          <option value="lowHours" ${reportRiskFilter === "lowHours" ? "selected" : ""}>余额低</option>
          <option value="lowFill" ${reportRiskFilter === "lowFill" ? "selected" : ""}>满班率低</option>
          <option value="highPending" ${reportRiskFilter === "highPending" ? "selected" : ""}>课节待处理</option>
          <option value="lowConvert" ${reportRiskFilter === "lowConvert" ? "selected" : ""}>转化弱</option>
          <option value="noIncome" ${reportRiskFilter === "noIncome" ? "selected" : ""}>无收入/无课节</option>
          <option value="healthy" ${reportRiskFilter === "healthy" ? "selected" : ""}>正常项</option>
        </select>
      </label>
      <label>排序
        <select id="reportSortMode" aria-label="经营诊断排序">
          <option value="priority" ${reportSortMode === "priority" ? "selected" : ""}>风险优先</option>
          <option value="amountDesc" ${reportSortMode === "amountDesc" ? "selected" : ""}>金额/占比降序</option>
          <option value="countDesc" ${reportSortMode === "countDesc" ? "selected" : ""}>数量降序</option>
          <option value="dimension" ${reportSortMode === "dimension" ? "selected" : ""}>维度分组</option>
        </select>
      </label>
    </div>`;
}

function renderReportInsightSummary(rows, visibleRows) {
  const risky = rows.filter((row) => row.reasons.length).length;
  const debtItems = rows.filter((row) => row.reasons.some((reason) => reason.key === "debt")).length;
  const lowFillItems = rows.filter((row) => row.reasons.some((reason) => reason.key === "lowFill")).length;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 个经营观察项</small></div>
      <div class="metric"><span>需关注项</span><strong>${risky}</strong><small>按风险优先排序处理</small></div>
      <div class="metric"><span>欠费相关</span><strong>${debtItems}</strong><small>建议当天核对收款</small></div>
      <div class="metric"><span>满班率低</span><strong>${lowFillItems}</strong><small>可联动招生线索补招</small></div>
    </div>`;
}

function renderReportInsightRows(rows) {
  return rows.map(
    (row) => `<tr>
      <td>${tag(row.dimension, "")}</td>
      <td><strong>${escapeHtml(row.name)}</strong><br><span class="muted">${escapeHtml(row.secondary)}</span></td>
      <td>${escapeHtml(row.primary)}</td>
      <td>${reportInsightRiskTags(row.reasons)}</td>
      <td class="report-insight-note">${escapeHtml(row.nextStep)}</td>
    </tr>`
  );
}

function appendReportInsights() {
  if (currentView !== "reports" || appContent.querySelector(".report-insight-panel")) return;
  const rows = reportInsightRows();
  const visibleRows = rows.filter(reportInsightMatches).sort(compareReportInsights);
  appContent.insertAdjacentHTML(
    "beforeend",
    `<section class="section report-insight-panel">
      <div class="section-head">
        <div>
          <h3>经营诊断清单</h3>
          <span class="muted">把课程、班级、教师和渠道数据转成可处理事项，方便校长每天复盘。</span>
        </div>
        ${tag(`${visibleRows.length} 项`, visibleRows.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${renderReportInsightSummary(rows, visibleRows)}
        ${renderReportInsightToolbar()}
        ${table(["维度", "对象", "关键数值", "诊断", "下一步"], renderReportInsightRows(visibleRows))}
      </div>
    </section>`
  );
}

const baseRenderReportsForInsights = renderReports;
renderReports = function renderReportsWithInsights() {
  baseRenderReportsForInsights();
  appendReportInsights();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "reportDimensionFilter") reportDimensionFilter = event.target.value;
  if (event.target.id === "reportRiskFilter") reportRiskFilter = event.target.value;
  if (event.target.id === "reportSortMode") reportSortMode = event.target.value;

  if (["reportDimensionFilter", "reportRiskFilter", "reportSortMode"].includes(event.target.id) && currentView === "reports") {
    renderView();
  }
});

if (currentView === "reports") {
  renderView();
}
