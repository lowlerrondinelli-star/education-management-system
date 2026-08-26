const leadStatuses = ["新线索", "已联系", "待试听", "已试听", "已报名", "流失"];
const leadIntentions = ["高", "中", "低"];
const leadSources = ["转介绍", "入学测评", "抖音直连", "小红书直连", "招生表单", "老师介绍", "到店咨询"];

const leadStyle = document.createElement("style");
leadStyle.textContent = `
  html,body{overflow-x:hidden}
  .lead-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,.38fr);gap:14px;min-width:0}
  .lead-card{border:1px solid var(--line);border-radius:8px;background:#fff;padding:12px;display:grid;gap:8px;min-width:0}
  .lead-card.hot{border-color:#f2b8a2;background:#fff7f2}
  .lead-actions{display:flex;gap:8px;flex-wrap:wrap}
  .lead-note{line-height:1.55;white-space:normal}
  .lead-funnel{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
  .lead-funnel .metric{min-height:88px}
  @media (max-width:1180px){.lead-funnel{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media (max-width:1040px){.lead-layout{grid-template-columns:minmax(0,1fr)}}
  @media (max-width:650px){.lead-funnel{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-actions .small-button{width:100%}}
`;
document.head.appendChild(leadStyle);

function leadToday() {
  return typeof todayIsoDate === "function" ? todayIsoDate() : localLeadDate(new Date());
}

function localLeadDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function leadDateOffset(offset) {
  const date = new Date(`${leadToday()}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return localLeadDate(date);
}

function nextLeadWeekday(weekday) {
  const date = new Date(`${leadToday()}T00:00:00`);
  const offset = (weekday - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + offset);
  return localLeadDate(date);
}

function leadFollowUpDatePresets() {
  return {
    today: { label: `今天 ${leadToday()}`, date: leadToday() },
    tomorrow: { label: `明天 ${leadDateOffset(1)}`, date: leadDateOffset(1) },
    threeDays: { label: `三天后 ${leadDateOffset(3)}`, date: leadDateOffset(3) },
    week: { label: `一周后 ${leadDateOffset(7)}`, date: leadDateOffset(7) },
    nextMonday: { label: `下周一 ${nextLeadWeekday(1)}`, date: nextLeadWeekday(1) },
    custom: { label: "自定义日期", date: "" }
  };
}

function leadTrialDatePresets() {
  return {
    tomorrow: { label: `明天 ${leadDateOffset(1)}`, date: leadDateOffset(1) },
    threeDays: { label: `三天后 ${leadDateOffset(3)}`, date: leadDateOffset(3) },
    saturday: { label: `最近周六 ${nextLeadWeekday(6)}`, date: nextLeadWeekday(6) },
    week: { label: `一周后 ${leadDateOffset(7)}`, date: leadDateOffset(7) },
    nextMonday: { label: `下周一 ${nextLeadWeekday(1)}`, date: nextLeadWeekday(1) },
    custom: { label: "自定义日期", date: "" }
  };
}

function leadDatePresetOptions(presets, selectedValue) {
  return Object.entries(presets)
    .map(([key, item]) => `<option value="${escapeHtml(key)}" ${key === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function applyLeadDatePreset(form, presetName, inputName, presets) {
  const preset = presets[form?.elements?.[presetName]?.value];
  if (!preset?.date) return;
  if (form.elements[inputName]) form.elements[inputName].value = preset.date;
}

function leadScenarioPresets() {
  return {
    referralTrial: {
      label: "转介绍试听咨询",
      relation: "母亲",
      grade: "初一年级",
      school: "实验中学",
      channel: "转介绍",
      owner: "前台老师",
      course: "初二小组课/一对一",
      intention: "高",
      nextFollowUpPreset: "today",
      note: "同学家长介绍，建议优先安排测评。"
    },
    walkInHot: {
      label: "到店高意向报名",
      relation: "母亲",
      grade: "初二年级",
      school: "暂未确定",
      channel: "到店咨询",
      owner: "前台老师",
      course: "初二小组课/一对一",
      intention: "高",
      nextFollowUpPreset: "tomorrow",
      note: "高意向咨询，建议当天邀约试听。"
    },
    onlineNurture: {
      label: "线上咨询待培养",
      relation: "母亲",
      grade: "初一年级",
      school: "校外/待确认",
      channel: "小红书直连",
      owner: "前台老师",
      course: "初一数学同步",
      intention: "中",
      nextFollowUpPreset: "threeDays",
      note: "家长关注班型和上课时间，需电话回访。"
    },
    assessmentInvite: {
      label: "测评后邀约试听",
      relation: "父亲",
      grade: "高一年级",
      school: "第一中学",
      channel: "入学测评",
      owner: "校长-奚老师",
      course: "高一物理提高班",
      intention: "高",
      nextFollowUpPreset: "today",
      note: "学生基础薄弱，建议先做入学测评。"
    },
    priceCompare: {
      label: "比价观望跟进",
      relation: "母亲",
      grade: "初二年级",
      school: "暂未确定",
      channel: "招生表单",
      owner: "前台老师",
      course: "初二小组课/一对一",
      intention: "低",
      nextFollowUpPreset: "week",
      note: "家长比价中，需同步课程优势和优惠政策。"
    }
  };
}

function leadScenarioOptions(selectedValue = "referralTrial") {
  return Object.entries(leadScenarioPresets())
    .map(([key, item]) => `<option value="${escapeHtml(key)}" ${key === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function leadSamplePresets() {
  return {
    referral: {
      label: "转介绍：初一数学高意向",
      scenario: "referralTrial",
      name: "顾安然",
      phone: "13900010910",
      relation: "母亲",
      grade: "初一年级",
      school: "实验中学",
      channel: "转介绍",
      owner: "前台老师",
      course: "初二小组课/一对一",
      intention: "高",
      nextFollowUpPreset: "today",
      note: "同学家长介绍，建议优先安排测评。"
    },
    walkIn: {
      label: "到店：初二小组课咨询",
      scenario: "walkInHot",
      name: "唐可然",
      phone: "13900010911",
      relation: "母亲",
      grade: "初二年级",
      school: "暂未确定",
      channel: "到店咨询",
      owner: "前台老师",
      course: "初二小组课/一对一",
      intention: "高",
      nextFollowUpPreset: "tomorrow",
      note: "高意向咨询，建议当天邀约试听。"
    },
    online: {
      label: "线上：小红书待培养",
      scenario: "onlineNurture",
      name: "林沐阳",
      phone: "13900010912",
      relation: "母亲",
      grade: "初一年级",
      school: "校外/待确认",
      channel: "小红书直连",
      owner: "前台老师",
      course: "初一数学同步",
      intention: "中",
      nextFollowUpPreset: "threeDays",
      note: "家长关注班型和上课时间，需电话回访。"
    },
    assessment: {
      label: "测评：高一物理试听",
      scenario: "assessmentInvite",
      name: "沈知远",
      phone: "13900010913",
      relation: "父亲",
      grade: "高一年级",
      school: "第一中学",
      channel: "入学测评",
      owner: "校长-奚老师",
      course: "高一物理提高班",
      intention: "高",
      nextFollowUpPreset: "today",
      note: "学生基础薄弱，建议先做入学测评。"
    },
    priceCompare: {
      label: "表单：比价观望",
      scenario: "priceCompare",
      name: "许嘉禾",
      phone: "13900010914",
      relation: "母亲",
      grade: "初二年级",
      school: "暂未确定",
      channel: "招生表单",
      owner: "前台老师",
      course: "初二小组课/一对一",
      intention: "低",
      nextFollowUpPreset: "week",
      note: "家长比价中，需同步课程优势和优惠政策。"
    }
  };
}

function leadSampleOptions(selectedValue = "referral") {
  return Object.entries(leadSamplePresets())
    .map(([key, item]) => `<option value="${escapeHtml(key)}" ${key === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function leadIntentionOptions(selectedValue = "高") {
  return leadIntentions.map((item) => `<option value="${escapeHtml(item)}" ${item === selectedValue ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
}

function leadFormDefaults(scenario) {
  return leadScenarioPresets()[scenario] || leadScenarioPresets().referralTrial;
}

function setLeadChoice(select, builder, value) {
  if (!select) return;
  select.innerHTML = builder(value);
  select.value = value;
}

function applyLeadScenario(form, scenario) {
  if (!form) return;
  const defaults = leadFormDefaults(scenario);
  setLeadChoice(form.elements.relation, typeof relationChoiceOptions === "function" ? relationChoiceOptions : (value) => `<option>${escapeHtml(value)}</option>`, defaults.relation);
  setLeadChoice(form.elements.grade, typeof gradeChoiceOptions === "function" ? gradeChoiceOptions : (value) => `<option>${escapeHtml(value)}</option>`, defaults.grade);
  setLeadChoice(form.elements.school, typeof schoolChoiceOptions === "function" ? schoolChoiceOptions : (value) => `<option>${escapeHtml(value)}</option>`, defaults.school);
  setLeadChoice(form.elements.channel, typeof channelChoiceOptions === "function" ? channelChoiceOptions : (value) => `<option>${escapeHtml(value)}</option>`, defaults.channel);
  setLeadChoice(form.elements.owner, typeof ownerChoiceOptions === "function" ? ownerChoiceOptions : (value) => `<option>${escapeHtml(value)}</option>`, defaults.owner);
  setLeadChoice(form.elements.course, typeof courseOptions === "function" ? courseOptions : (value) => `<option>${escapeHtml(value)}</option>`, defaults.course);
  setLeadChoice(form.elements.intention, leadIntentionOptions, defaults.intention);
  setLeadChoice(form.elements.note, typeof leadNoteOptions === "function" ? leadNoteOptions : (value) => `<option>${escapeHtml(value)}</option>`, defaults.note);
  if (form.elements.nextFollowUpPreset) {
    form.elements.nextFollowUpPreset.innerHTML = leadDatePresetOptions(leadFollowUpDatePresets(), defaults.nextFollowUpPreset);
    applyLeadDatePreset(form, "nextFollowUpPreset", "nextFollowUp", leadFollowUpDatePresets());
  }
}

function applyLeadSample(form, sampleKey) {
  if (!form) return;
  const sample = leadSamplePresets()[sampleKey] || leadSamplePresets().referral;
  if (form.elements.scenario) {
    form.elements.scenario.innerHTML = leadScenarioOptions(sample.scenario);
    form.elements.scenario.value = sample.scenario;
  }
  if (form.elements.name) form.elements.name.value = sample.name;
  if (form.elements.phone) form.elements.phone.value = sample.phone;
  setLeadChoice(form.elements.relation, typeof relationChoiceOptions === "function" ? relationChoiceOptions : (value) => `<option>${escapeHtml(value)}</option>`, sample.relation);
  setLeadChoice(form.elements.grade, typeof gradeChoiceOptions === "function" ? gradeChoiceOptions : (value) => `<option>${escapeHtml(value)}</option>`, sample.grade);
  setLeadChoice(form.elements.school, typeof schoolChoiceOptions === "function" ? schoolChoiceOptions : (value) => `<option>${escapeHtml(value)}</option>`, sample.school);
  setLeadChoice(form.elements.channel, typeof channelChoiceOptions === "function" ? channelChoiceOptions : (value) => `<option>${escapeHtml(value)}</option>`, sample.channel);
  setLeadChoice(form.elements.owner, typeof ownerChoiceOptions === "function" ? ownerChoiceOptions : (value) => `<option>${escapeHtml(value)}</option>`, sample.owner);
  setLeadChoice(form.elements.course, typeof courseOptions === "function" ? courseOptions : (value) => `<option>${escapeHtml(value)}</option>`, sample.course);
  setLeadChoice(form.elements.intention, leadIntentionOptions, sample.intention);
  setLeadChoice(form.elements.note, typeof leadNoteOptions === "function" ? leadNoteOptions : (value) => `<option>${escapeHtml(value)}</option>`, sample.note);
  if (form.elements.nextFollowUpPreset) {
    form.elements.nextFollowUpPreset.innerHTML = leadDatePresetOptions(leadFollowUpDatePresets(), sample.nextFollowUpPreset);
    form.elements.nextFollowUpPreset.value = sample.nextFollowUpPreset;
    applyLeadDatePreset(form, "nextFollowUpPreset", "nextFollowUp", leadFollowUpDatePresets());
  }
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
  const defaults = leadSamplePresets().referral;
  return `
    <form class="master-card" id="leadForm">
      <h4>新增线索</h4>
      <div class="operation-grid compact">
        <label>咨询样例<select name="leadSample">${leadSampleOptions("referral")}</select></label>
        <label>咨询场景模板<select name="scenario">${leadScenarioOptions(defaults.scenario)}</select></label>
        <label>学员姓名<input name="name" value="${escapeHtml(defaults.name)}" required /></label>
        <label>手机号<input name="phone" value="${escapeHtml(defaults.phone)}" required maxlength="11" /></label>
        <label>手机号归属<select name="relation">${typeof relationChoiceOptions === "function" ? relationChoiceOptions(defaults.relation) : `<option>${escapeHtml(defaults.relation)}</option>`}</select></label>
        <label>年级<select name="grade" required>${typeof gradeChoiceOptions === "function" ? gradeChoiceOptions(defaults.grade) : `<option>${escapeHtml(defaults.grade)}</option>`}</select></label>
        <label>学校<select name="school">${typeof schoolChoiceOptions === "function" ? schoolChoiceOptions(defaults.school) : `<option>${escapeHtml(defaults.school)}</option>`}</select></label>
        <label>来源渠道<select name="channel">${typeof channelChoiceOptions === "function" ? channelChoiceOptions(defaults.channel) : leadSources.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></label>
        <label>负责人<select name="owner" required>${typeof ownerChoiceOptions === "function" ? ownerChoiceOptions(defaults.owner) : `<option>${escapeHtml(defaults.owner)}</option>`}</select></label>
        <label>意向课程<select name="course" required>${typeof courseOptions === "function" ? courseOptions(defaults.course) : `<option>${escapeHtml(defaults.course)}</option>`}</select></label>
        <label>意向度<select name="intention">${leadIntentionOptions(defaults.intention)}</select></label>
        <label>跟进日期模板<select name="nextFollowUpPreset">${leadDatePresetOptions(leadFollowUpDatePresets(), defaults.nextFollowUpPreset)}</select></label>
        <label>下次跟进<input name="nextFollowUp" type="date" value="${leadToday()}" required /></label>
      </div>
      <label class="stack-item">备注<select name="note">${typeof leadNoteOptions === "function" ? leadNoteOptions(defaults.note) : `<option>${escapeHtml(defaults.note)}</option>`}</select></label>
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

function leadTextMatchesSubject(value, subject) {
  return !subject || text(value).includes(subject);
}

function leadTrialMatchedClass(lead, subject = "") {
  const course = text(lead.course).trim();
  const classes = appState.classes || [];
  const courseMatched = course
    ? classes.find(
        (item) =>
          (text(item.course).trim() === course || text(item.course).includes(course) || course.includes(text(item.course))) &&
          leadTextMatchesSubject(`${item.course} ${item.name}`, subject)
      )
    : null;
  if (courseMatched) return courseMatched;
  if (!subject) return null;
  return classes.find((item) => leadTextMatchesSubject(`${item.course} ${item.name}`, subject)) || null;
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

function leadTrialTeacherValue(lead, subject = leadTrialSubjectValue(lead)) {
  const matchedClass = leadTrialMatchedClass(lead, subject);
  if (matchedClass?.teacher) return matchedClass.teacher;
  const grade = text(lead.grade);
  const matchedTeacher = (appState.teachers || []).find((teacher) => {
    if (teacher.status === "离职") return false;
    const subjects = text(teacher.subjects);
    const grades = text(teacher.grades);
    const subjectMatched = !subject || subjects.includes(subject) || text(teacher.name).includes(subject);
    const gradeMatched = !grade || !grades || grades.includes(grade.replace("年级", "")) || grade.includes(grades.replace("年级", ""));
    return subjectMatched && gradeMatched;
  });
  if (matchedTeacher?.name) return matchedTeacher.name;
  return lead.owner || appState.teachers?.[0]?.name || "前台老师";
}

function leadTrialRoomValue(lead, subject = leadTrialSubjectValue(lead)) {
  const matchedClass = leadTrialMatchedClass(lead, subject);
  if (matchedClass?.room) return matchedClass.room;
  const course = (appState.courses || []).find((item) => item.name === lead.course);
  const onlineRoom = (appState.rooms || []).find((room) => room.name === "线上课程");
  if (course?.mode === "线上" && onlineRoom) return onlineRoom.name;
  const matchedRoom = (appState.rooms || []).find((room) => {
    if (room.status !== "可排课") return false;
    const source = `${room.name} ${room.note} ${room.type}`;
    return leadTextMatchesSubject(source, subject) || source.includes("一对一") || source.includes("备用");
  });
  return matchedRoom?.name || "试听教室";
}

function syncLeadTrialSubjectDefaults(form) {
  const lead = appState.leads.find((item) => item.id === form?.elements?.leadId?.value);
  if (!lead) return;
  const subject = form.elements.subject?.value || leadTrialSubjectValue(lead);
  setChoiceField(form.elements.teacher, leadTrialTeacherValue(lead, subject), typeof teacherChoiceOptions === "function" ? teacherChoiceOptions : null);
  setChoiceField(form.elements.room, leadTrialRoomValue(lead, subject), typeof roomChoiceOptions === "function" ? roomChoiceOptions : null);
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
        <label>试听日期模板<select name="trialDatePreset">${leadDatePresetOptions(leadTrialDatePresets(), "tomorrow")}</select></label>
        <label>试听日期<input name="date" type="date" value="${leadDateOffset(1)}" required /></label>
        <label>试听时间段<select name="timeSlot">${typeof lessonTimeSlotOptions === "function" ? lessonTimeSlotOptions("18:30-19:30") : "<option value=\"18:30-19:30\">试听 18:30-19:30</option>"}</select></label>
        <label>开始时间<input name="startTime" type="time" value="${start}" required /></label>
        <label>结束时间<input name="endTime" type="time" value="${end}" required /></label>
        <label>试听科目<select name="subject" required>${typeof subjectChoiceOptions === "function" ? subjectChoiceOptions(leadTrialSubjectValue(lead)) : `<option>${escapeHtml(leadTrialSubjectValue(lead))}</option>`}</select></label>
        <label>试听老师<select name="teacher" required>${typeof teacherChoiceOptions === "function" ? teacherChoiceOptions(leadTrialTeacherValue(lead, leadTrialSubjectValue(lead))) : `<option>${escapeHtml(leadTrialTeacherValue(lead, leadTrialSubjectValue(lead)))}</option>`}</select></label>
        <label>教室<select name="room" required>${typeof roomChoiceOptions === "function" ? roomChoiceOptions(leadTrialRoomValue(lead, leadTrialSubjectValue(lead))) : `<option>${escapeHtml(leadTrialRoomValue(lead, leadTrialSubjectValue(lead)))}</option>`}</select></label>
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

document.addEventListener("change", (event) => {
  if (event.target.name === "leadSample" && event.target.closest("#leadForm")) {
    applyLeadSample(event.target.form, event.target.value);
  }

  if (event.target.name === "scenario" && event.target.closest("#leadForm")) {
    applyLeadScenario(event.target.form, event.target.value);
  }

  if (event.target.name === "nextFollowUpPreset" && event.target.closest("#leadForm")) {
    applyLeadDatePreset(event.target.form, "nextFollowUpPreset", "nextFollowUp", leadFollowUpDatePresets());
  }

  if (event.target.name === "trialDatePreset" && event.target.closest("#leadTrialForm")) {
    applyLeadDatePreset(event.target.form, "trialDatePreset", "date", leadTrialDatePresets());
  }

  if (event.target.name === "subject" && event.target.closest("#leadTrialForm")) {
    syncLeadTrialSubjectDefaults(event.target.form);
  }
});

saveState();
renderNav();
