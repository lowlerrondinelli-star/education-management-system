const financeAdjustDialog = document.createElement("dialog");
financeAdjustDialog.id = "financeAdjustDialog";
financeAdjustDialog.className = "dialog";
document.body.appendChild(financeAdjustDialog);

const financeAdjustmentStyle = document.createElement("style");
financeAdjustmentStyle.textContent = `
  .finance-adjust-list{border:1px solid var(--line);border-radius:8px;background:#fff;padding:14px;display:grid;gap:10px}
  .finance-adjust-row{border:1px solid var(--line);border-radius:8px;background:#f8fafc;padding:10px;display:grid;gap:5px}
  .finance-adjust-actions{display:flex;gap:8px;flex-wrap:wrap}
`;
document.head.appendChild(financeAdjustmentStyle);

function ensureFinanceAdjustmentData() {
  if (!Array.isArray(appState.financeAdjustments)) appState.financeAdjustments = [];
}

const baseStatusToneForFinanceAdjustment = statusTone;
statusTone = function statusToneWithFinanceAdjustment(value) {
  if (["已作废", "退费"].includes(value)) return "red";
  if (["课时调整", "已调整"].includes(value)) return "amber";
  return baseStatusToneForFinanceAdjustment(value);
};

function orderById(orderId) {
  return appState.orders.find((item) => item.id === orderId);
}

function studentByNameForFinance(name) {
  return appState.students.find((item) => item.name === name);
}

function orderRemainingHours(order) {
  return Math.max(0, Number(order.bought || 0) + Number(order.gift || 0) - Number(order.used || 0));
}

function reduceOrderHours(order, hours) {
  let rest = Math.max(0, Number(hours || 0));
  const gift = Number(order.gift || 0);
  const giftReduce = Math.min(gift, rest);
  order.gift = gift - giftReduce;
  rest -= giftReduce;
  if (rest > 0) order.bought = Math.max(0, Number(order.bought || 0) - rest);
}

function appendFinanceAdjustment(record) {
  ensureFinanceAdjustmentData();
  appState.financeAdjustments.unshift({
    id: nextId("FJ"),
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    ...record
  });
}

function addFinancePaymentRecord(record) {
  if (typeof addPaymentRecord === "function") {
    addPaymentRecord(record);
    return;
  }
  if (!Array.isArray(appState.payments)) appState.payments = [];
  appState.payments.unshift({
    id: nextId("P"),
    paidAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    ...record
  });
}

function addFinanceLedgerRecord(record) {
  appState.ledger.unshift({
    id: nextId("C"),
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
    ...record
  });
}

function renderFinanceAdjustmentSummary() {
  ensureFinanceAdjustmentData();
  const latest = appState.financeAdjustments.slice(0, 4).map(
    (item) => `<div class="finance-adjust-row">
      <strong>${escapeHtml(item.type)} ${escapeHtml(item.student)} ${tag(item.status, statusTone(item.status))}</strong>
      <span class="muted">订单 ${escapeHtml(item.orderId)} · 金额 ${money(item.amount || 0)} · 课时 ${escapeHtml(item.hoursChange || 0)}</span>
      <span class="muted">${escapeHtml(item.reason || "无备注")} · ${escapeHtml(item.operator)}</span>
    </div>`
  );
  return `<div class="finance-adjust-list">
    <div class="quality-head">
      <div>
        <strong>财务异常记录</strong>
        <div class="muted">记录退费、订单作废和人工课时调整，便于财务与教务对账。</div>
      </div>
      ${tag(`${appState.financeAdjustments.length} 条记录`, appState.financeAdjustments.length ? "amber" : "green")}
    </div>
    ${latest.join("") || `<div class="stack-item"><span class="muted">暂无财务异常记录。</span></div>`}
  </div>`;
}

function financeAdjustmentPlanPresets(kind, order) {
  const paid = Number(order.paid || 0);
  const remaining = orderRemainingHours(order);
  const refundSmall = Math.min(paid, 500);
  const hoursSmall = Math.min(remaining, 1);
  const presets = {
    refund: {
      partialRefund: { label: "部分退费扣课", amount: refundSmall, hours: hoursSmall, method: "微信", reason: "家长退费，扣减剩余课时" },
      fullRefund: { label: "全额退费清课", amount: paid, hours: remaining, method: "银行转账", reason: "家长退费，扣减剩余课时" },
      transferRefund: { label: "转班退差额", amount: refundSmall, hours: 0, method: "银行转账", reason: "家长转班/停课，按协议处理" }
    },
    hours: {
      giftHours: { label: "赠课补录 +2", amount: 0, hours: 2, method: "线下处理", reason: "赠课补录，增加可用课时" },
      deductOne: { label: "误差扣减 -1", amount: 0, hours: -Math.min(remaining, 1), method: "线下处理", reason: "消课核对异常，修正剩余课时" },
      fixPositive: { label: "人工补增 +1", amount: 0, hours: 1, method: "线下处理", reason: "人工课时调整" },
      fixNegative: { label: "人工扣减 -0.5", amount: 0, hours: -Math.min(remaining, 0.5), method: "线下处理", reason: "人工课时调整" }
    },
    void: {
      noLessonVoid: { label: "未消课订单作废", amount: paid, hours: remaining, method: "线下处理", reason: "误建订单，未开始上课，作废处理" },
      duplicateVoid: { label: "重复订单作废", amount: paid, hours: remaining, method: "线下处理", reason: "报名信息录入错误，需财务调整" }
    }
  };
  return presets[kind] || presets.refund;
}

function financeAdjustmentPlanOptions(kind, order, selectedValue) {
  return Object.entries(financeAdjustmentPlanPresets(kind, order))
    .map(([key, item]) => `<option value="${escapeHtml(key)}" ${key === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function applyFinanceAdjustmentPlan(form, order) {
  if (!form || !order) return;
  const plan = financeAdjustmentPlanPresets(form.dataset.kind, order)[form.elements.adjustPlan?.value];
  if (!plan) return;
  if (form.elements.amount) form.elements.amount.value = plan.amount;
  if (form.elements.hours) form.elements.hours.value = plan.hours;
  if (form.elements.method) {
    form.elements.method.innerHTML = typeof paymentMethodOptions === "function" ? paymentMethodOptions(plan.method) : ["微信", "支付宝", "银行转账", "现金", "线下处理"].map((item) => `<option ${item === plan.method ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
  }
  if (form.elements.reason) {
    form.elements.reason.innerHTML = typeof financeReasonOptions === "function" ? financeReasonOptions(form.dataset.kind, plan.reason) : `<option>${escapeHtml(plan.reason)}</option>`;
  }
}

function injectFinanceOrderControls() {
  if (currentView !== "orders") return;
  const rows = appContent.querySelectorAll("[data-pay-order]");
  rows.forEach((payButton) => {
    const order = orderById(payButton.dataset.payOrder);
    const actions = payButton.closest(".payment-actions");
    if (!order || !actions || actions.querySelector("[data-finance-adjust]")) return;
    const voided = order.status === "已作废";
    actions.insertAdjacentHTML(
      "beforeend",
      `<button class="small-button" type="button" data-finance-adjust="refund" data-order-id="${escapeHtml(order.id)}" ${voided ? "disabled" : ""}>退费</button>
      <button class="small-button" type="button" data-finance-adjust="hours" data-order-id="${escapeHtml(order.id)}" ${voided ? "disabled" : ""}>课时调整</button>
      <button class="small-button" type="button" data-finance-adjust="void" data-order-id="${escapeHtml(order.id)}" ${voided || Number(order.used || 0) > 0 ? "disabled" : ""}>作废</button>`
    );
    const firstCell = actions.closest("tr")?.querySelector("td");
    if (firstCell && order.status && !firstCell.querySelector(".finance-order-status")) {
      firstCell.insertAdjacentHTML("beforeend", `<br><span class="finance-order-status">${tag(order.status, statusTone(order.status))}</span>`);
    }
  });

  const paymentSection = [...appContent.querySelectorAll(".section")].find((section) => section.textContent.includes("收款流水"));
  if (paymentSection && !appContent.querySelector(".finance-adjust-list")) {
    paymentSection.insertAdjacentHTML("beforebegin", `<section class="section"><div class="section-body">${renderFinanceAdjustmentSummary()}</div></section>`);
  }
}

const baseRenderOrdersForFinanceAdjustment = renderOrders;
renderOrders = function renderOrdersWithFinanceAdjustment() {
  baseRenderOrdersForFinanceAdjustment();
  injectFinanceOrderControls();
};

function renderFinanceAdjustDialog(kind, orderId) {
  const order = orderById(orderId);
  if (!order) return;
  const remaining = orderRemainingHours(order);
  const paid = Number(order.paid || 0);
  const titleMap = {
    refund: ["办理退费", "退费会减少订单实收，并可同步扣减未消课的剩余课时。"],
    hours: ["课时调整", "适合赠课、课时纠错、手工补扣，不改变收款金额。"],
    void: ["订单作废", "仅允许未消课订单作废；会清零实收、欠费和剩余课时。"]
  };
  const [title, help] = titleMap[kind] || titleMap.refund;
  const isRefund = kind === "refund";
  const isHours = kind === "hours";
  const isVoid = kind === "void";
  const defaultPlanKey = isVoid ? "noLessonVoid" : isHours ? "giftHours" : "partialRefund";
  const defaultPlan = financeAdjustmentPlanPresets(kind, order)[defaultPlanKey];
  financeAdjustDialog.innerHTML = `
    <form method="dialog" id="financeAdjustForm" data-kind="${escapeHtml(kind)}" data-order-id="${escapeHtml(order.id)}">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">财务异常</p>
          <h3>${escapeHtml(title)}</h3>
          <span class="muted">${escapeHtml(order.student)} · ${escapeHtml(order.course)} · 剩余 ${remaining} 课时 · 已收 ${money(paid)}</span>
        </div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <div class="form-grid">
        <label>处理模板<select name="adjustPlan">${financeAdjustmentPlanOptions(kind, order, defaultPlanKey)}</select></label>
        <label>金额<input name="amount" type="number" min="0" max="${isRefund || isVoid ? paid : 999999}" step="1" value="${escapeHtml(defaultPlan.amount)}" ${isHours ? "" : "required"} /></label>
        <label>课时变动<input name="hours" type="number" min="${isHours ? -remaining : 0}" max="${isRefund || isVoid ? remaining : 999}" step="0.5" value="${escapeHtml(defaultPlan.hours)}" required /></label>
        <label>经办人<select name="operator" required>${typeof operatorChoiceOptions === "function" ? operatorChoiceOptions(order.owner || "前台老师") : `<option>${escapeHtml(order.owner || "前台老师")}</option>`}</select></label>
        <label>处理方式<select name="method">${typeof paymentMethodOptions === "function" ? paymentMethodOptions(defaultPlan.method) : `<option>${escapeHtml(defaultPlan.method)}</option>`}</select></label>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr;">
        <label>原因备注<select name="reason" required>${typeof financeReasonOptions === "function" ? financeReasonOptions(kind, defaultPlan.reason) : `<option>${escapeHtml(defaultPlan.reason)}</option>`}</select></label>
      </div>
      <div class="dialog-actions">
        <span class="muted">${escapeHtml(help)}</span>
        <button value="cancel" type="submit">取消</button>
        <button class="primary-action" value="default" type="submit">确认处理</button>
      </div>
    </form>`;
  financeAdjustDialog.showModal();
}

function applyRefund(order, formData) {
  const beforePaid = Number(order.paid || 0);
  const beforeDebt = Number(order.debt || 0);
  const beforeRemaining = orderRemainingHours(order);
  const amount = Math.min(numberFromForm(formData, "amount"), beforePaid);
  const hours = Math.min(numberFromForm(formData, "hours"), beforeRemaining);
  if (amount <= 0 && hours <= 0) {
    setNotice("orders", "退费金额或课时至少填写一项。", "red");
    renderView();
    return;
  }
  const student = studentByNameForFinance(order.student);
  order.paid = Math.max(0, beforePaid - amount);
  reduceOrderHours(order, hours);
  if (student) student.balance = Math.max(0, Number(student.balance || 0) - hours);
  if (amount > 0) {
    addFinancePaymentRecord({
      orderId: order.id,
      student: order.student,
      amount: -amount,
      method: text(formData.get("method")) || "线下处理",
      account: order.account || "",
      tradeNo: "",
      type: "退费",
      beforeDebt,
      afterDebt: Number(order.debt || 0),
      operator: text(formData.get("operator")).trim() || order.owner || "前台老师",
      note: text(formData.get("reason")).trim()
    });
  }
  if (hours > 0 && student) {
    const before = Number(student.balance || 0) + hours;
    addFinanceLedgerRecord({
      student: order.student,
      lesson: `订单退费 ${order.id}`,
      type: "退费扣课",
      change: -hours,
      before,
      after: Number(student.balance || 0),
      operator: text(formData.get("operator")).trim() || order.owner || "前台老师"
    });
  }
  appendFinanceAdjustment({
    orderId: order.id,
    student: order.student,
    type: "退费",
    status: "退费",
    amount: -amount,
    hoursChange: -hours,
    beforePaid,
    afterPaid: order.paid,
    beforeHours: beforeRemaining,
    afterHours: orderRemainingHours(order),
    operator: text(formData.get("operator")).trim() || order.owner || "前台老师",
    reason: text(formData.get("reason")).trim()
  });
  setNotice("orders", `${order.student} 已退费 ${money(amount)}，扣减 ${hours} 课时。`, "amber");
}

function applyHourAdjustment(order, formData) {
  const hours = numberFromForm(formData, "hours");
  if (!hours) {
    setNotice("orders", "课时调整不能为 0。", "red");
    renderView();
    return;
  }
  const beforeRemaining = orderRemainingHours(order);
  if (hours < 0 && Math.abs(hours) > beforeRemaining) {
    setNotice("orders", "扣减课时不能超过订单剩余课时。", "red");
    renderView();
    return;
  }
  const student = studentByNameForFinance(order.student);
  const beforeStudentBalance = Number(student?.balance || 0);
  if (hours > 0) {
    order.gift = Number(order.gift || 0) + hours;
  } else {
    reduceOrderHours(order, Math.abs(hours));
  }
  if (student) student.balance = Math.max(0, beforeStudentBalance + hours);
  addFinanceLedgerRecord({
    student: order.student,
    lesson: `订单课时调整 ${order.id}`,
    type: "课时调整",
    change: hours,
    before: beforeStudentBalance,
    after: student ? Number(student.balance || 0) : beforeStudentBalance,
    operator: text(formData.get("operator")).trim() || order.owner || "前台老师"
  });
  appendFinanceAdjustment({
    orderId: order.id,
    student: order.student,
    type: "课时调整",
    status: "已调整",
    amount: 0,
    hoursChange: hours,
    beforePaid: Number(order.paid || 0),
    afterPaid: Number(order.paid || 0),
    beforeHours: beforeRemaining,
    afterHours: orderRemainingHours(order),
    operator: text(formData.get("operator")).trim() || order.owner || "前台老师",
    reason: text(formData.get("reason")).trim()
  });
  setNotice("orders", `${order.student} 课时调整已保存，变动 ${hours} 课时。`);
}

function applyOrderVoid(order, formData) {
  if (Number(order.used || 0) > 0) {
    setNotice("orders", "已有消课记录的订单不能作废，请用退费或课时调整处理。", "red");
    renderView();
    return;
  }
  const beforePaid = Number(order.paid || 0);
  const beforeDebt = Number(order.debt || 0);
  const beforeHours = orderRemainingHours(order);
  const student = studentByNameForFinance(order.student);
  const beforeStudentBalance = Number(student?.balance || 0);
  order.status = "已作废";
  order.paid = 0;
  order.debt = 0;
  order.bought = 0;
  order.gift = 0;
  if (student) {
    student.balance = Math.max(0, beforeStudentBalance - beforeHours);
    syncStudentDebt(order.student);
  }
  if (beforePaid > 0) {
    addFinancePaymentRecord({
      orderId: order.id,
      student: order.student,
      amount: -beforePaid,
      method: text(formData.get("method")) || "线下处理",
      account: order.account || "",
      tradeNo: "",
      type: "订单作废退款",
      beforeDebt,
      afterDebt: 0,
      operator: text(formData.get("operator")).trim() || order.owner || "前台老师",
      note: text(formData.get("reason")).trim()
    });
  }
  if (beforeHours > 0 && student) {
    addFinanceLedgerRecord({
      student: order.student,
      lesson: `订单作废 ${order.id}`,
      type: "订单作废扣课",
      change: -beforeHours,
      before: beforeStudentBalance,
      after: Number(student.balance || 0),
      operator: text(formData.get("operator")).trim() || order.owner || "前台老师"
    });
  }
  appendFinanceAdjustment({
    orderId: order.id,
    student: order.student,
    type: "订单作废",
    status: "已作废",
    amount: -beforePaid,
    hoursChange: -beforeHours,
    beforePaid,
    afterPaid: 0,
    beforeHours,
    afterHours: 0,
    operator: text(formData.get("operator")).trim() || order.owner || "前台老师",
    reason: text(formData.get("reason")).trim()
  });
  setNotice("orders", `${order.student} 的订单已作废。`, "amber");
}

function saveFinanceAdjustment(form) {
  const order = orderById(form.dataset.orderId);
  if (!order) return;
  const formData = new FormData(form);
  if (form.dataset.kind === "refund") applyRefund(order, formData);
  if (form.dataset.kind === "hours") applyHourAdjustment(order, formData);
  if (form.dataset.kind === "void") applyOrderVoid(order, formData);
  syncStudentDebt(order.student);
  saveState();
  financeAdjustDialog.close();
  setView("orders");
  renderNav();
}

function flattenFinanceAdjustmentRows() {
  ensureFinanceAdjustmentData();
  return appState.financeAdjustments.map((item) => ({
    id: item.id,
    orderId: item.orderId,
    student: item.student,
    type: item.type,
    status: item.status,
    amount: item.amount,
    hoursChange: item.hoursChange,
    beforePaid: item.beforePaid,
    afterPaid: item.afterPaid,
    beforeHours: item.beforeHours,
    afterHours: item.afterHours,
    operator: item.operator,
    reason: item.reason,
    createdAt: item.createdAt
  }));
}

if (typeof exportDataset === "function") {
  const baseExportDatasetForFinanceAdjustment = exportDataset;
  exportDataset = function exportDatasetWithFinanceAdjustment(type) {
    if (type !== "financeAdjustments") {
      baseExportDatasetForFinanceAdjustment(type);
      return;
    }
    const columns = [
      ["id", "异常编号"],
      ["orderId", "订单号"],
      ["student", "学员"],
      ["type", "处理类型"],
      ["status", "状态"],
      ["amount", "金额变动"],
      ["hoursChange", "课时变动"],
      ["beforePaid", "处理前实收"],
      ["afterPaid", "处理后实收"],
      ["beforeHours", "处理前剩余课时"],
      ["afterHours", "处理后剩余课时"],
      ["operator", "经办人"],
      ["reason", "原因备注"],
      ["createdAt", "处理时间"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("财务异常记录.csv", buildCsv(flattenFinanceAdjustmentRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "财务异常记录.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForFinanceAdjustment = renderDataCenter;
  renderDataCenter = function renderDataCenterWithFinanceAdjustment() {
    baseRenderDataCenterForFinanceAdjustment();
    const metricValue = [...appContent.querySelectorAll(".metric")]
      .find((item) => item.textContent.includes("数据表数量"))
      ?.querySelector("strong");
    if (metricValue) metricValue.textContent = "21";

    const dataGrid = appContent.querySelector(".data-grid");
    if (!dataGrid || dataGrid.querySelector('[data-export="financeAdjustments"]')) return;
    const card = document.createElement("article");
    card.className = "data-card";
    card.innerHTML = `<div><span class="muted">财务异常记录</span><strong>${flattenFinanceAdjustmentRows().length}</strong></div><button class="small-button" type="button" data-export="financeAdjustments">导出异常</button>`;
    const paymentCard = dataGrid.querySelector('[data-export="payments"]')?.closest(".data-card");
    if (paymentCard) {
      paymentCard.after(card);
    } else {
      dataGrid.appendChild(card);
    }
  };
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-finance-adjust]");
  if (button && !button.disabled) renderFinanceAdjustDialog(button.dataset.financeAdjust, button.dataset.orderId);
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "financeAdjustForm") return;
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  saveFinanceAdjustment(event.target);
});

document.addEventListener("change", (event) => {
  if (event.target.name !== "adjustPlan" || !event.target.closest("#financeAdjustForm")) return;
  const form = event.target.form;
  applyFinanceAdjustmentPlan(form, orderById(form.dataset.orderId));
});

ensureFinanceAdjustmentData();
if (currentView === "orders" || currentView === "data") renderView();
