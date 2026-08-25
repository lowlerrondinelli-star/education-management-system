const scheduleQualityStyle = document.createElement("style");
scheduleQualityStyle.textContent = `
  .schedule-quality {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 14px;
    background: #fff;
    display: grid;
    gap: 12px;
  }

  .quality-head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .quality-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(130px, 1fr));
    gap: 10px;
  }

  .quality-grid > div {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px;
    background: #f8fafc;
  }

  .quality-grid span {
    display: block;
    color: var(--muted);
    font-size: 12px;
    margin-bottom: 5px;
  }

  .quality-grid strong {
    font-size: 20px;
  }

  .conflict-list {
    display: grid;
    gap: 8px;
  }

  .conflict-item {
    border: 1px solid #f2b8a2;
    border-radius: 8px;
    padding: 10px;
    background: #fff7f2;
    display: grid;
    gap: 6px;
  }

  .lesson-card.conflict {
    border-left-color: var(--red);
    background: #fff9f6;
  }

  @media (max-width: 860px) {
    .quality-grid {
      grid-template-columns: repeat(2, minmax(120px, 1fr));
    }
  }
`;
document.head.appendChild(scheduleQualityStyle);

function minutesFromClock(value) {
  const [hour, minute] = text(value).split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
  return hour * 60 + minute;
}

function lessonRangeMinutes(lesson) {
  const [start, end] = text(lesson.time).split("-").map((part) => part.trim());
  return { start: minutesFromClock(start), end: minutesFromClock(end) };
}

function isValidLessonRange(lesson) {
  const range = lessonRangeMinutes(lesson);
  return Number.isFinite(range.start) && Number.isFinite(range.end) && range.start < range.end;
}

function lessonConflictReasons(left, right) {
  const reasons = [];
  if (text(left.teacher) && left.teacher === right.teacher) reasons.push("教师同一时间已有课");
  if (text(left.room) && left.room === right.room) reasons.push("教室同一时间被占用");
  if (text(left.target) && left.target === right.target) reasons.push("班级/学员同一时间重复排课");
  return reasons;
}

function lessonsOverlap(left, right) {
  if (left.date !== right.date) return false;
  return timeRangesOverlap(left.time, right.time);
}

findLessonConflicts = function findLessonConflictsWithReasons(candidate) {
  return appState.lessons
    .filter((lesson) => lesson.id !== candidate.id && lessonsOverlap(lesson, candidate))
    .map((lesson) => ({ ...lesson, reasons: lessonConflictReasons(lesson, candidate) }))
    .filter((lesson) => lesson.reasons.length);
};

function scheduleConflictPairs() {
  const pairs = [];
  for (let index = 0; index < appState.lessons.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < appState.lessons.length; nextIndex += 1) {
      const first = appState.lessons[index];
      const second = appState.lessons[nextIndex];
      if (!lessonsOverlap(first, second)) continue;
      const reasons = lessonConflictReasons(first, second);
      if (!reasons.length) continue;
      pairs.push({ first, second, reasons });
    }
  }
  return pairs.sort((a, b) => `${a.first.date} ${a.first.time}`.localeCompare(`${b.first.date} ${b.first.time}`, "zh-CN"));
}

function flattenScheduleConflictRows() {
  return scheduleConflictPairs().map((item) => ({
    date: item.first.date,
    time: `${item.first.time} / ${item.second.time}`,
    reason: item.reasons.join("、"),
    firstTarget: item.first.target,
    firstTeacher: item.first.teacher,
    firstRoom: item.first.room,
    secondTarget: item.second.target,
    secondTeacher: item.second.teacher,
    secondRoom: item.second.room,
    status: item.first.status === "已上课" && item.second.status === "已上课" ? "已发生" : "待处理"
  }));
}

function lessonIdsWithConflicts() {
  const ids = new Set();
  for (const item of scheduleConflictPairs()) {
    ids.add(item.first.id);
    ids.add(item.second.id);
  }
  return ids;
}

function renderScheduleQualityPanel() {
  const conflicts = scheduleConflictPairs();
  const pendingLessons = appState.lessons.filter((lesson) => lesson.status === "待上课").length;
  const usedTeachers = new Set(appState.lessons.map((lesson) => lesson.teacher).filter(Boolean)).size;
  const usedRooms = new Set(appState.lessons.map((lesson) => lesson.room).filter(Boolean)).size;
  const conflictRows = conflicts.slice(0, 5).map(
    (item) => `<div class="conflict-item">
      <strong>${escapeHtml(item.first.date)} ${escapeHtml(item.first.time)} ${tag(item.reasons.join("、"), "red")}</strong>
      <span>${escapeHtml(item.first.target)} / ${escapeHtml(item.first.teacher)} / ${escapeHtml(item.first.room)}</span>
      <span>${escapeHtml(item.second.target)} / ${escapeHtml(item.second.teacher)} / ${escapeHtml(item.second.room)}</span>
    </div>`
  );

  return `
    <div class="schedule-quality">
      <div class="quality-head">
        <div>
          <strong>排课健康检查</strong>
          <div class="muted">自动检查同一天同一时间的教师、教室、班级/学员冲突。</div>
        </div>
        ${conflicts.length ? tag(`${conflicts.length} 个冲突`, "red") : tag("暂无冲突", "green")}
      </div>
      <div class="quality-grid">
        <div><span>课节总数</span><strong>${appState.lessons.length}</strong></div>
        <div><span>待上课节</span><strong>${pendingLessons}</strong></div>
        <div><span>涉及教师</span><strong>${usedTeachers}</strong></div>
        <div><span>涉及教室</span><strong>${usedRooms}</strong></div>
      </div>
      <div class="conflict-list">
        ${
          conflictRows.join("") ||
          `<div class="stack-item"><strong>当前课表可用</strong><span class="muted">没有发现老师、教室或班级在同一时间重复占用。</span></div>`
        }
      </div>
    </div>`;
}

function injectScheduleQualityPanel() {
  const sectionBody = appContent.querySelector(".section-body");
  const lessonForm = appContent.querySelector("#lessonForm");
  if (!sectionBody || !lessonForm || appContent.querySelector(".schedule-quality")) return;
  lessonForm.insertAdjacentHTML("afterend", renderScheduleQualityPanel());

  const conflictIds = lessonIdsWithConflicts();
  appContent.querySelectorAll("[data-finish-lesson]").forEach((button) => {
    if (conflictIds.has(button.dataset.finishLesson)) button.closest(".lesson-card")?.classList.add("conflict");
  });
}

const baseRenderScheduleForQuality = renderSchedule;
renderSchedule = function renderScheduleWithQuality() {
  baseRenderScheduleForQuality();
  injectScheduleQualityPanel();
};

const baseCreateLessonForQuality = createLesson;
createLesson = function createLessonWithQuality(formData) {
  const date = text(formData.get("date"));
  const startTime = text(formData.get("startTime"));
  const endTime = text(formData.get("endTime"));
  const target = text(formData.get("target"));
  const classItem = getClass(target);
  const lesson = {
    id: nextId("L"),
    day: dayFromDate(date),
    date,
    time: `${startTime}-${endTime}`,
    type: text(formData.get("type")) || "班级课",
    target,
    subject: text(formData.get("subject")).trim() || "课程",
    teacher: text(formData.get("teacher")).trim() || classItem?.teacher || "任课老师",
    room: text(formData.get("room")).trim() || classItem?.room || "默认教室",
    status: "待上课",
    deduct: Number(classItem?.deduct || 1)
  };

  if (!isValidLessonRange(lesson)) {
    setNotice("schedule", "结束时间必须晚于开始时间，请调整后再保存。", "red");
    renderView();
    return;
  }

  const conflicts = findLessonConflicts(lesson);
  if (conflicts.length) {
    const names = conflicts.map((item) => `${item.target} ${item.time}（${item.reasons.join("、")}）`).join("；");
    setNotice("schedule", `存在排课冲突：${names}`, "red");
    renderView();
    return;
  }

  baseCreateLessonForQuality(formData);
};

renderNav();
