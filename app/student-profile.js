const studentProfileStyle = document.createElement("style");
studentProfileStyle.textContent = `
  .student-profile-dialog {
    width: min(1120px, calc(100vw - 28px));
  }

  .student-profile-dialog .dialog-body {
    padding: 0 18px 18px;
    display: grid;
    gap: 14px;
    max-height: min(78vh, 820px);
    overflow: auto;
  }

  .profile-title {
    display: flex;
    gap: 12px;
    align-items: center;
    min-width: 0;
  }

  .profile-avatar {
    width: 46px;
    height: 46px;
    border-radius: 8px;
    background: #e7f0ff;
    color: var(--blue-deep);
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 22px;
    flex: 0 0 auto;
  }

  .profile-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(130px, 1fr));
    gap: 10px;
  }

  .profile-summary .metric {
    box-shadow: none;
    padding: 13px;
  }

  .profile-summary .metric strong {
    font-size: 24px;
  }

  .profile-grid {
    display: grid;
    grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.28fr);
    gap: 14px;
  }

  .profile-card {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
    padding: 14px;
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .profile-card h4 {
    margin: 0;
    font-size: 16px;
  }

  .profile-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .profile-fact {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .profile-fact span {
    color: var(--muted);
    font-size: 12px;
  }

  .profile-fact strong {
    overflow-wrap: anywhere;
  }

  .profile-card .table-wrap {
    border: 1px solid var(--line);
    border-radius: 8px;
  }

  @media (max-width: 900px) {
    .profile-summary,
    .profile-grid,
    .profile-facts {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(studentProfileStyle);

const studentProfileDialog = document.createElement("dialog");
studentProfileDialog.id = "studentProfileDialog";
studentProfileDialog.className = "dialog student-profile-dialog";
document.body.appendChild(studentProfileDialog);

function studentById(studentId) {
  return appState.students.find((item) => item.id === studentId);
}

function studentOrders(student) {
  return appState.orders.filter((order) => order.student === student.name);
}

function studentLedger(student) {
  return appState.ledger.filter((item) => item.student === student.name);
}

function studentLessons(student) {
  const classNames = new Set([student.className, ...studentOrders(student).map((order) => order.className)].filter(Boolean));
  return appState.lessons.filter((lesson) => classNames.has(lesson.target) || lesson.target.startsWith(`${student.name}-`));
}

function studentAttendanceRows(student) {
  if (!Array.isArray(appState.attendance)) return [];
  return appState.attendance.flatMap((record) => {
    const studentRecord = (record.records || []).find((item) => item.studentId === student.id);
    if (!studentRecord) return [];
    const lesson = appState.lessons.find((item) => item.id === record.lessonId) || {};
    return [
      {
        date: record.date || lesson.date || "",
        time: record.time || lesson.time || "",
        target: record.target || lesson.target || "",
        status: studentRecord.status || "未点名",
        deduct: studentRecord.deduct ? "是" : "否",
        operator: record.operator || ""
      }
    ];
  });
}

function studentFollowUps(student) {
  if (typeof ensureFollowUpData === "function") ensureFollowUpData();
  return (appState.followUps || []).filter((item) => item.studentId === student.id || item.student === student.name);
}

function studentPaymentTotal(student) {
  if (typeof ensurePaymentData === "function") ensurePaymentData();
  return (appState.payments || [])
    .filter((item) => item.student === student.name)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function studentLessonBalanceFromOrders(student) {
  return studentOrders(student).reduce(
    (summary, order) => {
      summary.bought += Number(order.bought || 0);
      summary.gift += Number(order.gift || 0);
      summary.used += Number(order.used || 0);
      summary.remaining += Number(order.bought || 0) + Number(order.gift || 0) - Number(order.used || 0);
      summary.debt += Number(order.debt || 0);
      return summary;
    },
    { bought: 0, gift: 0, used: 0, remaining: 0, debt: 0 }
  );
}

function flattenStudentDetailRows() {
  if (typeof ensurePaymentData === "function") ensurePaymentData();
  if (typeof ensureFollowUpData === "function") ensureFollowUpData();
  return appState.students.map((student) => {
    const orders = studentOrders(student);
    const lessons = studentLessons(student);
    const ledger = studentLedger(student);
    const followUps = studentFollowUps(student);
    const attendance = studentAttendanceRows(student);
    const lessonBalance = studentLessonBalanceFromOrders(student);
    const latestFollowUp = followUps[0];
    const latestAttendance = attendance[0];
    const latestLedger = ledger[0];
    return {
      id: student.id,
      name: student.name,
      phone: student.phone,
      grade: student.grade,
      school: student.school,
      channel: student.channel,
      owner: student.owner,
      course: student.course,
      className: student.className,
      status: student.status,
      balance: student.balance,
      debt: student.debt,
      orderCount: orders.length,
      bought: lessonBalance.bought,
      gift: lessonBalance.gift,
      used: lessonBalance.used,
      remaining: lessonBalance.remaining || student.balance,
      paid: studentPaymentTotal(student),
      lessonCount: lessons.length,
      ledgerCount: ledger.length,
      followUpStatus: latestFollowUp ? `${latestFollowUp.type} / ${latestFollowUp.result}` : "",
      nextFollowUp: latestFollowUp?.dueDate || "",
      latestAttendance: latestAttendance ? `${latestAttendance.date} ${latestAttendance.status}` : "",
      latestLedger: latestLedger ? `${latestLedger.time} ${latestLedger.change}` : ""
    };
  });
}

function profileFacts(items) {
  return `<div class="profile-facts">${items
    .map(
      ([label, value]) => `<div class="profile-fact">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "-")}</strong>
      </div>`
    )
    .join("")}</div>`;
}

function renderProfileTable(headers, rows) {
  return table(headers, rows).replace('<div class="table-wrap">', '<div class="table-wrap profile-table-wrap">');
}

function showStudentProfile(studentId) {
  const student = studentById(studentId);
  if (!student) return;
  if (typeof ensurePaymentData === "function") ensurePaymentData();
  if (typeof ensureFollowUpData === "function") ensureFollowUpData();

  const orders = studentOrders(student);
  const ledger = studentLedger(student);
  const lessons = studentLessons(student);
  const attendance = studentAttendanceRows(student);
  const followUps = studentFollowUps(student);
  const paid = studentPaymentTotal(student);
  const balance = studentLessonBalanceFromOrders(student);
  const debt = Number(student.debt || balance.debt || 0);

  const orderRows = orders.map(
    (order) => `<tr>
      <td><strong>${escapeHtml(order.id)}</strong><br><span class="muted">${escapeHtml(order.owner)}</span></td>
      <td>${escapeHtml(order.course)}</td>
      <td>${escapeHtml(order.className)}</td>
      <td>${Number(order.bought || 0)} + ${Number(order.gift || 0)}</td>
      <td>${Number(order.used || 0)}</td>
      <td>${money(order.paid)}</td>
      <td>${Number(order.debt || 0) ? tag(money(order.debt), "red") : tag("无", "green")}</td>
      <td>${escapeHtml(order.expireAt)}</td>
    </tr>`
  );
  const lessonRows = lessons.slice(0, 8).map(
    (lesson) => `<tr>
      <td>${escapeHtml(lesson.date)}<br><span class="muted">${escapeHtml(lesson.time)}</span></td>
      <td>${escapeHtml(lesson.target)}</td>
      <td>${escapeHtml(lesson.subject)}</td>
      <td>${escapeHtml(lesson.teacher)}</td>
      <td>${tag(lesson.status, statusTone(lesson.status))}</td>
    </tr>`
  );
  const ledgerRows = ledger.slice(0, 8).map(
    (item) => `<tr>
      <td>${escapeHtml(item.time)}</td>
      <td>${escapeHtml(item.lesson)}</td>
      <td>${tag(item.type, statusTone(item.type))}</td>
      <td>${item.change}</td>
      <td>${item.before} -> ${item.after}</td>
      <td>${escapeHtml(item.operator)}</td>
    </tr>`
  );
  const followUpRows = followUps.slice(0, 6).map(
    (item) => `<tr>
      <td>${tag(item.type, item.priority === "高" ? "red" : item.priority === "中" ? "amber" : "")}</td>
      <td>${escapeHtml(item.dueDate)}</td>
      <td>${tag(item.result, item.status === "已完成" ? "green" : "amber")}</td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${escapeHtml(item.note)}</td>
    </tr>`
  );
  const attendanceRows = attendance.slice(0, 6).map(
    (item) => `<tr>
      <td>${escapeHtml(item.date)}<br><span class="muted">${escapeHtml(item.time)}</span></td>
      <td>${escapeHtml(item.target)}</td>
      <td>${tag(item.status, item.status === "到课" || item.status === "迟到" ? "green" : "amber")}</td>
      <td>${escapeHtml(item.deduct)}</td>
      <td>${escapeHtml(item.operator)}</td>
    </tr>`
  );

  studentProfileDialog.innerHTML = `
    <div class="dialog-head" style="padding:18px;">
      <div class="profile-title">
        <div class="profile-avatar" aria-hidden="true">${escapeHtml(student.name.slice(0, 1))}</div>
        <div>
          <p class="eyebrow">学员详情档案</p>
          <h3>${escapeHtml(student.name)} ${tag(student.status, statusTone(student.status))}</h3>
        </div>
      </div>
      <button class="icon-button" type="button" data-close-profile aria-label="关闭">×</button>
    </div>
    <div class="dialog-body">
      <div class="profile-summary">
        <div class="metric"><span>剩余课时</span><strong>${student.balance}</strong></div>
        <div class="metric"><span>累计实收</span><strong>${money(paid)}</strong></div>
        <div class="metric"><span>待收欠费</span><strong>${money(debt)}</strong></div>
        <div class="metric"><span>相关课节</span><strong>${lessons.length}</strong></div>
      </div>
      <div class="profile-grid">
        <section class="profile-card">
          <h4>基础信息</h4>
          ${profileFacts([
            ["学员编号", student.id],
            ["手机号", student.phone],
            ["手机号归属", student.relation],
            ["年级", student.grade],
            ["学校", student.school],
            ["渠道", student.channel],
            ["负责人", student.owner],
            ["当前班级", student.className],
            ["课程", student.course]
          ])}
          <div class="action-row">
            <button class="small-button" type="button" data-student-order="${escapeHtml(student.id)}">办理报名</button>
            <button class="small-button" type="button" data-student-class="${escapeHtml(student.id)}">调整分班</button>
            <button class="small-button" type="button" data-student-follow="${escapeHtml(student.id)}">新增跟进</button>
          </div>
        </section>
        <section class="profile-card">
          <h4>订单与课时</h4>
          ${renderProfileTable(["订单", "课程", "班级", "购买+赠送", "已上", "实收", "欠费", "有效期"], orderRows)}
        </section>
      </div>
      <section class="profile-card">
        <h4>近期课表</h4>
        ${renderProfileTable(["日期", "班级/对象", "科目", "教师", "状态"], lessonRows)}
      </section>
      <div class="profile-grid">
        <section class="profile-card">
          <h4>课时流水</h4>
          ${renderProfileTable(["时间", "课节", "类型", "变动", "余额", "操作人"], ledgerRows)}
        </section>
        <section class="profile-card">
          <h4>点名与跟进</h4>
          ${renderProfileTable(["日期", "班级/对象", "考勤", "消课", "点名人"], attendanceRows)}
          ${renderProfileTable(["类型", "下次跟进", "结果", "跟进人", "备注"], followUpRows)}
        </section>
      </div>
    </div>`;
  studentProfileDialog.showModal();
}

const baseRenderStudentsForProfile = renderStudents;
renderStudents = function renderStudentsWithProfile() {
  const rows = appState.students
    .filter(matchesRow)
    .map(
      (student) => `<tr>
        <td><strong>${escapeHtml(student.name)}</strong><br><span class="muted">${escapeHtml(student.id)}</span></td>
        <td>${escapeHtml(student.phone)}<br><span class="muted">${escapeHtml(student.relation)}</span></td>
        <td>${escapeHtml(student.grade)}</td>
        <td>${escapeHtml(student.school)}</td>
        <td>${escapeHtml(student.channel)}</td>
        <td>${escapeHtml(student.course)}</td>
        <td>${escapeHtml(student.className)}</td>
        <td>${tag(student.status, statusTone(student.status))}</td>
        <td>${student.balance}</td>
        <td>${student.debt ? tag(money(student.debt), "red") : tag("无欠费", "green")}</td>
        <td>
          <div class="action-row">
            <button class="small-button" type="button" data-student-detail="${student.id}">详情</button>
            <button class="small-button" type="button" data-student-order="${student.id}">报名</button>
            <button class="small-button" type="button" data-student-class="${student.id}">分班</button>
            <button class="small-button" type="button" data-student-follow="${student.id}">跟进</button>
          </div>
        </td>
      </tr>`
    );

  appContent.innerHTML = `
    <section class="section">
      <div class="section-head">
        <h3>学员列表</h3>
        <div class="action-row">
          <button class="small-button" type="button" id="resetDemo">恢复演示数据</button>
          <button class="primary-action" type="button" id="newStudentInline">新增学员</button>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("students")}
        ${table(["学员", "手机号", "年级", "学校", "渠道", "意向/报读课程", "班级", "状态", "剩余课时", "欠费", "操作"], rows)}
      </div>
    </section>`;
};

document.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-student-detail]");
  if (detailButton) showStudentProfile(detailButton.dataset.studentDetail);

  if (event.target.closest("[data-close-profile]")) studentProfileDialog.close();

  if (event.target.closest("[data-student-order], [data-student-class], [data-student-follow]") && studentProfileDialog.open) {
    studentProfileDialog.close();
  }
});

if (currentView === "students") {
  renderView();
}
