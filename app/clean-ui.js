const cleanUiActivePanels = {};

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

function cleanUiFocusActivePanel() {
  const panel = cleanUiActivePanel();
  if (!panel) return;
  panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function cleanUiPanelsInBody(body) {
  const directPanels = [...body.children].filter((child) => child.matches?.(".operation-panel, form.master-card, form.schedule-batch"));
  const nestedPanels = [
    ...body.querySelectorAll(":scope > .master-grid > form.master-card"),
    ...body.querySelectorAll(":scope > .lead-layout > form.master-card"),
    ...body.querySelectorAll(":scope > .follow-layout > form.master-card"),
    ...body.querySelectorAll(":scope > .staff-layout > form.master-card")
  ];
  return [...new Set([...directPanels, ...nestedPanels])];
}

function cleanUiDockAnchor(body, panels) {
  const firstPanel = panels[0];
  if (!firstPanel) return null;
  if (firstPanel.parentElement === body) return firstPanel;
  return firstPanel.closest(".master-grid, .lead-layout, .follow-layout, .staff-layout") || firstPanel;
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

const baseRenderViewForCleanUi = renderView;
renderView = function renderViewWithCleanUi() {
  baseRenderViewForCleanUi();
  decorateCleanUiPanels();
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
  }
});

if (appContent) decorateCleanUiPanels();
