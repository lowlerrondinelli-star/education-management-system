const studentHourAuditStyle = document.createElement("style");
studentHourAuditStyle.textContent = `
  .hour-audit-panel {
    margin-top: 16px;
  }

  .hour-audit-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .hour-audit-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .hour-audit-tags,
  .hour-audit-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .hour-audit-note {
    max-width: 300px;
    line-height: 1.5;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .hour-audit-toolbar,
    .hour-audit-toolbar label,
    .hour-audit-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(studentHourAuditStyle);

let hourAuditStatusFilter = "all";
let hourAuditClassFilter = "all";
let hourAuditOwnerFilter = "all";
let hourAuditSortMode = "risk";

function hourAuditOrderRemaining(order) {
  if (typeof orderRemainingHours === "function") return orderRemainingHours(order);
  return Math.max(0, Number(order.bought || 0) + Number(order.gift || 0) - Number(order.used || 0));
}

function hourAuditStudentOrders(student) {
  return appState.orders.filter((order) => order.student === student.name && order.status !== "已作废");
}

function hourAuditStudentLedger(student) {
  return appState.ledger.filter((item) => item.student === student.name);
}

function hourAuditLedgerNet(student) {
  return hourAuditStudentLedger(student).reduce((sum, item) => sum + Number(item.change || 0), 0);
}

function hourAuditOrderBought(student) {
  return hourAuditStudentOrders(student).reduce((sum, order) => sum + Number(order.bought || 0) + Number(order.gift || 0), 0);
}

function hourAuditOrderUsed(student) {
  return hourAuditStudentOrders(student).reduce((sum, order) => sum + Number(order.used || 0), 0);
}

function hourAuditOrderRemainingTotal(student) {
  return hourAuditStudentOrders(student).reduce((sum, order) => sum + hourAuditOrderRemaining(order), 0);
}

function hourAuditDebtTotal(student) {
  return hourAuditStudentOrders(student).reduce((sum, order) => sum + Number(order.debt || 0), 0);
}

function hourAuditClassName(student) {
  return student.className || "待分班";
}

function hourAuditRows() {
  return appState.students.map((student) => {
    const orders = hourAuditStudentOrders(student);
    const bought = hourAuditOrderBought(student);
    const used = hourAuditOrderUsed(student);
    const orderRemaining = hourAuditOrderRemainingTotal(student);
    const profileBalance = Number(student.balance || 0);
    const debt = hourAuditDebtTotal(student);
    const ledgerCount = hourAuditStudentLedger(student).length;
    const ledgerNet = hourAuditLedgerNet(student);
    const difference = profileBalance - orderRemaining;
    return {
      studentId: student.id,
      student: student.name,
      phone: student.phone,
      grade: student.grade,
      className: hourAuditClassName(student),
      owner: student.owner || "",
      studentStatus: student.status,
      orderCount: orders.length,
      bought,
      used,
      orderRemaining,
      profileBalance,
      difference,
      debt,
      ledgerCount,
      ledgerNet
    };
  });
}

function hourAuditReasons(row) {
  const reasons = [];
  if (!row.orderCount && row.studentStatus === "已报名") reasons.push({ key: "noOrder", label: "已报名无订单", tone: "red" });
  if (Math.abs(Number(row.difference || 0)) > 0.001) reasons.push({ key: "mismatch", label: "余额不一致", tone: "red" });
  if (Number(row.debt || 0) > 0) reasons.push({ key: "debt", label: "有欠费", tone: "red" });
  if (Number(row.profileBalance || 0) > 0 && Number(row.profileBalance || 0) <= 3) reasons.push({ key: "lowBalance", label: "课时不足", tone: "amber" });
  if (Number(row.profileBalance || 0) === 0 && row.studentStatus === "已报名") reasons.push({ key: "zeroBalance", label: "余额为 0", tone: "amber" });
  if (!row.className || row.className === "待分班") reasons.push({ key: "unassigned", label: "待分班", tone: "amber" });
  if (!reasons.length) reasons.push({ key: "healthy", label: "正常", tone: "green" });
  return reasons;
}

function hourAuditMatchesStatus(row) {
  if (hourAuditStatusFilter === "all") return true;
  return hourAuditReasons(row).some((reason) => reason.key === hourAuditStatusFilter);
}

function hourAuditMatches(row) {
  if (!matchesRow(row)) return false;
  if (hourAuditClassFilter !== "all" && row.className !== hourAuditClassFilter) return false;
  if (hourAuditOwnerFilter !== "all" && row.owner !== hourAuditOwnerFilter) return false;
  return hourAuditMatchesStatus(row);
}

function hourAuditRiskScore(row) {
  const weights = { mismatch: 1, noOrder: 2, debt: 3, zeroBalance: 4, lowBalance: 5, unassigned: 6, healthy: 9 };
  return Math.min(...hourAuditReasons(row).map((reason) => weights[reason.key] || 9));
}

function compareHourAuditRows(left, right) {
  if (hourAuditSortMode === "student") return text(left.student).localeCompare(text(right.student), "zh-CN");
  if (hourAuditSortMode === "balanceAsc") return Number(left.profileBalance || 0) - Number(right.profileBalance || 0);
  if (hourAuditSortMode === "debtDesc") return Number(right.debt || 0) - Number(left.debt || 0);
  if (hourAuditSortMode === "differenceAbs") return Math.abs(Number(right.difference || 0)) - Math.abs(Number(left.difference || 0));
  const riskGap = hourAuditRiskScore(left) - hourAuditRiskScore(right);
  return riskGap || text(left.className).localeCompare(text(right.className), "zh-CN") || text(left.student).localeCompare(text(right.student), "zh-CN");
}

function hourAuditOptionValues(rows, key, selectedValue, allLabel) {
  const values = [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function renderHourAuditToolbar(rows) {
  return `
    <div class="filters hour-audit-toolbar">
      <label>核对状态
        <select id="hourAuditStatusFilter" aria-label="学员课时账户核对状态筛选">
          <option value="all" ${hourAuditStatusFilter === "all" ? "selected" : ""}>全部情况</option>
          <option value="mismatch" ${hourAuditStatusFilter === "mismatch" ? "selected" : ""}>余额不一致</option>
          <option value="noOrder" ${hourAuditStatusFilter === "noOrder" ? "selected" : ""}>已报名无订单</option>
          <option value="debt" ${hourAuditStatusFilter === "debt" ? "selected" : ""}>有欠费</option>
          <option value="lowBalance" ${hourAuditStatusFilter === "lowBalance" ? "selected" : ""}>课时不足</option>
          <option value="zeroBalance" ${hourAuditStatusFilter === "zeroBalance" ? "selected" : ""}>余额为 0</option>
          <option value="unassigned" ${hourAuditStatusFilter === "unassigned" ? "selected" : ""}>待分班</option>
          <option value="healthy" ${hourAuditStatusFilter === "healthy" ? "selected" : ""}>正常</option>
        </select>
      </label>
      <label>班级
        <select id="hourAuditClassFilter" aria-label="学员课时账户班级筛选">
          ${hourAuditOptionValues(rows, "className", hourAuditClassFilter, "全部班级")}
        </select>
      </label>
      <label>负责人
        <select id="hourAuditOwnerFilter" aria-label="学员课时账户负责人筛选">
          ${hourAuditOptionValues(rows, "owner", hourAuditOwnerFilter, "全部负责人")}
        </select>
      </label>
      <label>排序
        <select id="hourAuditSortMode" aria-label="学员课时账户排序">
          <option value="risk" ${hourAuditSortMode === "risk" ? "selected" : ""}>风险优先</option>
          <option value="differenceAbs" ${hourAuditSortMode === "differenceAbs" ? "selected" : ""}>差异最大</option>
          <option value="balanceAsc" ${hourAuditSortMode === "balanceAsc" ? "selected" : ""}>余额升序</option>
          <option value="debtDesc" ${hourAuditSortMode === "debtDesc" ? "selected" : ""}>欠费降序</option>
          <option value="student" ${hourAuditSortMode === "student" ? "selected" : ""}>学员姓名</option>
        </select>
      </label>
    </div>`;
}

function hourAuditSummary(rows, visibleRows) {
  const mismatch = rows.filter((row) => hourAuditReasons(row).some((reason) => reason.key === "mismatch")).length;
  const debtTotal = rows.reduce((sum, row) => sum + Number(row.debt || 0), 0);
  const lowBalance = rows.filter((row) => hourAuditReasons(row).some((reason) => ["lowBalance", "zeroBalance"].includes(reason.key))).length;
  const healthy = rows.filter((row) => hourAuditReasons(row).some((reason) => reason.key === "healthy")).length;

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 名学员</small></div>
      <div class="metric"><span>余额差异</span><strong>${mismatch}</strong><small>档案余额与订单余额不一致</small></div>
      <div class="metric"><span>低课时</span><strong>${lowBalance}</strong><small>余额为 0 或不高于 3</small></div>
      <div class="metric"><span>待收欠费</span><strong>${money(debtTotal)}</strong><small>${healthy} 名账户正常</small></div>
    </div>`;
}

function renderHourAuditTags(row) {
  return `<div class="hour-audit-tags">${hourAuditReasons(row).map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function renderHourAuditRows(rows) {
  return rows.map((row) => {
    const diffTone = Math.abs(Number(row.difference || 0)) > 0.001 ? "red" : "green";
    return `<tr>
      <td><strong>${escapeHtml(row.student)}</strong><br><span class="muted">${escapeHtml(row.studentId)} / ${escapeHtml(row.phone)}</span></td>
      <td>${escapeHtml(row.className)}<br><span class="muted">${escapeHtml(row.grade)} / ${escapeHtml(row.owner || "未分配")}</span></td>
      <td>${row.orderCount} 笔<br><span class="muted">购赠 ${row.bought} / 已上 ${row.used}</span></td>
      <td>${tag(row.profileBalance, Number(row.profileBalance || 0) <= 3 ? "amber" : "green")}</td>
      <td>${tag(row.orderRemaining, Number(row.orderRemaining || 0) <= 3 ? "amber" : "green")}</td>
      <td>${tag(row.difference > 0 ? `+${row.difference}` : row.difference, diffTone)}</td>
      <td>${row.debt ? tag(money(row.debt), "red") : tag("无", "green")}</td>
      <td class="hour-audit-note">${renderHourAuditTags(row)}<span class="muted">流水 ${row.ledgerCount} 条，净变动 ${row.ledgerNet}</span></td>
      <td>
        <div class="hour-audit-actions">
          <button class="small-button" type="button" data-hour-audit-student="${escapeHtml(row.studentId)}">学员详情</button>
          <button class="small-button" type="button" data-go="consume">看流水</button>
        </div>
      </td>
    </tr>`;
  });
}

function appendHourAuditPanel() {
  if (currentView !== "orders" || appContent.querySelector(".hour-audit-panel")) return;
  const rows = hourAuditRows();
  const visibleRows = rows.filter(hourAuditMatches).sort(compareHourAuditRows);

  appContent.insertAdjacentHTML(
    "beforeend",
    `<section class="section hour-audit-panel">
      <div class="section-head">
        <div>
          <h3>学员课时账户核对</h3>
          <span class="muted">对比学员档案余额、订单剩余课时和消课流水，及时发现余额不一致、欠费和低课时。</span>
        </div>
        ${tag(`${visibleRows.length} 名`, visibleRows.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${hourAuditSummary(rows, visibleRows)}
        ${renderHourAuditToolbar(rows)}
        ${table(["学员", "班级/负责人", "订单课时", "档案余额", "订单余额", "差异", "欠费", "核对状态", "操作"], renderHourAuditRows(visibleRows))}
      </div>
    </section>`
  );
}

const baseRenderOrdersForHourAudit = renderOrders;
renderOrders = function renderOrdersWithHourAudit() {
  baseRenderOrdersForHourAudit();
  appendHourAuditPanel();
};

function flattenHourAuditRows() {
  return hourAuditRows().map((row) => ({
    ...row,
    auditStatus: hourAuditReasons(row).map((reason) => reason.label).join("、")
  }));
}

if (typeof exportDataset === "function") {
  const baseExportDatasetForHourAudit = exportDataset;
  exportDataset = function exportDatasetWithHourAudit(type) {
    if (type !== "hourAudit") {
      baseExportDatasetForHourAudit(type);
      return;
    }
    const columns = [
      ["studentId", "学员编号"],
      ["student", "学员姓名"],
      ["phone", "手机号"],
      ["grade", "年级"],
      ["className", "班级"],
      ["owner", "负责人"],
      ["studentStatus", "学员状态"],
      ["orderCount", "订单数"],
      ["bought", "购赠课时"],
      ["used", "订单已上"],
      ["orderRemaining", "订单余额"],
      ["profileBalance", "档案余额"],
      ["difference", "余额差异"],
      ["debt", "欠费"],
      ["ledgerCount", "流水条数"],
      ["ledgerNet", "流水净变动"],
      ["auditStatus", "核对状态"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("学员课时账户核对.csv", buildCsv(flattenHourAuditRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "学员课时账户核对.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForHourAudit = renderDataCenter;
  renderDataCenter = function renderDataCenterWithHourAudit() {
    baseRenderDataCenterForHourAudit();
    const metricValue = [...appContent.querySelectorAll(".metric")]
      .find((item) => item.textContent.includes("数据表数量"))
      ?.querySelector("strong");
    if (metricValue) metricValue.textContent = "24";

    const dataGrid = appContent.querySelector(".data-grid");
    if (!dataGrid || dataGrid.querySelector('[data-export="hourAudit"]')) return;
    const card = document.createElement("article");
    card.className = "data-card";
    card.innerHTML = `<div><span class="muted">学员课时账户核对</span><strong>${flattenHourAuditRows().length}</strong></div><button class="small-button" type="button" data-export="hourAudit">导出核对</button>`;
    const ledgerCard = dataGrid.querySelector('[data-export="ledger"]')?.closest(".data-card");
    if (ledgerCard) {
      ledgerCard.after(card);
    } else {
      dataGrid.appendChild(card);
    }
  };
}

document.addEventListener("change", (event) => {
  if (event.target.id === "hourAuditStatusFilter") hourAuditStatusFilter = event.target.value;
  if (event.target.id === "hourAuditClassFilter") hourAuditClassFilter = event.target.value;
  if (event.target.id === "hourAuditOwnerFilter") hourAuditOwnerFilter = event.target.value;
  if (event.target.id === "hourAuditSortMode") hourAuditSortMode = event.target.value;

  if (["hourAuditStatusFilter", "hourAuditClassFilter", "hourAuditOwnerFilter", "hourAuditSortMode"].includes(event.target.id) && currentView === "orders") {
    renderView();
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-hour-audit-student]");
  if (!button) return;
  if (typeof showStudentProfile === "function") showStudentProfile(button.dataset.hourAuditStudent);
});

if (currentView === "orders" || currentView === "data") {
  renderView();
}
