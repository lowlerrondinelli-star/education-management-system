const classOpsStyle = document.createElement("style");
classOpsStyle.textContent = `
  .class-ops-panel {
    margin-bottom: 16px;
  }

  .class-ops-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .class-ops-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .class-ops-tags,
  .class-ops-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .class-ops-note {
    max-width: 280px;
    line-height: 1.5;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  @media (max-width: 650px) {
    .class-ops-toolbar,
    .class-ops-toolbar label,
    .class-ops-toolbar select {
      width: 100%;
    }
  }
`;
document.head.appendChild(classOpsStyle);

let classOpsActionFilter = "all";
let classOpsTeacherFilter = "all";
let classOpsSortMode = "priority";

function classOpsStudents(classItem) {
  return typeof classStudents === "function" ? classStudents(classItem) : appState.students.filter((student) => student.className === classItem.name);
}

function classOpsOrders(classItem) {
  return typeof classOrders === "function" ? classOrders(classItem) : appState.orders.filter((order) => order.className === classItem.name);
}

function classOpsLessons(classItem) {
  if (typeof classLessons === "function") return classLessons(classItem);
  return appState.lessons.filter((lesson) => lesson.target === classItem.name).sort(compareLessonTime);
}

function classOpsCapacityRate(classItem) {
  if (typeof classCapacityRate === "function") return classCapacityRate(classItem, classOpsStudents(classItem).length);
  const capacity = Number(classItem.capacity || 0);
  return capacity ? Math.round((classOpsStudents(classItem).length / capacity) * 100) : 0;
}

function classOpsDebtTotal(classItem) {
  if (typeof classDebtTotal === "function") return classDebtTotal(classItem);
  return classOpsOrders(classItem).reduce((sum, order) => sum + Number(order.debt || 0), 0);
}

function classOpsPendingLessons(classItem) {
  return classOpsLessons(classItem).filter((lesson) => lesson.status === "待上课");
}

function classOpsNextLesson(classItem) {
  const today = todayIsoDate();
  return classOpsLessons(classItem)
    .filter((lesson) => lesson.status === "待上课" && lesson.date >= today)
    .sort(compareLessonTime)[0];
}

function classOpsActions(classItem) {
  const actions = [];
  const students = classOpsStudents(classItem);
  const rate = classOpsCapacityRate(classItem);
  const debt = classOpsDebtTotal(classItem);
  const pending = classOpsPendingLessons(classItem).length;
  const capacity = Number(classItem.capacity || 0);

  if (debt > 0) actions.push({ key: "debt", label: "催缴欠费", tone: "red", priority: 1, note: `班级欠费 ${money(debt)}，建议按订单跟进补缴。` });
  if (classItem.status === "开课中" && pending === 0) actions.push({ key: "schedule", label: "补排课程", tone: "amber", priority: 2, note: "开课中但没有待上课节，需要尽快补排。", go: "schedule" });
  if (students.length === 0) actions.push({ key: "empty", label: "招生分班", tone: "amber", priority: 3, note: "班级暂无学员，适合从招生线索或学员池分班。", go: "students" });
  if (capacity && students.length >= capacity) actions.push({ key: "full", label: "停止加人", tone: "red", priority: 4, note: "已经满班，新增学员前需要开新班或扩容。" });
  if (capacity && rate >= 80 && students.length < capacity) actions.push({ key: "nearFull", label: "接近满班", tone: "amber", priority: 5, note: "容量接近上限，报名和分班前先确认座位。" });
  if (classItem.status === "招生中") actions.push({ key: "recruit", label: "招生转化", tone: "amber", priority: 6, note: "仍在招生中，建议关注线索转化和试听安排。", go: "leads" });
  if (!actions.length) actions.push({ key: "stable", label: "正常运营", tone: "green", priority: 9, note: "容量、课表和欠费状态正常，保持常规点名消课。" });

  return actions;
}

function classOpsPrimaryAction(classItem) {
  return classOpsActions(classItem).sort((left, right) => left.priority - right.priority)[0];
}

function classOpsTeacherOptions() {
  const teachers = [...new Set(appState.classes.map((classItem) => classItem.teacher).filter(Boolean))].sort((a, b) => text(a).localeCompare(text(b), "zh-CN"));
  return [
    `<option value="all" ${classOpsTeacherFilter === "all" ? "selected" : ""}>全部老师</option>`,
    ...teachers.map((teacher) => `<option value="${escapeHtml(teacher)}" ${classOpsTeacherFilter === teacher ? "selected" : ""}>${escapeHtml(teacher)}</option>`)
  ].join("");
}

function classOpsMatches(classItem) {
  if (!matchesRow(classItem)) return false;
  if (classOpsTeacherFilter !== "all" && classItem.teacher !== classOpsTeacherFilter) return false;
  if (classOpsActionFilter === "all") return true;
  return classOpsActions(classItem).some((action) => action.key === classOpsActionFilter);
}

function compareClassOps(left, right) {
  if (classOpsSortMode === "fillDesc") return classOpsCapacityRate(right) - classOpsCapacityRate(left);
  if (classOpsSortMode === "pendingDesc") return classOpsPendingLessons(right).length - classOpsPendingLessons(left).length;
  if (classOpsSortMode === "debtDesc") return classOpsDebtTotal(right) - classOpsDebtTotal(left);
  if (classOpsSortMode === "teacher") {
    const teacherGap = text(left.teacher).localeCompare(text(right.teacher), "zh-CN");
    return teacherGap || text(left.name).localeCompare(text(right.name), "zh-CN");
  }
  const priorityGap = classOpsPrimaryAction(left).priority - classOpsPrimaryAction(right).priority;
  return priorityGap || text(left.name).localeCompare(text(right.name), "zh-CN");
}

function classOpsSummary(allClasses, visibleClasses) {
  const debt = allClasses.filter((classItem) => classOpsActions(classItem).some((action) => action.key === "debt")).length;
  const schedule = allClasses.filter((classItem) => classOpsActions(classItem).some((action) => action.key === "schedule")).length;
  const capacity = allClasses.filter((classItem) => classOpsActions(classItem).some((action) => ["full", "nearFull"].includes(action.key))).length;
  const pendingLessons = allClasses.reduce((sum, classItem) => sum + classOpsPendingLessons(classItem).length, 0);

  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleClasses.length}</strong><small>全部 ${allClasses.length} 个班级</small></div>
      <div class="metric"><span>催缴/补排</span><strong>${debt + schedule}</strong><small>${debt} 个有欠费，${schedule} 个待排课</small></div>
      <div class="metric"><span>容量预警</span><strong>${capacity}</strong><small>满班或接近满班</small></div>
      <div class="metric"><span>待上课节</span><strong>${pendingLessons}</strong><small>所有班级合计</small></div>
    </div>`;
}

function renderClassOpsToolbar() {
  return `
    <div class="filters class-ops-toolbar">
      <label>行动类型
        <select id="classOpsActionFilter" aria-label="班级运营行动类型筛选">
          <option value="all" ${classOpsActionFilter === "all" ? "selected" : ""}>全部行动</option>
          <option value="debt" ${classOpsActionFilter === "debt" ? "selected" : ""}>催缴欠费</option>
          <option value="schedule" ${classOpsActionFilter === "schedule" ? "selected" : ""}>补排课程</option>
          <option value="empty" ${classOpsActionFilter === "empty" ? "selected" : ""}>招生分班</option>
          <option value="full" ${classOpsActionFilter === "full" ? "selected" : ""}>停止加人</option>
          <option value="nearFull" ${classOpsActionFilter === "nearFull" ? "selected" : ""}>接近满班</option>
          <option value="recruit" ${classOpsActionFilter === "recruit" ? "selected" : ""}>招生转化</option>
          <option value="stable" ${classOpsActionFilter === "stable" ? "selected" : ""}>正常运营</option>
        </select>
      </label>
      <label>任课老师
        <select id="classOpsTeacherFilter" aria-label="班级运营任课老师筛选">${classOpsTeacherOptions()}</select>
      </label>
      <label>排序
        <select id="classOpsSortMode" aria-label="班级运营排序">
          <option value="priority" ${classOpsSortMode === "priority" ? "selected" : ""}>处理优先级</option>
          <option value="fillDesc" ${classOpsSortMode === "fillDesc" ? "selected" : ""}>满班率降序</option>
          <option value="pendingDesc" ${classOpsSortMode === "pendingDesc" ? "selected" : ""}>待上课节降序</option>
          <option value="debtDesc" ${classOpsSortMode === "debtDesc" ? "selected" : ""}>欠费金额降序</option>
          <option value="teacher" ${classOpsSortMode === "teacher" ? "selected" : ""}>老师分组</option>
        </select>
      </label>
    </div>`;
}

function renderClassOpsTags(classItem) {
  return `<div class="class-ops-tags">${classOpsActions(classItem).map((action) => tag(action.label, action.tone)).join("")}</div>`;
}

function renderClassOpsRows(classes) {
  return classes.map((classItem) => {
    const students = classOpsStudents(classItem);
    const pending = classOpsPendingLessons(classItem);
    const nextLesson = classOpsNextLesson(classItem);
    const debt = classOpsDebtTotal(classItem);
    const primaryAction = classOpsPrimaryAction(classItem);
    return `<tr>
      <td><strong>${escapeHtml(classItem.name)}</strong><br><span class="muted">${escapeHtml(classItem.stage)} · ${escapeHtml(classItem.status)}</span></td>
      <td>${escapeHtml(classItem.teacher)}<br><span class="muted">${escapeHtml(classItem.room)}</span></td>
      <td>${students.length}/${escapeHtml(classItem.capacity)} 人<br><span class="muted">满班率 ${classOpsCapacityRate(classItem)}%</span></td>
      <td>${pending.length} 节<br><span class="muted">${nextLesson ? `${escapeHtml(nextLesson.date)} ${escapeHtml(nextLesson.time)}` : "暂无未来课节"}</span></td>
      <td>${debt ? tag(money(debt), "red") : tag("无欠费", "green")}<br><span class="muted">扣课 ${escapeHtml(classItem.deduct)} / 老师 ${escapeHtml(classItem.teacherHours)}</span></td>
      <td class="class-ops-note">${renderClassOpsTags(classItem)}<span class="muted">${escapeHtml(primaryAction.note)}</span></td>
      <td>
        <div class="class-ops-actions">
          <button class="small-button" type="button" data-class-detail="${escapeHtml(classItem.name)}">详情</button>
          <button class="small-button" type="button" data-go="schedule">排课</button>
          <button class="small-button" type="button" data-go="students">分班</button>
          <button class="small-button" type="button" data-go="orders">订单</button>
        </div>
      </td>
    </tr>`;
  });
}

function prependClassOpsPanel() {
  if (currentView !== "classes" || appContent.querySelector(".class-ops-panel")) return;
  const allClasses = appState.classes.filter(matchesRow);
  const visibleClasses = appState.classes.filter(classOpsMatches).sort(compareClassOps);

  appContent.insertAdjacentHTML(
    "afterbegin",
    `<section class="section class-ops-panel">
      <div class="section-head">
        <div>
          <h3>班级运营看板</h3>
          <span class="muted">把容量、待上课、欠费和招生状态合成可处理的班级行动清单。</span>
        </div>
        ${tag(`${visibleClasses.length} 个`, visibleClasses.length ? "amber" : "green")}
      </div>
      <div class="section-body">
        ${classOpsSummary(allClasses, visibleClasses)}
        ${renderClassOpsToolbar()}
        ${table(["班级", "老师/教室", "容量", "排课", "课时资金", "建议动作", "操作"], renderClassOpsRows(visibleClasses))}
      </div>
    </section>`
  );
}

const baseRenderClassesForOps = renderClasses;
renderClasses = function renderClassesWithOpsPanel() {
  baseRenderClassesForOps();
  prependClassOpsPanel();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "classOpsActionFilter") classOpsActionFilter = event.target.value;
  if (event.target.id === "classOpsTeacherFilter") classOpsTeacherFilter = event.target.value;
  if (event.target.id === "classOpsSortMode") classOpsSortMode = event.target.value;

  if (["classOpsActionFilter", "classOpsTeacherFilter", "classOpsSortMode"].includes(event.target.id) && currentView === "classes") {
    renderView();
  }
});

if (currentView === "classes") {
  renderView();
}
