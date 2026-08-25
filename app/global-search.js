const globalSearchStyle = document.createElement("style");
globalSearchStyle.textContent = `
  .global-search-panel {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    box-shadow: var(--shadow);
  }

  .global-search-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .global-search-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }

  .search-result-card {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px;
    background: #fff;
    display: grid;
    gap: 8px;
    align-content: start;
    min-width: 0;
  }

  .search-result-card strong,
  .search-result-card span {
    overflow-wrap: anywhere;
  }

  .search-result-meta {
    color: var(--muted);
    line-height: 1.5;
  }

  .search-result-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .search-highlight {
    background: #fff4df;
    color: #8a3a05;
    border-radius: 4px;
    padding: 0 2px;
  }
`;
document.head.appendChild(globalSearchStyle);

function searchIncludes(value, keyword) {
  return text(value).toLowerCase().includes(keyword);
}

function searchHaystack(values) {
  return values.map((value) => text(value)).join(" ").toLowerCase();
}

function highlightSearch(value, keyword) {
  const source = text(value);
  if (!keyword) return escapeHtml(source);
  const index = source.toLowerCase().indexOf(keyword);
  if (index < 0) return escapeHtml(source);
  return `${escapeHtml(source.slice(0, index))}<span class="search-highlight">${escapeHtml(source.slice(index, index + keyword.length))}</span>${escapeHtml(source.slice(index + keyword.length))}`;
}

function searchCanViewModule(viewId) {
  return typeof canAccessView !== "function" || canAccessView(viewId);
}

function searchRoleNames() {
  if (typeof authRoleNames === "function") return authRoleNames();
  return [];
}

function searchCanViewAllTeaching() {
  return searchRoleNames().some((role) => ["校长/管理员", "教务/学管师"].includes(role));
}

function searchCurrentTeacherName() {
  const employee = typeof currentAuthEmployee === "function" ? currentAuthEmployee() : null;
  if (employee?.isTeacher === "是" || text(employee?.roles).includes("教师")) return employee.name;
  return "";
}

function searchCanViewLesson(lesson) {
  if (searchCanViewAllTeaching()) return true;
  const teacherName = searchCurrentTeacherName();
  return !teacherName || lesson.teacher === teacherName;
}

function searchLessonById(lessonId) {
  return appState.lessons.find((lesson) => lesson.id === lessonId);
}

function resultCard({ type, title, meta, tags = [], actions = [] }, keyword) {
  return `<article class="search-result-card">
    <div class="global-search-summary">
      ${tag(type, "")}
      ${tags.join("")}
    </div>
    <strong>${highlightSearch(title, keyword)}</strong>
    <span class="search-result-meta">${highlightSearch(meta, keyword)}</span>
    <div class="search-result-actions">${actions.join("")}</div>
  </article>`;
}

function buildStudentSearchResults(keyword) {
  if (!searchCanViewModule("students")) return [];
  return appState.students
    .filter((student) => searchHaystack([student.name, student.phone, student.grade, student.school, student.className, student.course, student.owner, student.status]).includes(keyword))
    .map((student) => ({
      type: "学员",
      title: `${student.name} ${student.phone}`,
      meta: `${student.grade} / ${student.className} / ${student.course}`,
      tags: [tag(student.status, statusTone(student.status)), tag(`余额 ${student.balance}`, Number(student.balance) <= 3 ? "amber" : "green"), Number(student.debt || 0) > 0 ? tag(`欠费 ${money(student.debt)}`, "red") : tag("无欠费", "green")],
      actions: [
        `<button class="small-button" type="button" data-student-detail="${escapeHtml(student.id)}">详情</button>`,
        `<button class="small-button" type="button" data-student-order="${escapeHtml(student.id)}">报名</button>`,
        `<button class="small-button" type="button" data-student-class="${escapeHtml(student.id)}">分班</button>`
      ]
    }));
}

function buildOrderSearchResults(keyword) {
  if (!searchCanViewModule("orders")) return [];
  return appState.orders
    .filter((order) => searchHaystack([order.id, order.student, order.course, order.className, order.owner, order.payMethod, order.expireAt]).includes(keyword))
    .map((order) => {
      const remaining = Number(order.bought || 0) + Number(order.gift || 0) - Number(order.used || 0);
      return {
        type: "订单",
        title: `${order.student} ${order.id}`,
        meta: `${order.course} / ${order.className} / 有效期 ${order.expireAt}`,
        tags: [tag(`余额 ${remaining}`, remaining <= 3 ? "amber" : "green"), Number(order.debt || 0) > 0 ? tag(`欠费 ${money(order.debt)}`, "red") : tag("已结清", "green")],
        actions: [`<button class="small-button" type="button" data-go="orders">查看订单</button>`]
      };
    });
}

function buildClassSearchResults(keyword) {
  if (!searchCanViewModule("classes")) return [];
  return appState.classes
    .filter((item) => searchHaystack([item.name, item.course, item.teacher, item.assistant, item.room, item.stage, item.status]).includes(keyword))
    .map((item) => ({
      type: "班级",
      title: item.name,
      meta: `${item.course} / ${item.teacher} / ${item.room}`,
      tags: [tag(item.status, statusTone(item.status)), tag(`${item.students}/${item.capacity} 人`)],
      actions: [`<button class="small-button" type="button" data-go="classes">查看班级</button>`]
    }));
}

function buildLessonSearchResults(keyword) {
  if (!searchCanViewModule("schedule")) return [];
  return appState.lessons
    .filter(searchCanViewLesson)
    .filter((lesson) => searchHaystack([lesson.id, lesson.date, lesson.time, lesson.target, lesson.subject, lesson.teacher, lesson.room, lesson.status]).includes(keyword))
    .map((lesson) => ({
      type: "课节",
      title: `${lesson.target} ${lesson.date}`,
      meta: `${dayFromDate(lesson.date)} ${lesson.time} / ${lesson.subject} / ${lesson.teacher} / ${lesson.room}`,
      tags: [tag(lesson.status, statusTone(lesson.status))],
      actions: [
        `<button class="small-button" type="button" data-go="schedule">看课表</button>`,
        `<button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}">点名</button>`,
        `<button class="small-button" type="button" data-feedback-lesson="${escapeHtml(lesson.id)}">反馈</button>`
      ]
    }));
}

function buildFollowUpSearchResults(keyword) {
  if (!searchCanViewModule("followUp")) return [];
  const rows = typeof flattenFollowUpRows === "function" ? flattenFollowUpRows() : [];
  return rows
    .filter((item) => searchHaystack([item.student, item.phone, item.type, item.owner, item.status, item.result, item.note, item.dueDate]).includes(keyword))
    .map((item) => ({
      type: "跟进",
      title: `${item.student} ${item.type}`,
      meta: `${item.owner} / ${item.status} / 下次 ${item.dueDate || "-"}`,
      tags: [tag(item.priority || "普通", item.priority === "高" ? "red" : item.status === "待跟进" ? "amber" : "green")],
      actions: [`<button class="small-button" type="button" data-go="followUp">查看跟进</button>`]
    }));
}

function buildFeedbackSearchResults(keyword) {
  if (!searchCanViewModule("feedback")) return [];
  const rows = typeof flattenFeedbackRows === "function" ? flattenFeedbackRows() : [];
  return rows
    .filter((item) => {
      const lesson = searchLessonById(item.lessonId);
      return !lesson || searchCanViewLesson(lesson);
    })
    .filter((item) => searchHaystack([item.student, item.target, item.subject, item.teacher, item.performance, item.parentMessage, item.risk, item.status]).includes(keyword))
    .map((item) => ({
      type: "反馈",
      title: `${item.student} ${item.subject}`,
      meta: `${item.target} / ${item.teacher} / ${item.parentMessage}`,
      tags: [tag(item.status, item.status === "已发送" ? "green" : "amber"), tag(`风险${item.risk}`, item.risk === "高" ? "red" : item.risk === "中" ? "amber" : "green")],
      actions: [`<button class="small-button" type="button" data-feedback-lesson="${escapeHtml(item.lessonId)}">编辑反馈</button>`]
    }));
}

function buildLeadSearchResults(keyword) {
  if (!searchCanViewModule("leads")) return [];
  const rows = typeof flattenLeadRows === "function" ? flattenLeadRows() : appState.leads || [];
  return rows
    .filter((item) => searchHaystack([item.name, item.student, item.phone, item.grade, item.course, item.owner, item.status, item.source, item.note]).includes(keyword))
    .map((item) => ({
      type: "线索",
      title: item.name || item.student,
      meta: `${item.phone || "-"} / ${item.grade || "-"} / ${item.course || "-"} / ${item.owner || "-"}`,
      tags: [tag(item.status || "线索", statusTone(item.status))],
      actions: [`<button class="small-button" type="button" data-go="leads">查看线索</button>`]
    }));
}

function buildLeaveSearchResults(keyword) {
  if (!searchCanViewModule("leaves")) return [];
  const rows = typeof flattenLeaveRows === "function" ? flattenLeaveRows() : appState.leaveRequests || [];
  return rows
    .filter((item) => {
      const lesson = searchLessonById(item.lessonId);
      return !lesson || searchCanViewLesson(lesson);
    })
    .filter((item) => searchHaystack([item.student, item.target, item.lessonDate, item.lessonTime, item.leaveType, item.reason, item.status, item.operator]).includes(keyword))
    .map((item) => ({
      type: "请假",
      title: `${item.student} ${item.status}`,
      meta: `${item.lessonDate || "-"} ${item.lessonTime || ""} / ${item.target || "-"} / ${item.reason || item.makeupPlan || "-"}`,
      tags: [tag(item.leaveType || "请假", ""), tag(item.status || "待处理", statusTone(item.status))],
      actions: [`<button class="small-button" type="button" data-go="leaves">查看请假</button>`]
    }));
}

function buildGlobalSearchResults(keyword) {
  return [
    ...buildStudentSearchResults(keyword),
    ...buildOrderSearchResults(keyword),
    ...buildClassSearchResults(keyword),
    ...buildLessonSearchResults(keyword),
    ...buildFollowUpSearchResults(keyword),
    ...buildFeedbackSearchResults(keyword),
    ...buildLeadSearchResults(keyword),
    ...buildLeaveSearchResults(keyword)
  ];
}

function renderGlobalSearchPanel() {
  const keyword = text(searchTerm).trim().toLowerCase();
  if (!keyword) return "";
  const results = buildGlobalSearchResults(keyword);
  const visibleResults = results.slice(0, 12);
  return `
    <section class="global-search-panel">
      <div class="section-head">
        <div>
          <h3>全局搜索结果</h3>
          <span class="muted">已按当前账号权限在可访问数据中查找。</span>
        </div>
        <span>${tag(`${results.length} 条`, results.length ? "green" : "amber")}</span>
      </div>
      <div class="section-body">
        <div class="global-search-grid">
          ${visibleResults.map((item) => resultCard(item, keyword)).join("") || `<div class="stack-item"><strong>没有找到相关数据</strong><span class="muted">可以换手机号、姓名、班级、老师、课程名称再试。</span></div>`}
        </div>
        ${results.length > visibleResults.length ? `<div class="notice amber">只显示前 ${visibleResults.length} 条，请输入更精确的关键词。</div>` : ""}
      </div>
    </section>`;
}

const baseRenderViewForGlobalSearch = renderView;
renderView = function renderViewWithGlobalSearch() {
  baseRenderViewForGlobalSearch();
  const panel = renderGlobalSearchPanel();
  if (panel) appContent.insertAdjacentHTML("afterbegin", panel);
};
