const orderRiskStyle = document.createElement("style");
orderRiskStyle.textContent = `
  .order-risk-panel {
    margin-top: 16px;
  }

  .order-risk-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .order-risk-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .order-risk-tags,
  .order-risk-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .order-risk-tags {
    max-width: 260px;
  }

  @media (max-width: 650px) {
    .order-risk-toolbar,
    .order-risk-toolbar label,
    .order-risk-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(orderRiskStyle);

let orderRiskFilter = "all";
let orderClassFilter = "all";
let orderOwnerFilter = "all";
let orderSortMode = "risk";

function orderHoursRemaining(order) {
  if (typeof orderRemainingHours === "function") return orderRemainingHours(order);
  return Math.max(0, Number(order.bought || 0) + Number(order.gift || 0) - Number(order.used || 0));
}

function daysUntilOrderExpire(order) {
  const expireDate = new Date(`${order.expireAt}T00:00:00`);
  const today = new Date(`${todayIsoDate()}T00:00:00`);
  if (!Number.isFinite(expireDate.getTime()) || !Number.isFinite(today.getTime())) return Infinity;
  return Math.ceil((expireDate - today) / 86400000);
}

function orderRiskReasons(order) {
  const reasons = [];
  const debt = Number(order.debt || 0);
  const remaining = orderHoursRemaining(order);
  const expireDays = daysUntilOrderExpire(order);

  if (order.status === "已作废") reasons.push({ key: "voided", label: "已作废", tone: "red" });
  if (debt > 0) reasons.push({ key: "debt", label: "欠费", tone: "red" });
  if (remaining > 0 && remaining <= 3) reasons.push({ key: "lowHours", label: "课时不足", tone: "amber" });
  if (expireDays < 0) reasons.push({ key: "expired", label: "已过期", tone: "red" });
  if (expireDays >= 0 && expireDays <= 30) reasons.push({ key: "expiring", label: "即将到期", tone: "amber" });
  if (!order.student || !order.className || !order.course) reasons.push({ key: "dataIssue", label: "资料异常", tone: "red" });

  return reasons;
}

function orderMatchesRisk(order, riskKey) {
  if (riskKey === "all") return true;
  if (riskKey === "healthy") return orderRiskReasons(order).length === 0;
  return orderRiskReasons(order).some((reason) => reason.key === riskKey);
}

function orderMatchesRiskFilters(order) {
  if (!matchesRow(order)) return false;
  if (orderClassFilter !== "all" && order.className !== orderClassFilter) return false;
  if (orderOwnerFilter !== "all" && order.owner !== orderOwnerFilter) return false;
  return orderMatchesRisk(order, orderRiskFilter);
}

function orderRiskScore(order) {
  const weights = { voided: 1, debt: 2, expired: 3, lowHours: 4, expiring: 5, dataIssue: 6 };
  const scores = orderRiskReasons(order).map((reason) => weights[reason.key] || 9);
  return Math.min(...scores, 99);
}

function compareRiskOrders(left, right) {
  if (orderSortMode === "debtDesc") return Number(right.debt || 0) - Number(left.debt || 0);
  if (orderSortMode === "hoursAsc") return orderHoursRemaining(left) - orderHoursRemaining(right);
  if (orderSortMode === "expireAsc") return daysUntilOrderExpire(left) - daysUntilOrderExpire(right);
  const riskGap = orderRiskScore(left) - orderRiskScore(right);
  if (riskGap) return riskGap;
  return text(left.student).localeCompare(text(right.student), "zh-CN");
}

function orderRiskTags(order) {
  const reasons = orderRiskReasons(order);
  if (!reasons.length) return tag("正常", "green");
  return `<div class="order-risk-tags">${reasons.map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function orderUniqueOptions(rows, key, selectedValue, allLabel) {
  const values = [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function renderOrderRiskToolbar() {
  return `
    <div class="filters order-risk-toolbar">
      <label>待处理
        <select id="orderRiskFilter" aria-label="按订单待处理事项筛选">
          <option value="all" ${orderRiskFilter === "all" ? "selected" : ""}>全部情况</option>
          <option value="debt" ${orderRiskFilter === "debt" ? "selected" : ""}>欠费</option>
          <option value="lowHours" ${orderRiskFilter === "lowHours" ? "selected" : ""}>课时不足</option>
          <option value="expiring" ${orderRiskFilter === "expiring" ? "selected" : ""}>即将到期</option>
          <option value="expired" ${orderRiskFilter === "expired" ? "selected" : ""}>已过期</option>
          <option value="voided" ${orderRiskFilter === "voided" ? "selected" : ""}>已作废</option>
          <option value="dataIssue" ${orderRiskFilter === "dataIssue" ? "selected" : ""}>资料异常</option>
          <option value="healthy" ${orderRiskFilter === "healthy" ? "selected" : ""}>无待处理</option>
        </select>
      </label>
      <label>班级
        <select id="orderClassFilter" aria-label="按班级筛选订单">
          ${orderUniqueOptions(appState.orders, "className", orderClassFilter, "全部班级")}
        </select>
      </label>
      <label>经办人
        <select id="orderOwnerFilter" aria-label="按经办人筛选订单">
          ${orderUniqueOptions(appState.orders, "owner", orderOwnerFilter, "全部经办人")}
        </select>
      </label>
      <label>排序
        <select id="orderSortMode" aria-label="订单风险排序">
          <option value="risk" ${orderSortMode === "risk" ? "selected" : ""}>风险优先</option>
          <option value="debtDesc" ${orderSortMode === "debtDesc" ? "selected" : ""}>欠费金额降序</option>
          <option value="hoursAsc" ${orderSortMode === "hoursAsc" ? "selected" : ""}>剩余课时升序</option>
          <option value="expireAsc" ${orderSortMode === "expireAsc" ? "selected" : ""}>有效期升序</option>
        </select>
      </label>
    </div>`;
}

function orderRiskSummary(visibleOrders) {
  const totalDebt = appState.orders.reduce((sum, order) => sum + Number(order.debt || 0), 0);
  const debtOrders = appState.orders.filter((order) => Number(order.debt || 0) > 0).length;
  const lowHours = appState.orders.filter((order) => orderHoursRemaining(order) > 0 && orderHoursRemaining(order) <= 3).length;
  const expiring = appState.orders.filter((order) => {
    const days = daysUntilOrderExpire(order);
    return days >= 0 && days <= 30;
  }).length;

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleOrders.length}</strong><small>全部 ${appState.orders.length} 笔订单</small></div>
      <div class="metric"><span>待收欠费</span><strong>${money(totalDebt)}</strong><small>${debtOrders} 笔订单待补缴</small></div>
      <div class="metric"><span>课时不足</span><strong>${lowHours}</strong><small>建议提醒续费</small></div>
      <div class="metric"><span>30 天到期</span><strong>${expiring}</strong><small>需要提前跟进</small></div>
    </div>`;
}

function renderOrderRiskRows(orders) {
  return orders.map((order) => {
    const debt = Number(order.debt || 0);
    const remaining = orderHoursRemaining(order);
    const voided = order.status === "已作废";
    return `<tr>
      <td><strong>${escapeHtml(order.student)}</strong><br><span class="muted">${escapeHtml(order.id)}</span></td>
      <td>${escapeHtml(order.course)}<br><span class="muted">${escapeHtml(order.className)}</span></td>
      <td>${Number(order.bought || 0)} + ${Number(order.gift || 0)}<br><span class="muted">已上 ${Number(order.used || 0)}</span></td>
      <td>${tag(remaining, remaining <= 3 && remaining > 0 ? "amber" : "green")}</td>
      <td>${money(order.paid)}</td>
      <td>${debt ? tag(money(debt), "red") : tag("无", "green")}</td>
      <td>${escapeHtml(order.expireAt)}<br><span class="muted">${Number.isFinite(daysUntilOrderExpire(order)) ? `${daysUntilOrderExpire(order)} 天` : "-"}</span></td>
      <td>${orderRiskTags(order)}</td>
      <td>
        <div class="order-risk-actions">
          <button class="small-button" type="button" data-pay-order="${escapeHtml(order.id)}" ${debt <= 0 || voided ? "disabled" : ""}>补缴</button>
          <button class="small-button" type="button" data-finance-adjust="refund" data-order-id="${escapeHtml(order.id)}" ${voided ? "disabled" : ""}>退费</button>
          <button class="small-button" type="button" data-finance-adjust="hours" data-order-id="${escapeHtml(order.id)}" ${voided ? "disabled" : ""}>课时调整</button>
        </div>
      </td>
    </tr>`;
  });
}

function appendOrderRiskPanel() {
  if (currentView !== "orders" || appContent.querySelector(".order-risk-panel")) return;
  const visibleOrders = appState.orders.filter(orderMatchesRiskFilters).sort(compareRiskOrders);
  appContent.insertAdjacentHTML(
    "beforeend",
    `<section class="section order-risk-panel">
      <div class="section-head">
        <div>
          <h3>订单风险清单</h3>
          <span class="muted">筛选欠费、课时不足和有效期风险，方便前台催缴、续费和财务对账。</span>
        </div>
        ${tag(`${visibleOrders.length} 笔`, visibleOrders.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${orderRiskSummary(visibleOrders)}
        ${renderOrderRiskToolbar()}
        ${table(["学员/订单", "课程班级", "购买课时", "余额", "实收", "欠费", "有效期", "待处理", "操作"], renderOrderRiskRows(visibleOrders))}
      </div>
    </section>`
  );
}

const baseRenderOrdersForRiskList = renderOrders;
renderOrders = function renderOrdersWithRiskList() {
  baseRenderOrdersForRiskList();
  appendOrderRiskPanel();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "orderRiskFilter") orderRiskFilter = event.target.value;
  if (event.target.id === "orderClassFilter") orderClassFilter = event.target.value;
  if (event.target.id === "orderOwnerFilter") orderOwnerFilter = event.target.value;
  if (event.target.id === "orderSortMode") orderSortMode = event.target.value;

  if (["orderRiskFilter", "orderClassFilter", "orderOwnerFilter", "orderSortMode"].includes(event.target.id) && currentView === "orders") {
    renderView();
  }
});

if (currentView === "orders") {
  renderView();
}
