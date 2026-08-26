const paymentDailyStyle = document.createElement("style");
paymentDailyStyle.textContent = `
  .payment-daily-panel {
    margin-bottom: 16px;
  }

  .payment-daily-toolbar {
    align-items: end;
  }

  .payment-daily-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .payment-daily-toolbar input,
  .payment-daily-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .payment-daily-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 0.45fr);
    gap: 12px;
    margin-top: 12px;
  }

  .payment-daily-card {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  .payment-daily-card h4 {
    margin: 0;
    font-size: 15px;
  }

  .payment-daily-bars {
    display: grid;
    gap: 8px;
  }

  .payment-daily-bar {
    display: grid;
    gap: 5px;
  }

  .payment-daily-bar div {
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--soft);
  }

  .payment-daily-bar span:last-child {
    display: block;
    height: 100%;
    background: var(--blue);
  }

  .payment-daily-actions,
  .payment-daily-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .payment-daily-note {
    max-width: 320px;
    white-space: normal;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  @media (max-width: 900px) {
    .payment-daily-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 650px) {
    .payment-daily-toolbar,
    .payment-daily-toolbar label,
    .payment-daily-toolbar input,
    .payment-daily-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(paymentDailyStyle);

let paymentDailyDateFilter = "";
let paymentDailyOperatorFilter = "all";
let paymentDailyMethodFilter = "all";
let paymentDailyTypeFilter = "all";

function paymentDailyRows() {
  if (typeof ensurePaymentData === "function") ensurePaymentData();
  return Array.isArray(appState.payments) ? appState.payments : [];
}

function paymentDailyDate(payment) {
  const value = text(payment.paidAt || "");
  const match = value.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/);
  if (!match) return "历史订单";
  return match[0].replace(/\//g, "-").replace(/-(\d)(?=-|$)/g, "-0$1");
}

function paymentDailyDefaultDate(rows = paymentDailyRows()) {
  const realDates = rows.map(paymentDailyDate).filter((date) => date !== "历史订单").sort();
  return realDates[realDates.length - 1] || "历史订单";
}

function paymentDailySelectedDate() {
  if (!paymentDailyDateFilter) paymentDailyDateFilter = paymentDailyDefaultDate();
  return paymentDailyDateFilter;
}

function paymentDailyDateOptions(rows) {
  const dates = [...new Set(rows.map(paymentDailyDate))].sort((left, right) => {
    if (left === "历史订单") return 1;
    if (right === "历史订单") return -1;
    return right.localeCompare(left);
  });
  return dates.map((date) => `<option value="${escapeHtml(date)}" ${paymentDailySelectedDate() === date ? "selected" : ""}>${escapeHtml(date)}</option>`).join("");
}

function paymentDailyOptionValues(rows, key, selectedValue, allLabel) {
  const values = [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function paymentDailyMatches(payment) {
  if (paymentDailyDate(payment) !== paymentDailySelectedDate()) return false;
  if (paymentDailyOperatorFilter !== "all" && payment.operator !== paymentDailyOperatorFilter) return false;
  if (paymentDailyMethodFilter !== "all" && payment.method !== paymentDailyMethodFilter) return false;
  if (paymentDailyTypeFilter !== "all" && payment.type !== paymentDailyTypeFilter) return false;
  return matchesRow(payment);
}

function paymentDailyVisibleRows() {
  return paymentDailyRows()
    .filter(paymentDailyMatches)
    .sort((left, right) => paymentDateRank(right) - paymentDateRank(left));
}

function paymentDailyAmount(rows, predicate = () => true) {
  return rows.filter(predicate).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function paymentDailyGroup(rows, key) {
  const groups = new Map();
  for (const payment of rows) {
    const label = payment[key] || "未记录";
    groups.set(label, (groups.get(label) || 0) + Number(payment.amount || 0));
  }
  return [...groups.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount) || text(left.label).localeCompare(text(right.label), "zh-CN"));
}

function paymentDailySummary(rows) {
  const income = paymentDailyAmount(rows, (payment) => Number(payment.amount || 0) > 0);
  const refund = Math.abs(paymentDailyAmount(rows, (payment) => Number(payment.amount || 0) < 0));
  const net = paymentDailyAmount(rows);
  const debt = typeof orderDebtTotal === "function" ? orderDebtTotal() : appState.orders.reduce((sum, order) => sum + Number(order.debt || 0), 0);
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>本日流水</span><strong>${rows.length}</strong><small>${escapeHtml(paymentDailySelectedDate())}</small></div>
      <div class="metric"><span>本日收款</span><strong>${money(income)}</strong><small>退费 ${money(refund)}</small></div>
      <div class="metric"><span>本日净收</span><strong>${money(net)}</strong><small>按当前筛选汇总</small></div>
      <div class="metric"><span>剩余欠费</span><strong>${money(debt)}</strong><small>来自订单当前欠费</small></div>
    </div>`;
}

function renderPaymentDailyToolbar(rows) {
  return `
    <div class="filters payment-daily-toolbar">
      <label>结算日期
        <select id="paymentDailyDateFilter" aria-label="选择收款日报日期">
          ${paymentDailyDateOptions(rows)}
        </select>
      </label>
      <label>经办人
        <select id="paymentDailyOperatorFilter" aria-label="收款日报经办人筛选">
          ${paymentDailyOptionValues(rows, "operator", paymentDailyOperatorFilter, "全部经办人")}
        </select>
      </label>
      <label>收款方式
        <select id="paymentDailyMethodFilter" aria-label="收款日报方式筛选">
          ${paymentDailyOptionValues(rows, "method", paymentDailyMethodFilter, "全部方式")}
        </select>
      </label>
      <label>流水类型
        <select id="paymentDailyTypeFilter" aria-label="收款日报类型筛选">
          ${paymentDailyOptionValues(rows, "type", paymentDailyTypeFilter, "全部类型")}
        </select>
      </label>
      <button class="small-button" type="button" data-export="paymentDaily">导出日报</button>
    </div>`;
}

function renderPaymentDailyBars(title, rows) {
  const max = Math.max(...rows.map((row) => Math.abs(row.amount)), 1);
  return `<div class="payment-daily-card">
    <h4>${escapeHtml(title)}</h4>
    <div class="payment-daily-bars">
      ${rows
        .map((row) => {
          const width = Math.max(6, Math.round((Math.abs(row.amount) / max) * 100));
          return `<div class="payment-daily-bar">
            <strong>${escapeHtml(row.label)} · ${money(row.amount)}</strong>
            <div><span style="width:${width}%"></span></div>
          </div>`;
        })
        .join("") || `<span class="muted">暂无可汇总数据。</span>`}
    </div>
  </div>`;
}

function paymentDailyTags(payment) {
  const tone = paymentTone(payment);
  const tags = [tag(payment.type || "收款", tone)];
  if (Number(payment.amount || 0) < 0) tags.push(tag("退费冲减", "red"));
  if (Number(payment.beforeDebt || 0) !== Number(payment.afterDebt || 0)) tags.push(tag("欠费变动", Number(payment.afterDebt || 0) > 0 ? "amber" : "green"));
  return `<div class="payment-daily-tags">${tags.join("")}</div>`;
}

function renderPaymentDailyRows(rows) {
  return rows.map((payment) => `<tr>
    <td><strong>${escapeHtml(payment.paidAt || "历史订单")}</strong><br><span class="muted">${escapeHtml(payment.id)}</span></td>
    <td>${escapeHtml(payment.student)}<br><span class="muted">${escapeHtml(payment.orderId || "-")}</span></td>
    <td>${paymentDailyTags(payment)}</td>
    <td>${tag(money(payment.amount), paymentTone(payment))}</td>
    <td>${escapeHtml(payment.method || "线下收款")}<br><span class="muted">${escapeHtml(payment.account || "-")}</span></td>
    <td>${escapeHtml(payment.operator || "未记录")}</td>
    <td class="payment-daily-note">${escapeHtml(payment.note || payment.tradeNo || "-")}</td>
  </tr>`);
}

function appendPaymentDailyPanel() {
  if (currentView !== "orders" || appContent.querySelector(".payment-daily-panel")) return;
  const rows = paymentDailyRows();
  paymentDailySelectedDate();
  const visibleRows = paymentDailyVisibleRows();
  const panel = `
    <section class="section payment-daily-panel">
      <div class="section-head">
        <div>
          <h3>收款日报</h3>
          <span class="muted">按日期核对当天收款、退费、收款方式和经办人，适合前台每日收工结算。</span>
        </div>
        ${tag(`${visibleRows.length} 条`, visibleRows.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${paymentDailySummary(visibleRows)}
        ${renderPaymentDailyToolbar(rows)}
        <div class="payment-daily-grid">
          ${renderPaymentDailyBars("按收款方式", paymentDailyGroup(visibleRows, "method"))}
          ${renderPaymentDailyBars("按经办人", paymentDailyGroup(visibleRows, "operator"))}
        </div>
        ${table(["时间/流水", "学员/订单", "类型", "金额", "方式/账户", "经办人", "备注"], renderPaymentDailyRows(visibleRows))}
      </div>
    </section>`;

  const renewalPanel = appContent.querySelector(".renewal-board");
  if (renewalPanel) {
    renewalPanel.insertAdjacentHTML("afterend", panel);
  } else {
    appContent.insertAdjacentHTML("afterbegin", panel);
  }
}

function flattenPaymentDailyRows() {
  return paymentDailyVisibleRows().map((payment) => ({
    closeDate: paymentDailySelectedDate(),
    id: payment.id,
    paidAt: payment.paidAt,
    orderId: payment.orderId,
    student: payment.student,
    type: payment.type,
    amount: payment.amount,
    method: payment.method,
    account: payment.account,
    operator: payment.operator,
    beforeDebt: payment.beforeDebt,
    afterDebt: payment.afterDebt,
    note: payment.note || payment.tradeNo || ""
  }));
}

const baseRenderOrdersForPaymentDaily = renderOrders;
renderOrders = function renderOrdersWithPaymentDaily() {
  baseRenderOrdersForPaymentDaily();
  appendPaymentDailyPanel();
};

if (typeof exportDataset === "function") {
  const baseExportDatasetForPaymentDaily = exportDataset;
  exportDataset = function exportDatasetWithPaymentDaily(type) {
    if (type !== "paymentDaily") {
      baseExportDatasetForPaymentDaily(type);
      return;
    }
    const columns = [
      ["closeDate", "结算日期"],
      ["id", "流水号"],
      ["paidAt", "收款时间"],
      ["orderId", "订单号"],
      ["student", "学员姓名"],
      ["type", "流水类型"],
      ["amount", "金额"],
      ["method", "收款方式"],
      ["account", "收款账户"],
      ["operator", "经办人"],
      ["beforeDebt", "收款前欠费"],
      ["afterDebt", "收款后欠费"],
      ["note", "备注"]
    ].map(([key, label]) => ({ key, label }));
    downloadText(`收款日报-${paymentDailySelectedDate()}.csv`, buildCsv(flattenPaymentDailyRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", `收款日报-${paymentDailySelectedDate()}.csv 已开始下载。`);
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForPaymentDaily = renderDataCenter;
  renderDataCenter = function renderDataCenterWithPaymentDaily() {
    baseRenderDataCenterForPaymentDaily();
    const dataGrid = appContent.querySelector(".data-grid");
    if (dataGrid && !dataGrid.querySelector('[data-export="paymentDaily"]')) {
      const card = document.createElement("article");
      card.className = "data-card";
      card.innerHTML = `<div><span class="muted">收款日报</span><strong>${flattenPaymentDailyRows().length}</strong></div><button class="small-button" type="button" data-export="paymentDaily">导出日报</button>`;
      const paymentCard = dataGrid.querySelector('[data-export="payments"]')?.closest(".data-card");
      if (paymentCard) {
        paymentCard.after(card);
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
  if (event.target.id === "paymentDailyDateFilter") paymentDailyDateFilter = event.target.value;
  if (event.target.id === "paymentDailyOperatorFilter") paymentDailyOperatorFilter = event.target.value;
  if (event.target.id === "paymentDailyMethodFilter") paymentDailyMethodFilter = event.target.value;
  if (event.target.id === "paymentDailyTypeFilter") paymentDailyTypeFilter = event.target.value;

  if (["paymentDailyDateFilter", "paymentDailyOperatorFilter", "paymentDailyMethodFilter", "paymentDailyTypeFilter"].includes(event.target.id) && currentView === "orders") {
    renderView();
  }
});

if (currentView === "orders" || currentView === "data") {
  renderView();
}
