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

  .order-package-hint {
    grid-column: 1 / -1;
    line-height: 1.55;
  }

  .order-recommend-hint {
    grid-column: 1 / -1;
    line-height: 1.55;
  }

  .payment-preview {
    grid-column: 1 / -1;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #f8fafc;
    padding: 10px;
    display: grid;
    gap: 4px;
    line-height: 1.55;
  }

  .payment-preview strong {
    font-size: 14px;
  }

  #paymentForm input[readonly] {
    background: #f8fafc;
    color: var(--muted);
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

function addMonthsToToday(months) {
  const date = new Date(`${todayIsoDate()}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function orderCourseMeta(courseName) {
  const course = (appState.courses || []).find((item) => item.name === courseName) || {};
  return {
    name: courseName || course.name || "常规课程",
    hours: Number(course.hours || 20),
    price: Number(course.price || 2800)
  };
}

function orderPackagePresets(courseName) {
  const course = orderCourseMeta(courseName);
  const standardPrice = course.price || 2800;
  const standardHours = course.hours || 20;
  const deposit = Math.min(1000, Math.max(500, Math.round(standardPrice * 0.25)));
  return [
    {
      key: "standard",
      label: `标准报名：${standardHours} 课时`,
      bought: standardHours,
      gift: standardPrice >= 3000 ? 2 : 0,
      paid: standardPrice,
      debt: 0,
      months: 6,
      note: "按课程标准价一次收齐，适合常规报名。"
    },
    {
      key: "deposit",
      label: `定金锁班：先收 ${money(deposit)}`,
      bought: standardHours,
      gift: 0,
      paid: deposit,
      debt: Math.max(0, standardPrice - deposit),
      months: 3,
      note: "先收定金保留名额，剩余金额进入欠费补缴。"
    },
    {
      key: "short",
      label: "短期体验包：4 课时",
      bought: 4,
      gift: 0,
      paid: Math.max(398, Math.round(standardPrice / Math.max(standardHours, 1) * 4)),
      debt: 0,
      months: 1,
      note: "适合试听转化或短期体验，后续可再续正式课包。"
    },
    {
      key: "renewal",
      label: `续费课包：${standardHours} + 2 课时`,
      bought: standardHours,
      gift: 2,
      paid: standardPrice,
      debt: 0,
      months: 6,
      note: "适合在读学员续费，默认赠送 2 课时。"
    }
  ];
}

function selectedOrderPackage(courseName, key = "standard") {
  return orderPackagePresets(courseName).find((item) => item.key === key) || orderPackagePresets(courseName)[0];
}

function orderPackageOptions(courseName, selectedKey = "standard") {
  return orderPackagePresets(courseName)
    .map((item) => `<option value="${escapeHtml(item.key)}" ${item.key === selectedKey ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function orderPaymentPlanPresets(packagePreset) {
  const total = Number(packagePreset.paid || 0) + Number(packagePreset.debt || 0);
  const deposit = Math.min(total, Math.max(500, Math.round(total * 0.25)));
  const half = Math.min(total, Math.max(1, Math.round(total / 2)));
  const discount = Math.max(0, total - Math.min(500, Math.round(total * 0.1)));
  return {
    packageDefault: {
      label: "按套餐默认",
      paid: packagePreset.paid,
      debt: packagePreset.debt,
      note: packagePreset.key === "deposit" ? "报名订单首付款" : "标准报名一次收齐",
      hint: packagePreset.note
    },
    fullPaid: {
      label: `全款收齐：${money(total)}`,
      paid: total,
      debt: 0,
      note: packagePreset.key === "renewal" ? "续费课包收款" : "标准报名一次收齐",
      hint: "家长本次一次收齐，应收金额不留欠费。"
    },
    depositLock: {
      label: `订金锁班：先收 ${money(deposit)}`,
      paid: deposit,
      debt: Math.max(0, total - deposit),
      note: "报名订单首付款",
      hint: "先收订金保留名额，剩余金额进入欠费补缴。"
    },
    twoInstallments: {
      label: `分两期：先收 ${money(half)}`,
      paid: half,
      debt: Math.max(0, total - half),
      note: "分期补缴",
      hint: "适合家长约定分两次缴费，剩余金额进入后续补缴。"
    },
    discountApproved: {
      label: `优惠收齐：${money(discount)}`,
      paid: discount,
      debt: 0,
      note: "线下收款已核对",
      hint: "适合校长已审批优惠的订单，本次按优惠后金额收齐。"
    }
  };
}

function selectedOrderPaymentPlan(packagePreset, key = "packageDefault") {
  const presets = orderPaymentPlanPresets(packagePreset);
  return presets[key] || presets.packageDefault;
}

function orderPaymentPlanOptions(packagePreset, selectedValue = "packageDefault") {
  return Object.entries(orderPaymentPlanPresets(packagePreset))
    .map(([value, item]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function debtPaymentPresets(order) {
  const debt = Number(order.debt || 0);
  const half = Math.max(1, Math.round(debt / 2));
  const deposit = Math.min(debt, Math.max(300, Math.round(debt * 0.3)));
  return {
    fullWechat: {
      label: "全额补缴：微信",
      amount: debt,
      method: "微信",
      note: "家长补齐尾款"
    },
    fullTransfer: {
      label: "全额补缴：银行转账",
      amount: debt,
      method: "银行转账",
      note: "家长补齐尾款"
    },
    halfWechat: {
      label: `分期补缴：先收 ${money(Math.min(debt, half))}`,
      amount: Math.min(debt, half),
      method: "微信",
      note: "分期补缴"
    },
    depositLock: {
      label: `订金锁班：先收 ${money(deposit)}`,
      amount: deposit,
      method: "支付宝",
      note: "订金锁班补款"
    },
    offlineReview: {
      label: "线下已收：财务复核",
      amount: debt,
      method: "线下收款",
      note: "财务复核后入账"
    },
    cashSmall: {
      label: "现金补缴",
      amount: debt,
      method: "现金",
      note: "欠费补缴"
    }
  };
}

function debtPaymentPresetOptions(order, selectedValue = "fullWechat") {
  return Object.entries(debtPaymentPresets(order))
    .map(([value, item]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function paymentValueModeOptions(selectedValue = "auto") {
  return [
    ["auto", "按模板自动填写"],
    ["manual", "手动微调金额"]
  ]
    .map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function debtPaymentPreviewText(order, amount) {
  const beforeDebt = Number(order?.debt || 0);
  const paymentAmount = Math.min(Math.max(0, Number(amount || 0)), beforeDebt);
  return `当前欠费 ${money(beforeDebt)}，本次收款 ${money(paymentAmount)}，保存后剩余欠费 ${money(Math.max(0, beforeDebt - paymentAmount))}。`;
}

function syncDebtPaymentPreview(form, order) {
  if (!form || !order) return;
  const preview = form.querySelector("[data-payment-preview]");
  if (!preview) return;
  preview.innerHTML = `<strong>补缴影响预览</strong><span class="muted">${escapeHtml(debtPaymentPreviewText(order, form.elements.amount?.value))}</span>`;
}

function applyDebtPaymentValueMode(form) {
  if (!form?.elements?.amount) return;
  form.elements.amount.readOnly = (form.elements.valueMode?.value || "auto") === "auto";
}

function applyDebtPaymentPreset(form, order) {
  if (!form || !order) return;
  const preset = debtPaymentPresets(order)[form.elements.paymentPreset?.value];
  if (!preset) return;
  if (form.elements.amount) form.elements.amount.value = preset.amount;
  if (form.elements.method) {
    form.elements.method.innerHTML = typeof paymentMethodOptions === "function" ? paymentMethodOptions(preset.method) : `<option>${escapeHtml(preset.method)}</option>`;
    form.elements.method.value = preset.method;
  }
  if (form.elements.account) {
    const account = typeof paymentAccountForMethod === "function" ? paymentAccountForMethod(preset.method) : "校区收款账户";
    form.elements.account.innerHTML = typeof paymentAccountOptions === "function" ? paymentAccountOptions(account) : `<option>${escapeHtml(account)}</option>`;
    form.elements.account.value = account;
  }
  if (form.elements.note) {
    form.elements.note.innerHTML = typeof paymentNoteOptions === "function" ? paymentNoteOptions(preset.note) : `<option>${escapeHtml(preset.note)}</option>`;
    form.elements.note.value = preset.note;
  }
  applyDebtPaymentValueMode(form);
  syncDebtPaymentPreview(form, order);
}

function applyOrderPackagePreset() {
  const form = document.querySelector("#orderForm");
  if (!form) return;
  const courseName = form.querySelector("#orderCourseSelect")?.value || "";
  const preset = selectedOrderPackage(courseName, form.querySelector("#orderPackageSelect")?.value);
  const fields = {
    bought: preset.bought,
    gift: preset.gift,
    expireAt: addMonthsToToday(preset.months)
  };
  Object.entries(fields).forEach(([name, value]) => {
    const field = form.elements[name];
    if (field) field.value = value;
  });
  const paymentPlanSelect = form.querySelector("#orderPaymentPlanSelect");
  if (paymentPlanSelect) {
    paymentPlanSelect.innerHTML = orderPaymentPlanOptions(preset, paymentPlanSelect.value || "packageDefault");
  }
  applyOrderPaymentPlanPreset(form, preset);
}

function applyOrderPaymentPlanPreset(form = document.querySelector("#orderForm"), packagePreset) {
  if (!form) return;
  const courseName = form.querySelector("#orderCourseSelect")?.value || "";
  const preset = packagePreset || selectedOrderPackage(courseName, form.querySelector("#orderPackageSelect")?.value);
  const plan = selectedOrderPaymentPlan(preset, form.querySelector("#orderPaymentPlanSelect")?.value);
  if (form.elements.paid) form.elements.paid.value = plan.paid;
  if (form.elements.debt) form.elements.debt.value = plan.debt;
  if (form.elements.note) {
    form.elements.note.innerHTML = typeof paymentNoteOptions === "function" ? paymentNoteOptions(plan.note) : `<option>${escapeHtml(plan.note)}</option>`;
    form.elements.note.value = plan.note;
  }
  const hint = form.querySelector("[data-order-package-hint]");
  if (hint) hint.textContent = `${plan.hint} 应收合计 ${money(Number(preset.paid || 0) + Number(preset.debt || 0))}，本次实收 ${money(plan.paid)}，欠费 ${money(plan.debt)}，有效期至 ${form.elements.expireAt?.value || addMonthsToToday(preset.months)}。`;
}

function refreshOrderPackageChoices() {
  const form = document.querySelector("#orderForm");
  if (!form) return;
  const select = form.querySelector("#orderPackageSelect");
  const courseName = form.querySelector("#orderCourseSelect")?.value || "";
  if (select) select.innerHTML = orderPackageOptions(courseName, select.value || "standard");
  applyOrderPackagePreset();
}

function orderClassOpenSeats(classItem) {
  if (!classItem) return 0;
  const currentCount = appState.students.filter((student) => student.className === classItem.name).length;
  return Math.max(0, Number(classItem.capacity || 0) - currentCount);
}

function orderRecommendedClass(student) {
  if (!student) return appState.classes[0] || {};
  const currentClass = getClass(student.className);
  if (currentClass) return currentClass;
  if (typeof assignRecommendedClass === "function") return assignRecommendedClass(student);
  const course = text(student.course);
  return (
    appState.classes
      .filter((classItem) => orderClassOpenSeats(classItem) > 0)
      .map((classItem) => ({
        classItem,
        score: Number(course && classItem.course === course) * 3 + Number(course && text(classItem.course).includes(course)) * 2
      }))
      .sort((left, right) => right.score - left.score || orderClassOpenSeats(right.classItem) - orderClassOpenSeats(left.classItem))[0]?.classItem ||
    appState.classes[0] ||
    {}
  );
}

function orderRecommendedDefaults(student) {
  const classItem = orderRecommendedClass(student);
  const course = classItem?.course || student?.course || "常规课程";
  const packageKey = Number(student?.debt || 0) > 0 ? "deposit" : "standard";
  return {
    className: classItem?.name || "",
    course,
    packageKey,
    classItem
  };
}

function orderRecommendationHint(student, defaults = orderRecommendedDefaults(student)) {
  if (!student) return "请选择学员，系统会按意向课程、目标班级和欠费情况推荐报名默认项。";
  const reasons = [];
  if (getClass(student.className)) reasons.push("沿用学员当前班级");
  else if (defaults.className) reasons.push("按意向课程和容量推荐班级");
  if (Number(student.debt || 0) > 0) reasons.push("有欠费，默认订金/分期套餐");
  else reasons.push("默认标准报名套餐");
  if (defaults.classItem) reasons.push(`剩余 ${orderClassOpenSeats(defaults.classItem)} 个名额`);
  return `${student.name} 推荐报名 ${defaults.className || "待选班级"} / ${defaults.course}：${reasons.join("，")}。`;
}

function syncOrderStudentDefaults(form) {
  const student = appState.students.find((item) => item.id === form?.elements?.studentId?.value);
  if (!form || !student) return;
  const defaults = orderRecommendedDefaults(student);
  if (form.elements.className) {
    form.elements.className.innerHTML = classOptions(defaults.className);
    form.elements.className.value = defaults.className;
  }
  if (form.elements.course) {
    form.elements.course.innerHTML = courseOptions(defaults.course);
    form.elements.course.value = defaults.course;
  }
  const packageSelect = form.elements.package;
  if (packageSelect) {
    packageSelect.innerHTML = orderPackageOptions(defaults.course, defaults.packageKey);
    packageSelect.value = defaults.packageKey;
  }
  applyOrderPackagePreset();
  const hint = form.querySelector("[data-order-recommend-hint]");
  if (hint) hint.textContent = orderRecommendationHint(student, defaults);
}

renderOrderQuickForm = function renderOrderQuickFormWithPaymentFields() {
  const selectedStudent = appState.students.find((item) => item.id === selectedStudentForOrder);
  const defaultStudent = selectedStudent || appState.students[0];
  const defaults = orderRecommendedDefaults(defaultStudent);
  const defaultClass = defaults.classItem || appState.classes[0] || {};
  const defaultCourse = defaults.course;
  const defaultPackage = selectedOrderPackage(defaultCourse, defaults.packageKey);
  const defaultPaymentPlanKey = "packageDefault";
  const defaultPaymentPlan = selectedOrderPaymentPlan(defaultPackage, defaultPaymentPlanKey);
  const defaultMethod = "微信";
  const defaultAccount = typeof paymentAccountForMethod === "function" ? paymentAccountForMethod(defaultMethod) : "微信收款码";
  return `
    <form class="operation-panel" id="orderForm">
      <div>
        <strong>快速报名</strong>
        <span class="muted">选择报名套餐后自动填充课时、金额、欠费和有效期，仍可按实际收款微调。</span>
      </div>
      <div class="operation-grid">
        <label>学员<select name="studentId" required>${studentOptions(defaultStudent?.id || "")}</select></label>
        <label>报读班级<select name="className" id="orderClassSelect" required>${classOptions(defaultClass.name || defaults.className)}</select></label>
        <label>报读课程<select name="course" id="orderCourseSelect" required>${courseOptions(defaultCourse)}</select></label>
        <label>报名套餐<select name="package" id="orderPackageSelect">${orderPackageOptions(defaultCourse, defaults.packageKey)}</select></label>
        <label>付款状态模板<select name="paymentPlan" id="orderPaymentPlanSelect">${orderPaymentPlanOptions(defaultPackage, defaultPaymentPlanKey)}</select></label>
        <label>购买课时<input name="bought" type="number" min="0" step="0.5" value="${escapeHtml(defaultPackage.bought)}" required /></label>
        <label>赠送课时<input name="gift" type="number" min="0" step="0.5" value="${escapeHtml(defaultPackage.gift)}" /></label>
        <label>实收金额<input name="paid" type="number" min="0" step="1" value="${escapeHtml(defaultPaymentPlan.paid)}" required /></label>
        <label>欠费金额<input name="debt" type="number" min="0" step="1" value="${escapeHtml(defaultPaymentPlan.debt)}" /></label>
        <label>有效期至<input name="expireAt" type="date" value="${escapeHtml(addMonthsToToday(defaultPackage.months))}" required /></label>
        <label>收款方式<select name="payMethod">${typeof paymentMethodOptions === "function" ? paymentMethodOptions(defaultMethod) : "<option>微信</option><option>支付宝</option><option>银行转账</option><option>现金</option><option>线下收款</option>"}</select></label>
        <label>收款账户<select name="account">${typeof paymentAccountOptions === "function" ? paymentAccountOptions(defaultAccount) : `<option>${escapeHtml(defaultAccount)}</option>`}</select></label>
        <label>收款备注<select name="note">${typeof paymentNoteOptions === "function" ? paymentNoteOptions(defaultPaymentPlan.note) : `<option>${escapeHtml(defaultPaymentPlan.note)}</option>`}</select></label>
        <label>支付单号<input name="tradeNo" placeholder="可选" /></label>
        <div class="muted order-recommend-hint" data-order-recommend-hint>${escapeHtml(orderRecommendationHint(defaultStudent, defaults))}</div>
        <div class="muted order-package-hint" data-order-package-hint>${escapeHtml(`${defaultPaymentPlan.hint} 应收合计 ${money(Number(defaultPackage.paid || 0) + Number(defaultPackage.debt || 0))}，本次实收 ${money(defaultPaymentPlan.paid)}，欠费 ${money(defaultPaymentPlan.debt)}，有效期至 ${addMonthsToToday(defaultPackage.months)}。`)}</div>
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
        <td>${escapeHtml(payment.note || payment.tradeNo || "-")}</td>
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
        ${table(["流水号", "学员", "金额", "方式", "经办人", "收款时间", "备注"], renderPaymentRows())}
      </div>
    </section>`;
};

function renderPaymentDialog(orderId) {
  const order = appState.orders.find((item) => item.id === orderId);
  if (!order) return;
  const debt = Number(order.debt || 0);
  const defaultPreset = debtPaymentPresets(order).fullWechat;
  const defaultMethod = defaultPreset.method;
  const defaultAccount = typeof paymentAccountForMethod === "function" ? paymentAccountForMethod(defaultMethod) : "微信收款码";
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
        <label>收款场景模板<select name="paymentPreset">${debtPaymentPresetOptions(order, "fullWechat")}</select></label>
        <label>收款数值来源<select name="valueMode">${paymentValueModeOptions("auto")}</select></label>
        <label>本次收款<input name="amount" type="number" min="1" max="${debt}" step="1" value="${debt}" required readonly /></label>
        <label>收款方式<select name="method">${typeof paymentMethodOptions === "function" ? paymentMethodOptions(defaultMethod) : "<option>微信</option><option>支付宝</option><option>银行转账</option><option>现金</option><option>线下收款</option>"}</select></label>
        <label>收款账户<select name="account">${typeof paymentAccountOptions === "function" ? paymentAccountOptions(defaultAccount) : `<option>${escapeHtml(defaultAccount)}</option>`}</select></label>
        <label>支付单号<input name="tradeNo" value="${escapeHtml(order.tradeNo || "")}" /></label>
        <label>经办人<select name="operator">${typeof operatorChoiceOptions === "function" ? operatorChoiceOptions(order.owner || "前台老师") : `<option>${escapeHtml(order.owner || "前台老师")}</option>`}</select></label>
        <label>备注<select name="note">${typeof paymentNoteOptions === "function" ? paymentNoteOptions(defaultPreset.note) : `<option>${escapeHtml(defaultPreset.note)}</option>`}</select></label>
        <div class="payment-preview" data-payment-preview>
          <strong>补缴影响预览</strong>
          <span class="muted">${escapeHtml(debtPaymentPreviewText(order, defaultPreset.amount))}</span>
        </div>
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
  const note = text(formData.get("note")).trim() || "报名订单首付款";
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
      note
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

document.addEventListener("change", (event) => {
  if (event.target.id === "orderPackageSelect") {
    applyOrderPackagePreset();
  }

  if (event.target.id === "orderPaymentPlanSelect") {
    applyOrderPaymentPlanPreset(event.target.form || event.target.closest("form"));
  }

  if (event.target.name === "studentId" && event.target.closest("#orderForm")) {
    syncOrderStudentDefaults(event.target.form || event.target.closest("form"));
  }

  if (event.target.id === "orderCourseSelect" || event.target.id === "orderClassSelect") {
    if (event.target.id === "orderClassSelect") {
      const student = appState.students.find((item) => item.id === event.target.form?.elements?.studentId?.value);
      const defaults = orderRecommendedDefaults(student);
      const hint = event.target.form?.querySelector("[data-order-recommend-hint]");
      if (hint) hint.textContent = orderRecommendationHint(student, { ...defaults, className: event.target.value, classItem: getClass(event.target.value), course: getClass(event.target.value)?.course || event.target.form?.elements?.course?.value || defaults.course });
    }
    refreshOrderPackageChoices();
  }

  if (event.target.name === "payMethod" && event.target.closest("#orderForm")) {
    applyPaymentMethodAccount(event.target.form, "payMethod");
  }

  if (event.target.name === "method" && event.target.closest("#paymentForm")) {
    applyPaymentMethodAccount(event.target.form, "method");
  }

  if (event.target.name === "paymentPreset" && event.target.closest("#paymentForm")) {
    const order = appState.orders.find((item) => item.id === event.target.form.dataset.orderId);
    applyDebtPaymentPreset(event.target.form, order);
  }

  if (event.target.name === "valueMode" && event.target.closest("#paymentForm")) {
    applyDebtPaymentValueMode(event.target.form);
  }

  if (event.target.name === "amount" && event.target.closest("#paymentForm")) {
    const order = appState.orders.find((item) => item.id === event.target.form.dataset.orderId);
    syncDebtPaymentPreview(event.target.form, order);
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "paymentForm") return;
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  receiveDebtPayment(event.target);
});

document.addEventListener("input", (event) => {
  if (event.target.name !== "amount" || !event.target.closest("#paymentForm")) return;
  const order = appState.orders.find((item) => item.id === event.target.form.dataset.orderId);
  syncDebtPaymentPreview(event.target.form, order);
});

ensurePaymentData();
saveState();
