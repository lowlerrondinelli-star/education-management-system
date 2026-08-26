const cleanUiActivePanels = {};

const cleanUiPanelMeta = {
  orderForm: { label: "新增报名", hint: "办理报名、套餐和收款" },
  classForm: { label: "新增班级", hint: "创建可报名和排课的班级" },
  assignForm: { label: "快速分班", hint: "把学员放入目标班级" },
  lessonForm: { label: "新增排课", hint: "新增单节班课或 1 对 1" },
  leaveRequestForm: { label: "登记请假", hint: "处理请假和补课建议" }
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
      <div>
        <strong>常用操作</strong>
        <span class="muted">先看数据，需要办理时再打开表单。</span>
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
    const panels = [...body.children].filter((child) => child.classList?.contains("operation-panel"));
    if (!panels.length || body.querySelector(".clean-action-dock")) return;

    const activeKey = cleanUiActivePanels[cleanUiViewKey()] || "";
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

    panels[0].insertAdjacentHTML("beforebegin", cleanUiActionDock(panels));
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
    return;
  }

  const closeButton = event.target.closest("[data-clean-panel-close]");
  if (closeButton) {
    cleanUiActivePanels[cleanUiViewKey()] = "";
    renderView();
  }
});

if (appContent) decorateCleanUiPanels();
