const paymentDialog = document.createElement("dialog");
paymentDialog.id = "paymentDialog";
paymentDialog.className = "dialog";
paymentDialog.innerHTML = `<div id="paymentDialogBody"></div>`;
document.body.appendChild(paymentDialog);

const paymentDialogBody = document.querySelector("#paymentDialogBody");

const paymentStyle = document.createElement("style");
paymentStyle.textContent = `
  .payment-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(160px, 1fr));
    gap: 10px;
  }

  .payment-summary .metric {
    box-shadow: none;
  }

  .payment-tools {
    display: grid;
    gap: 12px;
  }

  .payment-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  @media (max-width: 900px) {
    .payment-summary {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(paymentStyle);

function ensurePaymentData() {
  if (!Array.isArray(appState.payments)) appState.payments = [];
  if (appState.payments.length) return;

  appState.payments = appState.orders
    .filter((order) => Number(order.paid || 0) > 0)
    .map((order) => ({
      id: `P${order.id.replace(/\D/g, "").slice(-10)}`,
      orderId: order.id,
      student: order.student,
      amount: Number(order.paid || 0),
      method: order.payMethod || "线下收款",
      account: order.account || "",
      tradeNo: order.tradeNo || "",
      type: "报名收款",
      beforeDebt: Number(order.debt || 0),
      afterDebt: Number(order.debt || 0),
      operator: order.owner || "前台老师",
      paidAt: order.createdAt || "历史订单",
      note: "由历史订单实收金额生成"
    }));
}

function orderReceivedTotal() {
  return appState.orders.reduce((sum, order) => sum + Number(order.paid || 0), 0);
}

function orderDebtTotal() {
  return appState.orders.reduce((sum, order) => sum + Number(order.debt || 0), 0);
}

function syncStudentDebt(studentName) {
  const debt = appState.orders
    .filter((order) => order.student === studentName)
    .reduce((sum, order) => sum + Number(order.debt || 0), 0);
  for (const student of appState.students.filter((item) => item.name === studentName)) {
    student.debt = debt;
  }
}

function addPaymentRecord(record) {
  ensurePaymentData();
  appState.payments.unshift({
    id: nextId("P"),
    paidAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    ...record
  });
}

function renderPaymentSummary() {
  ensurePaymentData();
  const latestPayment = appState.payments[0];
  const latestText = latestPayment ? `${latestPayment.student} ${money(latestPayment.amount)}` : "暂无";
  return `
    <div class="payment-summary">
      <div class="metric"><span>累计实收</span><strong>${money(orderReceivedTotal())}</strong></div>
      <div class="metric"><span>待收欠费</span><strong>${money(orderDebtTotal())}</strong></div>
      <div class="metric"><span>最近收款</span><strong>${escapeHtml(latestText)}</strong></div>
    </div>`;
}

renderOrderQuickForm = function renderOrderQuickFormWithPaymentFields() {
  const selectedStudent = appState.students.find((item) => item.id === selectedStudentForOrder);
  const defaultClass = getClass(selectedStudent?.className) || appState.classes[0] || {};
  return `
    <form class="operation-panel" id="orderForm">
      <div>
        <strong>快速报名</strong>
        <span class="muted">生成订单后同步更新学员状态、班级、课时余额和收款流水。</span>
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
        <label>收款方式<select name="payMethod"><option>微信</option><option>支付宝</option><option>银行转账</option><option>现金</option><option>线下收款</option></select></label>
        <label>收款账户<input name="account" value="校区收款账户" /></label>
        <label>支付单号<input name="tradeNo" placeholder="可选" /></label>
      </div>
      <div class="dialog-actions">
        <span class="muted">有欠费时后续可在订单列表继续补缴。</span>
        <button class="primary-action" type="submit">确认报名</button>
      </div>
    </form>`;
};

function renderPaymentRows() {
  ensurePaymentData();
  return appState.payments
    .filter(matchesRow)
    .slice(0, 8)
    .map(
      (payment) => `<tr>
        <td><strong>${escapeHtml(payment.id)}</strong><br><span class="muted">${escapeHtml(payment.type)}</span></td>
        <td>${escapeHtml(payment.student)}</td>
        <td>${money(payment.amount)}</td>
        <td>${escapeHtml(payment.method)}</td>
        <td>${escapeHtml(payment.operator)}</td>
        <td>${escapeHtml(payment.paidAt)}</td>
      </tr>`
    );
}

renderOrders = function renderOrdersWithPayments() {
  ensurePaymentData();
  const rows = appState.orders
    .filter(matchesRow)
    .map((order) => {
      const balance = Number(order.bought) + Number(order.gift) - Number(order.used);
      const debt = Number(order.debt || 0);
      return `<tr>
        <td><strong>${escapeHtml(order.id)}</strong><br><span class="muted">${escapeHtml(order.owner)}</span></td>
        <td>${escapeHtml(order.student)}</td>
        <td>${escapeHtml(order.course)}</td>
        <td>${escapeHtml(order.className)}</td>
        <td>${order.bought} + ${order.gift}</td>
        <td>${order.used}</td>
        <td>${tag(balance, balance <= 3 ? "amber" : "green")}</td>
        <td>${money(order.paid)}</td>
        <td>${debt ? tag(money(debt), "red") : tag("无", "green")}</td>
        <td>${escapeHtml(order.expireAt)}</td>
        <td>
          <div class="payment-actions">
            <button class="small-button" type="button" data-pay-order="${escapeHtml(order.id)}" ${debt <= 0 ? "disabled" : ""}>
              ${debt > 0 ? "补缴" : "已结清"}
            </button>
          </div>
        </td>
      </tr>`;
    });

  appContent.innerHTML = `
    <section class="section">
      <div class="section-head"><h3>报名订单与课时账户</h3><span class="muted">余额 = 购买 + 赠送 - 已上；欠费可直接补缴</span></div>
      <div class="section-body payment-tools">
        ${renderNotice("orders")}
        ${renderPaymentSummary()}
        ${renderOrderQuickForm()}
        ${table(["订单号", "学员", "课程", "班级", "购买+赠送", "已上", "余额", "实收", "欠费", "有效期", "操作"], rows)}
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h3>收款流水</h3><span class="muted">自动记录报名收款和欠费补缴</span></div>
      <div class="section-body">
        ${table(["流水号", "学员", "金额", "方式", "经办人", "收款时间"], renderPaymentRows())}
      </div>
    </section>`;
};

function renderPaymentDialog(orderId) {
  const order = appState.orders.find((item) => item.id === orderId);
  if (!order) return;
  const debt = Number(order.debt || 0);
  paymentDialogBody.innerHTML = `
    <form method="dialog" id="paymentForm" data-order-id="${escapeHtml(order.id)}">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">欠费补缴</p>
          <h3>${escapeHtml(order.student)}</h3>
          <span class="muted">${escapeHtml(order.course)} · 当前欠费 ${money(debt)}</span>
        </div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <div class="form-grid">
        <label>本次收款<input name="amount" type="number" min="1" max="${debt}" step="1" value="${debt}" required /></label>
        <label>收款方式<select name="method"><option>微信</option><option>支付宝</option><option>银行转账</option><option>现金</option><option>线下收款</option></select></label>
        <label>收款账户<select name="account">${typeof paymentAccountOptions === "function" ? paymentAccountOptions(order.account || "校区收款账户") : `<option>${escapeHtml(order.account || "校区收款账户")}</option>`}</select></label>
        <label>支付单号<input name="tradeNo" value="${escapeHtml(order.tradeNo || "")}" /></label>
        <label>经办人<select name="operator">${typeof operatorChoiceOptions === "function" ? operatorChoiceOptions(order.owner || "前台老师") : `<option>${escapeHtml(order.owner || "前台老师")}</option>`}</select></label>
        <label>备注<select name="note">${typeof paymentNoteOptions === "function" ? paymentNoteOptions("欠费补缴") : "<option>欠费补缴</option>"}</select></label>
      </div>
      <div class="dialog-actions">
        <span class="muted">保存后会同步减少订单欠费和学员欠费。</span>
        <button class="primary-action" value="default" type="submit">确认收款</button>
      </div>
    </form>`;
  paymentDialog.showModal();
}

function receiveDebtPayment(form) {
  const order = appState.orders.find((item) => item.id === form.dataset.orderId);
  if (!order) return;
  const formData = new FormData(form);
  const beforeDebt = Number(order.debt || 0);
  const amount = Math.min(numberFromForm(formData, "amount"), beforeDebt);
  if (amount <= 0) {
    setNotice("orders", "当前订单没有可补缴欠费。", "amber");
    paymentDialog.close();
    renderView();
    return;
  }

  order.paid = Number(order.paid || 0) + amount;
  order.debt = Math.max(0, beforeDebt - amount);
  order.payMethod = text(formData.get("method")) || order.payMethod || "线下收款";
  order.account = text(formData.get("account")).trim();
  order.tradeNo = text(formData.get("tradeNo")).trim();
  syncStudentDebt(order.student);
  addPaymentRecord({
    orderId: order.id,
    student: order.student,
    amount,
    method: order.payMethod,
    account: order.account,
    tradeNo: order.tradeNo,
    type: "欠费补缴",
    beforeDebt,
    afterDebt: order.debt,
    operator: text(formData.get("operator")).trim() || order.owner || "前台老师",
    note: text(formData.get("note")).trim()
  });

  setNotice("orders", `${order.student} 已补缴 ${money(amount)}，剩余欠费 ${money(order.debt)}。`);
  saveState();
  paymentDialog.close();
  setView("orders");
}

const baseEnrollStudentForPayments = enrollStudent;
enrollStudent = function enrollStudentWithPaymentRecord(formData) {
  ensurePaymentData();
  const beforeIds = new Set(appState.orders.map((order) => order.id));
  const payMethod = text(formData.get("payMethod")) || "线下收款";
  const account = text(formData.get("account")).trim();
  const tradeNo = text(formData.get("tradeNo")).trim();
  const paid = numberFromForm(formData, "paid");
  baseEnrollStudentForPayments(formData);
  const order = appState.orders.find((item) => !beforeIds.has(item.id));
  if (!order) return;

  order.payMethod = payMethod;
  order.account = account;
  order.tradeNo = tradeNo;
  syncStudentDebt(order.student);
  if (paid > 0) {
    addPaymentRecord({
      orderId: order.id,
      student: order.student,
      amount: paid,
      method: payMethod,
      account,
      tradeNo,
      type: "报名收款",
      beforeDebt: Number(order.debt || 0),
      afterDebt: Number(order.debt || 0),
      operator: order.owner || "前台老师",
      note: "报名订单首付款"
    });
  }
  setNotice("orders", `${order.student} 已报名并记录收款 ${money(paid)}。`);
  saveState();
  setView("orders");
};

function flattenPaymentRows() {
  ensurePaymentData();
  return appState.payments.map((payment) => ({
    id: payment.id,
    orderId: payment.orderId,
    student: payment.student,
    type: payment.type,
    amount: payment.amount,
    method: payment.method,
    account: payment.account,
    tradeNo: payment.tradeNo,
    beforeDebt: payment.beforeDebt,
    afterDebt: payment.afterDebt,
    operator: payment.operator,
    paidAt: payment.paidAt,
    note: payment.note
  }));
}

document.addEventListener("click", (event) => {
  const payButton = event.target.closest("[data-pay-order]");
  if (payButton && !payButton.disabled) renderPaymentDialog(payButton.dataset.payOrder);
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "paymentForm") return;
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  receiveDebtPayment(event.target);
});

ensurePaymentData();
saveState();
