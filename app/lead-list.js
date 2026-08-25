const leadListStyle = document.createElement("style");
leadListStyle.textContent = `
  .lead-list-summary {
    margin-bottom: 14px;
  }

  .lead-filter-toolbar {
    align-items: end;
  }

  .lead-filter-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 145px;
  }

  .lead-filter-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .lead-risk-tags,
  .lead-list-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .lead-risk-tags {
    max-width: 280px;
  }

  .lead-next-step {
    max-width: 300px;
    white-space: normal;
    line-height: 1.55;
  }

  @media (max-width: 650px) {
    .lead-filter-toolbar,
    .lead-filter-toolbar label,
    .lead-filter-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(leadListStyle);

let leadStatusFilter = "active";
let leadOwnerFilter = "all";
let leadSourceFilter = "all";
let leadIntentionFilter = "all";
let leadFollowFilter = "all";
let leadSortMode = "priority";

function leadDateOnly(value) {
  const dateText = text(value).slice(0, 10);
  const date = new Date(`${dateText}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function leadDayGap(lead) {
  const date = leadDateOnly(lead.nextFollowUp);
  const today = leadDateOnly(leadToday());
  if (!date || !today) return Infinity;
  return Math.floor((date - today) / 86400000);
}

function leadTrialDayGap(lead) {
  const date = leadDateOnly(lead.trialAt);
  const today = leadDateOnly(leadToday());
  if (!date || !today) return Infinity;
  return Math.floor((date - today) / 86400000);
}

function leadIsClosed(lead) {
  return lead.status === "已报名" || lead.status === "流失";
}

function leadRiskReasons(lead) {
  const reasons = [];
  const dayGap = leadDayGap(lead);
  const trialGap = leadTrialDayGap(lead);
  const phone = text(lead.phone).trim();

  if (lead.status === "已报名") reasons.push({ key: "converted", label: "已转化", tone: "green" });
  if (lead.status === "流失") reasons.push({ key: "lost", label: "已流失", tone: "red" });
  if (!phone || !/^1\d{10}$/.test(phone)) reasons.push({ key: "dataIssue", label: "手机号异常", tone: "red" });
  if (!text(lead.course).trim()) reasons.push({ key: "dataIssue", label: "缺意向课程", tone: "red" });

  if (!leadIsClosed(lead)) {
    if (dayGap < 0) reasons.push({ key: "overdue", label: "逾期跟进", tone: "red" });
    if (dayGap === 0) reasons.push({ key: "today", label: "今日跟进", tone: "amber" });
    if (lead.intention === "高" && !text(lead.trialAt).trim() && lead.status !== "待试听") reasons.push({ key: "trial", label: "高意向待约试听", tone: "amber" });
    if (lead.status === "待试听" && trialGap <= 0) reasons.push({ key: "trial", label: "试听待确认", tone: "amber" });
    if (!text(lead.note || lead.result).trim()) reasons.push({ key: "note", label: "缺沟通记录", tone: "amber" });
  }

  return reasons;
}

function leadHasRisk(lead, riskKey) {
  const reasons = leadRiskReasons(lead);
  if (riskKey === "all") return true;
  if (riskKey === "none") return !leadIsClosed(lead) && reasons.length === 0;
  return reasons.some((reason) => reason.key === riskKey);
}

function leadMatchesStatusFilter(lead) {
  if (leadStatusFilter === "all") return true;
  if (leadStatusFilter === "active") return !leadIsClosed(lead);
  return lead.status === leadStatusFilter;
}

function leadMatchesFollowFilter(lead) {
  if (leadFollowFilter === "all") return true;
  if (leadFollowFilter === "active") return !leadIsClosed(lead);
  if (leadFollowFilter === "converted") return lead.status === "已报名";
  if (leadFollowFilter === "lost") return lead.status === "流失";
  return leadHasRisk(lead, leadFollowFilter);
}

function leadMatchesListFilters(lead) {
  if (!matchesRow(lead)) return false;
  if (!leadMatchesStatusFilter(lead)) return false;
  if (leadOwnerFilter !== "all" && lead.owner !== leadOwnerFilter) return false;
  if (leadSourceFilter !== "all" && lead.channel !== leadSourceFilter) return false;
  if (leadIntentionFilter !== "all" && lead.intention !== leadIntentionFilter) return false;
  return leadMatchesFollowFilter(lead);
}

function leadPriorityScore(lead) {
  const weights = { dataIssue: 1, overdue: 2, today: 3, trial: 4, note: 5, lost: 8, converted: 9 };
  const scores = leadRiskReasons(lead).map((reason) => weights[reason.key] || 7);
  const base = Math.min(...scores, leadIsClosed(lead) ? 9 : 6);
  return base - (lead.intention === "高" && !leadIsClosed(lead) ? 0.3 : 0);
}

function compareLeadsForList(left, right) {
  if (leadSortMode === "followAsc") return leadDayGap(left) - leadDayGap(right) || text(left.name).localeCompare(text(right.name), "zh-CN");
  if (leadSortMode === "createdDesc") return text(right.createdAt).localeCompare(text(left.createdAt), "zh-CN");
  if (leadSortMode === "intention") {
    const rank = { 高: 1, 中: 2, 低: 3 };
    return (rank[left.intention] || 9) - (rank[right.intention] || 9) || leadDayGap(left) - leadDayGap(right);
  }
  const priorityGap = leadPriorityScore(left) - leadPriorityScore(right);
  return priorityGap || leadDayGap(left) - leadDayGap(right) || text(left.name).localeCompare(text(right.name), "zh-CN");
}

function leadUniqueOptions(rows, key, selectedValue, allLabel) {
  const values = [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function leadRiskTags(lead) {
  const reasons = leadRiskReasons(lead);
  if (!reasons.length) return tag("正常推进", "green");
  return `<div class="lead-risk-tags">${reasons.map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function leadNextStepText(lead) {
  if (lead.status === "已报名") return "已转为学员，可在学员档案继续报名缴费和分班。";
  if (lead.status === "流失") return "已标记流失，后续可按渠道复盘来源质量。";
  if (leadRiskReasons(lead).some((reason) => reason.key === "dataIssue")) return "先补齐手机号、课程等关键资料，避免跟进和转化时断档。";
  if (leadDayGap(lead) <= 0) return "今天优先联系家长，记录沟通结果并设置下一次跟进日期。";
  if (lead.intention === "高" && !lead.trialAt) return "高意向家长建议尽快安排试听，降低流失概率。";
  if (lead.status === "待试听") return "试听课后及时回访，确认报名班型、价格和上课时间。";
  return "按下次跟进日期推进，保留家长关注点和异议。";
}

function renderLeadFilterToolbar(rows) {
  return `
    <div class="filters lead-filter-toolbar">
      <label>状态
        <select id="leadStatusFilter" aria-label="按线索状态筛选">
          <option value="active" ${leadStatusFilter === "active" ? "selected" : ""}>有效线索</option>
          <option value="all" ${leadStatusFilter === "all" ? "selected" : ""}>全部状态</option>
          ${leadStatuses.map((status) => `<option value="${escapeHtml(status)}" ${leadStatusFilter === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
        </select>
      </label>
      <label>负责人
        <select id="leadOwnerFilter" aria-label="按负责人筛选">
          ${leadUniqueOptions(rows, "owner", leadOwnerFilter, "全部负责人")}
        </select>
      </label>
      <label>来源
        <select id="leadSourceFilter" aria-label="按来源渠道筛选">
          ${leadUniqueOptions(rows, "channel", leadSourceFilter, "全部来源")}
        </select>
      </label>
      <label>意向度
        <select id="leadIntentionFilter" aria-label="按意向度筛选">
          ${leadUniqueOptions(rows, "intention", leadIntentionFilter, "全部意向")}
        </select>
      </label>
      <label>待处理
        <select id="leadFollowFilter" aria-label="按线索待处理事项筛选">
          <option value="all" ${leadFollowFilter === "all" ? "selected" : ""}>全部情况</option>
          <option value="overdue" ${leadFollowFilter === "overdue" ? "selected" : ""}>逾期跟进</option>
          <option value="today" ${leadFollowFilter === "today" ? "selected" : ""}>今日跟进</option>
          <option value="trial" ${leadFollowFilter === "trial" ? "selected" : ""}>试听相关</option>
          <option value="dataIssue" ${leadFollowFilter === "dataIssue" ? "selected" : ""}>资料异常</option>
          <option value="note" ${leadFollowFilter === "note" ? "selected" : ""}>缺沟通记录</option>
          <option value="converted" ${leadFollowFilter === "converted" ? "selected" : ""}>已转化</option>
          <option value="lost" ${leadFollowFilter === "lost" ? "selected" : ""}>已流失</option>
          <option value="none" ${leadFollowFilter === "none" ? "selected" : ""}>无待处理</option>
        </select>
      </label>
      <label>排序
        <select id="leadSortMode" aria-label="线索列表排序">
          <option value="priority" ${leadSortMode === "priority" ? "selected" : ""}>优先级</option>
          <option value="followAsc" ${leadSortMode === "followAsc" ? "selected" : ""}>跟进日期升序</option>
          <option value="intention" ${leadSortMode === "intention" ? "selected" : ""}>意向度</option>
          <option value="createdDesc" ${leadSortMode === "createdDesc" ? "selected" : ""}>最新录入</option>
        </select>
      </label>
    </div>`;
}

function leadListSummary(rows, visibleRows) {
  const active = rows.filter((lead) => !leadIsClosed(lead)).length;
  const due = rows.filter((lead) => !leadIsClosed(lead) && leadDayGap(lead) <= 0).length;
  const high = rows.filter((lead) => !leadIsClosed(lead) && lead.intention === "高").length;
  const trials = rows.filter((lead) => !leadIsClosed(lead) && (lead.status === "待试听" || lead.trialAt)).length;

  return `
    <div class="summary-grid compact-metrics lead-list-summary">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${rows.length} 条线索</small></div>
      <div class="metric"><span>有效线索</span><strong>${active}</strong><small>${due} 条今天或逾期跟进</small></div>
      <div class="metric"><span>高意向</span><strong>${high}</strong><small>建议尽快安排试听或报价</small></div>
      <div class="metric"><span>试听相关</span><strong>${trials}</strong><small>试听后要及时回访转化</small></div>
    </div>`;
}

function renderLeadCardsForList(items) {
  const cards = items.slice(0, 4).map(
    (lead) => `<div class="lead-card hot">
      <strong>${escapeHtml(lead.name)} ${tag(lead.status, leadTone(lead))}</strong>
      <span class="muted">${escapeHtml(lead.phone)} / ${escapeHtml(lead.grade)} / ${escapeHtml(lead.owner)}</span>
      <span class="lead-note">${escapeHtml(leadNextStepText(lead))}</span>
    </div>`
  );
  return `<div class="stack-list">${cards.join("") || `<div class="lead-card"><strong>当前筛选下没有紧急线索</strong><span class="muted">可以切换筛选，提前处理明后天待跟进的家长。</span></div>`}</div>`;
}

function renderLeadRows(rows) {
  return rows.map((lead) => {
    const closed = leadIsClosed(lead);
    return `<tr>
      <td><strong>${escapeHtml(lead.name)}</strong><br><span class="muted">${escapeHtml(lead.phone)} / ${escapeHtml(lead.relation || "")}</span></td>
      <td>${escapeHtml(lead.grade)}<br><span class="muted">${escapeHtml(lead.school || "未填学校")}</span></td>
      <td>${escapeHtml(lead.channel)}<br><span class="muted">${escapeHtml(lead.owner)}</span></td>
      <td>${escapeHtml(lead.course || "未填课程")}</td>
      <td>${tag(lead.intention, lead.intention === "高" ? "amber" : "")}</td>
      <td>${tag(lead.status, leadTone(lead))}<br><span class="muted">${escapeHtml(lead.nextFollowUp || "无需跟进")}</span></td>
      <td>${escapeHtml(lead.trialAt || "未安排")}</td>
      <td>${leadRiskTags(lead)}</td>
      <td class="lead-next-step">${escapeHtml(leadNextStepText(lead))}</td>
      <td>
        <div class="lead-list-actions">
          <button class="small-button" type="button" data-lead-status="${escapeHtml(lead.id)}" data-status="已联系" ${closed ? "disabled" : ""}>已联系</button>
          <button class="small-button" type="button" data-lead-trial="${escapeHtml(lead.id)}" ${closed ? "disabled" : ""}>试听</button>
          <button class="small-button" type="button" data-lead-convert="${escapeHtml(lead.id)}" ${lead.status === "已报名" ? "disabled" : ""}>转学员</button>
          <button class="small-button" type="button" data-lead-lost="${escapeHtml(lead.id)}" ${closed ? "disabled" : ""}>流失</button>
        </div>
      </td>
    </tr>`;
  });
}

renderLeads = function renderLeadsWithFilters() {
  ensureLeadData();
  const rows = appState.leads.filter(matchesRow);
  const visibleRows = appState.leads.filter(leadMatchesListFilters).sort(compareLeadsForList);
  const urgentRows = visibleRows.filter((lead) => !leadIsClosed(lead) && leadPriorityScore(lead) <= 4.5);
  const converted = leadStatusCount("已报名");
  const rate = appState.leads.length ? Math.round((converted / appState.leads.length) * 100) : 0;

  appContent.innerHTML = `
    <div class="summary-grid">
      <div class="metric"><span>有效线索</span><strong>${activeLeads().length}</strong></div>
      <div class="metric"><span>今日跟进</span><strong>${rows.filter((lead) => !leadIsClosed(lead) && leadDayGap(lead) <= 0).length}</strong></div>
      <div class="metric"><span>待试听</span><strong>${rows.filter((lead) => !leadIsClosed(lead) && (lead.status === "待试听" || lead.trialAt)).length}</strong></div>
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
          ${renderLeadCardsForList(urgentRows)}
          ${renderLeadForm()}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-head">
        <div>
          <h3>线索明细</h3>
          <span class="muted">按状态、负责人、渠道、意向度和跟进节奏筛选，方便每天电话回访和试听转化。</span>
        </div>
        ${tag(`${visibleRows.length} 条`, visibleRows.length ? "green" : "amber")}
      </div>
      <div class="section-body">
        ${leadListSummary(rows, visibleRows)}
        ${renderLeadFilterToolbar(rows)}
        ${table(["家长/学员", "年级学校", "渠道负责人", "意向课程", "意向度", "状态", "试听", "待处理", "下一步", "操作"], renderLeadRows(visibleRows))}
      </div>
    </section>`;
};

document.addEventListener("change", (event) => {
  if (event.target.id === "leadStatusFilter") leadStatusFilter = event.target.value;
  if (event.target.id === "leadOwnerFilter") leadOwnerFilter = event.target.value;
  if (event.target.id === "leadSourceFilter") leadSourceFilter = event.target.value;
  if (event.target.id === "leadIntentionFilter") leadIntentionFilter = event.target.value;
  if (event.target.id === "leadFollowFilter") leadFollowFilter = event.target.value;
  if (event.target.id === "leadSortMode") leadSortMode = event.target.value;

  if (["leadStatusFilter", "leadOwnerFilter", "leadSourceFilter", "leadIntentionFilter", "leadFollowFilter", "leadSortMode"].includes(event.target.id) && currentView === "leads") {
    renderView();
  }
});

if (currentView === "leads") {
  renderView();
}
