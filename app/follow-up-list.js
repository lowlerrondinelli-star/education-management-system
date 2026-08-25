const followUpListStyle = document.createElement("style");
followUpListStyle.textContent = `
  .follow-list-summary {
    margin-bottom: 14px;
  }

  .follow-filter-toolbar {
    align-items: end;
  }

  .follow-filter-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .follow-filter-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .follow-risk-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 260px;
  }

  @media (max-width: 650px) {
    .follow-filter-toolbar,
    .follow-filter-toolbar label,
    .follow-filter-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(followUpListStyle);

let followTypeFilter = "all";
let followOwnerFilter = "all";
let followStatusFilter = "active";
let followDueFilter = "all";
let followPriorityFilter = "all";
let followSortMode = "dueAsc";

function followDayGap(item) {
  const due = new Date(`${item.dueDate}T00:00:00`).getTime();
  const today = new Date(`${todayText()}T00:00:00`).getTime();
  if (!Number.isFinite(due) || !Number.isFinite(today)) return 999;
  return Math.round((due - today) / 86400000);
}

function followRiskReasons(item) {
  const reasons = [];
  const gap = followDayGap(item);

  if (item.status === "已完成") reasons.push({ key: "done", label: "已完成", tone: "green" });
  else if (gap < 0) reasons.push({ key: "overdue", label: "已逾期", tone: "red" });
  else if (gap === 0) reasons.push({ key: "today", label: "今日到期", tone: "red" });
  else if (gap <= 2) reasons.push({ key: "soon", label: "即将到期", tone: "amber" });

  if (item.priority === "高" && item.status !== "已完成") reasons.push({ key: "high", label: "高优先级", tone: "amber" });
  if (item.result === "未接通") reasons.push({ key: "missed", label: "未接通", tone: "amber" });
  if (item.result === "约定缴费") reasons.push({ key: "promised", label: "约定缴费", tone: "green" });

  return reasons;
}

function followMatchesDue(item) {
  const gap = followDayGap(item);
  if (followDueFilter === "all") return true;
  if (followDueFilter === "overdue") return item.status !== "已完成" && gap < 0;
  if (followDueFilter === "today") return item.status !== "已完成" && gap === 0;
  if (followDueFilter === "next2") return item.status !== "已完成" && gap >= 0 && gap <= 2;
  if (followDueFilter === "future") return item.status !== "已完成" && gap > 2;
  return true;
}

function followMatchesStatus(item) {
  if (followStatusFilter === "all") return true;
  if (followStatusFilter === "active") return item.status !== "已完成";
  return item.status === followStatusFilter;
}

function followMatchesListFilters(item) {
  if (!matchesRow(item)) return false;
  if (followTypeFilter !== "all" && item.type !== followTypeFilter) return false;
  if (followOwnerFilter !== "all" && item.owner !== followOwnerFilter) return false;
  if (followPriorityFilter !== "all" && item.priority !== followPriorityFilter) return false;
  if (!followMatchesStatus(item)) return false;
  return followMatchesDue(item);
}

function followSortKeyTime(item) {
  const time = new Date(`${item.dueDate}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareFollowUps(left, right) {
  if (followSortMode === "dueDesc") return followSortKeyTime(right) - followSortKeyTime(left);
  if (followSortMode === "priority") {
    const weights = { 高: 1, 中: 2, 低: 3 };
    return (weights[left.priority] || 9) - (weights[right.priority] || 9) || followSortKeyTime(left) - followSortKeyTime(right);
  }
  if (followSortMode === "owner") return text(left.owner).localeCompare(text(right.owner), "zh-CN") || followSortKeyTime(left) - followSortKeyTime(right);
  if (followSortMode === "student") return text(left.student).localeCompare(text(right.student), "zh-CN") || followSortKeyTime(left) - followSortKeyTime(right);
  return followSortKeyTime(left) - followSortKeyTime(right);
}

function followSelectOptions(values, selectedValue, allLabel) {
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function renderFollowRiskTags(item) {
  const reasons = followRiskReasons(item).filter((reason) => reason.key !== "done" || followStatusFilter !== "active");
  if (!reasons.length) return tag("正常", "green");
  return `<div class="follow-risk-tags">${reasons.map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function renderFollowFilterToolbar() {
  const types = [...new Set(appState.followUps.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const owners = [...new Set(appState.followUps.map((item) => item.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const priorities = [...new Set(appState.followUps.map((item) => item.priority).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));

  return `
    <div class="filters follow-filter-toolbar">
      <label>类型
        <select id="followTypeFilter" aria-label="按类型筛选跟进">
          ${followSelectOptions(types, followTypeFilter, "全部类型")}
        </select>
      </label>
      <label>跟进人
        <select id="followOwnerFilter" aria-label="按跟进人筛选">
          ${followSelectOptions(owners, followOwnerFilter, "全部跟进人")}
        </select>
      </label>
      <label>状态
        <select id="followStatusFilter" aria-label="按状态筛选跟进">
          <option value="active" ${followStatusFilter === "active" ? "selected" : ""}>未完成</option>
          <option value="all" ${followStatusFilter === "all" ? "selected" : ""}>全部状态</option>
          <option value="待跟进" ${followStatusFilter === "待跟进" ? "selected" : ""}>待跟进</option>
          <option value="已完成" ${followStatusFilter === "已完成" ? "selected" : ""}>已完成</option>
        </select>
      </label>
      <label>到期
        <select id="followDueFilter" aria-label="按到期时间筛选">
          <option value="all" ${followDueFilter === "all" ? "selected" : ""}>全部到期</option>
          <option value="overdue" ${followDueFilter === "overdue" ? "selected" : ""}>已逾期</option>
          <option value="today" ${followDueFilter === "today" ? "selected" : ""}>今天到期</option>
          <option value="next2" ${followDueFilter === "next2" ? "selected" : ""}>未来 2 天</option>
          <option value="future" ${followDueFilter === "future" ? "selected" : ""}>更晚跟进</option>
        </select>
      </label>
      <label>优先级
        <select id="followPriorityFilter" aria-label="按优先级筛选">
          ${followSelectOptions(priorities, followPriorityFilter, "全部优先级")}
        </select>
      </label>
      <label>排序
        <select id="followSortMode" aria-label="跟进记录排序">
          <option value="dueAsc" ${followSortMode === "dueAsc" ? "selected" : ""}>到期升序</option>
          <option value="dueDesc" ${followSortMode === "dueDesc" ? "selected" : ""}>到期降序</option>
          <option value="priority" ${followSortMode === "priority" ? "selected" : ""}>优先级</option>
          <option value="owner" ${followSortMode === "owner" ? "selected" : ""}>跟进人分组</option>
          <option value="student" ${followSortMode === "student" ? "selected" : ""}>学员分组</option>
        </select>
      </label>
    </div>`;
}

function followListSummary(visibleRows) {
  const active = visibleRows.filter((item) => item.status !== "已完成").length;
  const due = visibleRows.filter((item) => item.status !== "已完成" && followDayGap(item) <= 0).length;
  const high = visibleRows.filter((item) => item.status !== "已完成" && item.priority === "高").length;
  const promised = visibleRows.filter((item) => item.result === "约定缴费").length;

  return `
    <div class="summary-grid compact-metrics follow-list-summary">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>按筛选条件统计</small></div>
      <div class="metric"><span>未完成</span><strong>${active}</strong><small>需要继续跟进</small></div>
      <div class="metric"><span>到期/逾期</span><strong>${due}</strong><small>建议优先处理</small></div>
      <div class="metric"><span>高优先级/约定缴费</span><strong>${high + promised}</strong><small>高优先级 ${high} 个，约定缴费 ${promised} 个</small></div>
    </div>`;
}

function renderFollowRows(rows) {
  return rows.map((item) => {
    const student = appState.students.find((row) => row.name === item.student);
    const done = item.status === "已完成";
    return `<tr>
      <td><strong>${escapeHtml(item.student)}</strong><br><span class="muted">${escapeHtml(item.phone)}</span></td>
      <td>${tag(item.type, followUpTone(item))}<br>${tag(item.priority || "中", item.priority === "高" ? "red" : item.priority === "低" ? "green" : "amber")}</td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${escapeHtml(item.dueDate)}<br><span class="muted">${followDayGap(item) < 0 ? `逾期 ${Math.abs(followDayGap(item))} 天` : followDayGap(item) === 0 ? "今天到期" : `${followDayGap(item)} 天后`}</span></td>
      <td>${tag(item.status, done ? "green" : followUpTone(item))}<br><span class="muted">${escapeHtml(item.result || "-")}</span></td>
      <td>${renderFollowRiskTags(item)}</td>
      <td class="follow-note">${escapeHtml(item.note)}</td>
      <td>
        <div class="follow-actions">
          <button class="small-button" type="button" data-follow-result="${escapeHtml(item.id)}" data-result="已联系" ${done ? "disabled" : ""}>已联系</button>
          <button class="small-button" type="button" data-follow-result="${escapeHtml(item.id)}" data-result="约定缴费" ${done ? "disabled" : ""}>约定缴费</button>
          <button class="small-button" type="button" data-follow-done="${escapeHtml(item.id)}" ${done ? "disabled" : ""}>完成</button>
          ${student ? `<button class="small-button" type="button" data-follow-student="${escapeHtml(student.id)}">学员详情</button>` : ""}
        </div>
      </td>
    </tr>`;
  });
}

function renderFollowDueCards(items) {
  const cards = items.slice(0, 5).map(
    (item) => `<div class="follow-card due">
      <strong>${escapeHtml(item.student)} ${tag(item.type, followUpTone(item))}</strong>
      <span class="muted">${escapeHtml(item.owner)} / ${escapeHtml(item.dueDate)} / ${escapeHtml(item.phone)}</span>
      <span class="follow-note">${escapeHtml(item.note)}</span>
      <div class="follow-actions">
        <button class="small-button" type="button" data-follow-result="${escapeHtml(item.id)}" data-result="已联系">已联系</button>
        <button class="small-button" type="button" data-follow-done="${escapeHtml(item.id)}">完成</button>
      </div>
    </div>`
  );
  return `<div class="stack-list">${cards.join("") || `<div class="follow-card"><strong>当前筛选下没有紧急跟进</strong><span class="muted">可以切换筛选，提前处理明后天的续费沟通。</span></div>`}</div>`;
}

renderFollowUp = function renderFollowUpWithFilters() {
  ensureFollowUpData();
  const visibleRows = appState.followUps.filter(followMatchesListFilters).sort(compareFollowUps);
  const dueRows = visibleRows.filter((item) => item.status !== "已完成" && followDayGap(item) <= 0);

  appContent.innerHTML = `
    ${followListSummary(visibleRows)}
    <section class="section">
      <div class="section-head">
        <div>
          <h3>续费跟进工作台</h3>
          <span class="muted">筛选欠费、课时不足、意向回访和约定缴费，优先处理今天该联系的人。</span>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("followUp")}
        ${renderFollowFilterToolbar()}
        <div class="follow-layout">
          <div>${renderFollowDueCards(dueRows)}</div>
          ${renderFollowUpForm()}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-head compact-head"><h3>跟进记录</h3><span class="muted">支持搜索学员、手机号、跟进人和备注</span></div>
      ${table(["学员", "类型/优先级", "跟进人", "到期日", "状态/结果", "待处理", "备注", "操作"], renderFollowRows(visibleRows))}
    </section>`;
};

document.addEventListener("change", (event) => {
  if (event.target.id === "followTypeFilter") followTypeFilter = event.target.value;
  if (event.target.id === "followOwnerFilter") followOwnerFilter = event.target.value;
  if (event.target.id === "followStatusFilter") followStatusFilter = event.target.value;
  if (event.target.id === "followDueFilter") followDueFilter = event.target.value;
  if (event.target.id === "followPriorityFilter") followPriorityFilter = event.target.value;
  if (event.target.id === "followSortMode") followSortMode = event.target.value;

  if (["followTypeFilter", "followOwnerFilter", "followStatusFilter", "followDueFilter", "followPriorityFilter", "followSortMode"].includes(event.target.id) && currentView === "followUp") {
    renderView();
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-follow-student]");
  if (!button) return;
  if (typeof showStudentProfile === "function") showStudentProfile(button.dataset.followStudent);
});

if (currentView === "followUp") {
  renderView();
}
