const leaveListStyle = document.createElement("style");
leaveListStyle.textContent = `
  .leave-list-summary {
    margin-bottom: 14px;
  }

  .leave-filter-toolbar {
    align-items: end;
  }

  .leave-filter-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .leave-filter-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .leave-risk-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 260px;
  }

  @media (max-width: 650px) {
    .leave-filter-toolbar,
    .leave-filter-toolbar label,
    .leave-filter-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(leaveListStyle);

let leaveStatusFilter = "active";
let leaveTypeFilter = "all";
let leaveMakeupFilter = "all";
let leaveOperatorFilter = "all";
let leaveSortMode = "updatedDesc";

function leaveTimeValue(value) {
  const normalized = text(value).replaceAll("/", "-");
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : 0;
}

function leaveStatusIsActive(status) {
  return !["已驳回", "已完成"].includes(status);
}

function leaveMatchesStatus(item) {
  if (leaveStatusFilter === "all") return true;
  if (leaveStatusFilter === "active") return leaveStatusIsActive(item.status);
  return item.status === leaveStatusFilter;
}

function leaveMatchesListFilters(item) {
  if (!matchesRow(item)) return false;
  if (!leaveMatchesStatus(item)) return false;
  if (leaveTypeFilter !== "all" && item.leaveType !== leaveTypeFilter) return false;
  if (leaveMakeupFilter !== "all" && item.makeupPlan !== leaveMakeupFilter) return false;
  if (leaveOperatorFilter !== "all" && item.operator !== leaveOperatorFilter) return false;
  return true;
}

function compareLeaveRows(left, right) {
  if (leaveSortMode === "lessonAsc") return `${left.lessonDate} ${left.lessonTime}`.localeCompare(`${right.lessonDate} ${right.lessonTime}`);
  if (leaveSortMode === "lessonDesc") return `${right.lessonDate} ${right.lessonTime}`.localeCompare(`${left.lessonDate} ${left.lessonTime}`);
  if (leaveSortMode === "student") return text(left.student).localeCompare(text(right.student), "zh-CN") || leaveTimeValue(right.updatedAt || right.createdAt) - leaveTimeValue(left.updatedAt || left.createdAt);
  if (leaveSortMode === "status") return text(left.status).localeCompare(text(right.status), "zh-CN") || leaveTimeValue(right.updatedAt || right.createdAt) - leaveTimeValue(left.updatedAt || left.createdAt);
  return leaveTimeValue(right.updatedAt || right.createdAt) - leaveTimeValue(left.updatedAt || left.createdAt);
}

function leaveSelectOptions(values, selectedValue, allLabel) {
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function leaveRiskReasons(item) {
  const reasons = [];
  if (item.status === "待审批") reasons.push({ label: "待审批", tone: "amber" });
  if (item.status === "待补课" || item.status === "已批准") reasons.push({ label: "待安排补课", tone: "amber" });
  if (item.status === "已安排补课") reasons.push({ label: "待确认上课", tone: "amber" });
  if (item.status === "已完成") reasons.push({ label: "已闭环", tone: "green" });
  if (item.status === "已驳回") reasons.push({ label: "已驳回", tone: "red" });
  if (item.makeupPlan === "待家长确认") reasons.push({ label: "待家长确认", tone: "amber" });
  if (item.makeupPlan === "不需要补课") reasons.push({ label: "无需补课", tone: "green" });
  return reasons;
}

function renderLeaveRiskTags(item) {
  const reasons = leaveRiskReasons(item);
  if (!reasons.length) return tag("正常", "green");
  return `<div class="leave-risk-tags">${reasons.map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function renderLeaveFilterToolbar() {
  const types = [...new Set(appState.leaveRequests.map((item) => item.leaveType).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const makeupPlans = [...new Set(appState.leaveRequests.map((item) => item.makeupPlan).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const operators = [...new Set(appState.leaveRequests.map((item) => item.operator).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));

  return `
    <div class="filters leave-filter-toolbar">
      <label>状态
        <select id="leaveStatusFilter" aria-label="按状态筛选请假">
          <option value="active" ${leaveStatusFilter === "active" ? "selected" : ""}>未闭环</option>
          <option value="all" ${leaveStatusFilter === "all" ? "selected" : ""}>全部状态</option>
          <option value="待审批" ${leaveStatusFilter === "待审批" ? "selected" : ""}>待审批</option>
          <option value="待补课" ${leaveStatusFilter === "待补课" ? "selected" : ""}>待补课</option>
          <option value="已安排补课" ${leaveStatusFilter === "已安排补课" ? "selected" : ""}>已安排补课</option>
          <option value="已完成" ${leaveStatusFilter === "已完成" ? "selected" : ""}>已完成</option>
          <option value="已驳回" ${leaveStatusFilter === "已驳回" ? "selected" : ""}>已驳回</option>
        </select>
      </label>
      <label>请假类型
        <select id="leaveTypeFilter" aria-label="按请假类型筛选">
          ${leaveSelectOptions(types, leaveTypeFilter, "全部类型")}
        </select>
      </label>
      <label>补课建议
        <select id="leaveMakeupFilter" aria-label="按补课建议筛选">
          ${leaveSelectOptions(makeupPlans, leaveMakeupFilter, "全部建议")}
        </select>
      </label>
      <label>处理人
        <select id="leaveOperatorFilter" aria-label="按处理人筛选请假">
          ${leaveSelectOptions(operators, leaveOperatorFilter, "全部处理人")}
        </select>
      </label>
      <label>排序
        <select id="leaveSortMode" aria-label="请假记录排序">
          <option value="updatedDesc" ${leaveSortMode === "updatedDesc" ? "selected" : ""}>最近更新</option>
          <option value="lessonAsc" ${leaveSortMode === "lessonAsc" ? "selected" : ""}>原课节升序</option>
          <option value="lessonDesc" ${leaveSortMode === "lessonDesc" ? "selected" : ""}>原课节降序</option>
          <option value="status" ${leaveSortMode === "status" ? "selected" : ""}>状态分组</option>
          <option value="student" ${leaveSortMode === "student" ? "selected" : ""}>学员分组</option>
        </select>
      </label>
    </div>`;
}

function leaveListSummary(rows) {
  const pending = rows.filter((item) => item.status === "待审批").length;
  const waitingMakeup = rows.filter((item) => item.status === "待补课" || item.status === "已批准").length;
  const arranged = rows.filter((item) => item.status === "已安排补课").length;
  const closed = rows.filter((item) => item.status === "已完成" || item.status === "已驳回").length;

  return `
    <div class="summary-grid compact-metrics leave-list-summary">
      <div class="metric"><span>当前显示</span><strong>${rows.length}</strong><small>按筛选条件统计</small></div>
      <div class="metric"><span>待审批</span><strong>${pending}</strong><small>需先确认是否允许请假</small></div>
      <div class="metric"><span>待补课/已安排</span><strong>${waitingMakeup + arranged}</strong><small>待安排 ${waitingMakeup} 个，待确认 ${arranged} 个</small></div>
      <div class="metric"><span>已闭环</span><strong>${closed}</strong><small>完成或驳回的记录</small></div>
    </div>`;
}

function leaveActionButtons(item) {
  const canApprove = item.status === "待审批";
  const canMakeup = ["待补课", "已批准"].includes(item.status);
  const canComplete = item.status === "已安排补课";
  const student = appState.students.find((row) => row.id === item.studentId || row.name === item.student);

  return `<div class="leave-actions">
    <button class="small-button" type="button" data-leave-approve="${escapeHtml(item.id)}" ${canApprove ? "" : "disabled"}>批准</button>
    <button class="small-button" type="button" data-leave-reject="${escapeHtml(item.id)}" ${canApprove ? "" : "disabled"}>驳回</button>
    <button class="small-button" type="button" data-leave-makeup="${escapeHtml(item.id)}" ${canMakeup ? "" : "disabled"}>安排补课</button>
    <button class="small-button" type="button" data-leave-complete="${escapeHtml(item.id)}" ${canComplete ? "" : "disabled"}>完成</button>
    ${student ? `<button class="small-button" type="button" data-leave-student="${escapeHtml(student.id)}">学员详情</button>` : ""}
  </div>`;
}

function renderLeaveCardsForList(items) {
  const cards = items.slice(0, 5).map(
    (item) => `<article class="leave-card ${leaveStatusIsActive(item.status) ? "due" : ""}">
      <div class="leave-card-head">
        <div>
          <strong>${escapeHtml(item.student)} ${tag(item.status, statusTone(item.status))}</strong>
          <div class="muted">${escapeHtml(item.lessonDate)} ${escapeHtml(item.lessonTime)} · ${escapeHtml(item.target)}</div>
        </div>
        <span class="muted">${escapeHtml(item.leaveType)}</span>
      </div>
      <span class="muted">${escapeHtml(item.reason)} · ${escapeHtml(item.operator)}</span>
      ${leaveActionButtons(item)}
    </article>`
  );
  return `<div class="leave-cards">${cards.join("") || `<div class="stack-item"><span class="muted">当前筛选下暂无请假记录。</span></div>`}</div>`;
}

function renderLeaveRows(rows) {
  return rows.map((item) => `<tr>
    <td><strong>${escapeHtml(item.student)}</strong><br><span class="muted">${escapeHtml(item.id)}</span></td>
    <td>${escapeHtml(item.lessonDate)}<br><span class="muted">${escapeHtml(item.lessonTime)}</span></td>
    <td>${escapeHtml(item.target)}<br><span class="muted">${escapeHtml(item.subject || "")} / ${escapeHtml(item.teacher || "")}</span></td>
    <td>${escapeHtml(item.leaveType)}<br><span class="muted">${escapeHtml(item.contact || "")}</span></td>
    <td>${tag(item.status, statusTone(item.status))}</td>
    <td>${escapeHtml(item.makeupPlan || "")}</td>
    <td>${item.newLessonId ? `${escapeHtml(item.newLessonId)}<br><span class="muted">${escapeHtml(item.makeupDate || "")} ${escapeHtml(item.makeupTime || "")}</span>` : `<span class="muted">-</span>`}</td>
    <td>${renderLeaveRiskTags(item)}</td>
    <td>${escapeHtml(item.operator)}<br><span class="muted">${escapeHtml(item.updatedAt || item.createdAt)}</span></td>
    <td>${leaveActionButtons(item)}</td>
  </tr>`);
}

renderLeaveManagement = function renderLeaveManagementWithFilters() {
  ensureLeaveData();
  const visibleRows = appState.leaveRequests.filter(leaveMatchesListFilters).sort(compareLeaveRows);
  const activeRows = visibleRows.filter((item) => leaveStatusIsActive(item.status));

  appContent.innerHTML = `
    ${leaveListSummary(visibleRows)}
    <section class="section">
      <div class="section-head">
        <div>
          <h3>请假与补课闭环</h3>
          <span class="muted">筛选待审批、待补课、已安排补课，避免请假记录卡在半路。</span>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("leaves")}
        ${renderLeaveFilterToolbar()}
        <div class="leave-board">
          <div>${renderLeaveQuickForm()}</div>
          <div>${renderLeaveCardsForList(activeRows)}</div>
        </div>
      </div>
    </section>
    <section class="section leave-detail-panel">
      <div class="section-head"><h3>请假明细</h3><span class="muted">可在数据中心导出 CSV 对账</span></div>
      <div class="section-body">
        ${table(["学员", "原课节日期", "班级/对象", "类型", "状态", "补课建议", "补课课节", "待处理", "处理人", "操作"], renderLeaveRows(visibleRows))}
      </div>
    </section>`;
};

document.addEventListener("change", (event) => {
  if (event.target.id === "leaveStatusFilter") leaveStatusFilter = event.target.value;
  if (event.target.id === "leaveTypeFilter") leaveTypeFilter = event.target.value;
  if (event.target.id === "leaveMakeupFilter") leaveMakeupFilter = event.target.value;
  if (event.target.id === "leaveOperatorFilter") leaveOperatorFilter = event.target.value;
  if (event.target.id === "leaveSortMode") leaveSortMode = event.target.value;

  if (["leaveStatusFilter", "leaveTypeFilter", "leaveMakeupFilter", "leaveOperatorFilter", "leaveSortMode"].includes(event.target.id) && currentView === "leaves") {
    renderView();
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-leave-student]");
  if (!button) return;
  if (typeof showStudentProfile === "function") showStudentProfile(button.dataset.leaveStudent);
});

if (currentView === "leaves") {
  renderView();
}
