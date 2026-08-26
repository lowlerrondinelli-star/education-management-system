const consumeListStyle = document.createElement("style");
consumeListStyle.textContent = `
  .consume-list-summary {
    margin-bottom: 14px;
  }

  .consume-filter-toolbar {
    align-items: end;
  }

  .consume-filter-toolbar label {
    display: grid;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    min-width: 150px;
  }

  .consume-filter-toolbar select {
    color: var(--ink);
    min-width: 0;
  }

  .consume-change {
    font-weight: 800;
  }

  .consume-change.negative {
    color: var(--red);
  }

  .consume-change.positive {
    color: var(--green);
  }

  .consume-risk-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 260px;
  }

  .consume-pending-panel .consume-pending-list {
    display: grid;
    gap: 10px;
  }

  .consume-pending-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--soft);
  }

  .consume-pending-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .consume-pending-advice {
    margin-top: 8px;
    display: grid;
    gap: 6px;
    color: var(--muted);
  }

  .consume-pending-advice strong {
    color: var(--ink);
  }

  .consume-pending-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  @media (max-width: 650px) {
    .consume-filter-toolbar,
    .consume-filter-toolbar label,
    .consume-filter-toolbar select,
    .consume-pending-card {
      width: 100%;
    }

    .consume-pending-card {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(consumeListStyle);

let consumeTypeFilter = "all";
let consumeStudentFilter = "all";
let consumeOperatorFilter = "all";
let consumeRiskFilter = "all";
let consumeSortMode = "timeDesc";

function consumeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function consumeTimeValue(item) {
  const normalized = text(item.time).replaceAll("/", "-");
  const value = new Date(normalized).getTime();
  return Number.isFinite(value) ? value : 0;
}

function consumeChangeClass(item) {
  const change = consumeNumber(item.change);
  if (change > 0) return "positive";
  if (change < 0) return "negative";
  return "";
}

function consumeRiskReasons(item) {
  const reasons = [];
  const typeValue = text(item.type);
  const change = consumeNumber(item.change);
  const after = consumeNumber(item.after);

  if (typeValue.includes("课时不足")) reasons.push({ key: "shortage", label: "课时不足", tone: "red" });
  if (typeValue.includes("退费") || typeValue.includes("作废")) reasons.push({ key: "finance", label: "财务异常", tone: "red" });
  if (typeValue.includes("调整")) reasons.push({ key: "adjustment", label: "人工调整", tone: "amber" });
  if (change < 0 && after > 0 && after <= 3) reasons.push({ key: "lowBalance", label: "余额偏低", tone: "amber" });
  if (change < 0 && after <= 0) reasons.push({ key: "zeroBalance", label: "余额用尽", tone: "amber" });

  return reasons;
}

function consumeHasRisk(item, riskKey) {
  if (riskKey === "all") return true;
  if (riskKey === "none") return consumeRiskReasons(item).length === 0;
  return consumeRiskReasons(item).some((reason) => reason.key === riskKey);
}

function consumeMatchesListFilters(item) {
  if (!matchesRow(item)) return false;
  if (consumeTypeFilter !== "all" && item.type !== consumeTypeFilter) return false;
  if (consumeStudentFilter !== "all" && item.student !== consumeStudentFilter) return false;
  if (consumeOperatorFilter !== "all" && item.operator !== consumeOperatorFilter) return false;
  return consumeHasRisk(item, consumeRiskFilter);
}

function compareConsumeRows(left, right) {
  if (consumeSortMode === "timeAsc") return consumeTimeValue(left) - consumeTimeValue(right);
  if (consumeSortMode === "student") return text(left.student).localeCompare(text(right.student), "zh-CN") || consumeTimeValue(right) - consumeTimeValue(left);
  if (consumeSortMode === "changeAbs") return Math.abs(consumeNumber(right.change)) - Math.abs(consumeNumber(left.change));
  if (consumeSortMode === "afterAsc") return consumeNumber(left.after) - consumeNumber(right.after);
  return consumeTimeValue(right) - consumeTimeValue(left);
}

function consumeSelectOptions(values, selectedValue, allLabel) {
  return [
    `<option value="all" ${selectedValue === "all" ? "selected" : ""}>${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
  ].join("");
}

function renderConsumeRiskTags(item) {
  const reasons = consumeRiskReasons(item);
  if (!reasons.length) return tag("正常", "green");
  return `<div class="consume-risk-tags">${reasons.map((reason) => tag(reason.label, reason.tone)).join("")}</div>`;
}

function renderConsumeFilterToolbar() {
  const types = [...new Set(appState.ledger.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const students = [...new Set(appState.ledger.map((item) => item.student).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const operators = [...new Set(appState.ledger.map((item) => item.operator).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));

  return `
    <div class="filters consume-filter-toolbar">
      <label>类型
        <select id="consumeTypeFilter" aria-label="按类型筛选课时流水">
          ${consumeSelectOptions(types, consumeTypeFilter, "全部类型")}
        </select>
      </label>
      <label>学员
        <select id="consumeStudentFilter" aria-label="按学员筛选课时流水">
          ${consumeSelectOptions(students, consumeStudentFilter, "全部学员")}
        </select>
      </label>
      <label>操作人
        <select id="consumeOperatorFilter" aria-label="按操作人筛选课时流水">
          ${consumeSelectOptions(operators, consumeOperatorFilter, "全部操作人")}
        </select>
      </label>
      <label>待核对
        <select id="consumeRiskFilter" aria-label="按待核对事项筛选课时流水">
          <option value="all" ${consumeRiskFilter === "all" ? "selected" : ""}>全部情况</option>
          <option value="shortage" ${consumeRiskFilter === "shortage" ? "selected" : ""}>课时不足</option>
          <option value="lowBalance" ${consumeRiskFilter === "lowBalance" ? "selected" : ""}>余额偏低</option>
          <option value="zeroBalance" ${consumeRiskFilter === "zeroBalance" ? "selected" : ""}>余额用尽</option>
          <option value="finance" ${consumeRiskFilter === "finance" ? "selected" : ""}>财务异常</option>
          <option value="adjustment" ${consumeRiskFilter === "adjustment" ? "selected" : ""}>人工调整</option>
          <option value="none" ${consumeRiskFilter === "none" ? "selected" : ""}>无待核对</option>
        </select>
      </label>
      <label>排序
        <select id="consumeSortMode" aria-label="课时流水排序">
          <option value="timeDesc" ${consumeSortMode === "timeDesc" ? "selected" : ""}>最新在前</option>
          <option value="timeAsc" ${consumeSortMode === "timeAsc" ? "selected" : ""}>最早在前</option>
          <option value="afterAsc" ${consumeSortMode === "afterAsc" ? "selected" : ""}>余额升序</option>
          <option value="changeAbs" ${consumeSortMode === "changeAbs" ? "selected" : ""}>变动课时最大</option>
          <option value="student" ${consumeSortMode === "student" ? "selected" : ""}>学员分组</option>
        </select>
      </label>
    </div>`;
}

function consumeListSummary(allRows, visibleRows) {
  const deducted = visibleRows.reduce((sum, item) => sum + (consumeNumber(item.change) < 0 ? Math.abs(consumeNumber(item.change)) : 0), 0);
  const added = visibleRows.reduce((sum, item) => sum + (consumeNumber(item.change) > 0 ? consumeNumber(item.change) : 0), 0);
  const riskCount = visibleRows.filter((item) => consumeRiskReasons(item).length).length;

  return `
    <div class="summary-grid compact-metrics consume-list-summary">
      <div class="metric"><span>当前显示</span><strong>${visibleRows.length}</strong><small>全部 ${allRows.length} 条流水</small></div>
      <div class="metric"><span>当前扣课</span><strong>${deducted}</strong><small>含上课、退费、作废扣课</small></div>
      <div class="metric"><span>当前加课</span><strong>${added}</strong><small>人工调整或补课增加</small></div>
      <div class="metric"><span>待核对</span><strong>${riskCount}</strong><small>课时不足、余额偏低或财务异常</small></div>
    </div>`;
}

function renderConsumeRows(rows) {
  return rows.map((item) => {
    const student = appState.students.find((row) => row.name === item.student);
    return `<tr>
      <td>${escapeHtml(item.time)}<br><span class="muted">流水 ${escapeHtml(item.id || "-")}</span></td>
      <td><strong>${escapeHtml(item.student)}</strong>${student ? `<br><span class="muted">${escapeHtml(student.grade)} · ${escapeHtml(student.className)}</span>` : ""}</td>
      <td>${escapeHtml(item.lesson)}</td>
      <td>${tag(item.type, statusTone(item.type))}</td>
      <td><span class="consume-change ${consumeChangeClass(item)}">${consumeNumber(item.change) > 0 ? "+" : ""}${escapeHtml(item.change)}</span></td>
      <td>${escapeHtml(item.before)} -> ${escapeHtml(item.after)}</td>
      <td>${escapeHtml(item.operator)}</td>
      <td>${renderConsumeRiskTags(item)}</td>
      <td>${student ? `<button class="small-button" type="button" data-consume-student="${escapeHtml(student.id)}">学员详情</button>` : `<span class="muted">-</span>`}</td>
    </tr>`;
  });
}

function consumeLessonHasAttendance(lesson) {
  if (typeof lessonHasAttendance === "function") return lessonHasAttendance(lesson);
  const record = appState.attendance?.find((item) => item.lessonId === lesson.id);
  return Boolean(record?.updatedAt || record?.records?.length);
}

function consumePendingLessonStatus(lesson) {
  if (lesson.status === "已取消") return { key: "canceled", label: "已取消", tone: "" };
  if (lesson.status === "已上课") return { key: "done", label: "已消课", tone: "green" };
  if (consumeLessonHasAttendance(lesson)) return { key: "ready", label: "可确认消课", tone: "amber" };
  return { key: "attendance", label: "待点名", tone: "red" };
}

function consumePendingLessons() {
  return appState.lessons
    .filter((lesson) => !["已取消", "已上课"].includes(lesson.status))
    .slice()
    .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));
}

function consumePendingSummary(rows) {
  const ready = rows.filter((lesson) => consumePendingLessonStatus(lesson).key === "ready").length;
  const attendance = rows.filter((lesson) => consumePendingLessonStatus(lesson).key === "attendance").length;
  return `
    <div class="summary-grid compact-metrics consume-list-summary">
      <div class="metric"><span>待处理课节</span><strong>${rows.length}</strong><small>未取消且未完成消课</small></div>
      <div class="metric"><span>可确认消课</span><strong>${ready}</strong><small>已保存点名</small></div>
      <div class="metric"><span>待点名</span><strong>${attendance}</strong><small>先补考勤再消课</small></div>
    </div>`;
}

function consumePendingAttendanceRecord(lesson) {
  return appState.attendance?.find((item) => item.lessonId === lesson.id);
}

function consumePendingRiskStudents(students) {
  return students.filter((student) => Number(student.debt || 0) > 0 || Number(student.balance || 0) <= 0);
}

function consumePendingReadyPreview(lesson) {
  const record = consumePendingAttendanceRecord(lesson);
  const deduct = typeof lessonDeduct === "function" ? lessonDeduct(lesson) : Number(lesson.deduct || 1);
  const studentsById = new Map(appState.students.map((student) => [student.id, student]));
  const rows = (record?.records || []).map((item) => {
    const student = studentsById.get(item.studentId);
    const before = consumeNumber(student?.balance ?? item.balance);
    const shouldDeduct = typeof canDeductAttendance === "function" ? canDeductAttendance(item.status) : item.status === "到课" || item.status === "迟到";
    const change = shouldDeduct ? Math.min(before, deduct) : 0;
    return {
      debt: Number(student?.debt || 0),
      before,
      change,
      shouldDeduct,
      shortage: shouldDeduct && before < deduct
    };
  });
  const deductCount = rows.filter((row) => row.shouldDeduct).length;
  const holdCount = rows.length - deductCount;
  const totalChange = rows.reduce((sum, row) => sum + row.change, 0);
  const riskCount = rows.filter((row) => row.shortage || row.debt > 0).length;
  return { rows, deductCount, holdCount, totalChange, riskCount };
}

function consumePendingPlan(lesson, status) {
  const students = typeof lessonStudents === "function" ? lessonStudents(lesson) : [];
  if (status.key === "ready") {
    const preview = consumePendingReadyPreview(lesson);
    const scenario = preview.riskCount ? "riskHold" : "attendance";
    return {
      action: "consume",
      scenario,
      title: preview.riskCount ? "建议：欠费/零课时学员先不扣" : "建议：按点名结果消课",
      detail: `预计消课 ${preview.deductCount} 人，合计 ${preview.totalChange} 课时；${preview.holdCount} 人不扣课。`,
      tags: [
        tag(`消课 ${preview.deductCount} 人`, "green"),
        tag(`不扣 ${preview.holdCount} 人`, preview.holdCount ? "amber" : "green"),
        preview.riskCount ? tag(`需核对 ${preview.riskCount} 人`, "red") : tag("余额正常", "green")
      ]
    };
  }

  const riskStudents = consumePendingRiskStudents(students);
  const scenario = riskStudents.length ? "riskLeave" : "normal";
  return {
    action: "attendance",
    scenario,
    title: riskStudents.length ? "建议：欠费/零课时学员先请假" : "建议：常规上课全部到课",
    detail: `先完成点名，再进入消课确认；当前名单 ${students.length} 人。`,
    tags: [
      tag(`名单 ${students.length} 人`, students.length ? "green" : "amber"),
      tag("待点名", "red"),
      riskStudents.length ? tag(`资金风险 ${riskStudents.length} 人`, "red") : tag("无资金风险", "green")
    ]
  };
}

function renderConsumePendingAdvice(plan) {
  return `<div class="consume-pending-advice">
    <strong>${escapeHtml(plan.title)}</strong>
    <span>${escapeHtml(plan.detail)}</span>
    <div class="consume-pending-tags">${plan.tags.join("")}</div>
  </div>`;
}

function renderConsumePendingRows(rows) {
  if (!rows.length) {
    return `<div class="stack-item"><strong>暂无待消课课节</strong><span class="muted">当前没有需要补点名或确认消课的课节。</span></div>`;
  }

  return rows
    .map((lesson) => {
      const status = consumePendingLessonStatus(lesson);
      const studentCount = typeof lessonStudents === "function" ? lessonStudents(lesson).length : 0;
      const attendanceText = typeof attendanceSummary === "function" ? attendanceSummary(lesson) : status.label;
      const plan = consumePendingPlan(lesson, status);
      return `<article class="consume-pending-card">
        <div>
          <strong>${escapeHtml(lesson.date)} ${escapeHtml(lesson.time)} ${escapeHtml(lesson.target)}</strong>
          <div class="consume-pending-meta">
            ${tag(status.label, status.tone)}
            ${tag(`${studentCount} 名学员`, studentCount ? "green" : "amber")}
            <span class="muted">${escapeHtml(lesson.subject)} / ${escapeHtml(lesson.teacher)} / ${escapeHtml(attendanceText)}</span>
          </div>
          ${renderConsumePendingAdvice(plan)}
        </div>
        <div class="action-row">
          <button class="small-button" type="button" data-attendance-lesson="${escapeHtml(lesson.id)}" data-attendance-scenario="${escapeHtml(plan.action === "attendance" ? plan.scenario : "")}">${plan.action === "attendance" ? "按建议点名" : "查看点名"}</button>
          <button class="small-button" type="button" data-finish-lesson="${escapeHtml(lesson.id)}" data-consume-scenario="${escapeHtml(plan.action === "consume" ? plan.scenario : "attendance")}" ${status.key === "ready" ? "" : "disabled"}>${plan.action === "consume" ? "按建议消课" : "确认消课"}</button>
        </div>
      </article>`;
    })
    .join("");
}

function renderConsumePendingPanel() {
  const rows = consumePendingLessons();
  return `
    <section class="section consume-pending-panel">
      <div class="section-head compact-head">
        <h3>待消课课节</h3>
        <span class="muted">已点名课节可直接确认消课；未点名课节先补点名。</span>
      </div>
      <div class="section-body">
        ${consumePendingSummary(rows)}
        <div class="consume-pending-list">${renderConsumePendingRows(rows)}</div>
      </div>
    </section>`;
}

renderConsume = function renderConsumeWithFilters() {
  const allRows = appState.ledger.filter(matchesRow);
  const visibleRows = appState.ledger.filter(consumeMatchesListFilters).sort(compareConsumeRows);

  appContent.innerHTML = `
    <section class="section">
      <div class="section-head">
        <div>
          <h3>课时流水</h3>
          <span class="muted">按学员、类型和余额风险核对每一次消课与课时调整。</span>
        </div>
      </div>
      <div class="section-body">
        ${consumeListSummary(allRows, visibleRows)}
        ${renderConsumeFilterToolbar()}
        ${table(["时间", "学员", "关联课节", "类型", "课时变动", "变动前后", "操作人", "待核对", "操作"], renderConsumeRows(visibleRows))}
      </div>
    </section>
    ${renderConsumePendingPanel()}`;
};

document.addEventListener("change", (event) => {
  if (event.target.id === "consumeTypeFilter") consumeTypeFilter = event.target.value;
  if (event.target.id === "consumeStudentFilter") consumeStudentFilter = event.target.value;
  if (event.target.id === "consumeOperatorFilter") consumeOperatorFilter = event.target.value;
  if (event.target.id === "consumeRiskFilter") consumeRiskFilter = event.target.value;
  if (event.target.id === "consumeSortMode") consumeSortMode = event.target.value;

  if (["consumeTypeFilter", "consumeStudentFilter", "consumeOperatorFilter", "consumeRiskFilter", "consumeSortMode"].includes(event.target.id) && currentView === "consume") {
    renderView();
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-consume-student]");
  if (!button) return;
  if (typeof showStudentProfile === "function") showStudentProfile(button.dataset.consumeStudent);
});

if (currentView === "consume") {
  renderView();
}
