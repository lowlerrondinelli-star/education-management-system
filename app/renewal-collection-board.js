const renewalBoardStyle = document.createElement("style");
renewalBoardStyle.textContent = `
  .renewal-board {
    margin-bottom: 16px;
  }

  .renewal-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .renewal-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .renewal-tags,
  .renewal-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .renewal-note {
    min-width: 220px;
    max-width: 340px;
    line-height: 1.55;
    white-space: normal;
  }

  .renewal-money {
    display: grid;
    gap: 5px;
  }

  @media (max-width: 650px) {
    .renewal-toolbar,
    .renewal-toolbar label,
    .renewal-toolbar select {
      width: 100%;
    }

    .renewal-note {
      min-width: 0;
      max-width: none;
    }
  }
`;
document.head.appendChild(renewalBoardStyle);

let renewalTypeFilter = "all";
let renewalOwnerFilter = "all";
let renewalStatusFilter = "all";
let renewalSortMode = "priority";

const renewalTypeMeta = {
  debt: { label: "欠费催缴", tone: "red", followType: "欠费补缴", priority: 1 },
  renew: { label: "课时不足", tone: "amber", followType: "课时不足", priority: 2 },
  expiring: { label: "有效期提醒", tone: "amber", followType: "常规回访", priority: 3 },
  intent: { label: "报名转化", tone: "amber", followType: "意向回访", priority: 4 }
};

function renewalOrdersForStudent(student) {
  return appState.orders.filter((order) => order.student === student.name);
}

function renewalStudentByName(name) {
  return appState.students.find((student) => student.name === name);
}

function renewalOrderRemaining(order) {
  if (typeof orderHoursRemaining === "function") return orderHoursRemaining(order);
  return Math.max(0, Number(order.bought || 0) + Number(order.gift || 0) - Number(order.used || 0));
}

function renewalExpireDays(order) {
  if (typeof daysUntilOrderExpire === "function") return daysUntilOrderExpire(order);
  const expireDate = new Date(`${order.expireAt}T00:00:00`);
  const today = new Date(`${todayIsoDate()}T00:00:00`);
  if (!Number.isFinite(expireDate.getTime()) || !Number.isFinite(today.getTime())) return Infinity;
  return Math.ceil((expireDate - today) / 86400000);
}

function renewalFollowUps(student) {
  if (typeof ensureFollowUpData === "function") ensureFollowUpData();
  return (appState.followUps || []).filter((item) => item.studentId === student.id || item.student === student.name);
}

function renewalLastFollowUp(student) {
  return renewalFollowUps(student).sort((left, right) => {
    const rightValue = text(right.updatedAt || right.dueDate);
    const leftValue = text(left.updatedAt || left.dueDate);
    return rightValue.localeCompare(leftValue);
  })[0];
}

function renewalActiveFollowUps(student) {
  return renewalFollowUps(student).filter((item) => item.status !== "已完成");
}

function renewalStudentDebt(student) {
  if (typeof studentOpsDebt === "function") return studentOpsDebt(student);
  const orderDebt = renewalOrdersForStudent(student).reduce((sum, order) => sum + Number(order.debt || 0), 0);
  return Math.max(Number(student.debt || 0), orderDebt);
}

function renewalRowStatus(row) {
  const activeItems = renewalActiveFollowUps(row.student);
  const last = row.lastFollowUp;
  const due = activeItems.some((item) => item.dueDate <= todayIsoDate());
  const promised = activeItems.some((item) => item.result === "约定缴费");

  if (!last) return { key: "none", label: "未建跟进", tone: "red" };
  if (promised) return { key: "promised", label: "约定缴费", tone: "amber" };
  if (due) return { key: "due", label: "到期跟进", tone: "red" };
  if (last.status === "已完成") return { key: "done", label: "已完成", tone: "green" };
  if (last.result === "已联系") return { key: "contacted", label: "已联系", tone: "green" };
  return { key: "pending", label: last.result || last.status || "待跟进", tone: "amber" };
}

function renewalSuggestedNote(row) {
  if (row.type === "debt") return `先确认 ${money(row.debt)} 欠费的补缴时间，必要时同步发送收款账户。`;
  if (row.type === "renew") return `剩余 ${row.remaining} 课时，建议本周完成续费沟通并确认新课包。`;
  if (row.type === "expiring") return `有效期${row.expireDays < 0 ? `已过 ${Math.abs(row.expireDays)} 天` : `还剩 ${row.expireDays} 天`}，先确认后续上课计划。`;
  return `意向课程：${row.student.course || "待确认"}，建议确认试听、报名和分班时间。`;
}

function renewalBuildRows() {
  const rows = [];
  const seenIntent = new Set();

  for (const order of appState.orders) {
    if (order.status === "已作废") continue;
    const student = renewalStudentByName(order.student);
    if (!student) continue;
    const debt = Number(order.debt || 0);
    const remaining = renewalOrderRemaining(order);
    const expireDays = renewalExpireDays(order);
    let type = "";

    if (debt > 0) type = "debt";
    else if (remaining > 0 && remaining <= 3) type = "renew";
    else if (expireDays <= 30) type = "expiring";
    if (!type) continue;

    const lastFollowUp = renewalLastFollowUp(student);
    rows.push({
      key: `${type}:${order.id}`,
      type,
      student,
      order,
      owner: order.owner || student.owner || "未分配",
      className: order.className || student.className || "待分班",
      debt,
      remaining,
      expireDays,
      lastFollowUp,
      priority: renewalTypeMeta[type].priority
    });
    seenIntent.add(student.id);
  }

  for (const student of appState.students) {
    const hasOrder = renewalOrdersForStudent(student).length > 0;
    if (student.status !== "意向" || seenIntent.has(student.id) || hasOrder) continue;
    const lastFollowUp = renewalLastFollowUp(student);
    rows.push({
      key: `intent:${student.id}`,
      type: "intent",
      student,
      order: null,
      owner: student.owner || "未分配",
      className: student.className || "待分班",
      debt: renewalStudentDebt(student),
      remaining: Number(student.balance || 0),
      expireDays: Infinity,
      lastFollowUp,
      priority: renewalTypeMeta.intent.priority
    });
  }

  return rows;
}

function renewalMatchesSearch(row) {
  if (!searchTerm) return true;
  const haystack = [
    row.student.name,
    row.student.phone,
    row.student.grade,
    row.student.course,
    row.owner,
    row.className,
    row.order?.id,
    row.order?.course,
    row.lastFollowUp?.note
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchTerm.toLowerCase());
}

function renewalMatchesFilters(row) {
  const rowStatus = renewalRowStatus(row).key;
  if (!renewalMatchesSearch(row)) return false;
  if (renewalTypeFilter !== "all" && row.type !== renewalTypeFilter) return false;
  if (renewalOwnerFilter !== "all" && row.owner !== renewalOwnerFilter) return false;
  if (renewalStatusFilter === "active" && rowStatus === "done") return false;
  if (renewalStatusFilter !== "all" && renewalStatusFilter !== "active" && rowStatus !== renewalStatusFilter) return false;
  return true;
}

function renewalCompareRows(left, right) {
  if (renewalSortMode === "debtDesc") return right.debt - left.debt;
  if (renewalSortMode === "hoursAsc") return left.remaining - right.remaining;
  if (renewalSortMode === "expireAsc") return left.expireDays - right.expireDays;
  if (renewalSortMode === "owner") {
    const ownerGap = text(left.owner).localeCompare(text(right.owner), "zh-CN");
    return ownerGap || text(left.student.name).localeCompare(text(right.student.name), "zh-CN");
  }
  const statusWeight = { none: 0, due: 1, promised: 2, pending: 3, contacted: 4, done: 9 };
  const leftStatus = renewalRowStatus(left).key;
  const rightStatus = renewalRowStatus(right).key;
  return left.priority - right.priority || (statusWeight[leftStatus] ?? 5) - (statusWeight[rightStatus] ?? 5) || text(left.student.name).localeCompare(text(right.student.name), "zh-CN");
}

function renewalUniqueOptions(rows, key, selectedValue, allLabel) {
  const values = [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function renderRenewalToolbar(rows) {
  return `
    <div class="filters renewal-toolbar">
      <label>沟通类型
        <select id="renewalTypeFilter" aria-label="续费欠费沟通类型筛选">
          <option value="all" ${renewalTypeFilter === "all" ? "selected" : ""}>全部类型</option>
          <option value="debt" ${renewalTypeFilter === "debt" ? "selected" : ""}>欠费催缴</option>
          <option value="renew" ${renewalTypeFilter === "renew" ? "selected" : ""}>课时不足</option>
          <option value="expiring" ${renewalTypeFilter === "expiring" ? "selected" : ""}>有效期提醒</option>
          <option value="intent" ${renewalTypeFilter === "intent" ? "selected" : ""}>报名转化</option>
        </select>
      </label>
      <label>负责人
        <select id="renewalOwnerFilter" aria-label="续费欠费负责人筛选">${renewalUniqueOptions(rows, "owner", renewalOwnerFilter, "全部负责人")}</select>
      </label>
      <label>跟进状态
        <select id="renewalStatusFilter" aria-label="续费欠费跟进状态筛选">
          <option value="all" ${renewalStatusFilter === "all" ? "selected" : ""}>全部状态</option>
          <option value="active" ${renewalStatusFilter === "active" ? "selected" : ""}>未完成</option>
          <option value="none" ${renewalStatusFilter === "none" ? "selected" : ""}>未建跟进</option>
          <option value="due" ${renewalStatusFilter === "due" ? "selected" : ""}>到期跟进</option>
          <option value="promised" ${renewalStatusFilter === "promised" ? "selected" : ""}>约定缴费</option>
          <option value="contacted" ${renewalStatusFilter === "contacted" ? "selected" : ""}>已联系</option>
          <option value="done" ${renewalStatusFilter === "done" ? "selected" : ""}>已完成</option>
        </select>
      </label>
      <label>排序
        <select id="renewalSortMode" aria-label="续费欠费排序">
          <option value="priority" ${renewalSortMode === "priority" ? "selected" : ""}>处理优先级</option>
          <option value="debtDesc" ${renewalSortMode === "debtDesc" ? "selected" : ""}>欠费金额降序</option>
          <option value="hoursAsc" ${renewalSortMode === "hoursAsc" ? "selected" : ""}>剩余课时升序</option>
          <option value="expireAsc" ${renewalSortMode === "expireAsc" ? "selected" : ""}>有效期升序</option>
          <option value="owner" ${renewalSortMode === "owner" ? "selected" : ""}>负责人分组</option>
        </select>
      </label>
    </div>`;
}

function renewalSummary(rows, visibleRows) {
  const debtRows = rows.filter((row) => row.type === "debt");
  const renewRows = rows.filter((row) => row.type === "renew");
  const intentRows = rows.filter((row) => row.type === "intent");
  const activeRows = rows.filter((row) => renewalRowStatus(row).key !== "done");
  const debtTotal = debtRows.reduce((sum, row) => sum + row.debt, 0);

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 个沟通对象</small></div>
      <div class="metric"><span>待收欠费</span><strong>${money(debtTotal)}</strong><small>${debtRows.length} 个催缴对象</small></div>
      <div class="metric"><span>续费提醒</span><strong>${renewRows.length}</strong><small>课时不足需优先联系</small></div>
      <div class="metric"><span>未完成沟通</span><strong>${activeRows.length}</strong><small>${intentRows.length} 个报名转化</small></div>
    </div>`;
}

function renderRenewalTags(row) {
  const meta = renewalTypeMeta[row.type];
  const tags = [tag(meta.label, meta.tone)];
  if (row.debt > 0) tags.push(tag(`欠费 ${money(row.debt)}`, "red"));
  if (row.remaining > 0 && row.remaining <= 3) tags.push(tag(`剩 ${row.remaining} 课时`, "amber"));
  if (Number.isFinite(row.expireDays) && row.expireDays <= 30) tags.push(tag(row.expireDays < 0 ? "已过期" : `${row.expireDays} 天到期`, row.expireDays < 0 ? "red" : "amber"));
  return `<div class="renewal-tags">${tags.join("")}</div>`;
}

function renderRenewalRows(rows) {
  return rows.map((row) => {
    const status = renewalRowStatus(row);
    const last = row.lastFollowUp;
    const followText = last ? `${last.type || "跟进"} / ${last.result || last.status || "待联系"}` : "暂无跟进";
    const dueText = last?.dueDate ? `下次 ${last.dueDate}` : "建议今天建跟进";
    return `<tr>
      <td><strong>${escapeHtml(row.student.name)}</strong><br><span class="muted">${escapeHtml(row.student.phone)} · ${escapeHtml(row.student.relation || "")}</span></td>
      <td>${renderRenewalTags(row)}<span class="muted">${escapeHtml(row.order?.id || row.student.status || "")}</span></td>
      <td>${escapeHtml(row.owner)}<br><span class="muted">${escapeHtml(row.className)}</span></td>
      <td>
        <div class="renewal-money">
          <span>${row.debt ? tag(money(row.debt), "red") : tag("无欠费", "green")}</span>
          <span class="muted">剩余 ${escapeHtml(row.remaining)} 课时</span>
          <span class="muted">${row.order ? `有效期 ${escapeHtml(row.order.expireAt || "-")}` : "未生成订单"}</span>
        </div>
      </td>
      <td>${tag(status.label, status.tone)}<br><span class="muted">${escapeHtml(followText)}</span><br><span class="muted">${escapeHtml(dueText)}</span></td>
      <td class="renewal-note">${escapeHtml(renewalSuggestedNote(row))}</td>
      <td>
        <div class="renewal-actions">
          <button class="small-button" type="button" data-renewal-contact="${escapeHtml(row.student.id)}" data-renewal-type="${escapeHtml(row.type)}">已联系</button>
          ${row.debt > 0 && row.order ? `<button class="small-button" type="button" data-pay-order="${escapeHtml(row.order.id)}">补缴</button>` : ""}
          <button class="small-button" type="button" data-student-order="${escapeHtml(row.student.id)}">${row.type === "intent" ? "报名" : "续费"}</button>
          <button class="small-button" type="button" data-student-detail="${escapeHtml(row.student.id)}">详情</button>
        </div>
      </td>
    </tr>`;
  });
}

function prependRenewalBoard() {
  if (currentView !== "orders" || appContent.querySelector(".renewal-board")) return;
  const rows = renewalBuildRows();
  const visibleRows = rows.filter(renewalMatchesFilters).sort(renewalCompareRows);
  appContent.insertAdjacentHTML(
    "afterbegin",
    `<section class="section renewal-board">
      <div class="section-head">
        <div>
          <h3>续费与欠费沟通台</h3>
          <span class="muted">集中处理待收欠费、课时不足、有效期提醒和意向转化，联系后自动沉淀到跟进记录。</span>
        </div>
        ${tag(`${visibleRows.length} 项`, visibleRows.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${renewalSummary(rows, visibleRows)}
        ${renderRenewalToolbar(rows)}
        ${table(["学员", "类型/订单", "负责人/班级", "资金课时", "最近跟进", "建议话术", "操作"], renderRenewalRows(visibleRows))}
      </div>
    </section>`
  );
}

function addRenewalContact(studentId, typeKey) {
  if (typeof ensureFollowUpData === "function") ensureFollowUpData();
  const student = appState.students.find((item) => item.id === studentId);
  const meta = renewalTypeMeta[typeKey] || renewalTypeMeta.renew;
  if (!student) return;

  const rows = renewalBuildRows().filter((row) => row.student.id === studentId && row.type === typeKey);
  const row = rows[0] || { student, type: typeKey, debt: renewalStudentDebt(student), remaining: Number(student.balance || 0), expireDays: Infinity };
  const nextDueDate = daysFromToday(2);
  const updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  for (const item of renewalActiveFollowUps(student)) {
    if (item.type !== meta.followType) continue;
    item.result = "已联系";
    item.dueDate = nextDueDate;
    item.updatedAt = updatedAt;
  }

  const followUp = {
    id: nextId("F"),
    key: `manual:${typeKey}:${student.id}:${Date.now()}`,
    studentId: student.id,
    student: student.name,
    phone: student.phone,
    type: meta.followType,
    owner: row.owner || student.owner || "前台老师",
    dueDate: nextDueDate,
    status: "待跟进",
    result: "已联系",
    priority: typeKey === "debt" ? "高" : "中",
    source: "沟通台",
    note: `${meta.label}：${renewalSuggestedNote(row)}`,
    updatedAt
  };

  appState.followUps.unshift(followUp);
  setNotice("orders", `${student.name} 已记录一次${meta.label}，下次跟进：${followUp.dueDate}。`);
  saveState();
  renderNav();
  renderView();
}

const baseRenderOrdersForRenewalBoard = renderOrders;
renderOrders = function renderOrdersWithRenewalBoard() {
  baseRenderOrdersForRenewalBoard();
  prependRenewalBoard();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "renewalTypeFilter") renewalTypeFilter = event.target.value;
  if (event.target.id === "renewalOwnerFilter") renewalOwnerFilter = event.target.value;
  if (event.target.id === "renewalStatusFilter") renewalStatusFilter = event.target.value;
  if (event.target.id === "renewalSortMode") renewalSortMode = event.target.value;

  if (["renewalTypeFilter", "renewalOwnerFilter", "renewalStatusFilter", "renewalSortMode"].includes(event.target.id) && currentView === "orders") {
    renderView();
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-renewal-contact]");
  if (!button) return;
  addRenewalContact(button.dataset.renewalContact, button.dataset.renewalType);
});

if (currentView === "orders") renderView();
