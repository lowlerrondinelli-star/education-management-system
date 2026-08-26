const cleanUiActivePanels = {};
const cleanUiActiveSupportPanels = {};

const cleanUiPanelMeta = {
  orderForm: { label: "新增报名", hint: "办理报名、套餐和收款" },
  classForm: { label: "新增班级", hint: "创建可报名和排课的班级" },
  assignForm: { label: "快速分班", hint: "把学员放入目标班级" },
  lessonForm: { label: "新增排课", hint: "新增单节班课或 1 对 1" },
  batchScheduleForm: { label: "周期排课", hint: "按星期批量生成课表" },
  leaveRequestForm: { label: "登记请假", hint: "处理请假和补课建议" },
  courseForm: { label: "新增课程", hint: "维护报价和课程口径" },
  teacherForm: { label: "新增教师", hint: "维护教师科目和容量" },
  roomForm: { label: "新增教室", hint: "维护教室和校区容量" },
  leadForm: { label: "新增线索", hint: "登记咨询和试听意向" },
  followUpForm: { label: "新增跟进", hint: "记录回访和下次提醒" },
  employeeForm: { label: "新增员工", hint: "维护校区人员和岗位" },
  roleForm: { label: "新增角色", hint: "维护权限模板" }
};

const cleanUiSupportPanelMeta = {
  schedule: [
    { key: "quality", selector: ".schedule-quality", label: "排课健康", hint: "查看冲突和课节统计" },
    { key: "signin", selector: ".lesson-signin-panel", label: "课前签到", hint: "查看到课和资金风险" },
    { key: "resource", selector: ".schedule-resource-panel", label: "资源占用", hint: "查看老师和教室占用" },
    { key: "list", selector: ".schedule-list-panel", label: "课表清单", hint: "按条件筛选全部课节" }
  ],
  students: [
    { key: "enrollment", selector: ".enrollment-workbench", label: "报名办理", hint: "查看报名分班排课卡点" },
    { key: "operations", selector: ".student-ops-panel", label: "运营看板", hint: "查看欠费续费分班动作" }
  ],
  classes: [
    { key: "operations", selector: ".class-ops-panel", label: "班级运营", hint: "查看容量欠费和补排动作" },
    { key: "advisor", selector: ".class-advisor-panel", label: "智能分班", hint: "查看推荐班级和分班卡点" }
  ],
  orders: [
    { key: "renewal", selector: ".renewal-board", label: "续费欠费", hint: "查看催缴续费沟通对象" },
    { key: "daily", selector: ".payment-daily-panel", label: "收款日报", hint: "查看当日收款和经办人" },
    { key: "risk", selector: ".order-risk-panel", label: "订单风险", hint: "查看欠费课时和有效期" },
    { key: "payments", selector: ".payment-list-panel", label: "收款对账", hint: "查看收款退费流水" },
    { key: "hours", selector: ".hour-audit-panel", label: "课时核对", hint: "查看余额差异和欠费" }
  ],
  teacherDesk: [
    { key: "prep", selector: ".lesson-prep-panel", label: "课前准备", hint: "查看名单请假和资金提醒" },
    { key: "roster", selector: ".teacher-roster-panel", label: "班级花名册", hint: "查看老师班级和学员风险" },
    { key: "execution", selector: ".lesson-execution-panel", label: "上课闭环", hint: "查看点名消课反馈进度" },
    { key: "tasks", selector: ".teacher-task-panel", label: "任务清单", hint: "查看待点名反馈和异常" }
  ],
  leaves: [
    { key: "detail", selector: ".leave-detail-panel", label: "请假明细", hint: "查看全部请假补课记录" },
    { key: "audit", selector: ".attendance-audit-panel", label: "考勤核对", hint: "查看异常考勤和补课闭环" }
  ],
  feedback: [
    { key: "lessons", selector: ".feedback-lessons-panel", label: "课节状态", hint: "查看已上课节反馈状态" },
    { key: "records", selector: ".feedback-records-panel", label: "反馈记录", hint: "查看学员反馈留档" },
    { key: "parent", selector: ".parent-message-audit-panel", label: "家长通知", hint: "核对话术作业和风险" }
  ]
};

const cleanUiSupportGroupMeta = {
  schedule: { title: "课表辅助" },
  students: { title: "学员辅助" },
  classes: { title: "班级辅助" },
  orders: { title: "订单辅助" },
  teacherDesk: { title: "老师辅助" },
  leaves: { title: "请假辅助" },
  feedback: { title: "反馈辅助" }
};

function cleanUiViewKey() {
  return currentView || "dashboard";
}

function cleanUiPanelLabel(panel) {
  const meta = cleanUiPanelMeta[panel.id];
  if (meta) return meta;
  const strong = panel.querySelector("strong")?.textContent?.trim();
  return { label: strong || "办理操作", hint: "打开后填写业务信息" };
}

function cleanUiPanelKey(panel, index) {
  return panel.id || `operation-panel-${index}`;
}

function cleanUiActivePanel() {
  return appContent.querySelector('.operation-panel[aria-expanded="true"], form.master-card[aria-expanded="true"], form.schedule-batch[aria-expanded="true"]');
}

function cleanUiActiveSupportPanel() {
  return appContent.querySelector('[data-clean-support-panel][aria-expanded="true"]');
}

function cleanUiFocusActivePanel() {
  const panel = cleanUiActivePanel() || cleanUiActiveSupportPanel();
  if (!panel) return;
  panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function cleanUiManagedForm(form) {
  return form?.matches?.(".operation-panel, form.master-card, form.schedule-batch");
}

function cleanUiClosePanelAfterSubmit(viewKey) {
  if (!cleanUiActivePanels[viewKey]) return;
  if (operationNotice?.view === viewKey && operationNotice?.tone === "red") return;
  cleanUiActivePanels[viewKey] = "";
  if (currentView === viewKey) renderView();
}

function cleanUiPanelsInBody(body) {
  const directPanels = [...body.children].filter((child) => child.matches?.(".operation-panel, form.master-card, form.schedule-batch"));
  const nestedPanels = [
    ...body.querySelectorAll(":scope > .master-grid > form.master-card"),
    ...body.querySelectorAll(":scope > .lead-layout > form.master-card"),
    ...body.querySelectorAll(":scope > .follow-layout > form.master-card"),
    ...body.querySelectorAll(":scope > .staff-layout > form.master-card"),
    ...body.querySelectorAll(":scope > .leave-board form.operation-panel")
  ];
  return [...new Set([...directPanels, ...nestedPanels])];
}

function cleanUiDockAnchor(body, panels) {
  const firstPanel = panels[0];
  if (!firstPanel) return null;
  if (firstPanel.parentElement === body) return firstPanel;
  return firstPanel.closest(".master-grid, .lead-layout, .follow-layout, .staff-layout, .leave-board") || firstPanel;
}

function cleanUiActionDock(panels) {
  const activeKey = cleanUiActivePanels[cleanUiViewKey()] || "";
  const buttons = panels
    .map((panel, index) => {
      const key = cleanUiPanelKey(panel, index);
      const meta = cleanUiPanelLabel(panel);
      const active = activeKey === key;
      return `<button class="clean-action-button ${active ? "active" : ""}" type="button" data-clean-panel-open="${escapeHtml(key)}">
        <strong>${escapeHtml(meta.label)}</strong>
        <span>${escapeHtml(meta.hint)}</span>
      </button>`;
    })
    .join("");
  const closeButton = activeKey ? `<button class="small-button clean-action-close" type="button" data-clean-panel-close>收起操作</button>` : "";

  return `
    <div class="clean-action-dock">
      <div class="clean-action-title">
        <span class="clean-action-kicker">功能按钮</span>
        <strong>常用操作</strong>
        <span class="muted">${activeKey ? "正在办理，完成后可收起。" : `已收起 ${panels.length} 个办理入口。`}</span>
      </div>
      <div class="clean-action-buttons">
        ${buttons}
        ${closeButton}
      </div>
    </div>`;
}

function cleanUiSupportPanelItems() {
  const metas = cleanUiSupportPanelMeta[cleanUiViewKey()] || [];
  return metas
    .map((meta) => {
      const panel = appContent.querySelector(meta.selector);
      return panel ? { ...meta, panel } : null;
    })
    .filter(Boolean);
}

function cleanUiSupportPanelKey(item) {
  return `${cleanUiViewKey()}:${item.key}`;
}

function cleanUiSupportDock(items) {
  const activeKey = cleanUiActiveSupportPanels[cleanUiViewKey()] || "";
  const group = cleanUiSupportGroupMeta[cleanUiViewKey()] || { title: "辅助面板" };
  const buttons = items
    .map((item) => {
      const key = cleanUiSupportPanelKey(item);
      const active = activeKey === key;
      return `<button class="clean-action-button clean-support-button ${active ? "active" : ""}" type="button" data-clean-support-open="${escapeHtml(key)}">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.hint)}</span>
      </button>`;
    })
    .join("");
  const closeButton = activeKey ? `<button class="small-button clean-action-close" type="button" data-clean-support-close>收起面板</button>` : "";
  return `
    <div class="clean-support-group">
      <div class="clean-action-title">
        <span class="clean-action-kicker">查看面板</span>
        <strong>${escapeHtml(group.title)}</strong>
        <span class="muted">${activeKey ? "正在查看辅助面板。" : `已收起 ${items.length} 个辅助面板。`}</span>
      </div>
      <div class="clean-action-buttons">
        ${buttons}
        ${closeButton}
      </div>
    </div>`;
}

function cleanUiSupportOnlyDock(items) {
  return `
    <div class="clean-action-dock clean-support-only">
      ${cleanUiSupportDock(items)}
    </div>`;
}

function decorateCleanUiPanels() {
  const bodies = [...appContent.querySelectorAll(".section-body")];
  bodies.forEach((body) => {
    const panels = cleanUiPanelsInBody(body);
    if (!panels.length || body.querySelector(".clean-action-dock")) return;

    const activeKey = cleanUiActivePanels[cleanUiViewKey()] || "";
    body.classList.add("clean-ui-managed");
    panels.forEach((panel, index) => {
      const key = cleanUiPanelKey(panel, index);
      panel.dataset.cleanPanel = key;
      panel.classList.toggle("clean-panel-hidden", activeKey !== key);
      if (activeKey === key) {
        panel.setAttribute("aria-expanded", "true");
      } else {
        panel.setAttribute("aria-expanded", "false");
      }
    });

    cleanUiDockAnchor(body, panels)?.insertAdjacentHTML("beforebegin", cleanUiActionDock(panels));
  });
}

function decorateCleanUiSupportPanels() {
  const items = cleanUiSupportPanelItems();
  if (!items.length) return;
  const activeKey = cleanUiActiveSupportPanels[cleanUiViewKey()] || "";
  items.forEach((item) => {
    const key = cleanUiSupportPanelKey(item);
    item.panel.dataset.cleanSupportPanel = key;
    item.panel.classList.toggle("clean-support-hidden", activeKey !== key);
    item.panel.setAttribute("aria-expanded", activeKey === key ? "true" : "false");
  });

  const dock = appContent.querySelector(".clean-action-dock");
  if (dock && !dock.querySelector(".clean-support-group")) {
    dock.insertAdjacentHTML("beforeend", cleanUiSupportDock(items));
    return;
  }

  const primaryBody = [...appContent.querySelectorAll(".section:not([data-clean-support-panel]) .section-body")]
    .find((body) => !body.querySelector(".clean-action-dock"));
  if (primaryBody) {
    primaryBody.classList.add("clean-ui-managed");
    primaryBody.insertAdjacentHTML("afterbegin", cleanUiSupportOnlyDock(items));
  }
}

const baseRenderViewForCleanUi = renderView;
renderView = function renderViewWithCleanUi() {
  baseRenderViewForCleanUi();
  decorateCleanUiPanels();
  decorateCleanUiSupportPanels();
};

document.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-clean-panel-open]");
  if (openButton) {
    cleanUiActivePanels[cleanUiViewKey()] = openButton.dataset.cleanPanelOpen;
    renderView();
    setTimeout(cleanUiFocusActivePanel, 30);
    return;
  }

  const closeButton = event.target.closest("[data-clean-panel-close]");
  if (closeButton) {
    cleanUiActivePanels[cleanUiViewKey()] = "";
    renderView();
    return;
  }

  const supportButton = event.target.closest("[data-clean-support-open]");
  if (supportButton) {
    const key = supportButton.dataset.cleanSupportOpen;
    const viewKey = cleanUiViewKey();
    cleanUiActiveSupportPanels[viewKey] = cleanUiActiveSupportPanels[viewKey] === key ? "" : key;
    renderView();
    setTimeout(cleanUiFocusActivePanel, 30);
    return;
  }

  const supportCloseButton = event.target.closest("[data-clean-support-close]");
  if (supportCloseButton) {
    cleanUiActiveSupportPanels[cleanUiViewKey()] = "";
    renderView();
  }
});

document.addEventListener("submit", (event) => {
  if (!cleanUiManagedForm(event.target)) return;
  const viewKey = cleanUiViewKey();
  setTimeout(() => cleanUiClosePanelAfterSubmit(viewKey), 0);
});

if (appContent) {
  decorateCleanUiPanels();
  decorateCleanUiSupportPanels();
}
