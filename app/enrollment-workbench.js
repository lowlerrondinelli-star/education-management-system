const enrollmentWorkbenchStyle = document.createElement("style");
enrollmentWorkbenchStyle.textContent = `
  .enrollment-workbench {
    margin-bottom: 16px;
  }

  .enrollment-toolbar {
    align-items: end;
  }

  .enrollment-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .enrollment-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .enrollment-stage {
    display: grid;
    gap: 7px;
    min-width: 190px;
  }

  .enrollment-step-strip {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
    max-width: 220px;
  }

  .enrollment-step-dot {
    height: 6px;
    border-radius: 999px;
    background: #e5e7eb;
  }

  .enrollment-step-dot.done {
    background: #2f7d5b;
  }

  .enrollment-step-dot.warn {
    background: #d97706;
  }

  .enrollment-tags,
  .enrollment-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .enrollment-note {
    max-width: 340px;
    line-height: 1.55;
    white-space: normal;
  }

  @media (max-width: 650px) {
    .enrollment-toolbar,
    .enrollment-toolbar label,
    .enrollment-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(enrollmentWorkbenchStyle);

let enrollmentStageFilter = "active";
let enrollmentOwnerFilter = "all";
let enrollmentSortMode = "stage";

const enrollmentStageMeta = {
  lead: { label: "待转学员", tone: "amber", rank: 1, progress: 1 },
  trial: { label: "待试听确认", tone: "amber", rank: 2, progress: 1 },
  order: { label: "待报名收款", tone: "red", rank: 3, progress: 2 },
  payment: { label: "待补缴", tone: "red", rank: 4, progress: 3 },
  class: { label: "待分班", tone: "amber", rank: 5, progress: 4 },
  schedule: { label: "待排课", tone: "amber", rank: 6, progress: 5 },
  ready: { label: "可开课", tone: "green", rank: 7, progress: 6 }
};

function enrollmentEnsureLeads() {
  if (typeof ensureLeadData === "function") ensureLeadData();
}

function enrollmentClosedLead(lead) {
  return ["已报名", "流失"].includes(lead?.status);
}

function enrollmentStudentOrders(student) {
  if (!student) return [];
  if (typeof studentOrders === "function") return studentOrders(student);
  return appState.orders.filter((order) => order.student === student.name);
}

function enrollmentFindStudentForLead(lead) {
  if (!lead) return null;
  return appState.students.find((student) => student.id === lead.convertedStudentId || student.phone === lead.phone || student.name === lead.name) || null;
}

function enrollmentFindLeadForStudent(student) {
  if (!Array.isArray(appState.leads) || !student) return null;
  return appState.leads.find((lead) => lead.convertedStudentId === student.id || lead.phone === student.phone || lead.name === student.name) || null;
}

function enrollmentFutureLesson(student) {
  if (!student) return null;
  const today = todayIsoDate();
  const classNames = new Set([student.className, ...enrollmentStudentOrders(student).map((order) => order.className)].filter(Boolean));
  return appState.lessons
    .filter((lesson) => lesson.status === "待上课" && lesson.date >= today && (classNames.has(lesson.target) || text(lesson.target).startsWith(`${student.name}-`)))
    .sort(compareLessonTime)[0];
}

function enrollmentDebt(student, orders) {
  if (!student) return 0;
  const orderDebt = orders.reduce((sum, order) => sum + Number(order.debt || 0), 0);
  return Math.max(Number(student.debt || 0), orderDebt);
}

function enrollmentClassReady(student) {
  const className = text(student?.className).trim();
  return !!className && className !== "待分班" && !!getClass(className);
}

function enrollmentStageFor(lead, student) {
  const orders = enrollmentStudentOrders(student);
  const debt = enrollmentDebt(student, orders);
  if (!student) return lead?.status === "待试听" || lead?.trialAt ? "trial" : "lead";
  if (!orders.length) return "order";
  if (debt > 0) return "payment";
  if (!enrollmentClassReady(student)) return "class";
  if (!enrollmentFutureLesson(student)) return "schedule";
  return "ready";
}

function enrollmentCaseNextStep(row) {
  if (row.stage === "lead") return "先把线索转成学员档案，避免后续报名和分班没有承接对象。";
  if (row.stage === "trial") return "试听后当天回访，确认是否报名以及适合的班型。";
  if (row.stage === "order") return "已建档但没有订单，下一步办理报名收款并生成课时账户。";
  if (row.stage === "payment") return `还有 ${money(row.debt)} 欠费，先补缴或确认欠费原因。`;
  if (row.stage === "class") return "订单已建立，下一步把学员分到正式班级。";
  if (row.stage === "schedule") return "学员已在班级里，但没有未来待上课节，需要核对排课。";
  return "报名、分班、排课都已具备，可以按课表点名消课。";
}

function enrollmentBuildRows() {
  enrollmentEnsureLeads();
  const rows = [];
  const seenStudents = new Set();

  (appState.leads || []).forEach((lead) => {
    const student = enrollmentFindStudentForLead(lead);
    const stage = enrollmentStageFor(lead, student);
    if (enrollmentClosedLead(lead) && (!student || stage === "ready")) return;
    if (student) seenStudents.add(student.id);
    rows.push(enrollmentBuildRow(lead, student));
  });

  appState.students.forEach((student) => {
    if (seenStudents.has(student.id)) return;
    rows.push(enrollmentBuildRow(enrollmentFindLeadForStudent(student), student));
  });

  return rows;
}

function enrollmentBuildRow(lead, student) {
  const orders = enrollmentStudentOrders(student);
  const debt = enrollmentDebt(student, orders);
  const stage = enrollmentStageFor(lead, student);
  const nextLesson = enrollmentFutureLesson(student);
  const owner = student?.owner || lead?.owner || "未分配";
  return {
    id: student?.id || lead?.id || "",
    lead,
    student,
    orders,
    debt,
    stage,
    owner,
    name: student?.name || lead?.name || "未命名",
    phone: student?.phone || lead?.phone || "",
    course: student?.course || lead?.course || "",
    className: student?.className || "待分班",
    nextLesson
  };
}

function enrollmentMatches(row) {
  const source = [row.name, row.phone, row.course, row.className, row.owner, row.lead?.channel, row.lead?.status].join(" ");
  if (searchTerm && !source.toLowerCase().includes(searchTerm.toLowerCase())) return false;
  if (enrollmentOwnerFilter !== "all" && row.owner !== enrollmentOwnerFilter) return false;
  if (enrollmentStageFilter === "active") return row.stage !== "ready";
  if (enrollmentStageFilter !== "all" && row.stage !== enrollmentStageFilter) return false;
  return true;
}

function compareEnrollmentRows(left, right) {
  if (enrollmentSortMode === "owner") {
    const ownerGap = left.owner.localeCompare(right.owner, "zh-CN");
    return ownerGap || left.name.localeCompare(right.name, "zh-CN");
  }
  if (enrollmentSortMode === "name") return left.name.localeCompare(right.name, "zh-CN");
  if (enrollmentSortMode === "debtDesc") return right.debt - left.debt || left.name.localeCompare(right.name, "zh-CN");
  const rankGap = enrollmentStageMeta[left.stage].rank - enrollmentStageMeta[right.stage].rank;
  return rankGap || left.name.localeCompare(right.name, "zh-CN");
}

function renderEnrollmentSummary(rows, visibleRows) {
  const needOrder = rows.filter((row) => row.stage === "order").length;
  const needClass = rows.filter((row) => row.stage === "class").length;
  const needSchedule = rows.filter((row) => row.stage === "schedule").length;
  const ready = rows.filter((row) => row.stage === "ready").length;
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>办理中 ${rows.filter((row) => row.stage !== "ready").length} 人</small></div>
      <div class="metric"><span>待报名</span><strong>${needOrder}</strong><small>需要生成订单课时</small></div>
      <div class="metric"><span>待分班/排课</span><strong>${needClass + needSchedule}</strong><small>${needClass} 人待分班，${needSchedule} 人待排课</small></div>
      <div class="metric"><span>可开课</span><strong>${ready}</strong><small>流程已具备</small></div>
    </div>`;
}

function renderEnrollmentToolbar(rows) {
  const owners = [...new Set(rows.map((row) => row.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  return `
    <div class="filters enrollment-toolbar">
      <label>办理阶段
        <select id="enrollmentStageFilter" aria-label="报名办理阶段筛选">
          <option value="active" ${enrollmentStageFilter === "active" ? "selected" : ""}>只看待处理</option>
          <option value="all" ${enrollmentStageFilter === "all" ? "selected" : ""}>全部阶段</option>
          ${Object.entries(enrollmentStageMeta).map(([key, meta]) => `<option value="${key}" ${enrollmentStageFilter === key ? "selected" : ""}>${escapeHtml(meta.label)}</option>`).join("")}
        </select>
      </label>
      <label>负责人
        <select id="enrollmentOwnerFilter" aria-label="报名办理负责人筛选">
          <option value="all" ${enrollmentOwnerFilter === "all" ? "selected" : ""}>全部负责人</option>
          ${owners.map((owner) => `<option value="${escapeHtml(owner)}" ${enrollmentOwnerFilter === owner ? "selected" : ""}>${escapeHtml(owner)}</option>`).join("")}
        </select>
      </label>
      <label>排序
        <select id="enrollmentSortMode" aria-label="报名办理排序">
          <option value="stage" ${enrollmentSortMode === "stage" ? "selected" : ""}>流程阶段</option>
          <option value="debtDesc" ${enrollmentSortMode === "debtDesc" ? "selected" : ""}>欠费金额降序</option>
          <option value="owner" ${enrollmentSortMode === "owner" ? "selected" : ""}>负责人分组</option>
          <option value="name" ${enrollmentSortMode === "name" ? "selected" : ""}>姓名顺序</option>
        </select>
      </label>
    </div>`;
}

function renderEnrollmentSteps(row) {
  const progress = enrollmentStageMeta[row.stage].progress;
  return `<div class="enrollment-step-strip" aria-label="报名办理进度">
    ${[1, 2, 3, 4, 5, 6].map((step) => `<span class="enrollment-step-dot ${step <= progress ? "done" : step === progress + 1 ? "warn" : ""}"></span>`).join("")}
  </div>`;
}

function renderEnrollmentActions(row) {
  if (!row.student) {
    return `<button class="small-button" type="button" data-enrollment-convert-lead="${escapeHtml(row.lead?.id || "")}">转学员</button>
      <button class="small-button" type="button" data-go="leads">线索</button>`;
  }
  if (row.stage === "order") return `<button class="small-button" type="button" data-student-order="${escapeHtml(row.student.id)}">报名</button><button class="small-button" type="button" data-student-detail="${escapeHtml(row.student.id)}">详情</button>`;
  if (row.stage === "payment") {
    const debtOrder = row.orders.find((order) => Number(order.debt || 0) > 0);
    return `<button class="small-button" type="button" data-pay-order="${escapeHtml(debtOrder?.id || "")}" ${debtOrder ? "" : "disabled"}>补缴</button><button class="small-button" type="button" data-go="orders">订单</button>`;
  }
  if (row.stage === "class") return `<button class="small-button" type="button" data-student-class="${escapeHtml(row.student.id)}">分班</button><button class="small-button" type="button" data-go="classes">班级</button>`;
  if (row.stage === "schedule") return `<button class="small-button" type="button" data-enrollment-schedule="${escapeHtml(row.className)}">排课</button><button class="small-button" type="button" data-go="schedule">课表</button>`;
  return `<button class="small-button" type="button" data-student-detail="${escapeHtml(row.student.id)}">详情</button><button class="small-button" type="button" data-go="schedule">课表</button>`;
}

function renderEnrollmentRows(rows) {
  return rows.map((row) => {
    const meta = enrollmentStageMeta[row.stage];
    const source = row.lead ? `${row.lead.status} · ${row.lead.channel || "未知渠道"}` : "学员档案";
    const orderText = row.orders.length ? `${row.orders.length} 笔订单 / 欠费 ${row.debt ? money(row.debt) : "无"}` : "暂无订单";
    const lessonText = row.nextLesson ? `${row.nextLesson.date} ${row.nextLesson.time}` : "暂无未来课节";
    return `<tr>
      <td><strong>${escapeHtml(row.name)}</strong><br><span class="muted">${escapeHtml(row.phone)} · ${escapeHtml(source)}</span></td>
      <td>
        <div class="enrollment-stage">
          ${tag(meta.label, meta.tone)}
          ${renderEnrollmentSteps(row)}
        </div>
      </td>
      <td>${escapeHtml(row.owner)}<br><span class="muted">${escapeHtml(row.course || "待确认课程")}</span></td>
      <td>${escapeHtml(row.className || "待分班")}<br><span class="muted">${escapeHtml(orderText)}</span></td>
      <td><strong>${escapeHtml(lessonText)}</strong><br><span class="muted">${row.student ? `余额 ${escapeHtml(row.student.balance || 0)} 课时` : "尚未建学员档案"}</span></td>
      <td class="enrollment-note">${escapeHtml(enrollmentCaseNextStep(row))}</td>
      <td><div class="enrollment-actions">${renderEnrollmentActions(row)}</div></td>
    </tr>`;
  });
}

function prependEnrollmentWorkbench() {
  if (currentView !== "students" || appContent.querySelector(".enrollment-workbench")) return;
  const rows = enrollmentBuildRows();
  const visibleRows = rows.filter(enrollmentMatches).sort(compareEnrollmentRows);
  appContent.insertAdjacentHTML(
    "afterbegin",
    `<section class="section enrollment-workbench">
      <div class="section-head">
        <div>
          <h3>报名办理台</h3>
          <span class="muted">从招生线索、建档、报名收款、分班到首次排课，按卡点推进每个学员。</span>
        </div>
        ${tag(`${visibleRows.length} 项`, visibleRows.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${renderEnrollmentSummary(rows, visibleRows)}
        ${renderEnrollmentToolbar(rows)}
        ${table(["学员/来源", "当前阶段", "负责人/课程", "班级订单", "上课准备", "下一步", "操作"], renderEnrollmentRows(visibleRows))}
      </div>
    </section>`
  );
}

const baseRenderStudentsForEnrollment = renderStudents;
renderStudents = function renderStudentsWithEnrollmentWorkbench() {
  baseRenderStudentsForEnrollment();
  prependEnrollmentWorkbench();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "enrollmentStageFilter") enrollmentStageFilter = event.target.value;
  if (event.target.id === "enrollmentOwnerFilter") enrollmentOwnerFilter = event.target.value;
  if (event.target.id === "enrollmentSortMode") enrollmentSortMode = event.target.value;
  if (["enrollmentStageFilter", "enrollmentOwnerFilter", "enrollmentSortMode"].includes(event.target.id) && currentView === "students") renderView();
});

document.addEventListener("click", (event) => {
  const convertButton = event.target.closest("[data-enrollment-convert-lead]");
  if (convertButton) {
    const leadId = convertButton.dataset.enrollmentConvertLead;
    if (typeof convertLeadToStudent === "function") {
      convertLeadToStudent(leadId);
    } else {
      setView("leads");
    }
  }

  const scheduleButton = event.target.closest("[data-enrollment-schedule]");
  if (scheduleButton) {
    const className = scheduleButton.dataset.enrollmentSchedule;
    setNotice("schedule", `${className} 需要新增未来课节，可在新增课节表单中选择该班级。`, "amber");
    setView("schedule");
  }
});

if (currentView === "students") renderView();
