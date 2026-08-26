const feedbackListStyle = document.createElement("style");
feedbackListStyle.textContent = `
  .feedback-list-summary {
    margin-bottom: 14px;
  }

  .feedback-filter-toolbar {
    align-items: end;
  }

  .feedback-filter-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .feedback-filter-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .feedback-record-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  @media (max-width: 650px) {
    .feedback-filter-toolbar,
    .feedback-filter-toolbar label,
    .feedback-filter-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(feedbackListStyle);

let feedbackStatusFilter = "all";
let feedbackTeacherFilter = "all";
let feedbackRiskFilter = "all";
let feedbackAttendanceFilter = "all";
let feedbackSortMode = "updatedDesc";

function feedbackLessonStatusLabel(lesson) {
  const records = lessonFeedbacks(lesson.id);
  if (records.some((item) => item.status === "已发送")) return "已发送";
  if (records.length) return "草稿";
  return "待反馈";
}

function feedbackRecordRiskTone(risk) {
  if (risk === "高") return "red";
  if (risk === "中") return "amber";
  return "green";
}

function feedbackAttendanceTone(status) {
  if (status === "到课" || status === "迟到") return "green";
  if (status === "未点名") return "red";
  return "amber";
}

function feedbackMatchesStatus(status) {
  return feedbackStatusFilter === "all" || status === feedbackStatusFilter;
}

function feedbackMatchesRisk(records) {
  if (feedbackRiskFilter === "all") return true;
  if (feedbackRiskFilter === "none") return !records.some((item) => item.risk === "中" || item.risk === "高");
  return records.some((item) => item.risk === feedbackRiskFilter);
}

function feedbackMatchesAttendance(records, lesson) {
  if (feedbackAttendanceFilter === "all") return true;
  if (records.length) return records.some((item) => item.attendanceStatus === feedbackAttendanceFilter);
  const students = feedbackLessonStudents(lesson);
  return students.some((student) => feedbackAttendanceStatus(lesson, student.id) === feedbackAttendanceFilter);
}

function feedbackLessonMatchesFilters(lesson) {
  if (!matchesRow(lesson)) return false;
  if (feedbackTeacherFilter !== "all" && lesson.teacher !== feedbackTeacherFilter) return false;
  const status = feedbackLessonStatusLabel(lesson);
  if (!feedbackMatchesStatus(status)) return false;
  const records = lessonFeedbacks(lesson.id);
  if (!feedbackMatchesRisk(records)) return false;
  return feedbackMatchesAttendance(records, lesson);
}

function feedbackRecordMatchesFilters(item) {
  if (!matchesRow(item)) return false;
  if (feedbackStatusFilter !== "all" && item.status !== feedbackStatusFilter) return false;
  if (feedbackTeacherFilter !== "all" && item.teacher !== feedbackTeacherFilter) return false;
  if (feedbackRiskFilter !== "all" && feedbackRiskFilter !== "none" && item.risk !== feedbackRiskFilter) return false;
  if (feedbackRiskFilter === "none" && (item.risk === "中" || item.risk === "高")) return false;
  if (feedbackAttendanceFilter !== "all" && item.attendanceStatus !== feedbackAttendanceFilter) return false;
  return true;
}

function feedbackSortDateValue(value) {
  const normalized = text(value).replaceAll("/", "-");
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareFeedbackRecords(left, right) {
  if (feedbackSortMode === "updatedAsc") return feedbackSortDateValue(left.updatedAt) - feedbackSortDateValue(right.updatedAt);
  if (feedbackSortMode === "student") return text(left.student).localeCompare(text(right.student), "zh-CN") || feedbackSortDateValue(right.updatedAt) - feedbackSortDateValue(left.updatedAt);
  if (feedbackSortMode === "teacher") return text(left.teacher).localeCompare(text(right.teacher), "zh-CN") || feedbackSortDateValue(right.updatedAt) - feedbackSortDateValue(left.updatedAt);
  if (feedbackSortMode === "risk") {
    const weights = { 高: 1, 中: 2, 低: 3 };
    return (weights[left.risk] || 9) - (weights[right.risk] || 9) || feedbackSortDateValue(right.updatedAt) - feedbackSortDateValue(left.updatedAt);
  }
  return feedbackSortDateValue(right.updatedAt) - feedbackSortDateValue(left.updatedAt);
}

function compareFeedbackLessons(left, right) {
  if (feedbackSortMode === "teacher") return text(left.teacher).localeCompare(text(right.teacher), "zh-CN") || compareLessonTime(left, right);
  return compareLessonTime(left, right);
}

function feedbackSelectOptions(values, selectedValue, allLabel) {
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function renderFeedbackFilterToolbar() {
  const teachers = [...new Set(appState.lessons.map((item) => item.teacher).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const attendanceStatuses = [...new Set(appState.lessonFeedbacks.map((item) => item.attendanceStatus).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));

  return `
    <div class="filters feedback-filter-toolbar">
      <label>反馈状态
        <select id="feedbackStatusFilter" aria-label="按反馈状态筛选">
          <option value="all" ${feedbackStatusFilter === "all" ? "selected" : ""}>全部状态</option>
          <option value="待反馈" ${feedbackStatusFilter === "待反馈" ? "selected" : ""}>待反馈</option>
          <option value="草稿" ${feedbackStatusFilter === "草稿" ? "selected" : ""}>草稿</option>
          <option value="已发送" ${feedbackStatusFilter === "已发送" ? "selected" : ""}>已发送</option>
        </select>
      </label>
      <label>老师
        <select id="feedbackTeacherFilter" aria-label="按老师筛选反馈">
          ${feedbackSelectOptions(teachers, feedbackTeacherFilter, "全部老师")}
        </select>
      </label>
      <label>续读风险
        <select id="feedbackRiskFilter" aria-label="按续读风险筛选">
          <option value="all" ${feedbackRiskFilter === "all" ? "selected" : ""}>全部风险</option>
          <option value="高" ${feedbackRiskFilter === "高" ? "selected" : ""}>高风险</option>
          <option value="中" ${feedbackRiskFilter === "中" ? "selected" : ""}>中风险</option>
          <option value="低" ${feedbackRiskFilter === "低" ? "selected" : ""}>低风险</option>
          <option value="none" ${feedbackRiskFilter === "none" ? "selected" : ""}>无中高风险</option>
        </select>
      </label>
      <label>考勤
        <select id="feedbackAttendanceFilter" aria-label="按考勤筛选反馈">
          ${feedbackSelectOptions(attendanceStatuses.length ? attendanceStatuses : ["未点名"], feedbackAttendanceFilter, "全部考勤")}
        </select>
      </label>
      <label>排序
        <select id="feedbackSortMode" aria-label="反馈记录排序">
          <option value="updatedDesc" ${feedbackSortMode === "updatedDesc" ? "selected" : ""}>最近更新</option>
          <option value="updatedAsc" ${feedbackSortMode === "updatedAsc" ? "selected" : ""}>最早更新</option>
          <option value="risk" ${feedbackSortMode === "risk" ? "selected" : ""}>风险优先</option>
          <option value="teacher" ${feedbackSortMode === "teacher" ? "selected" : ""}>老师分组</option>
          <option value="student" ${feedbackSortMode === "student" ? "selected" : ""}>学员分组</option>
        </select>
      </label>
    </div>`;
}

function feedbackListSummary(visibleLessons, visibleRecords) {
  const pending = visibleLessons.filter((lesson) => feedbackLessonStatusLabel(lesson) === "待反馈").length;
  const drafts = visibleRecords.filter((item) => item.status === "草稿").length;
  const sent = visibleRecords.filter((item) => item.status === "已发送").length;
  const highRisk = visibleRecords.filter((item) => item.risk === "高" && item.status !== "已发送").length;

  return `
    <div class="summary-grid compact-metrics feedback-list-summary">
      <div class="metric"><span>待反馈课节</span><strong>${pending}</strong><small>筛选范围内未留档课节</small></div>
      <div class="metric"><span>反馈草稿</span><strong>${drafts}</strong><small>需要老师继续确认发送</small></div>
      <div class="metric"><span>已发送反馈</span><strong>${sent}</strong><small>可导出留档给教务</small></div>
      <div class="metric"><span>高风险未发</span><strong>${highRisk}</strong><small>建议同步续费跟进</small></div>
    </div>`;
}

function renderFeedbackLessonCards(lessons) {
  const cards = lessons
    .filter((lesson) => feedbackLessonStatusLabel(lesson) !== "已发送")
    .slice(0, 6)
    .map((lesson) => {
      const status = feedbackLessonStatusLabel(lesson);
      return `<div class="feedback-card ${status === "待反馈" ? "warn" : ""}">
        <strong>${escapeHtml(lesson.target)} ${tag(status, feedbackLessonTone(lesson))}</strong>
        <span class="muted">${escapeHtml(lesson.date)} ${escapeHtml(lesson.time)} / ${escapeHtml(lesson.subject)} / ${escapeHtml(lesson.teacher)}</span>
        <div class="feedback-actions">
          <button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">${status === "草稿" ? "继续编辑" : "写反馈"}</button>
        </div>
      </div>`;
    });
  return cards.join("") || `<div class="feedback-card"><strong>当前筛选下没有待反馈课节</strong><span class="muted">可以切换状态或老师查看其他反馈记录。</span></div>`;
}

function renderFeedbackLessonRows(lessons) {
  return lessons.map((lesson) => {
    const status = feedbackLessonStatusLabel(lesson);
    return `<tr>
      <td>${escapeHtml(lesson.date)}<br><span class="muted">${escapeHtml(lesson.time)}</span></td>
      <td><strong>${escapeHtml(lesson.target)}</strong><br><span class="muted">${escapeHtml(lesson.type || "班级课")}</span></td>
      <td>${escapeHtml(lesson.subject)}</td>
      <td>${escapeHtml(lesson.teacher)}</td>
      <td>${tag(status, feedbackLessonTone(lesson))}</td>
      <td><button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">${status === "已发送" ? "查看/编辑" : "反馈"}</button></td>
    </tr>`;
  });
}

function renderFeedbackRecordRows(records) {
  return records.map((item) => `<tr>
    <td><strong>${escapeHtml(item.student)}</strong><br><span class="muted">${escapeHtml(item.target)}</span></td>
    <td>${escapeHtml(item.date)}<br><span class="muted">${escapeHtml(item.time)}</span></td>
    <td>${escapeHtml(item.subject)}<br><span class="muted">${escapeHtml(item.teacher)}</span></td>
    <td>${tag(item.attendanceStatus, feedbackAttendanceTone(item.attendanceStatus))}</td>
    <td>${tag(item.performance, feedbackTone(item))}<br>${tag(`风险${item.risk}`, feedbackRecordRiskTone(item.risk))}</td>
    <td class="feedback-note">${escapeHtml(item.parentMessage)}</td>
    <td>${tag(item.status, feedbackTone(item))}<br><span class="muted">${escapeHtml(item.updatedAt)}</span></td>
    <td><div class="feedback-record-actions"><button class="small-button" type="button" data-feedback-lesson="${escapeHtml(item.lessonId)}">编辑</button></div></td>
  </tr>`);
}

renderFeedback = function renderFeedbackWithFilters() {
  ensureFeedbackData();
  const completedLessons = appState.lessons
    .filter((lesson) => lesson.status === "已上课")
    .filter(feedbackLessonMatchesFilters)
    .sort(compareFeedbackLessons);
  const records = appState.lessonFeedbacks.filter(feedbackRecordMatchesFilters).sort(compareFeedbackRecords);

  appContent.innerHTML = `
    ${feedbackListSummary(completedLessons, records)}
    <section class="section">
      <div class="section-head">
        <div>
          <h3>课后反馈工作台</h3>
          <span class="muted">筛选待反馈、草稿、高风险学员，课后快速完成家长反馈留档。</span>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("feedback")}
        ${renderFeedbackFilterToolbar()}
        <div class="feedback-layout">
          <div class="stack-list">${renderFeedbackLessonCards(completedLessons)}</div>
          <div class="feedback-card">
            <strong>处理建议</strong>
            <span class="muted">先处理待反馈课节，再检查草稿和高风险学员。标记已发送后，数据中心可以导出课后反馈留档。</span>
            <span class="muted">高风险或缺勤学员，建议同步到续费跟进或请假补课。</span>
          </div>
        </div>
      </div>
    </section>
    <section class="section feedback-lessons-panel">
      <div class="section-head compact-head"><h3>课节反馈状态</h3><span class="muted">按筛选条件显示已上课节</span></div>
      ${table(["日期", "班级/对象", "科目", "教师", "反馈状态", "操作"], renderFeedbackLessonRows(completedLessons))}
    </section>
    <section class="section feedback-records-panel">
      <div class="section-head compact-head"><h3>反馈记录</h3><span class="muted">按学员留存，可导出给教务复盘</span></div>
      ${table(["学员", "课节", "科目教师", "考勤", "表现/风险", "家长话术", "状态", "操作"], renderFeedbackRecordRows(records))}
    </section>`;
};

document.addEventListener("change", (event) => {
  if (event.target.id === "feedbackStatusFilter") feedbackStatusFilter = event.target.value;
  if (event.target.id === "feedbackTeacherFilter") feedbackTeacherFilter = event.target.value;
  if (event.target.id === "feedbackRiskFilter") feedbackRiskFilter = event.target.value;
  if (event.target.id === "feedbackAttendanceFilter") feedbackAttendanceFilter = event.target.value;
  if (event.target.id === "feedbackSortMode") feedbackSortMode = event.target.value;

  if (["feedbackStatusFilter", "feedbackTeacherFilter", "feedbackRiskFilter", "feedbackAttendanceFilter", "feedbackSortMode"].includes(event.target.id) && currentView === "feedback") {
    renderView();
  }
});

if (currentView === "feedback") {
  renderView();
}
