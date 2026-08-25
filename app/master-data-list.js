const masterDataListStyle = document.createElement("style");
masterDataListStyle.textContent = `
  .master-list-summary {
    margin-bottom: 14px;
  }

  .master-filter-toolbar {
    align-items: end;
  }

  .master-filter-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .master-filter-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .master-risk-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 270px;
  }

  .master-list-block {
    margin-top: 16px;
  }

  .master-list-block:first-of-type {
    margin-top: 0;
  }

  @media (max-width: 650px) {
    .master-filter-toolbar,
    .master-filter-toolbar label,
    .master-filter-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(masterDataListStyle);

let masterKindFilter = "all";
let masterStatusFilter = "all";
let masterRiskFilter = "all";
let masterSortMode = "risk";

const masterKinds = {
  courses: "课程",
  teachers: "教师",
  rooms: "教室"
};

function masterCourseRiskReasons(course) {
  const reasons = [];
  if (Number(course.price || 0) <= 0) reasons.push({ key: "price", label: "待定价", tone: "amber" });
  if (Number(course.hours || 0) <= 0) reasons.push({ key: "hours", label: "课时异常", tone: "red" });
  if (course.status !== "在售") reasons.push({ key: "inactive", label: "非在售", tone: "amber" });
  return reasons;
}

function masterTeacherRiskReasons(teacher) {
  const reasons = [];
  const phone = text(teacher.phone).trim();
  if (!phone) reasons.push({ key: "phone", label: "缺手机号", tone: "amber" });
  if (phone && !/^1\d{10}$/.test(phone)) reasons.push({ key: "phone", label: "手机号异常", tone: "red" });
  if (Number(teacher.weeklyHours || 0) <= 0) reasons.push({ key: "capacity", label: "容量异常", tone: "red" });
  if (teacher.status !== "在职") reasons.push({ key: "inactive", label: "不可排课", tone: "amber" });
  return reasons;
}

function masterRoomRiskReasons(room) {
  const reasons = [];
  const capacity = Number(room.capacity || 0);
  if (capacity <= 0) reasons.push({ key: "capacity", label: "容量异常", tone: "red" });
  if (capacity > 0 && capacity < 8) reasons.push({ key: "capacity", label: "容量偏小", tone: "amber" });
  if (room.status !== "可排课") reasons.push({ key: "inactive", label: "不可排课", tone: "amber" });
  if (!text(room.note).trim()) reasons.push({ key: "note", label: "缺备注", tone: "amber" });
  return reasons;
}

function masterRiskReasons(kind, item) {
  if (kind === "courses") return masterCourseRiskReasons(item);
  if (kind === "teachers") return masterTeacherRiskReasons(item);
  if (kind === "rooms") return masterRoomRiskReasons(item);
  return [];
}

function masterHasRisk(kind, item, riskKey) {
  const reasons = masterRiskReasons(kind, item);
  if (riskKey === "all") return true;
  if (riskKey === "none") return reasons.length === 0;
  return reasons.some((reason) => reason.key === riskKey);
}

function masterMatchesListFilters(kind, item) {
  if (!matchesRow(item)) return false;
  if (masterKindFilter !== "all" && masterKindFilter !== kind) return false;
  if (masterStatusFilter !== "all" && item.status !== masterStatusFilter) return false;
  return masterHasRisk(kind, item, masterRiskFilter);
}

function masterRiskScore(kind, item) {
  const weights = { hours: 1, capacity: 1, phone: 2, price: 3, inactive: 4, note: 5 };
  const scores = masterRiskReasons(kind, item).map((reason) => weights[reason.key] || 9);
  return Math.min(...scores, 99);
}

function compareMasterRecords(kind, left, right) {
  if (masterSortMode === "name") return text(left.name).localeCompare(text(right.name), "zh-CN");
  if (masterSortMode === "status") {
    const statusGap = text(left.status).localeCompare(text(right.status), "zh-CN");
    return statusGap || text(left.name).localeCompare(text(right.name), "zh-CN");
  }
  if (masterSortMode === "capacityDesc") {
    const leftValue = kind === "courses" ? Number(left.hours || 0) : kind === "teachers" ? Number(left.weeklyHours || 0) : Number(left.capacity || 0);
    const rightValue = kind === "courses" ? Number(right.hours || 0) : kind === "teachers" ? Number(right.weeklyHours || 0) : Number(right.capacity || 0);
    return rightValue - leftValue || text(left.name).localeCompare(text(right.name), "zh-CN");
  }

  const riskGap = masterRiskScore(kind, left) - masterRiskScore(kind, right);
  return riskGap || text(left.name).localeCompare(text(right.name), "zh-CN");
}

function masterRiskTags(kind, item) {
  const reasons = masterRiskReasons(kind, item);
  if (!reasons.length) return tag("资料完整", "green");
  return `<div class="master-risk-tags">${reasons.map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function masterSelectOptions(values, selectedValue, allLabel) {
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function masterStatusOptions() {
  const statuses = [
    ...new Set([
      ...appState.courses.map((item) => item.status),
      ...appState.teachers.map((item) => item.status),
      ...appState.rooms.map((item) => item.status)
    ].filter(Boolean))
  ].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));

  return masterSelectOptions(statuses, masterStatusFilter, "全部状态");
}

function renderMasterFilterToolbar() {
  return `
    <div class="filters master-filter-toolbar">
      <label>资料类型
        <select id="masterKindFilter" aria-label="按资料类型筛选">
          <option value="all" ${masterKindFilter === "all" ? "selected" : ""}>全部资料</option>
          <option value="courses" ${masterKindFilter === "courses" ? "selected" : ""}>课程资料</option>
          <option value="teachers" ${masterKindFilter === "teachers" ? "selected" : ""}>教师资料</option>
          <option value="rooms" ${masterKindFilter === "rooms" ? "selected" : ""}>教室资料</option>
        </select>
      </label>
      <label>状态
        <select id="masterStatusFilter" aria-label="按状态筛选">${masterStatusOptions()}</select>
      </label>
      <label>待处理
        <select id="masterRiskFilter" aria-label="按待处理事项筛选">
          <option value="all" ${masterRiskFilter === "all" ? "selected" : ""}>全部情况</option>
          <option value="price" ${masterRiskFilter === "price" ? "selected" : ""}>待定价</option>
          <option value="hours" ${masterRiskFilter === "hours" ? "selected" : ""}>课时异常</option>
          <option value="phone" ${masterRiskFilter === "phone" ? "selected" : ""}>缺手机号</option>
          <option value="capacity" ${masterRiskFilter === "capacity" ? "selected" : ""}>容量异常</option>
          <option value="inactive" ${masterRiskFilter === "inactive" ? "selected" : ""}>不可用/非在售</option>
          <option value="note" ${masterRiskFilter === "note" ? "selected" : ""}>缺备注</option>
          <option value="none" ${masterRiskFilter === "none" ? "selected" : ""}>无待处理</option>
        </select>
      </label>
      <label>排序
        <select id="masterSortMode" aria-label="基础资料排序">
          <option value="risk" ${masterSortMode === "risk" ? "selected" : ""}>待处理优先</option>
          <option value="name" ${masterSortMode === "name" ? "selected" : ""}>名称顺序</option>
          <option value="status" ${masterSortMode === "status" ? "selected" : ""}>状态分组</option>
          <option value="capacityDesc" ${masterSortMode === "capacityDesc" ? "selected" : ""}>课时/容量降序</option>
        </select>
      </label>
    </div>`;
}

function masterListSummary(visibleCourses, visibleTeachers, visibleRooms) {
  const allItems = [
    ...appState.courses.map((item) => ({ kind: "courses", item })),
    ...appState.teachers.map((item) => ({ kind: "teachers", item })),
    ...appState.rooms.map((item) => ({ kind: "rooms", item }))
  ];
  const visibleItems = [
    ...visibleCourses.map((item) => ({ kind: "courses", item })),
    ...visibleTeachers.map((item) => ({ kind: "teachers", item })),
    ...visibleRooms.map((item) => ({ kind: "rooms", item }))
  ];
  const issueCount = visibleItems.filter(({ kind, item }) => masterRiskReasons(kind, item).length).length;
  const allIssueCount = allItems.filter(({ kind, item }) => masterRiskReasons(kind, item).length).length;

  return `
    <div class="summary-grid compact-metrics master-list-summary">
      <div class="metric"><span>当前显示</span><strong>${visibleItems.length}</strong><small>全部 ${allItems.length} 条基础资料</small></div>
      <div class="metric"><span>待补资料</span><strong>${issueCount}</strong><small>全库 ${allIssueCount} 条需处理</small></div>
      <div class="metric"><span>课程/教师</span><strong>${visibleCourses.length}/${visibleTeachers.length}</strong><small>${appState.courses.length} 门课程，${appState.teachers.length} 位教师</small></div>
      <div class="metric"><span>教室资源</span><strong>${visibleRooms.length}</strong><small>${appState.rooms.length} 间教室可核对</small></div>
    </div>`;
}

function renderMasterCourseRows(courses) {
  return courses.map(
    (item) => `<tr>
      <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${escapeHtml(item.mode)}</span></td>
      <td>${escapeHtml(item.subject)} / ${escapeHtml(item.grade)}</td>
      <td>${escapeHtml(item.type)}</td>
      <td>${Number(item.hours || 0)}</td>
      <td>${money(item.price || 0)}</td>
      <td>${tag(item.status, item.status === "在售" ? "green" : "amber")}</td>
      <td>${masterRiskTags("courses", item)}</td>
    </tr>`
  );
}

function renderMasterTeacherRows(teachers) {
  return teachers.map(
    (item) => `<tr>
      <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${escapeHtml(item.phone || "未填手机号")}</span></td>
      <td>${escapeHtml(item.subjects)}</td>
      <td>${escapeHtml(item.grades)}</td>
      <td>${escapeHtml(item.role)}</td>
      <td>${Number(item.weeklyHours || 0)}</td>
      <td>${tag(item.status, item.status === "在职" ? "green" : "amber")}</td>
      <td>${masterRiskTags("teachers", item)}</td>
    </tr>`
  );
}

function renderMasterRoomRows(rooms) {
  return rooms.map(
    (item) => `<tr>
      <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${escapeHtml(item.campus)}</span></td>
      <td>${Number(item.capacity || 0)}</td>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.note || "未填备注")}</td>
      <td>${tag(item.status, item.status === "可排课" ? "green" : "amber")}</td>
      <td>${masterRiskTags("rooms", item)}</td>
    </tr>`
  );
}

function renderMasterListBlock(kind, title, description, headers, rows) {
  if (masterKindFilter !== "all" && masterKindFilter !== kind) return "";
  return `
    <section class="section master-list-block">
      <div class="section-head compact-head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <span class="muted">${escapeHtml(description)}</span>
        </div>
        ${tag(`${rows.length} 条`, rows.length ? "green" : "amber")}
      </div>
      ${table(headers, rows)}
    </section>`;
}

renderMasterTables = function renderMasterTablesWithFilters() {
  ensureMasterData();

  const visibleCourses = appState.courses.filter((item) => masterMatchesListFilters("courses", item)).sort((a, b) => compareMasterRecords("courses", a, b));
  const visibleTeachers = appState.teachers.filter((item) => masterMatchesListFilters("teachers", item)).sort((a, b) => compareMasterRecords("teachers", a, b));
  const visibleRooms = appState.rooms.filter((item) => masterMatchesListFilters("rooms", item)).sort((a, b) => compareMasterRecords("rooms", a, b));

  return `
    <section class="section">
      <div class="section-head">
        <div>
          <h3>基础资料清单</h3>
          <span class="muted">集中核对课程定价、教师联系方式、教室容量和排课可用状态。</span>
        </div>
        ${tag(masterKinds[masterKindFilter] || "全部资料", "green")}
      </div>
      <div class="section-body">
        ${masterListSummary(visibleCourses, visibleTeachers, visibleRooms)}
        ${renderMasterFilterToolbar()}
      </div>
    </section>
    <div class="layout-two">
      ${renderMasterListBlock("courses", "课程报价资料", "用于报名收款、课时售卖和排课科目选择。", ["课程", "科目/年级", "类型", "课时", "标准价", "状态", "待处理"], renderMasterCourseRows(visibleCourses))}
      ${renderMasterListBlock("teachers", "教师资料", "用于排课、点名、课后反馈和老师工作台。", ["教师", "科目", "年级", "角色", "周容量", "状态", "待处理"], renderMasterTeacherRows(visibleTeachers))}
    </div>
    ${renderMasterListBlock("rooms", "教室资料", "用于排课容量核对和冲突检查。", ["教室", "容量", "类型", "备注", "状态", "待处理"], renderMasterRoomRows(visibleRooms))}`;
};

document.addEventListener("change", (event) => {
  if (event.target.id === "masterKindFilter") masterKindFilter = event.target.value;
  if (event.target.id === "masterStatusFilter") masterStatusFilter = event.target.value;
  if (event.target.id === "masterRiskFilter") masterRiskFilter = event.target.value;
  if (event.target.id === "masterSortMode") masterSortMode = event.target.value;

  if (["masterKindFilter", "masterStatusFilter", "masterRiskFilter", "masterSortMode"].includes(event.target.id) && currentView === "masters") {
    renderView();
  }
});
