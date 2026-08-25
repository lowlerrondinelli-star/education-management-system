const scheduleResourceStyle = document.createElement("style");
scheduleResourceStyle.textContent = `
  .schedule-resource-panel {
    margin-top: 16px;
  }

  .schedule-resource-toolbar {
    align-items: end;
  }

  .schedule-resource-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .schedule-resource-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .resource-usage-bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    min-width: 140px;
  }

  .resource-usage-track {
    height: 8px;
    border-radius: 999px;
    background: #e5e7eb;
    overflow: hidden;
  }

  .resource-usage-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #2f7d5b;
  }

  .resource-usage-fill.warn {
    background: #d97706;
  }

  .resource-usage-fill.danger {
    background: #c2410c;
  }

  .resource-slot-strip {
    display: grid;
    grid-template-columns: repeat(7, minmax(34px, 1fr));
    gap: 4px;
    min-width: 260px;
  }

  .resource-slot {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 5px 4px;
    text-align: center;
    background: #f8fafc;
    display: grid;
    gap: 2px;
  }

  .resource-slot.busy {
    border-color: #a7d7bd;
    background: #eef8f1;
  }

  .resource-slot.conflict {
    border-color: #f2b8a2;
    background: #fff7f2;
  }

  .resource-slot span {
    color: var(--muted);
    font-size: 11px;
  }

  .resource-slot strong {
    font-size: 13px;
  }

  .resource-risk-tags,
  .resource-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .resource-note {
    max-width: 330px;
    line-height: 1.55;
    white-space: normal;
  }

  @media (max-width: 650px) {
    .schedule-resource-toolbar,
    .schedule-resource-toolbar label,
    .schedule-resource-toolbar select {
      width: 100%;
    }

    .resource-slot-strip {
      min-width: 360px;
    }
  }
`;
document.head.appendChild(scheduleResourceStyle);

let scheduleResourceKind = "teachers";
let scheduleResourceRange = "next14";
let scheduleResourceRisk = "all";
let scheduleResourceSort = "loadDesc";

function scheduleResourceDateFromIso(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function scheduleResourceAddDays(value, offset) {
  const date = scheduleResourceDateFromIso(value);
  if (!date) return value;
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function scheduleResourceRangeDays() {
  if (scheduleResourceRange === "next7") return 7;
  if (scheduleResourceRange === "next30") return 30;
  return 14;
}

function scheduleResourceDates() {
  const start = todayIsoDate();
  const nearDates = Array.from({ length: 2 }, (_, index) => scheduleResourceAddDays(start, index));
  const busyDates = [...new Set(appState.lessons.filter(scheduleResourceInRange).map((lesson) => lesson.date).filter(Boolean))].sort();
  const dates = [...new Set([...nearDates, ...busyDates])].sort();
  if (dates.length >= 7) return dates.slice(0, 7);
  const fillDates = Array.from({ length: 7 }, (_, index) => scheduleResourceAddDays(start, index));
  return [...new Set([...dates, ...fillDates])].sort().slice(0, 7);
}

function scheduleResourceInRange(lesson) {
  if (scheduleResourceRange === "all") return true;
  const today = scheduleResourceDateFromIso(todayIsoDate());
  const date = scheduleResourceDateFromIso(lesson.date);
  if (!today || !date) return true;
  const diff = Math.floor((date - today) / 86400000);
  return diff >= 0 && diff < scheduleResourceRangeDays();
}

function scheduleResourceLessonHours(lesson) {
  if (typeof lessonDurationHours === "function") return lessonDurationHours(lesson);
  const range = typeof lessonRangeMinutes === "function" ? lessonRangeMinutes(lesson) : parseTimeRange(lesson.time);
  if (![range.start, range.end].every(Number.isFinite) || range.end <= range.start) return Number(lesson.teacherHours || 1);
  return Math.round(((range.end - range.start) / 60) * 10) / 10;
}

function scheduleResourceCatalog(kind) {
  if (kind === "rooms") {
    const roomMap = new Map((appState.rooms || []).map((room) => [room.name, room]));
    for (const lesson of appState.lessons) {
      if (lesson.room && !roomMap.has(lesson.room)) roomMap.set(lesson.room, { name: lesson.room, status: "可排课", capacity: "" });
    }
    return [...roomMap.values()].map((item) => ({
      kind: "rooms",
      name: item.name,
      status: item.status || "可排课",
      capacity: Number(item.capacity || 0),
      meta: item.type || item.note || "教室资源"
    }));
  }

  const teacherMap = new Map((appState.teachers || []).map((teacher) => [teacher.name, teacher]));
  for (const lesson of appState.lessons) {
    if (lesson.teacher && !teacherMap.has(lesson.teacher)) teacherMap.set(lesson.teacher, { name: lesson.teacher, status: "在职", weeklyHours: "" });
  }
  return [...teacherMap.values()].map((item) => ({
    kind: "teachers",
    name: item.name,
    status: item.status || "在职",
    weeklyHours: Number(item.weeklyHours || 0),
    meta: [item.subjects || item.subject, item.grades || item.grade].filter(Boolean).join(" / ") || item.phone || "教师资源"
  }));
}

function scheduleResourceLessonsFor(resource) {
  const key = resource.kind === "rooms" ? "room" : "teacher";
  return appState.lessons
    .filter((lesson) => lesson[key] === resource.name && scheduleResourceInRange(lesson))
    .sort(compareLessonTime);
}

function scheduleResourceConflictCount(resource) {
  if (typeof scheduleConflictPairs !== "function") return 0;
  return scheduleConflictPairs().filter((item) => {
    const key = resource.kind === "rooms" ? "room" : "teacher";
    return item.first[key] === resource.name || item.second[key] === resource.name;
  }).length;
}

function scheduleResourceRows() {
  return scheduleResourceCatalog(scheduleResourceKind).map((resource) => {
    const lessons = scheduleResourceLessonsFor(resource);
    const pending = lessons.filter((lesson) => lesson.status === "待上课").length;
    const hours = lessons.reduce((sum, lesson) => sum + scheduleResourceLessonHours(lesson), 0);
    const conflictCount = scheduleResourceConflictCount(resource);
    const denominator = resource.kind === "teachers" ? resource.weeklyHours || Math.max(hours, 1) : Math.max(lessons.length, 1);
    const usageRate = Math.round((hours / denominator) * 100);
    return {
      ...resource,
      lessons,
      pending,
      hours,
      conflictCount,
      usageRate,
      nextLesson: lessons.find((lesson) => lesson.status === "待上课") || lessons[0]
    };
  });
}

function scheduleResourceRiskReasons(row) {
  const reasons = [];
  if (row.conflictCount > 0) reasons.push({ key: "conflict", label: "有冲突", tone: "red" });
  if (row.kind === "teachers" && row.weeklyHours > 0 && row.hours > row.weeklyHours) reasons.push({ key: "overload", label: "超容量", tone: "red" });
  if (row.kind === "teachers" && row.weeklyHours > 0 && row.usageRate >= 80 && row.hours <= row.weeklyHours) reasons.push({ key: "busy", label: "接近满负荷", tone: "amber" });
  if (row.status && !["在职", "可排课"].includes(row.status)) reasons.push({ key: "inactive", label: "不可排课", tone: "amber" });
  if (!row.lessons.length) reasons.push({ key: "idle", label: "暂无占用", tone: "" });
  if (!reasons.length) reasons.push({ key: "normal", label: "正常", tone: "green" });
  return reasons;
}

function scheduleResourceMatches(row) {
  if (scheduleResourceRisk === "all") return true;
  return scheduleResourceRiskReasons(row).some((reason) => reason.key === scheduleResourceRisk);
}

function compareScheduleResources(left, right) {
  if (scheduleResourceSort === "name") return left.name.localeCompare(right.name, "zh-CN");
  if (scheduleResourceSort === "conflict") return right.conflictCount - left.conflictCount || right.hours - left.hours || left.name.localeCompare(right.name, "zh-CN");
  if (scheduleResourceSort === "idle") return left.hours - right.hours || left.name.localeCompare(right.name, "zh-CN");
  return right.hours - left.hours || right.pending - left.pending || left.name.localeCompare(right.name, "zh-CN");
}

function renderScheduleResourceSummary(allRows, visibleRows) {
  const conflict = allRows.filter((row) => row.conflictCount > 0).length;
  const idle = allRows.filter((row) => !row.lessons.length).length;
  const busy = allRows.filter((row) => scheduleResourceRiskReasons(row).some((reason) => reason.key === "busy" || reason.key === "overload")).length;
  const totalHours = allRows.reduce((sum, row) => sum + row.hours, 0);
  return `
    <div class="summary-grid compact-metrics">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${allRows.length} 个资源</small></div>
      <div class="metric"><span>占用课时</span><strong>${totalHours}</strong><small>${scheduleResourceRange === "all" ? "全部日期" : `未来 ${scheduleResourceRangeDays()} 天`}</small></div>
      <div class="metric"><span>冲突/满负荷</span><strong>${conflict + busy}</strong><small>${conflict} 个冲突，${busy} 个高负荷</small></div>
      <div class="metric"><span>暂无占用</span><strong>${idle}</strong><small>可优先用于新排课</small></div>
    </div>`;
}

function renderScheduleResourceToolbar() {
  return `
    <div class="filters schedule-resource-toolbar">
      <label>资源类型
        <select id="scheduleResourceKind" aria-label="排课资源类型筛选">
          <option value="teachers" ${scheduleResourceKind === "teachers" ? "selected" : ""}>老师</option>
          <option value="rooms" ${scheduleResourceKind === "rooms" ? "selected" : ""}>教室</option>
        </select>
      </label>
      <label>日期范围
        <select id="scheduleResourceRange" aria-label="排课资源日期范围筛选">
          <option value="next7" ${scheduleResourceRange === "next7" ? "selected" : ""}>未来 7 天</option>
          <option value="next14" ${scheduleResourceRange === "next14" ? "selected" : ""}>未来 14 天</option>
          <option value="next30" ${scheduleResourceRange === "next30" ? "selected" : ""}>未来 30 天</option>
          <option value="all" ${scheduleResourceRange === "all" ? "selected" : ""}>全部日期</option>
        </select>
      </label>
      <label>资源状态
        <select id="scheduleResourceRisk" aria-label="排课资源状态筛选">
          <option value="all" ${scheduleResourceRisk === "all" ? "selected" : ""}>全部状态</option>
          <option value="conflict" ${scheduleResourceRisk === "conflict" ? "selected" : ""}>有冲突</option>
          <option value="overload" ${scheduleResourceRisk === "overload" ? "selected" : ""}>超容量</option>
          <option value="busy" ${scheduleResourceRisk === "busy" ? "selected" : ""}>接近满负荷</option>
          <option value="idle" ${scheduleResourceRisk === "idle" ? "selected" : ""}>暂无占用</option>
          <option value="inactive" ${scheduleResourceRisk === "inactive" ? "selected" : ""}>不可排课</option>
          <option value="normal" ${scheduleResourceRisk === "normal" ? "selected" : ""}>正常</option>
        </select>
      </label>
      <label>排序
        <select id="scheduleResourceSort" aria-label="排课资源排序">
          <option value="loadDesc" ${scheduleResourceSort === "loadDesc" ? "selected" : ""}>占用最多</option>
          <option value="conflict" ${scheduleResourceSort === "conflict" ? "selected" : ""}>冲突优先</option>
          <option value="idle" ${scheduleResourceSort === "idle" ? "selected" : ""}>空闲优先</option>
          <option value="name" ${scheduleResourceSort === "name" ? "selected" : ""}>名称顺序</option>
        </select>
      </label>
    </div>`;
}

function renderScheduleResourceUsage(row) {
  const width = Math.min(row.usageRate || 0, 100);
  const tone = row.usageRate >= 100 ? "danger" : row.usageRate >= 80 ? "warn" : "";
  const label = row.kind === "teachers" && row.weeklyHours ? `${row.hours}/${row.weeklyHours}h` : `${row.hours}h`;
  return `<div class="resource-usage-bar">
    <div class="resource-usage-track"><span class="resource-usage-fill ${tone}" style="width:${width}%"></span></div>
    <strong>${escapeHtml(label)}</strong>
  </div>`;
}

function renderScheduleResourceSlots(row) {
  const conflictDates = new Set();
  if (typeof scheduleConflictPairs === "function") {
    for (const pair of scheduleConflictPairs()) {
      const key = row.kind === "rooms" ? "room" : "teacher";
      if (pair.first[key] === row.name || pair.second[key] === row.name) conflictDates.add(pair.first.date);
    }
  }
  return `<div class="resource-slot-strip">
    ${scheduleResourceDates().map((date) => {
      const lessons = row.lessons.filter((lesson) => lesson.date === date);
      const cls = conflictDates.has(date) ? "conflict" : lessons.length ? "busy" : "";
      return `<div class="resource-slot ${cls}">
        <span>${escapeHtml(date.slice(5))}</span>
        <strong>${lessons.length ? `${lessons.length}节` : "空"}</strong>
      </div>`;
    }).join("")}
  </div>`;
}

function renderScheduleResourceTags(row) {
  return `<div class="resource-risk-tags">${scheduleResourceRiskReasons(row).map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function scheduleResourceNextStep(row) {
  if (row.conflictCount > 0) return "先处理冲突课节，再继续新增排课。";
  if (row.kind === "teachers" && row.weeklyHours > 0 && row.hours > row.weeklyHours) return "老师已超过周容量，建议调课或换老师。";
  if (!row.lessons.length) return "当前范围内空闲，可优先承接新班或补课。";
  if (row.usageRate >= 80 && row.kind === "teachers") return "接近满负荷，新增排课前先核对老师时间。";
  return "资源占用正常，可按课表继续点名和反馈。";
}

function renderScheduleResourceRows(rows) {
  return rows.map((row) => {
    const nextLesson = row.nextLesson ? `${row.nextLesson.date} ${row.nextLesson.time} / ${row.nextLesson.target}` : "暂无课节";
    const actionAttr = row.kind === "rooms" ? "data-resource-room" : "data-resource-teacher";
    return `<tr>
      <td><strong>${escapeHtml(row.name)}</strong><br><span class="muted">${escapeHtml(row.meta || row.status || "")}</span></td>
      <td>${renderScheduleResourceUsage(row)}</td>
      <td>${row.lessons.length} 节<br><span class="muted">${row.pending} 节待上</span></td>
      <td>${renderScheduleResourceSlots(row)}</td>
      <td>${escapeHtml(nextLesson)}</td>
      <td>${renderScheduleResourceTags(row)}</td>
      <td class="resource-note">${escapeHtml(scheduleResourceNextStep(row))}</td>
      <td><div class="resource-actions"><button class="small-button" type="button" ${actionAttr}="${escapeHtml(row.name)}">看课表</button><button class="small-button" type="button" data-go="masters">资料</button></div></td>
    </tr>`;
  });
}

function renderScheduleResourceBoard() {
  const allRows = scheduleResourceRows();
  const visibleRows = allRows.filter(scheduleResourceMatches).sort(compareScheduleResources);
  return `<section class="section schedule-resource-panel">
    <div class="section-head">
      <div>
        <h3>排课资源占用看板</h3>
        <span class="muted">按老师和教室查看未来占用、空闲资源、冲突和满负荷情况。</span>
      </div>
      ${tag(`${visibleRows.length} 个资源`, visibleRows.length ? "green" : "amber")}
    </div>
    <div class="section-body">
      ${renderScheduleResourceSummary(allRows, visibleRows)}
      ${renderScheduleResourceToolbar()}
      ${table(["资源", "占用", "课节", "关键日期", "下一节", "状态", "下一步", "操作"], renderScheduleResourceRows(visibleRows))}
    </div>
  </section>`;
}

function injectScheduleResourceBoard() {
  if (currentView !== "schedule" || appContent.querySelector(".schedule-resource-panel")) return;
  const listPanel = appContent.querySelector(".schedule-list-panel");
  if (listPanel) {
    listPanel.insertAdjacentHTML("beforebegin", renderScheduleResourceBoard());
  } else {
    appContent.insertAdjacentHTML("beforeend", renderScheduleResourceBoard());
  }
}

const baseRenderScheduleForResourceBoard = renderSchedule;
renderSchedule = function renderScheduleWithResourceBoard() {
  baseRenderScheduleForResourceBoard();
  injectScheduleResourceBoard();
};

document.addEventListener("change", (event) => {
  if (event.target.id === "scheduleResourceKind") scheduleResourceKind = event.target.value;
  if (event.target.id === "scheduleResourceRange") scheduleResourceRange = event.target.value;
  if (event.target.id === "scheduleResourceRisk") scheduleResourceRisk = event.target.value;
  if (event.target.id === "scheduleResourceSort") scheduleResourceSort = event.target.value;
  if (["scheduleResourceKind", "scheduleResourceRange", "scheduleResourceRisk", "scheduleResourceSort"].includes(event.target.id) && currentView === "schedule") renderView();
});

document.addEventListener("click", (event) => {
  const teacherButton = event.target.closest("[data-resource-teacher]");
  if (teacherButton) {
    scheduleTeacherFilter = teacherButton.dataset.resourceTeacher;
    scheduleRoomFilter = "all";
    scheduleDateFilter = scheduleResourceRange === "all" ? "all" : "upcoming";
    renderView();
  }

  const roomButton = event.target.closest("[data-resource-room]");
  if (roomButton) {
    scheduleRoomFilter = roomButton.dataset.resourceRoom;
    scheduleTeacherFilter = "all";
    scheduleDateFilter = scheduleResourceRange === "all" ? "all" : "upcoming";
    renderView();
  }
});

if (currentView === "schedule") renderView();
