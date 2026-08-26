const followUpTypes = ["课时不足", "欠费补缴", "高风险反馈", "意向回访", "常规回访"];
const followUpResults = ["待联系", "已联系", "未接通", "约定缴费", "已续费", "暂不考虑"];

const followUpStyle = document.createElement("style");
followUpStyle.textContent = `
  .follow-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.42fr);
    gap: 14px;
  }

  .follow-card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px;
    background: #fff;
    display: grid;
    gap: 8px;
  }

  .follow-card.due {
    border-color: #f2b8a2;
    background: #fff7f2;
  }

  .follow-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .follow-note {
    line-height: 1.55;
    white-space: normal;
  }

  @media (max-width: 1040px) {
    .follow-layout {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(followUpStyle);

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromToday(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function followUpKey(type, studentName) {
  return `${type}:${studentName}`;
}

function followUpTone(item) {
  if (item.status === "已完成") return "green";
  if (item.dueDate <= todayText()) return "red";
  if (item.type === "课时不足" || item.type === "欠费补缴") return "amber";
  return "";
}

function studentDebt(student) {
  const orderDebt = appState.orders
    .filter((order) => order.student === student.name)
    .reduce((sum, order) => sum + Number(order.debt || 0), 0);
  return Math.max(Number(student.debt || 0), orderDebt);
}

function suggestedFollowUps() {
  const tasks = [];
  for (const student of appState.students) {
    const debt = studentDebt(student);
    if (debt > 0) {
      tasks.push({
        id: `F-${followUpKey("欠费补缴", student.name)}`,
        key: followUpKey("欠费补缴", student.name),
        student: student.name,
        phone: student.phone,
        type: "欠费补缴",
        owner: student.owner || "前台老师",
        dueDate: todayText(),
        status: "待跟进",
        result: "待联系",
        priority: "高",
        note: `当前欠费 ${money(debt)}，建议当天联系补缴。`,
        source: "系统提醒",
        updatedAt: ""
      });
    }

    if (Number(student.balance || 0) > 0 && Number(student.balance || 0) <= 3) {
      tasks.push({
        id: `F-${followUpKey("课时不足", student.name)}`,
        key: followUpKey("课时不足", student.name),
        student: student.name,
        phone: student.phone,
        type: "课时不足",
        owner: student.owner || "教务老师",
        dueDate: daysFromToday(1),
        status: "待跟进",
        result: "待联系",
        priority: "高",
        note: `剩余 ${student.balance} 课时，建议安排续费沟通。`,
        source: "系统提醒",
        updatedAt: ""
      });
    }

    if (student.status === "意向") {
      tasks.push({
        id: `F-${followUpKey("意向回访", student.name)}`,
        key: followUpKey("意向回访", student.name),
        student: student.name,
        phone: student.phone,
        type: "意向回访",
        owner: student.owner || "前台老师",
        dueDate: todayText(),
        status: "待跟进",
        result: "待联系",
        priority: "中",
        note: `意向课程：${student.course || "待确认"}，建议确认试听或报名时间。`,
        source: "系统提醒",
        updatedAt: ""
      });
    }
  }
  return tasks;
}

function ensureFollowUpData() {
  if (!Array.isArray(appState.followUps)) appState.followUps = [];
  const existingKeys = new Set(appState.followUps.map((item) => item.key).filter(Boolean));
  for (const task of suggestedFollowUps()) {
    if (!existingKeys.has(task.key)) appState.followUps.push(task);
  }
}

function activeFollowUps() {
  ensureFollowUpData();
  return appState.followUps.filter((item) => item.status !== "已完成");
}

function dueFollowUps() {
  return activeFollowUps().filter((item) => item.dueDate <= todayText());
}

function flattenFollowUpRows() {
  ensureFollowUpData();
  return appState.followUps.map((item) => ({
    id: item.id,
    student: item.student,
    phone: item.phone,
    type: item.type,
    owner: item.owner,
    dueDate: item.dueDate,
    status: item.status,
    result: item.result,
    priority: item.priority,
    source: item.source,
    note: item.note,
    updatedAt: item.updatedAt
  }));
}

function renderFollowUp() {
  ensureFollowUpData();
  const active = activeFollowUps();
  const due = dueFollowUps();
  const lowBalanceCount = active.filter((item) => item.type === "课时不足").length;
  const debtCount = active.filter((item) => item.type === "欠费补缴").length;
  const intentCount = active.filter((item) => item.type === "意向回访").length;
  const rows = appState.followUps
    .filter(matchesRow)
    .sort((a, b) => `${a.status === "已完成" ? 1 : 0}${a.dueDate}`.localeCompare(`${b.status === "已完成" ? 1 : 0}${b.dueDate}`))
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.student)}</strong><br><span class="muted">${escapeHtml(item.phone)}</span></td>
        <td>${tag(item.type, followUpTone(item))}</td>
        <td>${escapeHtml(item.owner)}</td>
        <td>${escapeHtml(item.dueDate)}</td>
        <td>${tag(item.status, item.status === "已完成" ? "green" : followUpTone(item))}</td>
        <td>${escapeHtml(item.result)}</td>
        <td class="follow-note">${escapeHtml(item.note)}</td>
        <td>
          <div class="follow-actions">
            <button class="small-button" type="button" data-follow-result="${item.id}" data-result="已联系">已联系</button>
            <button class="small-button" type="button" data-follow-result="${item.id}" data-result="约定缴费">约定缴费</button>
            <button class="small-button" type="button" data-follow-done="${item.id}">完成</button>
          </div>
        </td>
      </tr>`
    );

  appContent.innerHTML = `
    <div class="summary-grid">
      <div class="metric"><span>待跟进</span><strong>${active.length}</strong></div>
      <div class="metric"><span>今日到期</span><strong>${due.length}</strong></div>
      <div class="metric"><span>课时不足</span><strong>${lowBalanceCount}</strong></div>
      <div class="metric"><span>欠费/意向</span><strong>${debtCount + intentCount}</strong></div>
    </div>
    <section class="section">
      <div class="section-head">
        <div>
          <h3>续费跟进工作台</h3>
          <span class="muted">把欠费、课时不足、意向回访集中成老师每天可处理的待办。</span>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("followUp")}
        <div class="follow-layout">
          <div>
            ${renderFollowUpCards(due)}
          </div>
          ${renderFollowUpForm()}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-head compact-head"><h3>跟进记录</h3><span class="muted">支持搜索学员、手机号、跟进人和备注</span></div>
      ${table(["学员", "类型", "跟进人", "到期日", "状态", "结果", "备注", "操作"], rows)}
    </section>`;
}

function renderFollowUpCards(items) {
  const cards = items.slice(0, 4).map(
    (item) => `<div class="follow-card due">
      <strong>${escapeHtml(item.student)} ${tag(item.type, followUpTone(item))}</strong>
      <span class="muted">${escapeHtml(item.owner)} / ${escapeHtml(item.dueDate)} / ${escapeHtml(item.phone)}</span>
      <span class="follow-note">${escapeHtml(item.note)}</span>
    </div>`
  );
  return `<div class="stack-list">${cards.join("") || `<div class="follow-card"><strong>今天没有紧急跟进</strong><span class="muted">可以查看下方记录，提前处理明后天的续费沟通。</span></div>`}</div>`;
}

function renderFollowUpForm() {
  return `
    <form class="master-card" id="followUpForm">
      <h4>新增跟进</h4>
      <div class="operation-grid compact">
        <label>学员<select name="studentId" required>${studentOptions(appState.students[0]?.id || "")}</select></label>
        <label>跟进类型<select name="type">${followUpTypes.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></label>
        <label>跟进人<input name="owner" value="前台老师" required /></label>
        <label>下次跟进<input name="dueDate" type="date" value="${daysFromToday(1)}" required /></label>
        <label>跟进结果<select name="result">${followUpResults.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></label>
        <label>优先级<select name="priority"><option>中</option><option>高</option><option>低</option></select></label>
      </div>
      <label class="stack-item">备注<input name="note" placeholder="例如 家长约定周五补缴，或需要安排试听。" /></label>
      <button class="primary-action" type="submit">保存跟进</button>
    </form>`;
}

function addFollowUp(formData) {
  const student = appState.students.find((item) => item.id === formData.get("studentId"));
  if (!student) return;
  const type = text(formData.get("type"));
  const followUp = {
    id: nextId("F"),
    key: "",
    student: student.name,
    phone: student.phone,
    type,
    owner: text(formData.get("owner")).trim(),
    dueDate: text(formData.get("dueDate")),
    status: text(formData.get("result")) === "已续费" ? "已完成" : "待跟进",
    result: text(formData.get("result")),
    priority: text(formData.get("priority")),
    source: "手动新增",
    note: text(formData.get("note")).trim() || `${type}跟进记录`,
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false })
  };
  appState.followUps.unshift(followUp);
  setNotice("followUp", `${student.name} 的${type}已保存。`);
  saveState();
  setView("followUp");
}

function updateFollowUpResult(id, result, done = false) {
  const item = appState.followUps.find((followUp) => followUp.id === id);
  if (!item) return;
  item.result = result;
  item.status = done || result === "已续费" ? "已完成" : "待跟进";
  item.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  if (result === "约定缴费") item.dueDate = daysFromToday(1);
  setNotice("followUp", `${item.student} 已更新为：${result}。`);
  saveState();
  setView("followUp");
}

ensureFollowUpData();

const followUpInsertIndex = navItems.findIndex((item) => item.id === "consume");
navItems.splice(followUpInsertIndex >= 0 ? followUpInsertIndex + 1 : navItems.length - 1, 0, { id: "followUp", label: "续费跟进", icon: "续" });
viewMeta.followUp = ["续费跟进", "待办与回访"];

const baseRenderNavForFollowUp = renderNav;
renderNav = function renderNavWithFollowUpCount() {
  ensureFollowUpData();
  baseRenderNavForFollowUp();
  const countNode = navList.querySelector('[data-view="followUp"] .nav-count');
  if (countNode) countNode.textContent = activeFollowUps().length;
};

const baseRenderViewForFollowUp = renderView;
renderView = function renderViewWithFollowUp() {
  if (currentView === "followUp") {
    renderFollowUp();
    return;
  }
  baseRenderViewForFollowUp();
};

document.addEventListener("submit", (event) => {
  if (event.target.id !== "followUpForm") return;
  event.preventDefault();
  addFollowUp(new FormData(event.target));
});

document.addEventListener("click", (event) => {
  const resultButton = event.target.closest("[data-follow-result]");
  if (resultButton) updateFollowUpResult(resultButton.dataset.followResult, resultButton.dataset.result);

  const doneButton = event.target.closest("[data-follow-done]");
  if (doneButton) updateFollowUpResult(doneButton.dataset.followDone, "已完成", true);
});

saveState();
renderNav();
