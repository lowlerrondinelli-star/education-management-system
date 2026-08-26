const classAdvisorStyle = document.createElement("style");
classAdvisorStyle.textContent = `
  .class-advisor-panel {
    margin-bottom: 16px;
  }

  .class-advisor-toolbar {
    align-items: end;
  }

  .class-advisor-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .class-advisor-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .class-advisor-tags,
  .class-advisor-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .class-advisor-note {
    max-width: 360px;
    white-space: normal;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .class-advisor-scenario-note {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
    max-width: 560px;
  }

  .class-advisor-score {
    display: grid;
    gap: 6px;
    min-width: 120px;
  }

  .class-advisor-bar {
    height: 8px;
    border-radius: 999px;
    background: var(--soft);
    overflow: hidden;
  }

  .class-advisor-bar span {
    display: block;
    height: 100%;
    background: var(--green);
  }

  .class-advisor-bar.warn span {
    background: var(--amber);
  }

  .class-advisor-bar.bad span {
    background: var(--red);
  }

  @media (max-width: 650px) {
    .class-advisor-toolbar,
    .class-advisor-toolbar label,
    .class-advisor-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(classAdvisorStyle);

let classAdvisorStatusFilter = "all";
let classAdvisorRiskFilter = "all";
let classAdvisorSortMode = "score";
let classAdvisorScenario = "dailyReview";

function classAdvisorScenarioPresets() {
  return {
    dailyReview: {
      label: "日常分班总览",
      status: "all",
      risk: "all",
      sort: "score",
      note: "显示所有可处理建议，按匹配度从高到低核对。"
    },
    newEnrollment: {
      label: "新报名优先分班",
      status: "recommended",
      risk: "unassigned",
      sort: "score",
      note: "优先看已报名但仍待分班、且系统判断适合直接分入的学员。"
    },
    riskReview: {
      label: "风险复核优先",
      status: "risk",
      risk: "all",
      sort: "risk",
      note: "先处理课程不一致、课时不足、班级已满等不适合直接分班的记录。"
    },
    courseAudit: {
      label: "课程匹配核对",
      status: "all",
      risk: "courseMismatch",
      sort: "risk",
      note: "集中核对学员报读课程和班级课程不一致的情况。"
    },
    capacityFirst: {
      label: "容量宽松优先",
      status: "all",
      risk: "all",
      sort: "openSeats",
      note: "按剩余名额排序，适合招生高峰期快速找可接收班级。"
    },
    orderClassAudit: {
      label: "订单班级复核",
      status: "all",
      risk: "orderClass",
      sort: "risk",
      note: "集中处理学员档案班级和订单班级不一致的问题。"
    },
    custom: {
      label: "手动筛选",
      status: "all",
      risk: "all",
      sort: "score",
      note: "当前由教务手动组合建议状态、卡点和排序条件。"
    }
  };
}

function classAdvisorScenarioOptions(selectedValue = "dailyReview") {
  return Object.entries(classAdvisorScenarioPresets())
    .map(([key, item]) => `<option value="${escapeHtml(key)}" ${key === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function applyClassAdvisorScenario(scenarioKey) {
  const preset = classAdvisorScenarioPresets()[scenarioKey] || classAdvisorScenarioPresets().dailyReview;
  classAdvisorScenario = scenarioKey;
  classAdvisorStatusFilter = preset.status;
  classAdvisorRiskFilter = preset.risk;
  classAdvisorSortMode = preset.sort;
}

function classAdvisorStudentOrders(student) {
  return appState.orders.filter((order) => order.student === student.name && order.status !== "已作废");
}

function classAdvisorClassStudents(classItem) {
  if (typeof classStudents === "function") return classStudents(classItem);
  return appState.students.filter((student) => student.className === classItem.name);
}

function classAdvisorClassRate(classItem) {
  const capacity = Number(classItem.capacity || 0);
  if (!capacity) return 0;
  return Math.round((classAdvisorClassStudents(classItem).length / capacity) * 100);
}

function classAdvisorClassOpenSeats(classItem) {
  return Math.max(0, Number(classItem.capacity || 0) - classAdvisorClassStudents(classItem).length);
}

function classAdvisorStudentNeeds(student) {
  const currentClass = getClass(student.className);
  const orders = classAdvisorStudentOrders(student);
  const hasClass = Boolean(currentClass);
  const hasMatchingOrder = orders.some((order) => order.className === student.className);
  const needs = [];

  if (!student.className || student.className === "待分班" || !hasClass) needs.push({ key: "unassigned", label: "待分班", tone: "amber" });
  if (student.status === "意向") needs.push({ key: "intent", label: "意向待转化", tone: "amber" });
  if (student.status === "已报名" && !orders.length) needs.push({ key: "noOrder", label: "已报名无订单", tone: "red" });
  if (orders.length && !hasMatchingOrder) needs.push({ key: "orderClass", label: "订单班级待核对", tone: "amber" });
  if (currentClass && student.course && currentClass.course && student.course !== currentClass.course) needs.push({ key: "courseMismatch", label: "课程不匹配", tone: "red" });
  if (Number(student.balance || 0) <= 0 && student.status === "已报名") needs.push({ key: "noHours", label: "无可用课时", tone: "red" });
  if (!needs.length) needs.push({ key: "stable", label: "已有班级", tone: "green" });
  return needs;
}

function classAdvisorNeedsAction(student) {
  return classAdvisorStudentNeeds(student).some((need) => need.key !== "stable");
}

function classAdvisorCandidateStudents() {
  return appState.students.filter((student) => classAdvisorNeedsAction(student) || student.status === "意向");
}

function classAdvisorTextTokens(value) {
  return text(value)
    .replace(/[（）()]/g, " ")
    .split(/[、/,\s-]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function classAdvisorSharedTextScore(left, right, points) {
  const leftTokens = classAdvisorTextTokens(left);
  const rightText = text(right);
  if (!leftTokens.length || !rightText) return 0;
  return leftTokens.some((token) => rightText.includes(token)) ? points : 0;
}

function classAdvisorScore(student, classItem) {
  let score = 35;
  const orders = classAdvisorStudentOrders(student);
  const orderForClass = orders.find((order) => order.className === classItem.name);
  const openSeats = classAdvisorClassOpenSeats(classItem);
  const currentClass = student.className === classItem.name;

  if (currentClass) score += 18;
  if (orderForClass) score += 22;
  if (student.course && student.course === classItem.course) score += 20;
  score += classAdvisorSharedTextScore(student.course, classItem.course, 10);
  score += classAdvisorSharedTextScore(student.grade, classItem.course, 8);
  score += classAdvisorSharedTextScore(student.grade, classItem.name, 8);
  if (classItem.status === "招生中") score += 8;
  if (classItem.status === "开课中") score += student.status === "已报名" ? 8 : 3;
  if (openSeats > 0) score += 10;
  if (!openSeats && !currentClass) score -= 35;
  if (classAdvisorClassRate(classItem) >= 80 && !currentClass) score -= 8;
  if (Number(student.balance || 0) <= 0 && student.status === "已报名") score -= 12;

  return Math.max(0, Math.min(100, score));
}

function classAdvisorWarnings(student, classItem) {
  const warnings = [];
  const currentClass = student.className === classItem.name;
  const openSeats = classAdvisorClassOpenSeats(classItem);
  const orders = classAdvisorStudentOrders(student);

  if (!currentClass && openSeats <= 0) warnings.push({ key: "full", label: "班级已满", tone: "red" });
  if (student.course && classItem.course && student.course !== classItem.course && !classAdvisorSharedTextScore(student.course, classItem.course, 1)) {
    warnings.push({ key: "course", label: "课程不一致", tone: "red" });
  }
  if (student.status === "意向") warnings.push({ key: "intent", label: "先确认报名", tone: "amber" });
  if (orders.length && !orders.some((order) => order.className === classItem.name)) warnings.push({ key: "order", label: "订单不在此班", tone: "amber" });
  if (Number(student.balance || 0) <= 0 && student.status === "已报名") warnings.push({ key: "hours", label: "课时不足", tone: "red" });
  if (!warnings.length) warnings.push({ key: "ok", label: "可分班", tone: "green" });
  return warnings;
}

function classAdvisorReason(student, classItem, score) {
  const parts = [];
  const openSeats = classAdvisorClassOpenSeats(classItem);
  if (student.className === classItem.name) parts.push("当前已在此班，可用于复核班级与订单是否一致。");
  if (student.course && classItem.course && student.course === classItem.course) parts.push("报读课程与班级课程一致。");
  if (classAdvisorStudentOrders(student).some((order) => order.className === classItem.name)) parts.push("已有订单指向该班级。");
  if (openSeats > 0) parts.push(`剩余 ${openSeats} 个名额，当前满班率 ${classAdvisorClassRate(classItem)}%。`);
  if (score >= 80) parts.push("匹配度高，适合优先安排。");
  if (!parts.length) parts.push("匹配度一般，建议教务人工核对课程、年级和容量后再处理。");
  return parts.join(" ");
}

function classAdvisorBestClass(student) {
  return appState.classes
    .map((classItem) => ({
      student,
      classItem,
      score: classAdvisorScore(student, classItem)
    }))
    .sort((left, right) => right.score - left.score || classAdvisorClassOpenSeats(right.classItem) - classAdvisorClassOpenSeats(left.classItem))[0];
}

function classAdvisorRows() {
  return classAdvisorCandidateStudents()
    .map((student) => {
      const match = classAdvisorBestClass(student);
      if (!match) return null;
      const warnings = classAdvisorWarnings(student, match.classItem);
      return {
        student,
        classItem: match.classItem,
        score: match.score,
        warnings,
        needs: classAdvisorStudentNeeds(student),
        reason: classAdvisorReason(student, match.classItem, match.score),
        canAssign: student.className !== match.classItem.name && !warnings.some((warning) => warning.key === "full")
      };
    })
    .filter(Boolean);
}

function classAdvisorStatus(row) {
  if (row.score >= 80 && row.canAssign) return { key: "recommended", label: "建议分入", tone: "green" };
  if (row.student.className === row.classItem.name) return { key: "review", label: "复核中", tone: "green" };
  if (row.warnings.some((warning) => warning.tone === "red")) return { key: "risk", label: "需人工核对", tone: "red" };
  return { key: "candidate", label: "可选班级", tone: "amber" };
}

function classAdvisorMatches(row) {
  const status = classAdvisorStatus(row).key;
  if (classAdvisorStatusFilter !== "all" && status !== classAdvisorStatusFilter) return false;
  if (classAdvisorRiskFilter !== "all" && !row.needs.some((need) => need.key === classAdvisorRiskFilter) && !row.warnings.some((warning) => warning.key === classAdvisorRiskFilter)) return false;
  return true;
}

function compareClassAdvisorRows(left, right) {
  if (classAdvisorSortMode === "student") return text(left.student.name).localeCompare(text(right.student.name), "zh-CN");
  if (classAdvisorSortMode === "class") return text(left.classItem.name).localeCompare(text(right.classItem.name), "zh-CN");
  if (classAdvisorSortMode === "openSeats") return classAdvisorClassOpenSeats(right.classItem) - classAdvisorClassOpenSeats(left.classItem);
  if (classAdvisorSortMode === "risk") {
    const leftRisk = left.warnings.some((warning) => warning.tone === "red") ? 0 : left.warnings.some((warning) => warning.tone === "amber") ? 1 : 2;
    const rightRisk = right.warnings.some((warning) => warning.tone === "red") ? 0 : right.warnings.some((warning) => warning.tone === "amber") ? 1 : 2;
    return leftRisk - rightRisk || right.score - left.score;
  }
  return right.score - left.score || text(left.student.name).localeCompare(text(right.student.name), "zh-CN");
}

function renderClassAdvisorSummary(rows, visibleRows) {
  const high = rows.filter((row) => row.score >= 80 && row.canAssign).length;
  const risks = rows.filter((row) => row.warnings.some((warning) => warning.tone === "red")).length;
  const unassigned = rows.filter((row) => row.needs.some((need) => need.key === "unassigned")).length;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 个建议</small></div>
      <div class="metric"><span>建议分入</span><strong>${high}</strong><small>匹配度 80 分以上</small></div>
      <div class="metric"><span>待分班</span><strong>${unassigned}</strong><small>没有有效班级</small></div>
      <div class="metric"><span>需核对</span><strong>${risks}</strong><small>课程、容量或课时风险</small></div>
    </div>`;
}

function renderClassAdvisorToolbar() {
  const scenario = classAdvisorScenarioPresets()[classAdvisorScenario] || classAdvisorScenarioPresets().dailyReview;
  return `
    <div class="filters class-advisor-toolbar">
      <label>分班场景
        <select id="classAdvisorScenario" aria-label="智能分班场景模板">${classAdvisorScenarioOptions(classAdvisorScenario)}</select>
      </label>
      <label>建议状态
        <select id="classAdvisorStatusFilter" aria-label="智能分班建议状态筛选">
          <option value="all" ${classAdvisorStatusFilter === "all" ? "selected" : ""}>全部建议</option>
          <option value="recommended" ${classAdvisorStatusFilter === "recommended" ? "selected" : ""}>建议分入</option>
          <option value="candidate" ${classAdvisorStatusFilter === "candidate" ? "selected" : ""}>可选班级</option>
          <option value="risk" ${classAdvisorStatusFilter === "risk" ? "selected" : ""}>需人工核对</option>
          <option value="review" ${classAdvisorStatusFilter === "review" ? "selected" : ""}>复核中</option>
        </select>
      </label>
      <label>卡点
        <select id="classAdvisorRiskFilter" aria-label="智能分班卡点筛选">
          <option value="all" ${classAdvisorRiskFilter === "all" ? "selected" : ""}>全部卡点</option>
          <option value="unassigned" ${classAdvisorRiskFilter === "unassigned" ? "selected" : ""}>待分班</option>
          <option value="intent" ${classAdvisorRiskFilter === "intent" ? "selected" : ""}>意向学员</option>
          <option value="courseMismatch" ${classAdvisorRiskFilter === "courseMismatch" ? "selected" : ""}>课程不匹配</option>
          <option value="orderClass" ${classAdvisorRiskFilter === "orderClass" ? "selected" : ""}>订单班级待核对</option>
          <option value="noOrder" ${classAdvisorRiskFilter === "noOrder" ? "selected" : ""}>已报名无订单</option>
          <option value="full" ${classAdvisorRiskFilter === "full" ? "selected" : ""}>班级已满</option>
        </select>
      </label>
      <label>排序
        <select id="classAdvisorSortMode" aria-label="智能分班建议排序">
          <option value="score" ${classAdvisorSortMode === "score" ? "selected" : ""}>匹配度最高</option>
          <option value="risk" ${classAdvisorSortMode === "risk" ? "selected" : ""}>风险优先</option>
          <option value="openSeats" ${classAdvisorSortMode === "openSeats" ? "selected" : ""}>名额最多</option>
          <option value="student" ${classAdvisorSortMode === "student" ? "selected" : ""}>学员姓名</option>
          <option value="class" ${classAdvisorSortMode === "class" ? "selected" : ""}>班级名称</option>
        </select>
      </label>
    </div>
    <div class="class-advisor-scenario-note">${escapeHtml(scenario.note)}</div>`;
}

function renderClassAdvisorScore(row) {
  const tone = row.score < 60 ? "bad" : row.score < 80 ? "warn" : "";
  return `<div class="class-advisor-score">
    <strong>${row.score}</strong>
    <div class="class-advisor-bar ${tone}"><span style="width:${row.score}%"></span></div>
    <span class="muted">匹配度</span>
  </div>`;
}

function renderClassAdvisorTags(items) {
  return `<div class="class-advisor-tags">${items.map((item) => tag(item.label, item.tone)).join("")}</div>`;
}

function renderClassAdvisorRows(rows) {
  return rows.map((row) => {
    const status = classAdvisorStatus(row);
    const classRate = classAdvisorClassRate(row.classItem);
    const seats = classAdvisorClassOpenSeats(row.classItem);
    return `<tr>
      <td><strong>${escapeHtml(row.student.name)}</strong><br><span class="muted">${escapeHtml(row.student.grade)} · ${escapeHtml(row.student.course || "待确认课程")}</span></td>
      <td>${renderClassAdvisorTags(row.needs)}</td>
      <td><strong>${escapeHtml(row.classItem.name)}</strong><br><span class="muted">${escapeHtml(row.classItem.course)} / ${escapeHtml(row.classItem.teacher)}</span></td>
      <td>${seats} 个名额<br><span class="muted">满班率 ${classRate}%</span></td>
      <td>${renderClassAdvisorScore(row)}</td>
      <td>${tag(status.label, status.tone)}<br>${renderClassAdvisorTags(row.warnings)}</td>
      <td class="class-advisor-note">${escapeHtml(row.reason)}</td>
      <td>
        <div class="class-advisor-actions">
          <button class="small-button" type="button" data-class-advisor-assign="${escapeHtml(row.student.id)}" data-class-name="${escapeHtml(row.classItem.name)}" ${row.canAssign ? "" : "disabled"}>分入此班</button>
          <button class="small-button" type="button" data-student-detail="${escapeHtml(row.student.id)}">学员详情</button>
          <button class="small-button" type="button" data-class-detail="${escapeHtml(row.classItem.name)}">班级详情</button>
        </div>
      </td>
    </tr>`;
  });
}

function flattenClassAdvisorRows() {
  return classAdvisorRows().map((row) => ({
    studentId: row.student.id,
    student: row.student.name,
    phone: row.student.phone,
    grade: row.student.grade,
    currentClass: row.student.className || "待分班",
    course: row.student.course,
    studentStatus: row.student.status,
    suggestedClass: row.classItem.name,
    classCourse: row.classItem.course,
    teacher: row.classItem.teacher,
    openSeats: classAdvisorClassOpenSeats(row.classItem),
    capacityRate: `${classAdvisorClassRate(row.classItem)}%`,
    score: row.score,
    status: classAdvisorStatus(row).label,
    needs: row.needs.map((item) => item.label).join("、"),
    warnings: row.warnings.map((item) => item.label).join("、"),
    reason: row.reason
  }));
}

function appendClassAdvisorPanel() {
  if (currentView !== "classes" || appContent.querySelector(".class-advisor-panel")) return;
  const rows = classAdvisorRows();
  const visibleRows = rows.filter(classAdvisorMatches).sort(compareClassAdvisorRows);
  const assignPanel = [...appContent.querySelectorAll(".operation-panel")].find((panel) => panel.querySelector("#assignForm"));
  const panel = `
    <section class="section class-advisor-panel">
      <div class="section-head">
        <div>
          <h3>智能分班建议</h3>
          <span class="muted">按课程、年级、订单班级、容量和课时状态推荐可接收班级，减少人工来回查表。</span>
        </div>
        ${tag(`${visibleRows.length} 条`, visibleRows.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${renderClassAdvisorSummary(rows, visibleRows)}
        ${renderClassAdvisorToolbar()}
        ${table(["学员", "当前卡点", "建议班级", "容量", "匹配度", "建议状态", "理由", "操作"], renderClassAdvisorRows(visibleRows))}
      </div>
    </section>`;

  if (assignPanel) {
    assignPanel.insertAdjacentHTML("afterend", panel);
  } else {
    appContent.insertAdjacentHTML("afterbegin", panel);
  }
}

function classAdvisorAssign(studentId, className) {
  const student = appState.students.find((item) => item.id === studentId);
  const classItem = getClass(className);
  if (!student || !classItem) return;
  if (classAdvisorClassOpenSeats(classItem) <= 0 && student.className !== classItem.name) {
    setNotice("classes", `${classItem.name} 已满班，请先扩容或选择其他班级。`, "red");
    renderView();
    return;
  }

  student.className = classItem.name;
  student.course = classItem.course;
  selectedStudentForClass = student.id;
  syncClassCounts();
  setNotice("classes", `${student.name} 已按建议分入 ${classItem.name}。`);
  saveState();
  renderNav();
  renderView();
}

const baseRenderClassesForAdvisor = renderClasses;
renderClasses = function renderClassesWithAdvisor() {
  baseRenderClassesForAdvisor();
  appendClassAdvisorPanel();
};

if (typeof exportDataset === "function") {
  const baseExportDatasetForClassAdvisor = exportDataset;
  exportDataset = function exportDatasetWithClassAdvisor(type) {
    if (type !== "classAdvisor") {
      baseExportDatasetForClassAdvisor(type);
      return;
    }
    const columns = [
      ["studentId", "学员编号"],
      ["student", "学员姓名"],
      ["phone", "手机号"],
      ["grade", "年级"],
      ["currentClass", "当前班级"],
      ["course", "报读课程"],
      ["studentStatus", "学员状态"],
      ["suggestedClass", "建议班级"],
      ["classCourse", "班级课程"],
      ["teacher", "任课教师"],
      ["openSeats", "剩余名额"],
      ["capacityRate", "满班率"],
      ["score", "匹配度"],
      ["status", "建议状态"],
      ["needs", "当前卡点"],
      ["warnings", "风险提示"],
      ["reason", "推荐理由"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("智能分班建议.csv", buildCsv(flattenClassAdvisorRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "智能分班建议.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForClassAdvisor = renderDataCenter;
  renderDataCenter = function renderDataCenterWithClassAdvisor() {
    baseRenderDataCenterForClassAdvisor();
    const dataGrid = appContent.querySelector(".data-grid");
    if (dataGrid && !dataGrid.querySelector('[data-export="classAdvisor"]')) {
      const card = document.createElement("article");
      card.className = "data-card";
      card.innerHTML = `<div><span class="muted">智能分班建议</span><strong>${flattenClassAdvisorRows().length}</strong></div><button class="small-button" type="button" data-export="classAdvisor">导出建议</button>`;
      const classCard = dataGrid.querySelector('[data-export="classRosters"]')?.closest(".data-card") || dataGrid.querySelector('[data-export="classes"]')?.closest(".data-card");
      if (classCard) {
        classCard.after(card);
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
  if (event.target.id === "classAdvisorScenario") {
    applyClassAdvisorScenario(event.target.value);
    if (currentView === "classes") renderView();
    return;
  }

  if (event.target.id === "classAdvisorStatusFilter") classAdvisorStatusFilter = event.target.value;
  if (event.target.id === "classAdvisorRiskFilter") classAdvisorRiskFilter = event.target.value;
  if (event.target.id === "classAdvisorSortMode") classAdvisorSortMode = event.target.value;
  if (["classAdvisorStatusFilter", "classAdvisorRiskFilter", "classAdvisorSortMode"].includes(event.target.id)) classAdvisorScenario = "custom";

  if (["classAdvisorStatusFilter", "classAdvisorRiskFilter", "classAdvisorSortMode"].includes(event.target.id) && currentView === "classes") {
    renderView();
  }
});

document.addEventListener("click", (event) => {
  const assignButton = event.target.closest("[data-class-advisor-assign]");
  if (!assignButton || assignButton.disabled) return;
  classAdvisorAssign(assignButton.dataset.classAdvisorAssign, assignButton.dataset.className);
});

if (currentView === "classes" || currentView === "data") {
  renderView();
}
