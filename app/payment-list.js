const paymentListStyle = document.createElement("style");
paymentListStyle.textContent = `
  .payment-list-panel {
    margin-top: 16px;
  }

  .payment-list-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .payment-list-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .payment-list-actions,
  .payment-list-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .payment-list-note {
    max-width: 280px;
    line-height: 1.5;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .payment-list-toolbar,
    .payment-list-toolbar label,
    .payment-list-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(paymentListStyle);

let paymentTypeFilter = "all";
let paymentMethodFilter = "all";
let paymentOperatorFilter = "all";
let paymentSortMode = "timeDesc";

function paymentRows() {
  if (typeof ensurePaymentData === "function") ensurePaymentData();
  return Array.isArray(appState.payments) ? appState.payments : [];
}

function paymentDateRank(payment) {
  const date = new Date(text(payment.paidAt).replace(" ", "T"));
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function paymentTone(payment) {
  const amount = Number(payment.amount || 0);
  if (amount < 0 || payment.type === "退费") return "red";
  if (payment.type === "欠费补缴") return "amber";
  return "green";
}

function paymentDebtChange(payment) {
  const before = Number(payment.beforeDebt || 0);
  const after = Number(payment.afterDebt || 0);
  if (!before && !after) return "无欠费变化";
  return `${money(before)} -> ${money(after)}`;
}

function paymentListUniqueOptions(rows, key, selectedValue, allLabel) {
  const values = [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function paymentMatchesListFilters(payment) {
  if (!matchesRow(payment)) return false;
  if (paymentTypeFilter !== "all" && payment.type !== paymentTypeFilter) return false;
  if (paymentMethodFilter !== "all" && payment.method !== paymentMethodFilter) return false;
  if (paymentOperatorFilter !== "all" && payment.operator !== paymentOperatorFilter) return false;
  return true;
}

function comparePaymentRows(left, right) {
  if (paymentSortMode === "timeAsc") return paymentDateRank(left) - paymentDateRank(right);
  if (paymentSortMode === "amountDesc") return Number(right.amount || 0) - Number(left.amount || 0);
  if (paymentSortMode === "student") {
    const studentGap = text(left.student).localeCompare(text(right.student), "zh-CN");
    return studentGap || paymentDateRank(right) - paymentDateRank(left);
  }
  if (paymentSortMode === "operator") {
    const operatorGap = text(left.operator).localeCompare(text(right.operator), "zh-CN");
    return operatorGap || paymentDateRank(right) - paymentDateRank(left);
  }
  return paymentDateRank(right) - paymentDateRank(left);
}

function paymentListSummary(rows, visibleRows) {
  const income = visibleRows.filter((payment) => Number(payment.amount || 0) > 0).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const refunds = Math.abs(visibleRows.filter((payment) => Number(payment.amount || 0) < 0).reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const net = visibleRows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const debt = typeof orderDebtTotal === "function" ? orderDebtTotal() : appState.orders.reduce((sum, order) => sum + Number(order.debt || 0), 0);

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 条流水</small></div>
      <div class="metric"><span>收入/退费</span><strong>${money(income)}</strong><small>退费 ${money(refunds)}</small></div>
      <div class="metric"><span>净收款</span><strong>${money(net)}</strong><small>按当前筛选汇总</small></div>
      <div class="metric"><span>待收欠费</span><strong>${money(debt)}</strong><small>来自订单欠费</small></div>
    </div>`;
}

function renderPaymentListToolbar(rows) {
  return `
    <div class="filters payment-list-toolbar">
      <label>流水类型
        <select id="paymentTypeFilter" aria-label="收款流水类型筛选">
          ${paymentListUniqueOptions(rows, "type", paymentTypeFilter, "全部类型")}
        </select>
      </label>
      <label>收款方式
        <select id="paymentMethodFilter" aria-label="收款方式筛选">
          ${paymentListUniqueOptions(rows, "method", paymentMethodFilter, "全部方式")}
        </select>
      </label>
      <label>经办人
        <select id="paymentOperatorFilter" aria-label="收款经办人筛选">
          ${paymentListUniqueOptions(rows, "operator", paymentOperatorFilter, "全部经办人")}
        </select>
      </label>
      <label>排序
        <select id="paymentSortMode" aria-label="收款流水排序">
          <option value="timeDesc" ${paymentSortMode === "timeDesc" ? "selected" : ""}>时间降序</option>
          <option value="timeAsc" ${paymentSortMode === "timeAsc" ? "selected" : ""}>时间升序</option>
          <option value="amountDesc" ${paymentSortMode === "amountDesc" ? "selected" : ""}>金额降序</option>
          <option value="student" ${paymentSortMode === "student" ? "selected" : ""}>学员分组</option>
          <option value="operator" ${paymentSortMode === "operator" ? "selected" : ""}>经办人分组</option>
        </select>
      </label>
    </div>`;
}

function paymentListTags(payment) {
  const tags = [tag(payment.type || "收款", paymentTone(payment))];
  const debtChange = Number(payment.beforeDebt || 0) !== Number(payment.afterDebt || 0);
  if (debtChange) tags.push(tag("欠费变动", Number(payment.afterDebt || 0) > 0 ? "amber" : "green"));
  if (Number(payment.amount || 0) < 0) tags.push(tag("冲减收入", "red"));
  return `<div class="payment-list-tags">${tags.join("")}</div>`;
}

function renderPaymentListRows(rows) {
  return rows.map((payment) => {
    const amount = Number(payment.amount || 0);
    return `<tr>
      <td><strong>${escapeHtml(payment.paidAt || "历史订单")}</strong><br><span class="muted">${escapeHtml(payment.id)}</span></td>
      <td>${escapeHtml(payment.student)}<br><span class="muted">${escapeHtml(payment.orderId || "-")}</span></td>
      <td>${paymentListTags(payment)}</td>
      <td>${tag(money(amount), paymentTone(payment))}</td>
      <td>${escapeHtml(payment.method || "线下收款")}<br><span class="muted">${escapeHtml(payment.account || "-")}</span></td>
      <td>${escapeHtml(payment.operator || "未记录")}</td>
      <td>${escapeHtml(paymentDebtChange(payment))}</td>
      <td class="payment-list-note">${escapeHtml(payment.note || payment.tradeNo || "-")}</td>
    </tr>`;
  });
}

function appendPaymentListPanel() {
  if (currentView !== "orders" || appContent.querySelector(".payment-list-panel")) return;
  const rows = paymentRows();
  const visibleRows = rows.filter(paymentMatchesListFilters).sort(comparePaymentRows);
  appContent.insertAdjacentHTML(
    "beforeend",
    `<section class="section payment-list-panel">
      <div class="section-head">
        <div>
          <h3>收款对账清单</h3>
          <span class="muted">按流水类型、方式和经办人筛选，核对报名收款、欠费补缴和退费冲减。</span>
        </div>
        ${tag(`${visibleRows.length} 条`, visibleRows.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${paymentListSummary(rows, visibleRows)}
        ${renderPaymentListToolbar(rows)}
        ${table(["时间/流水", "学员/订单", "类型", "金额", "方式/账户", "经办人", "欠费变化", "备注"], renderPaymentListRows(visibleRows))}
      </div>
    </section>`
  );
}

const baseRenderOrdersForPaymentList = renderOrders;
renderOrders = function renderOrdersWithPaymentList() {
  baseRenderOrdersForPaymentList();
  appendPaymentListPanel();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "paymentTypeFilter") paymentTypeFilter = event.target.value;
  if (event.target.id === "paymentMethodFilter") paymentMethodFilter = event.target.value;
  if (event.target.id === "paymentOperatorFilter") paymentOperatorFilter = event.target.value;
  if (event.target.id === "paymentSortMode") paymentSortMode = event.target.value;

  if (["paymentTypeFilter", "paymentMethodFilter", "paymentOperatorFilter", "paymentSortMode"].includes(event.target.id) && currentView === "orders") {
    renderView();
  }
});

if (currentView === "orders") {
  renderView();
}
