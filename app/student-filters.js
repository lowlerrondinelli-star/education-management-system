const studentFilterStyle = document.createElement("style");
studentFilterStyle.textContent = `
  .student-list-summary {
    margin-bottom: 14px;
  }

  .student-filter-toolbar {
    align-items: end;
  }

  .student-filter-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .student-filter-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .student-risk-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 260px;
  }

  .student-follow-summary {
    display: grid;
    gap: 4px;
    min-width: 160px;
    max-width: 240px;
  }

  .student-follow-summary .muted {
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .student-filter-toolbar,
    .student-filter-toolbar label,
    .student-filter-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(studentFilterStyle);

let studentStatusFilter = "all";
let studentClassFilter = "all";
let studentRiskFilter = "all";
let studentSortMode = "risk";

function studentRiskReasons(student) {
  const reasons = [];
  const balance = Number(student.balance || 0);
  const debt = Number(student.debt || 0);
  const phone = text(student.phone).trim();

  if (debt > 0) reasons.push({ key: "debt", label: "欠费", tone: "red" });
  if (balance > 0 && balance <= 3) reasons.push({ key: "lowBalance", label: "课时不足", tone: "amber" });
  if (text(student.className).trim() === "" || student.className === "待分班") reasons.push({ key: "unassigned", label: "待分班", tone: "amber" });
  if (student.status === "意向") reasons.push({ key: "intent", label: "意向跟进", tone: "amber" });
  if (!student.name || (phone && !/^1\d{10}$/.test(phone))) reasons.push({ key: "dataIssue", label: "资料异常", tone: "red" });

  return reasons;
}

function studentHasRisk(student, riskKey) {
  if (riskKey === "all") return true;
  if (riskKey === "none") return studentRiskReasons(student).length === 0;
  return studentRiskReasons(student).some((reason) => reason.key === riskKey);
}

function studentMatchesListFilters(student) {
  if (!matchesRow(student)) return false;
  if (studentStatusFilter !== "all" && student.status !== studentStatusFilter) return false;
  if (studentClassFilter !== "all" && student.className !== studentClassFilter) return false;
  return studentHasRisk(student, studentRiskFilter);
}

function studentRiskScore(student) {
  const weights = { debt: 1, lowBalance: 2, unassigned: 3, intent: 4, dataIssue: 5 };
  const scores = studentRiskReasons(student).map((reason) => weights[reason.key] || 9);
  return Math.min(...scores, 99);
}

function compareStudentsForList(left, right) {
  if (studentSortMode === "name") return text(left.name).localeCompare(text(right.name), "zh-CN");
  if (studentSortMode === "balanceAsc") return Number(left.balance || 0) - Number(right.balance || 0);
  if (studentSortMode === "debtDesc") return Number(right.debt || 0) - Number(left.debt || 0);

  const riskGap = studentRiskScore(left) - studentRiskScore(right);
  if (riskGap) return riskGap;
  return text(left.name).localeCompare(text(right.name), "zh-CN");
}

function renderStudentRiskTags(student) {
  const reasons = studentRiskReasons(student);
  if (!reasons.length) return tag("正常", "green");
  return `<div class="student-risk-tags">${reasons.map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function studentFollowUpSummary(student) {
  if (typeof studentFollowUps !== "function") return `<span class="muted">暂无跟进</span>`;
  const rows = studentFollowUps(student);
  if (!rows.length) return `<span class="muted">暂无跟进</span>`;
  const activeRows = rows
    .filter((item) => item.status !== "已完成")
    .sort((left, right) => text(left.dueDate).localeCompare(text(right.dueDate)));
  const item = activeRows[0] || rows[0];
  const dueDate = text(item.dueDate);
  const today = typeof todayText === "function" ? todayText() : new Date().toISOString().slice(0, 10);
  const tone = item.status === "已完成" ? "green" : dueDate <= today ? "red" : "amber";
  const result = item.result || item.status || "待跟进";
  return `
    <div class="student-follow-summary">
      <span>${tag(item.type || "跟进", tone)} ${escapeHtml(result)}</span>
      <span class="muted">${escapeHtml(dueDate || "未定日期")} / ${escapeHtml(item.owner || "-")}</span>
      <span class="muted">${escapeHtml(item.note || "-")}</span>
    </div>`;
}

function studentClassFilterOptions() {
  const classNames = [
    ...new Set([
      ...appState.classes.map((classItem) => classItem.name),
      ...appState.students.map((student) => student.className)
    ].filter(Boolean))
  ].sort((a, b) => a.localeCompare(b, "zh-CN"));
  return [
    `<option value="all" ${studentClassFilter === "all" ? "selected" : ""}>全部班级</option>`,
    ...classNames.map((className) => `<option value="${escapeHtml(className)}" ${studentClassFilter === className ? "selected" : ""}>${escapeHtml(className)}</option>`)
  ].join("");
}

function renderStudentFilterToolbar() {
  return `
    <div class="filters student-filter-toolbar">
      <label>状态
        <select id="studentStatusFilter" aria-label="按状态筛选学员">
          <option value="all" ${studentStatusFilter === "all" ? "selected" : ""}>全部状态</option>
          <option value="已报名" ${studentStatusFilter === "已报名" ? "selected" : ""}>已报名</option>
          <option value="意向" ${studentStatusFilter === "意向" ? "selected" : ""}>意向</option>
        </select>
      </label>
      <label>班级
        <select id="studentClassFilter" aria-label="按班级筛选学员">${studentClassFilterOptions()}</select>
      </label>
      <label>待处理
        <select id="studentRiskFilter" aria-label="按待处理事项筛选学员">
          <option value="all" ${studentRiskFilter === "all" ? "selected" : ""}>全部情况</option>
          <option value="debt" ${studentRiskFilter === "debt" ? "selected" : ""}>欠费</option>
          <option value="lowBalance" ${studentRiskFilter === "lowBalance" ? "selected" : ""}>课时不足</option>
          <option value="intent" ${studentRiskFilter === "intent" ? "selected" : ""}>意向跟进</option>
          <option value="unassigned" ${studentRiskFilter === "unassigned" ? "selected" : ""}>待分班</option>
          <option value="dataIssue" ${studentRiskFilter === "dataIssue" ? "selected" : ""}>资料异常</option>
          <option value="none" ${studentRiskFilter === "none" ? "selected" : ""}>无待处理</option>
        </select>
      </label>
      <label>排序
        <select id="studentSortMode" aria-label="学员列表排序">
          <option value="risk" ${studentSortMode === "risk" ? "selected" : ""}>风险优先</option>
          <option value="name" ${studentSortMode === "name" ? "selected" : ""}>姓名顺序</option>
          <option value="balanceAsc" ${studentSortMode === "balanceAsc" ? "selected" : ""}>剩余课时升序</option>
          <option value="debtDesc" ${studentSortMode === "debtDesc" ? "selected" : ""}>欠费金额降序</option>
        </select>
      </label>
    </div>`;
}

function studentListSummary(allStudents, visibleStudents) {
  const enrolled = allStudents.filter((student) => student.status === "已报名").length;
  const intent = allStudents.filter((student) => student.status === "意向").length;
  const debt = allStudents.filter((student) => Number(student.debt || 0) > 0).length;
  const lowBalance = allStudents.filter((student) => Number(student.balance || 0) > 0 && Number(student.balance || 0) <= 3).length;
  const unassigned = allStudents.filter((student) => text(student.className).trim() === "" || student.className === "待分班").length;

  return `
    <div class="summary-grid compact-metrics student-list-summary">
      <div class="metric"><span>当前显示</span><strong>${visibleStudents.length}</strong><small>全部 ${allStudents.length} 名学员</small></div>
      <div class="metric"><span>已报名</span><strong>${enrolled}</strong><small>${intent} 名意向待跟进</small></div>
      <div class="metric"><span>欠费学员</span><strong>${debt}</strong><small>优先联系缴费确认</small></div>
      <div class="metric"><span>课时不足/待分班</span><strong>${lowBalance + unassigned}</strong><small>${lowBalance} 名课时不足，${unassigned} 名待分班</small></div>
    </div>`;
}

renderStudents = function renderStudentsWithFilters() {
  if (typeof syncClassCounts === "function") syncClassCounts();
  if (typeof ensureFollowUpData === "function") ensureFollowUpData();

  const allStudents = appState.students.filter(matchesRow);
  const visibleStudents = appState.students.filter(studentMatchesListFilters).sort(compareStudentsForList);
  const rows = visibleStudents.map(
    (student) => `<tr>
      <td><strong>${escapeHtml(student.name)}</strong><br><span class="muted">${escapeHtml(student.id)}</span></td>
      <td>${escapeHtml(student.phone)}<br><span class="muted">${escapeHtml(student.relation)}</span></td>
      <td>${escapeHtml(student.grade)}</td>
      <td>${escapeHtml(student.school)}</td>
      <td>${escapeHtml(student.channel)}</td>
      <td>${escapeHtml(student.course)}</td>
      <td>${escapeHtml(student.className)}</td>
      <td>${tag(student.status, statusTone(student.status))}</td>
      <td>${student.balance}</td>
      <td>${student.debt ? tag(money(student.debt), "red") : tag("无欠费", "green")}</td>
      <td>${renderStudentRiskTags(student)}</td>
      <td>${studentFollowUpSummary(student)}</td>
      <td>
        <div class="action-row">
          <button class="small-button" type="button" data-student-detail="${escapeHtml(student.id)}">详情</button>
          <button class="small-button" type="button" data-student-order="${escapeHtml(student.id)}">报名</button>
          <button class="small-button" type="button" data-student-class="${escapeHtml(student.id)}">分班</button>
          <button class="small-button" type="button" data-student-follow="${escapeHtml(student.id)}">跟进</button>
        </div>
      </td>
    </tr>`
  );

  appContent.innerHTML = `
    <section class="section">
      <div class="section-head">
        <div>
          <h3>学员列表</h3>
          <span class="muted">筛选欠费、课时不足、意向跟进等日常待处理学员。</span>
        </div>
        <div class="action-row">
          <button class="small-button" type="button" id="resetDemo">恢复演示数据</button>
          <button class="primary-action" type="button" id="newStudentInline">新增学员</button>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("students")}
        ${studentListSummary(allStudents, visibleStudents)}
        ${renderStudentFilterToolbar()}
        ${table(["学员", "手机号", "年级", "学校", "渠道", "意向/报读课程", "班级", "状态", "剩余课时", "欠费", "待处理", "跟进", "操作"], rows)}
      </div>
    </section>`;
};

document.addEventListener("change", (event) => {
  if (event.target.id === "studentStatusFilter") studentStatusFilter = event.target.value;
  if (event.target.id === "studentClassFilter") studentClassFilter = event.target.value;
  if (event.target.id === "studentRiskFilter") studentRiskFilter = event.target.value;
  if (event.target.id === "studentSortMode") studentSortMode = event.target.value;

  if (["studentStatusFilter", "studentClassFilter", "studentRiskFilter", "studentSortMode"].includes(event.target.id) && currentView === "students") {
    renderView();
  }
});

if (currentView === "students") {
  renderView();
}
