const operationFlowStyle = document.createElement("style");
operationFlowStyle.textContent = `
  .operation-flow-panel {
    margin-bottom: 16px;
  }

  .operation-flow-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(180px, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  .operation-flow-step {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    padding: 12px;
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .operation-flow-step strong {
    overflow-wrap: anywhere;
  }

  .operation-flow-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .operation-flow-num {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    color: #fff;
    background: var(--blue);
    font-weight: 800;
    flex: 0 0 auto;
  }

  .operation-flow-step.warn .operation-flow-num {
    background: var(--amber);
  }

  .operation-flow-step.red .operation-flow-num {
    background: var(--red);
  }

  .operation-flow-step.green .operation-flow-num {
    background: var(--green);
  }

  .operation-flow-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .operation-flow-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .operation-flow-note {
    max-width: 360px;
    white-space: normal;
    line-height: 1.55;
  }

  .operation-flow-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  @media (max-width: 1120px) {
    .operation-flow-strip {
      grid-template-columns: repeat(2, minmax(180px, 1fr));
    }
  }

  @media (max-width: 650px) {
    .operation-flow-strip {
      grid-template-columns: 1fr;
    }

    .operation-flow-toolbar,
    .operation-flow-toolbar label,
    .operation-flow-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(operationFlowStyle);

let operationFlowRoleFilter = "all";

function operationFlowArray(key) {
  return Array.isArray(appState[key]) ? appState[key] : [];
}

function operationFlowCanAccess(view) {
  return typeof canAccessView !== "function" || canAccessView(view);
}

function operationFlowDebtTotal() {
  return operationFlowArray("orders").reduce((sum, order) => sum + Number(order.debt || 0), 0);
}

function operationFlowLowBalanceStudents() {
  return operationFlowArray("students").filter((student) => Number(student.balance || 0) > 0 && Number(student.balance || 0) <= 3);
}

function operationFlowBuildSteps() {
  const leads = operationFlowArray("leads");
  const students = operationFlowArray("students");
  const orders = operationFlowArray("orders");
  const classes = operationFlowArray("classes");
  const lessons = operationFlowArray("lessons");
  const ledger = operationFlowArray("ledger");
  const followUps = typeof activeFollowUps === "function" ? activeFollowUps() : operationFlowArray("followUps").filter((item) => item.status !== "已完成");
  const intentStudents = students.filter((student) => student.status === "意向");
  const enrolledStudents = students.filter((student) => student.status === "已报名");
  const unassignedStudents = students.filter((student) => !student.className || student.className === "待分班");
  const pendingLessons = lessons.filter((lesson) => lesson.status === "待上课");
  const finishedLessons = lessons.filter((lesson) => lesson.status === "已上课");
  const debtTotal = operationFlowDebtTotal();
  const lowBalance = operationFlowLowBalanceStudents();
  const activeClasses = classes.filter((item) => item.status === "开课中");

  return [
    {
      id: "leads",
      order: 1,
      title: "招生线索",
      owner: "前台/招生",
      role: "front",
      view: "leads",
      metric: `${leads.length} 条线索`,
      status: leads.length ? "warn" : "green",
      detail: leads.length ? "先处理待邀约、试听和未转化线索。" : "没有待处理线索，可继续维护获客渠道。",
      action: "看线索"
    },
    {
      id: "students",
      order: 2,
      title: "学员建档",
      owner: "前台/教务",
      role: "front",
      view: "students",
      metric: `${students.length} 名学员`,
      status: intentStudents.length ? "warn" : "green",
      detail: intentStudents.length ? `${intentStudents.length} 名意向学员需要报名转化或回访。` : "学员档案已可支撑报名、分班和排课。",
      action: "看学员"
    },
    {
      id: "orders",
      order: 3,
      title: "报名收款",
      owner: "前台/财务",
      role: "finance",
      view: "orders",
      metric: `${orders.length} 笔订单`,
      status: debtTotal > 0 ? "red" : "green",
      detail: debtTotal > 0 ? `当前待收欠费 ${money(debtTotal)}，优先补缴和续费沟通。` : "订单欠费已结清，可继续关注续费提醒。",
      action: "看订单"
    },
    {
      id: "classes",
      order: 4,
      title: "分班编班",
      owner: "教务",
      role: "academic",
      view: "classes",
      metric: `${activeClasses.length} 个开课班`,
      status: unassignedStudents.length ? "warn" : "green",
      detail: unassignedStudents.length ? `${unassignedStudents.length} 名学员还未进入正式班级。` : "已报名学员均有班级，可继续检查容量。",
      action: "看班级"
    },
    {
      id: "schedule",
      order: 5,
      title: "排课",
      owner: "教务/老师",
      role: "academic",
      view: "schedule",
      metric: `${pendingLessons.length} 节待上`,
      status: pendingLessons.length ? "warn" : "green",
      detail: pendingLessons.length ? "核对教师、教室和班级资源，避免冲突排课。" : "暂无待上课节，可以新增未来课表。",
      action: "看课表"
    },
    {
      id: "consume",
      order: 6,
      title: "点名消课",
      owner: "老师/教务",
      role: "teacher",
      view: "schedule",
      metric: `${ledger.length} 条流水`,
      status: finishedLessons.length > ledger.length ? "warn" : "green",
      detail: finishedLessons.length ? "课后及时点名，系统会生成课时流水并更新余额。" : "先完成排课，上课后再点名消课。",
      action: "去点名"
    },
    {
      id: "followUp",
      order: 7,
      title: "续费跟进",
      owner: "前台/学管",
      role: "front",
      view: "followUp",
      metric: `${followUps.length} 个待办`,
      status: followUps.length || lowBalance.length ? "warn" : "green",
      detail: lowBalance.length ? `${lowBalance.length} 名学员课时不足，建议本周完成续费沟通。` : "续费与回访任务稳定，可保持常规反馈。",
      action: "去跟进"
    },
    {
      id: "data",
      order: 8,
      title: "导入校验",
      owner: "教务/管理员",
      role: "admin",
      view: "data",
      metric: `${operationFlowArray("templates").length} 个模板`,
      status: "green",
      detail: "批量导入前先看模板字段、必填项和数据健康检查。",
      action: "数据中心"
    }
  ].filter((step) => operationFlowCanAccess(step.view));
}

function operationFlowVisibleSteps() {
  const steps = operationFlowBuildSteps();
  if (operationFlowRoleFilter === "all") return steps;
  return steps.filter((step) => step.role === operationFlowRoleFilter);
}

function operationFlowStatusTone(step) {
  if (step.status === "red") return "red";
  if (step.status === "warn") return "amber";
  if (step.status === "green") return "green";
  return "";
}

function renderOperationFlowSummary(steps, visibleSteps) {
  const warnings = steps.filter((step) => step.status === "warn" || step.status === "red").length;
  const ready = steps.filter((step) => step.status === "green").length;
  const roles = new Set(steps.map((step) => step.role)).size;

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleSteps.length}</strong><small>全部 ${steps.length} 个流程节点</small></div>
      <div class="metric"><span>需关注</span><strong>${warnings}</strong><small>有待处理事项</small></div>
      <div class="metric"><span>运行正常</span><strong>${ready}</strong><small>可按常规维护</small></div>
      <div class="metric"><span>覆盖角色</span><strong>${roles}</strong><small>前台、教务、老师、财务</small></div>
    </div>`;
}

function renderOperationFlowToolbar() {
  return `
    <div class="filters operation-flow-toolbar">
      <label>查看角色
        <select id="operationFlowRoleFilter" aria-label="按角色筛选运营流程">
          <option value="all" ${operationFlowRoleFilter === "all" ? "selected" : ""}>全部角色</option>
          <option value="front" ${operationFlowRoleFilter === "front" ? "selected" : ""}>前台/学管</option>
          <option value="academic" ${operationFlowRoleFilter === "academic" ? "selected" : ""}>教务</option>
          <option value="teacher" ${operationFlowRoleFilter === "teacher" ? "selected" : ""}>老师</option>
          <option value="finance" ${operationFlowRoleFilter === "finance" ? "selected" : ""}>财务</option>
          <option value="admin" ${operationFlowRoleFilter === "admin" ? "selected" : ""}>管理员</option>
        </select>
      </label>
    </div>`;
}

function renderOperationFlowStrip(steps) {
  return `
    <div class="operation-flow-strip">
      ${steps
        .slice(0, 8)
        .map(
          (step) => `<article class="operation-flow-step ${step.status}">
            <div class="operation-flow-top">
              <span class="operation-flow-num">${step.order}</span>
              ${tag(step.status === "green" ? "正常" : "待处理", operationFlowStatusTone(step))}
            </div>
            <strong>${escapeHtml(step.title)}</strong>
            <span class="muted">${escapeHtml(step.metric)} · ${escapeHtml(step.owner)}</span>
            <button class="small-button" type="button" data-go="${escapeHtml(step.view)}">${escapeHtml(step.action)}</button>
          </article>`
        )
        .join("") || `<div class="stack-item"><strong>没有匹配流程</strong><span class="muted">请切换角色筛选。</span></div>`}
    </div>`;
}

function renderOperationFlowRows(steps) {
  return steps.map((step) => `<tr>
    <td><strong>${step.order}. ${escapeHtml(step.title)}</strong><br><span class="muted">${escapeHtml(step.owner)}</span></td>
    <td>${tag(step.status === "green" ? "正常" : "待处理", operationFlowStatusTone(step))}</td>
    <td>${escapeHtml(step.metric)}</td>
    <td class="operation-flow-note">${escapeHtml(step.detail)}</td>
    <td>
      <div class="operation-flow-actions">
        <button class="small-button" type="button" data-go="${escapeHtml(step.view)}">${escapeHtml(step.action)}</button>
      </div>
    </td>
  </tr>`);
}

function insertOperationFlowGuide() {
  if (currentView !== "dashboard" || appContent.querySelector(".operation-flow-panel")) return;
  const steps = operationFlowBuildSteps();
  const visibleSteps = operationFlowVisibleSteps();
  const section = `
    <section class="section operation-flow-panel">
      <div class="section-head">
        <div>
          <h3>校区运营流程导航</h3>
          <span class="muted">把线索、建档、报名、分班、排课、消课和续费串成一条可点击的工作路径。</span>
        </div>
        ${tag(`${visibleSteps.length} 步`, visibleSteps.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${renderOperationFlowSummary(steps, visibleSteps)}
        ${renderOperationFlowToolbar()}
        ${renderOperationFlowStrip(visibleSteps)}
        ${table(["步骤", "状态", "当前数据", "下一步", "操作"], renderOperationFlowRows(visibleSteps))}
      </div>
    </section>`;

  const taskPanel = appContent.querySelector(".task-center-panel");
  if (taskPanel) {
    taskPanel.insertAdjacentHTML("beforebegin", section);
    return;
  }

  const hero = appContent.querySelector(".dashboard-hero");
  if (hero) {
    hero.insertAdjacentHTML("afterend", section);
  } else {
    appContent.insertAdjacentHTML("afterbegin", section);
  }
}

const baseRenderDashboardForOperationFlow = renderDashboard;
renderDashboard = function renderDashboardWithOperationFlow() {
  baseRenderDashboardForOperationFlow();
  insertOperationFlowGuide();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "operationFlowRoleFilter") operationFlowRoleFilter = event.target.value;
  if (event.target.id === "operationFlowRoleFilter" && currentView === "dashboard") renderView();
});

if (currentView === "dashboard") renderView();
