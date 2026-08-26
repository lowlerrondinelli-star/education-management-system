const leadStatuses = ["新线索", "已联系", "待试听", "已试听", "已报名", "流失"];
const leadIntentions = ["高", "中", "低"];
const leadSources = ["转介绍", "入学测评", "抖音直连", "小红书直连", "招生表单", "老师介绍", "到店咨询"];

const leadStyle = document.createElement("style");
leadStyle.textContent = `
  html,body{overflow-x:hidden}
  .lead-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,.38fr);gap:14px}
  .lead-card{border:1px solid var(--line);border-radius:8px;background:#fff;padding:12px;display:grid;gap:8px}
  .lead-card.hot{border-color:#f2b8a2;background:#fff7f2}
  .lead-actions{display:flex;gap:8px;flex-wrap:wrap}
  .lead-note{line-height:1.55;white-space:normal}
  .lead-funnel{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
  .lead-funnel .metric{min-height:88px}
  @media (max-width:1180px){.lead-funnel{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media (max-width:1040px){.lead-layout{grid-template-columns:1fr}}
  @media (max-width:650px){.lead-funnel{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-actions .small-button{width:100%}}
`;
document.head.appendChild(leadStyle);

function leadToday() {
  return new Date().toISOString().slice(0, 10);
}

function leadDateOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function ensureLeadData() {
  if (!Array.isArray(appState.leads)) {
    appState.leads = [
      {
        id: "Q001",
        name: "陈若溪",
        phone: "13800010003",
        relation: "本人",
        grade: "六年级",
        school: "和平小学",
        channel: "小红书直连",
        owner: "英语-王Tony",
        course: "五六年级小组课",
        intention: "高",
        status: "待试听",
        nextFollowUp: leadToday(),
        trialAt: `${leadDateOffset(2)} 18:30-19:30`,
        result: "待试听",
        note: "家长关注小升初英语，已约试听后再确认班型。",
        createdAt: "2026-08-25 10:30",
        updatedAt: ""
      },
      {
        id: "Q002",
        name: "赵一鸣",
        phone: "13800010006",
        relation: "母亲",
        grade: "初一年级",
        school: "实验中学",
        channel: "转介绍",
        owner: "前台老师",
        course: "初一数学同步",
        intention: "中",
        status: "已联系",
        nextFollowUp: leadDateOffset(1),
        trialAt: "",
        result: "家长比价中",
        note: "同学家长介绍，想了解秋季班时间和收费。",
        createdAt: "2026-08-25 14:10",
        updatedAt: ""
      },
      {
        id: "Q003",
        name: "沈知远",
        phone: "13800010007",
        relation: "父亲",
        grade: "高一年级",
        school: "第一中学",
        channel: "入学测评",
        owner: "校长-奚老师",
        course: "高一物理提高班",
        intention: "高",
        status: "新线索",
        nextFollowUp: leadToday(),
        trialAt: "",
        result: "待联系",
        note: "测评后物理薄弱，建议先安排一节试听课。",
        createdAt: "2026-08-25 16:20",
        updatedAt: ""
      }
    ];
  }

  appState.leads.forEach((lead) => {
    if (!lead.id) lead.id = nextId("Q");
    if (!lead.status) lead.status = "新线索";
    if (!lead.intention) lead.intention = "中";
    if (!lead.nextFollowUp) lead.nextFollowUp = leadToday();
    if (!lead.createdAt) lead.createdAt = new Date().toLocaleString("zh-CN", { hour12: false });
  });
}

function leadTone(lead) {
  if (lead.status === "已报名") return "green";
  if (lead.status === "流失") return "red";
  if (lead.nextFollowUp <= leadToday()) return "red";
  if (lead.intention === "高" || lead.status === "待试听") return "amber";
  return "";
}

function activeLeads() {
  ensureLeadData();
  return appState.leads.filter((lead) => !["已报名", "流失"].includes(lead.status));
}

function leadStatusCount(status) {
  ensureLeadData();
  return appState.leads.filter((lead) => lead.status === status).length;
}

function flattenLeadRows() {
  ensureLeadData();
  return appState.leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    relation: lead.relation,
    grade: lead.grade,
    school: lead.school,
    channel: lead.channel,
    owner: lead.owner,
    course: lead.course,
    intention: lead.intention,
    status: lead.status,
    nextFollowUp: lead.nextFollowUp,
    trialAt: lead.trialAt,
    result: lead.result,
    note: lead.note,
    convertedStudentId: lead.convertedStudentId || "",
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt
  }));
}

function renderLeads() {
  ensureLeadData();
  const active = activeLeads();
  const due = active.filter((lead) => lead.nextFollowUp <= leadToday());
  const trials = active.filter((lead) => lead.status === "待试听" || lead.trialAt);
  const converted = leadStatusCount("已报名");
  const rate = appState.leads.length ? Math.round((converted / appState.leads.length) * 100) : 0;
  const hotCards = due.slice(0, 4).map(
    (lead) => `<div class="lead-card hot">
      <strong>${escapeHtml(lead.name)} ${tag(lead.status, leadTone(lead))}</strong>
      <span class="muted">${escapeHtml(lead.phone)} / ${escapeHtml(lead.grade)} / ${escapeHtml(lead.owner)}</span>
      <span class="lead-note">${escapeHtml(lead.note || lead.result || "待补充沟通记录")}</span>
    </div>`
  );
  const rows = appState.leads
    .filter(matchesRow)
    .sort((a, b) => `${a.status === "已报名" ? 1 : 0}${a.nextFollowUp}`.localeCompare(`${b.status === "已报名" ? 1 : 0}${b.nextFollowUp}`))
    .map(
      (lead) => `<tr>
        <td><strong>${escapeHtml(lead.name)}</strong><br><span class="muted">${escapeHtml(lead.phone)} / ${escapeHtml(lead.relation || "")}</span></td>
        <td>${escapeHtml(lead.grade)}<br><span class="muted">${escapeHtml(lead.school || "未填学校")}</span></td>
        <td>${escapeHtml(lead.channel)}<br><span class="muted">${escapeHtml(lead.owner)}</span></td>
        <td>${escapeHtml(lead.course)}</td>
        <td>${tag(lead.intention, lead.intention === "高" ? "amber" : "")}</td>
        <td>${tag(lead.status, leadTone(lead))}<br><span class="muted">${escapeHtml(lead.nextFollowUp || "")}</span></td>
        <td>${escapeHtml(lead.trialAt || "未安排")}</td>
        <td class="lead-note">${escapeHtml(lead.note || lead.result || "")}</td>
        <td>
          <div class="lead-actions">
            <button class="small-button" type="button" data-lead-status="${lead.id}" data-status="已联系">已联系</button>
            <button class="small-button" type="button" data-lead-trial="${lead.id}">试听</button>
            <button class="small-button" type="button" data-lead-convert="${lead.id}">转学员</button>
            <button class="small-button" type="button" data-lead-lost="${lead.id}">流失</button>
          </div>
        </td>
      </tr>`
    );

  appContent.innerHTML = `
    <div class="summary-grid">
      <div class="metric"><span>有效线索</span><strong>${active.length}</strong></div>
      <div class="metric"><span>今日跟进</span><strong>${due.length}</strong></div>
      <div class="metric"><span>待试听</span><strong>${trials.length}</strong></div>
      <div class="metric"><span>转化率</span><strong>${rate}%</strong></div>
    </div>
    <section class="section">
      <div class="section-head">
        <div>
          <h3>招生线索工作台</h3>
          <span class="muted">从咨询登记、电话跟进、试听课到转为学员，前台可按这张表推进。</span>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("leads")}
        <div class="lead-funnel">
          ${leadStatuses.map((status) => `<div class="metric"><span>${escapeHtml(status)}</span><strong>${leadStatusCount(status)}</strong></div>`).join("")}
        </div>
        <div class="lead-layout">
          <div class="stack-list">${hotCards.join("") || `<div class="lead-card"><strong>今天没有到期线索</strong><span class="muted">可以录入新咨询，或提前处理明后天待跟进的家长。</span></div>`}</div>
          ${renderLeadForm()}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-head compact-head"><h3>线索明细</h3><span class="muted">支持搜索姓名、手机号、渠道、课程和备注</span></div>
      ${table(["家长/学员", "年级学校", "渠道负责人", "意向课程", "意向度", "状态", "试听", "备注", "操作"], rows)}
    </section>`;
}

function renderLeadForm() {
  return `
    <form class="master-card" id="leadForm">
      <h4>新增线索</h4>
      <div class="operation-grid compact">
        <label>学员姓名<input name="name" required /></label>
        <label>手机号<input name="phone" required maxlength="11" /></label>
        <label>手机号归属<select name="relation"><option>母亲</option><option>父亲</option><option>本人</option><option>其他</option></select></label>
        <label>年级<select name="grade" required>${typeof gradeChoiceOptions === "function" ? gradeChoiceOptions("初一年级") : "<option>初一年级</option>"}</select></label>
        <label>学校<input name="school" placeholder="可选" /></label>
        <label>来源渠道<select name="channel">${leadSources.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></label>
        <label>负责人<select name="owner" required>${typeof ownerChoiceOptions === "function" ? ownerChoiceOptions("前台老师") : "<option>前台老师</option>"}</select></label>
        <label>意向课程<select name="course" required>${typeof courseOptions === "function" ? courseOptions("初二小组课/一对一") : "<option>数学同步课</option>"}</select></label>
        <label>意向度<select name="intention">${leadIntentions.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></label>
        <label>下次跟进<input name="nextFollowUp" type="date" value="${leadDateOffset(1)}" required /></label>
      </div>
      <label class="stack-item">备注<select name="note">${typeof leadNoteOptions === "function" ? leadNoteOptions("家长想先试听，关注价格和上课时间。") : "<option>家长想先试听，关注价格和上课时间。</option>"}</select></label>
      <button class="primary-action" type="submit">保存线索</button>
    </form>`;
}

function addLead(formData) {
  ensureLeadData();
  const phone = text(formData.get("phone")).trim();
  if (appState.leads.some((lead) => lead.phone === phone && !["已报名", "流失"].includes(lead.status))) {
    setNotice("leads", "已存在相同手机号的有效线索，请先处理原线索。", "red");
    renderView();
    return;
  }
  const lead = {
    id: nextId("Q"),
    name: text(formData.get("name")).trim(),
    phone,
    relation: text(formData.get("relation")),
    grade: text(formData.get("grade")).trim(),
    school: text(formData.get("school")).trim(),
    channel: text(formData.get("channel")),
    owner: text(formData.get("owner")).trim(),
    course: text(formData.get("course")).trim(),
    intention: text(formData.get("intention")),
    status: "新线索",
    nextFollowUp: text(formData.get("nextFollowUp")),
    trialAt: "",
    result: "待联系",
    note: text(formData.get("note")).trim(),
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    updatedAt: ""
  };
  appState.leads.unshift(lead);
  setNotice("leads", `${lead.name} 的招生线索已保存。`);
  saveState();
  setView("leads");
}

function updateLeadStatus(id, status, result = status) {
  ensureLeadData();
  const lead = appState.leads.find((item) => item.id === id);
  if (!lead) return;
  lead.status = status;
  lead.result = result;
  lead.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  if (status === "已联系") lead.nextFollowUp = leadDateOffset(1);
  if (status === "流失") lead.nextFollowUp = "";
  setNotice("leads", `${lead.name} 已更新为：${status}。`);
  saveState();
  setView("leads");
}

function leadTrialMatchedClass(lead) {
  const course = text(lead.course).trim();
  if (!course) return null;
  return (appState.classes || []).find((item) => text(item.course).trim() === course || text(item.course).includes(course) || course.includes(text(item.course)));
}

function leadTrialSubjectValue(lead) {
  const course = text(lead.course).trim();
  const matchedCourse = (appState.courses || []).find((item) => text(item.name).trim() === course || text(item.name).includes(course) || course.includes(text(item.name)));
  if (matchedCourse?.subject) return matchedCourse.subject;
  if (course.includes("语文")) return "语文";
  if (course.includes("英语")) return "英语";
  if (course.includes("物理")) return "物理";
  if (course.includes("化学")) return "化学";
  return "数学";
}

function leadTrialTeacherValue(lead) {
  const matchedClass = leadTrialMatchedClass(lead);
  if (matchedClass?.teacher) return matchedClass.teacher;
  return lead.owner || appState.teachers?.[0]?.name || "前台老师";
}

function leadTrialRoomValue(lead) {
  const matchedClass = leadTrialMatchedClass(lead);
  return matchedClass?.room || "试听教室";
}

function renderLeadTrialDialog(id) {
  ensureLeadData();
  const lead = appState.leads.find((item) => item.id === id);
  if (!lead) return;
  const [start, end] = ["18:30", "19:30"];
  document.querySelector("#attendanceDialogBody").innerHTML = `
    <form method="dialog" id="leadTrialForm">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">招生试听</p>
          <h3>安排 ${escapeHtml(lead.name)} 的试听课</h3>
        </div>
        <button class="icon-button" value="cancel" aria-label="关闭" type="submit">×</button>
      </div>
      <input type="hidden" name="leadId" value="${escapeHtml(lead.id)}" />
      <div class="form-grid">
        <label>试听日期<input name="date" type="date" value="${leadDateOffset(1)}" required /></label>
        <label>开始时间<input name="startTime" type="time" value="${start}" required /></label>
        <label>结束时间<input name="endTime" type="time" value="${end}" required /></label>
        <label>试听科目<select name="subject" required>${typeof subjectChoiceOptions === "function" ? subjectChoiceOptions(leadTrialSubjectValue(lead)) : `<option>${escapeHtml(leadTrialSubjectValue(lead))}</option>`}</select></label>
        <label>试听老师<select name="teacher" required>${typeof teacherChoiceOptions === "function" ? teacherChoiceOptions(leadTrialTeacherValue(lead)) : `<option>${escapeHtml(leadTrialTeacherValue(lead))}</option>`}</select></label>
        <label>教室<select name="room" required>${typeof roomChoiceOptions === "function" ? roomChoiceOptions(leadTrialRoomValue(lead)) : `<option>${escapeHtml(leadTrialRoomValue(lead))}</option>`}</select></label>
      </div>
      <label class="stack-item">备注<select name="note">${typeof leadTrialNoteOptions === "function" ? leadTrialNoteOptions("招生试听课，试听后回访报名意向") : "<option>招生试听课，试听后回访报名意向</option>"}</select></label>
      <div class="dialog-actions">
        <button value="cancel" type="submit">取消</button>
        <button class="primary-action" value="default" type="submit">保存试听</button>
      </div>
    </form>`;
  attendanceDialog.showModal();
}

function scheduleLeadTrial(formData) {
  ensureLeadData();
  const lead = appState.leads.find((item) => item.id === formData.get("leadId"));
  if (!lead) return;
  const date = text(formData.get("date"));
  const time = `${text(formData.get("startTime"))}-${text(formData.get("endTime"))}`;
  const lesson = {
    id: nextId("L"),
    day: dayFromDate(date),
    date,
    time,
    type: "1对1",
    target: `${lead.name}-${lead.grade}试听`,
    subject: text(formData.get("subject")).trim(),
    teacher: text(formData.get("teacher")).trim(),
    room: text(formData.get("room")).trim(),
    status: "待上课",
    deduct: 0,
    source: "招生试听",
    leadId: lead.id,
    note: text(formData.get("note")).trim()
  };
  const conflicts = findLessonConflicts(lesson);
  if (conflicts.length) {
    setNotice("leads", `试听课存在排课冲突：${conflicts.map((item) => `${item.target} ${item.time}`).join("；")}`, "red");
    attendanceDialog.close();
    renderView();
    return;
  }
  appState.lessons.unshift(lesson);
  lead.status = "待试听";
  lead.trialAt = `${date} ${time}`;
  lead.result = "已安排试听";
  lead.nextFollowUp = date;
  lead.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  setNotice("leads", `${lead.name} 已安排 ${date} ${time} 试听课。`);
  saveState();
  attendanceDialog.close();
  setView("leads");
}

function convertLeadToStudent(id) {
  ensureLeadData();
  const lead = appState.leads.find((item) => item.id === id);
  if (!lead) return;
  let student = appState.students.find((item) => item.phone === lead.phone);
  if (!student) {
    student = {
      id: nextId("S"),
      name: lead.name,
      phone: lead.phone,
      relation: lead.relation || "母亲",
      grade: lead.grade,
      school: lead.school || "",
      channel: lead.channel,
      owner: lead.owner,
      course: lead.course,
      className: "待分班",
      status: "意向",
      balance: 0,
      debt: 0
    };
    appState.students.unshift(student);
  } else {
    student.channel = student.channel || lead.channel;
    student.owner = student.owner || lead.owner;
    student.course = student.course || lead.course;
    if (student.status === "流失") student.status = "意向";
  }
  lead.status = "已报名";
  lead.result = "已转学员";
  lead.convertedStudentId = student.id;
  lead.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  lead.nextFollowUp = "";
  selectedStudentForOrder = student.id;
  setNotice("students", `${lead.name} 已转为学员档案，可继续报名缴费。`);
  saveState();
  setView("students");
}

ensureLeadData();

const leadInsertIndex = navItems.findIndex((item) => item.id === "students");
navItems.splice(leadInsertIndex >= 0 ? leadInsertIndex : 1, 0, { id: "leads", label: "招生线索", icon: "招" });
viewMeta.leads = ["招生管理", "线索与试听"];

const baseRenderNavForLeads = renderNav;
renderNav = function renderNavWithLeadCount() {
  ensureLeadData();
  baseRenderNavForLeads();
  const countNode = navList.querySelector('[data-view="leads"] .nav-count');
  if (countNode) countNode.textContent = activeLeads().length;
};

const baseRenderViewForLeads = renderView;
renderView = function renderViewWithLeads() {
  if (currentView === "leads") {
    renderLeads();
    return;
  }
  baseRenderViewForLeads();
};

if (typeof exportDataset === "function") {
  const baseExportDatasetForLeads = exportDataset;
  exportDataset = function exportDatasetWithLeads(type) {
    if (type !== "leads") {
      baseExportDatasetForLeads(type);
      return;
    }
    const columns = [
      ["id", "线索编号"],
      ["name", "学员姓名"],
      ["phone", "手机号"],
      ["relation", "手机号归属人"],
      ["grade", "年级"],
      ["school", "学校"],
      ["channel", "来源渠道"],
      ["owner", "负责人"],
      ["course", "意向课程"],
      ["intention", "意向度"],
      ["status", "线索状态"],
      ["nextFollowUp", "下次跟进"],
      ["trialAt", "试听时间"],
      ["result", "跟进结果"],
      ["note", "备注"],
      ["convertedStudentId", "转化学员编号"],
      ["createdAt", "创建时间"],
      ["updatedAt", "更新时间"]
    ].map(([key, label]) => ({ key, label }));
    downloadText("招生线索.csv", buildCsv(flattenLeadRows(), columns), "text/csv;charset=utf-8");
    setNotice("data", "招生线索.csv 已开始下载。");
    renderView();
  };
}

if (typeof renderDataCenter === "function") {
  const baseRenderDataCenterForLeads = renderDataCenter;
  renderDataCenter = function renderDataCenterWithLeads() {
    baseRenderDataCenterForLeads();
    const metricValue = [...appContent.querySelectorAll(".metric")]
      .find((item) => item.textContent.includes("数据表数量"))
      ?.querySelector("strong");
    if (metricValue) metricValue.textContent = "22";

    const dataGrid = appContent.querySelector(".data-grid");
    if (!dataGrid || dataGrid.querySelector('[data-export="leads"]')) return;
    const card = document.createElement("article");
    card.className = "data-card";
    card.innerHTML = `<div><span class="muted">招生线索</span><strong>${flattenLeadRows().length}</strong></div><button class="small-button" type="button" data-export="leads">导出线索</button>`;
    const studentCard = dataGrid.querySelector('[data-export="students"]')?.closest(".data-card");
    if (studentCard) {
      studentCard.before(card);
    } else {
      dataGrid.prepend(card);
    }
  };
}

document.addEventListener("submit", (event) => {
  if (event.target.id === "leadForm") {
    event.preventDefault();
    addLead(new FormData(event.target));
  }

  if (event.target.id === "leadTrialForm") {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    scheduleLeadTrial(new FormData(event.target));
  }
});

document.addEventListener("click", (event) => {
  const statusButton = event.target.closest("[data-lead-status]");
  if (statusButton) updateLeadStatus(statusButton.dataset.leadStatus, statusButton.dataset.status);

  const trialButton = event.target.closest("[data-lead-trial]");
  if (trialButton) renderLeadTrialDialog(trialButton.dataset.leadTrial);

  const convertButton = event.target.closest("[data-lead-convert]");
  if (convertButton) convertLeadToStudent(convertButton.dataset.leadConvert);

  const lostButton = event.target.closest("[data-lead-lost]");
  if (lostButton) updateLeadStatus(lostButton.dataset.leadLost, "流失", "暂不考虑");
});

saveState();
renderNav();
