const defaultCourses = [
  {
    name: "初二小组课/一对一",
    subject: "数学",
    grade: "初二年级",
    type: "组合课程",
    mode: "线下",
    hours: 30,
    price: 3600,
    status: "在售"
  },
  {
    name: "高一小组课/一对一",
    subject: "物理",
    grade: "高一年级",
    type: "组合课程",
    mode: "线下",
    hours: 20,
    price: 4000,
    status: "在售"
  },
  {
    name: "五六年级小组课",
    subject: "英语",
    grade: "六年级",
    type: "普通课程",
    mode: "线上",
    hours: 24,
    price: 2880,
    status: "在售"
  },
  {
    name: "初三小组课/一对一",
    subject: "数学",
    grade: "初三年级",
    type: "组合课程",
    mode: "线下",
    hours: 12,
    price: 1980,
    status: "在售"
  }
];

const defaultTeachers = [
  {
    name: "数物-张波",
    phone: "13810001001",
    subjects: "数学、物理",
    grades: "初二、初三",
    role: "任课老师",
    weeklyHours: 28,
    status: "在职"
  },
  {
    name: "物理-苗老师",
    phone: "13810001002",
    subjects: "物理",
    grades: "高一",
    role: "任课老师",
    weeklyHours: 22,
    status: "在职"
  },
  {
    name: "英语-王Tony",
    phone: "13810001003",
    subjects: "英语",
    grades: "五年级、六年级",
    role: "任课老师",
    weeklyHours: 24,
    status: "在职"
  },
  {
    name: "校长-奚老师",
    phone: "13810001004",
    subjects: "数学、运营",
    grades: "高二",
    role: "校长/教师",
    weeklyHours: 12,
    status: "在职"
  }
];

const defaultRooms = [
  {
    name: "东楼101室-王楠",
    campus: "主校区",
    capacity: 16,
    type: "线下教室",
    status: "可排课",
    note: "初中小班优先"
  },
  {
    name: "西楼201室",
    campus: "主校区",
    capacity: 12,
    type: "线下教室",
    status: "可排课",
    note: "高中理科"
  },
  {
    name: "西楼103室",
    campus: "主校区",
    capacity: 14,
    type: "线下教室",
    status: "可排课",
    note: "冲刺班"
  },
  {
    name: "线上课程",
    campus: "线上",
    capacity: 60,
    type: "线上教室",
    status: "可排课",
    note: "直播课"
  }
];

function uniqueByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    const name = text(item.name).trim();
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

function ensureMasterData() {
  const classCourses = appState.classes.map((item) => ({
    name: item.course,
    subject: text(item.course).includes("英语") ? "英语" : text(item.course).includes("物理") ? "物理" : "数学",
    grade: text(item.course).slice(0, 4),
    type: text(item.course).includes("一对一") ? "组合课程" : "普通课程",
    mode: item.room === "线上课程" ? "线上" : "线下",
    hours: 20,
    price: 0,
    status: "在售"
  }));
  const classTeachers = appState.classes.map((item) => ({
    name: item.teacher,
    phone: "",
    subjects: item.course,
    grades: item.stage,
    role: "任课老师",
    weeklyHours: 20,
    status: "在职"
  }));
  const lessonTeachers = appState.lessons.map((item) => ({
    name: item.teacher,
    phone: "",
    subjects: item.subject,
    grades: "",
    role: "任课老师",
    weeklyHours: 20,
    status: "在职"
  }));
  const classRooms = appState.classes.map((item) => ({
    name: item.room,
    campus: item.room === "线上课程" ? "线上" : "主校区",
    capacity: item.capacity || 12,
    type: item.room === "线上课程" ? "线上教室" : "线下教室",
    status: "可排课",
    note: item.name
  }));

  appState.courses = uniqueByName([...(Array.isArray(appState.courses) ? appState.courses : []), ...defaultCourses, ...classCourses]);
  appState.teachers = uniqueByName([...(Array.isArray(appState.teachers) ? appState.teachers : []), ...defaultTeachers, ...classTeachers, ...lessonTeachers]);
  appState.rooms = uniqueByName([...(Array.isArray(appState.rooms) ? appState.rooms : []), ...defaultRooms, ...classRooms]);
}

ensureMasterData();

navItems.splice(navItems.findIndex((item) => item.id === "templates"), 0, { id: "masters", label: "基础资料", icon: "库" });
viewMeta.masters = ["基础资料", "课程教师教室"];

const baseRenderNavForMasters = renderNav;
renderNav = function renderNavWithMasterCount() {
  ensureMasterData();
  baseRenderNavForMasters();
  const countNode = navList.querySelector('[data-view="masters"] .nav-count');
  if (countNode) countNode.textContent = appState.courses.length + appState.teachers.length + appState.rooms.length;
};

const baseRenderViewForMasters = renderView;
renderView = function renderViewWithMasters() {
  if (currentView === "masters") {
    renderMasterData();
    return;
  }
  baseRenderViewForMasters();
};

const baseRenderLessonForm = renderLessonForm;
renderLessonForm = function renderLessonFormWithMasterData() {
  if (!appState.courses?.length || !appState.teachers?.length || !appState.rooms?.length) return baseRenderLessonForm();
  const defaultClass = appState.classes[0] || {};
  const defaultDate = typeof lessonDatePresetValue === "function" ? lessonDatePresetValue("nextMonday") : "2026-09-07";
  const recommendation = typeof lessonTargetRecommendation === "function" ? lessonTargetRecommendation(defaultClass) : {
    subject: defaultClass.course || "数学",
    teacher: defaultClass.teacher || "任课老师",
    room: defaultClass.room || "默认教室",
    time: "18:30-20:00",
    timeSlot: "18:30-20:00"
  };
  const [defaultStartTime, defaultEndTime] = text(recommendation.time || "18:30-20:00").split("-").map((part) => part.trim());
  return `
    <form class="operation-panel" id="lessonForm">
      <div>
        <strong>新增课节</strong>
        <span class="muted">选择班级后自动带出科目、老师、教室和推荐时间，保存前会检查冲突。</span>
      </div>
      <div class="operation-grid">
        <label>日期模板<select name="lessonDatePreset">${typeof lessonDatePresetOptions === "function" ? lessonDatePresetOptions("nextMonday") : "<option value=\"custom\">自定义日期</option>"}</select></label>
        <label>上课日期<input name="date" type="date" value="${escapeHtml(defaultDate)}" required /></label>
        <label>上课时间段<select name="timeSlot" id="lessonTimeSlotSelect">${typeof lessonTimeSlotOptions === "function" ? lessonTimeSlotOptions(recommendation.timeSlot) : "<option value=\"18:30-20:00\">晚一 18:30-20:00</option>"}</select></label>
        <label>开始时间<input name="startTime" type="time" value="${escapeHtml(defaultStartTime || "18:30")}" required /></label>
        <label>结束时间<input name="endTime" type="time" value="${escapeHtml(defaultEndTime || "20:00")}" required /></label>
        <label>班级/对象<select name="target" id="lessonTargetSelect" required>${classOptions(defaultClass.name)}</select></label>
        <label>科目<select name="subject" id="lessonSubjectSelect" required>${masterOptions(appState.courses, "subject", recommendation.subject)}</select></label>
        <label>上课教师<select name="teacher" id="lessonTeacherSelect" required>${masterOptions(appState.teachers, "name", recommendation.teacher)}</select></label>
        <label>上课教室<select name="room" id="lessonRoomSelect" required>${masterOptions(appState.rooms, "name", recommendation.room)}</select></label>
        <label>课节类型<select name="type"><option>班级课</option><option>1对1</option></select></label>
        <div class="form-wide muted" data-lesson-recommendation-hint>${escapeHtml(typeof lessonRecommendationHint === "function" ? lessonRecommendationHint(defaultClass, recommendation) : "选择班级后自动带出推荐排课默认项。")}</div>
      </div>
      <div class="dialog-actions">
        <span class="muted">确认上课后会自动扣除对应学员课时。</span>
        <button class="primary-action" type="submit">保存课节</button>
      </div>
    </form>`;
};

function masterOptions(items, key, selectedValue = "") {
  const values = [...new Set(items.map((item) => text(item[key]).trim()).filter(Boolean))];
  return values
    .map((value) => `<option value="${escapeHtml(value)}" ${value === selectedValue || text(selectedValue).includes(value) ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function courseTemplatePresets() {
  return {
    juniorMath: {
      label: "初中数学同步小班",
      name: "初一数学同步班",
      subject: "数学",
      grade: "初一年级",
      type: "普通课程",
      mode: "线下",
      hours: 20,
      price: 2980
    },
    juniorCombo: {
      label: "初中小组/一对一组合",
      name: "初二数学小组/一对一",
      subject: "数学",
      grade: "初二年级",
      type: "组合课程",
      mode: "线下",
      hours: 30,
      price: 3600
    },
    seniorPhysics: {
      label: "高中物理提高班",
      name: "高一物理提高班",
      subject: "物理",
      grade: "高一年级",
      type: "普通课程",
      mode: "线下",
      hours: 24,
      price: 4800
    },
    oneToOne: {
      label: "一对一精品课",
      name: "初三数学一对一",
      subject: "数学",
      grade: "初三年级",
      type: "一对一",
      mode: "线下",
      hours: 10,
      price: 3000
    },
    primaryEnglish: {
      label: "小学英语小班",
      name: "五六年级英语小班",
      subject: "英语",
      grade: "六年级",
      type: "普通课程",
      mode: "线上",
      hours: 24,
      price: 2880
    },
    sprint: {
      label: "考前冲刺班",
      name: "初三数学冲刺班",
      subject: "数学",
      grade: "初三年级",
      type: "普通课程",
      mode: "线下",
      hours: 12,
      price: 1980
    }
  };
}

function courseTemplateOptions(selectedValue = "juniorMath") {
  return Object.entries(courseTemplatePresets())
    .map(([key, item]) => `<option value="${escapeHtml(key)}" ${key === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function courseSelectOptions(values, selectedValue) {
  return values
    .map((value) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function applyCourseTemplate(form, templateKey = "juniorMath") {
  if (!form) return;
  const preset = courseTemplatePresets()[templateKey] || courseTemplatePresets().juniorMath;
  if (form.elements.name) form.elements.name.value = preset.name;
  if (form.elements.subject) form.elements.subject.innerHTML = typeof subjectChoiceOptions === "function" ? subjectChoiceOptions(preset.subject) : `<option>${escapeHtml(preset.subject)}</option>`;
  if (form.elements.grade) form.elements.grade.innerHTML = typeof gradeChoiceOptions === "function" ? gradeChoiceOptions(preset.grade) : `<option>${escapeHtml(preset.grade)}</option>`;
  if (form.elements.type) form.elements.type.innerHTML = courseSelectOptions(["普通课程", "组合课程", "一对一"], preset.type);
  if (form.elements.mode) form.elements.mode.innerHTML = courseSelectOptions(["线下", "线上", "混合"], preset.mode);
  if (form.elements.hours) form.elements.hours.value = preset.hours;
  if (form.elements.price) form.elements.price.value = preset.price;
}

function teacherTemplatePresets() {
  return {
    juniorMathTeacher: { label: "初中数学任课老师", name: "数学-李老师", subjects: "数学", grades: "初一、初二、初三", role: "任课老师", weeklyHours: 24 },
    physicsTeacher: { label: "高中物理任课老师", name: "物理-陈老师", subjects: "物理", grades: "高一、高二", role: "任课老师", weeklyHours: 22 },
    englishTeacher: { label: "小学英语老师", name: "英语-王老师", subjects: "英语", grades: "五年级、六年级", role: "任课老师", weeklyHours: 20 },
    assistant: { label: "小班助教", name: "助教-刘老师", subjects: "全科托管", grades: "小初", role: "助教", weeklyHours: 28 },
    headTeacher: { label: "班主任/学管师", name: "学管-周老师", subjects: "全科托管", grades: "初中", role: "班主任", weeklyHours: 30 }
  };
}

function teacherTemplateOptions(selectedValue = "juniorMathTeacher") {
  return Object.entries(teacherTemplatePresets())
    .map(([key, item]) => `<option value="${escapeHtml(key)}" ${key === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function applyTeacherTemplate(form, templateKey = "juniorMathTeacher") {
  if (!form) return;
  const preset = teacherTemplatePresets()[templateKey] || teacherTemplatePresets().juniorMathTeacher;
  if (form.elements.name) form.elements.name.value = preset.name;
  if (form.elements.subjects) form.elements.subjects.innerHTML = typeof staffSubjectOptions === "function" ? staffSubjectOptions(preset.subjects) : `<option>${escapeHtml(preset.subjects)}</option>`;
  if (form.elements.grades) form.elements.grades.innerHTML = typeof staffGradeOptions === "function" ? staffGradeOptions(preset.grades) : `<option>${escapeHtml(preset.grades)}</option>`;
  if (form.elements.role) form.elements.role.innerHTML = courseSelectOptions(["任课老师", "助教", "班主任"], preset.role);
  if (form.elements.weeklyHours) form.elements.weeklyHours.value = preset.weeklyHours;
}

function roomTemplatePresets() {
  return {
    smallClass: { label: "标准小班教室", name: "东楼202室", campus: "主校区", capacity: 12, type: "线下教室", note: "初中小班优先" },
    seniorScience: { label: "高中理科教室", name: "西楼301室", campus: "主校区", capacity: 16, type: "线下教室", note: "高中理科" },
    oneToOneRoom: { label: "一对一教室", name: "一对一教室A", campus: "主校区", capacity: 4, type: "线下教室", note: "一对一教室" },
    onlineRoom: { label: "线上直播教室", name: "线上直播间A", campus: "线上", capacity: 80, type: "线上教室", note: "直播课" },
    studyRoom: { label: "自习托管教室", name: "自习室A", campus: "主校区", capacity: 24, type: "自习室", note: "自习托管" }
  };
}

function roomTemplateOptions(selectedValue = "smallClass") {
  return Object.entries(roomTemplatePresets())
    .map(([key, item]) => `<option value="${escapeHtml(key)}" ${key === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");
}

function applyRoomTemplate(form, templateKey = "smallClass") {
  if (!form) return;
  const preset = roomTemplatePresets()[templateKey] || roomTemplatePresets().smallClass;
  if (form.elements.name) form.elements.name.value = preset.name;
  if (form.elements.campus) form.elements.campus.innerHTML = typeof campusChoiceOptions === "function" ? campusChoiceOptions(preset.campus) : `<option>${escapeHtml(preset.campus)}</option>`;
  if (form.elements.capacity) form.elements.capacity.value = preset.capacity;
  if (form.elements.type) form.elements.type.innerHTML = courseSelectOptions(["线下教室", "线上教室", "自习室"], preset.type);
  if (form.elements.note) form.elements.note.innerHTML = typeof roomNoteOptions === "function" ? roomNoteOptions(preset.note) : `<option>${escapeHtml(preset.note)}</option>`;
}

function renderMasterData() {
  const activeTeachers = appState.teachers.filter((item) => item.status !== "离职").length;
  const availableRooms = appState.rooms.filter((item) => item.status === "可排课").length;
  appContent.innerHTML = `
    <div class="summary-grid">
      <div class="metric"><span>课程资料</span><strong>${appState.courses.length}</strong></div>
      <div class="metric"><span>在职教师</span><strong>${activeTeachers}</strong></div>
      <div class="metric"><span>可排教室</span><strong>${availableRooms}</strong></div>
      <div class="metric"><span>开课班级</span><strong>${appState.classes.length}</strong></div>
    </div>
    <section class="section">
      <div class="section-head">
        <div>
          <h3>基础资料维护</h3>
          <span class="muted">先维护课程、教师、教室，再用于报名、分班和排课。</span>
        </div>
      </div>
      <div class="section-body">
        ${renderNotice("masters")}
        <div class="master-grid">
          ${renderCourseForm()}
          ${renderTeacherForm()}
          ${renderRoomForm()}
        </div>
      </div>
    </section>
    ${renderMasterTables()}`;
}

function renderCourseForm() {
  const defaults = courseTemplatePresets().juniorMath;
  return `
    <form class="master-card" id="courseForm">
      <h4>新增课程</h4>
      <div class="operation-grid">
        <label>课程报价模板<select name="template">${courseTemplateOptions("juniorMath")}</select></label>
        <label>课程名称<input name="name" required value="${escapeHtml(defaults.name)}" placeholder="例如 初一数学同步班" /></label>
        <label>科目<select name="subject" required>${subjectChoiceOptions(defaults.subject)}</select></label>
        <label>年级<select name="grade" required>${gradeChoiceOptions(defaults.grade)}</select></label>
        <label>课程类型<select name="type">${courseSelectOptions(["普通课程", "组合课程", "一对一"], defaults.type)}</select></label>
        <label>授课方式<select name="mode">${courseSelectOptions(["线下", "线上", "混合"], defaults.mode)}</select></label>
        <label>标准课时<input name="hours" type="number" min="1" value="${escapeHtml(defaults.hours)}" required /></label>
        <label>标准价<input name="price" type="number" min="0" value="${escapeHtml(defaults.price)}" /></label>
      </div>
      <button class="primary-action" type="submit">保存课程</button>
    </form>`;
}

function renderTeacherForm() {
  const defaults = teacherTemplatePresets().juniorMathTeacher;
  return `
    <form class="master-card" id="teacherForm">
      <h4>新增教师</h4>
      <div class="operation-grid">
        <label>教师岗位模板<select name="template">${teacherTemplateOptions("juniorMathTeacher")}</select></label>
        <label>教师姓名<input name="name" required value="${escapeHtml(defaults.name)}" placeholder="例如 数学-李老师" /></label>
        <label>手机号<input name="phone" maxlength="11" /></label>
        <label>科目<select name="subjects" required>${staffSubjectOptions(defaults.subjects)}</select></label>
        <label>年级<select name="grades" required>${staffGradeOptions(defaults.grades)}</select></label>
        <label>角色<select name="role">${courseSelectOptions(["任课老师", "助教", "班主任"], defaults.role)}</select></label>
        <label>每周容量<input name="weeklyHours" type="number" min="0" value="${escapeHtml(defaults.weeklyHours)}" /></label>
      </div>
      <button class="primary-action" type="submit">保存教师</button>
    </form>`;
}

function renderRoomForm() {
  const defaults = roomTemplatePresets().smallClass;
  return `
    <form class="master-card" id="roomForm">
      <h4>新增教室</h4>
      <div class="operation-grid">
        <label>教室模板<select name="template">${roomTemplateOptions("smallClass")}</select></label>
        <label>教室名称<input name="name" required value="${escapeHtml(defaults.name)}" placeholder="例如 东楼202室" /></label>
        <label>校区<select name="campus" required>${campusChoiceOptions(defaults.campus)}</select></label>
        <label>容量<input name="capacity" type="number" min="1" value="${escapeHtml(defaults.capacity)}" /></label>
        <label>教室类型<select name="type">${courseSelectOptions(["线下教室", "线上教室", "自习室"], defaults.type)}</select></label>
        <label>备注<select name="note">${roomNoteOptions(defaults.note)}</select></label>
      </div>
      <button class="primary-action" type="submit">保存教室</button>
    </form>`;
}

function renderMasterTables() {
  const courseRows = appState.courses.filter(matchesRow).map(
    (item) => `<tr>
      <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${escapeHtml(item.mode)}</span></td>
      <td>${escapeHtml(item.subject)} / ${escapeHtml(item.grade)}</td>
      <td>${escapeHtml(item.type)}</td>
      <td>${item.hours}</td>
      <td>${money(item.price || 0)}</td>
      <td>${tag(item.status, item.status === "在售" ? "green" : "amber")}</td>
    </tr>`
  );
  const teacherRows = appState.teachers.filter(matchesRow).map(
    (item) => `<tr>
      <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${escapeHtml(item.phone)}</span></td>
      <td>${escapeHtml(item.subjects)}</td>
      <td>${escapeHtml(item.grades)}</td>
      <td>${escapeHtml(item.role)}</td>
      <td>${item.weeklyHours}</td>
      <td>${tag(item.status, item.status === "在职" ? "green" : "amber")}</td>
    </tr>`
  );
  const roomRows = appState.rooms.filter(matchesRow).map(
    (item) => `<tr>
      <td><strong>${escapeHtml(item.name)}</strong><br><span class="muted">${escapeHtml(item.campus)}</span></td>
      <td>${item.capacity}</td>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.note)}</td>
      <td>${tag(item.status, item.status === "可排课" ? "green" : "amber")}</td>
    </tr>`
  );

  return `
    <div class="layout-two">
      <section class="section">
        <div class="section-head compact-head"><h3>课程报价资料</h3></div>
        ${table(["课程", "科目/年级", "类型", "课时", "标准价", "状态"], courseRows)}
      </section>
      <section class="section">
        <div class="section-head compact-head"><h3>教师资料</h3></div>
        ${table(["教师", "科目", "年级", "角色", "周容量", "状态"], teacherRows)}
      </section>
    </div>
    <section class="section">
      <div class="section-head compact-head"><h3>教室资料</h3></div>
      ${table(["教室", "容量", "类型", "备注", "状态"], roomRows)}
    </section>`;
}

function addCourse(formData) {
  const name = text(formData.get("name")).trim();
  if (appState.courses.some((item) => item.name === name)) {
    setNotice("masters", `课程 ${name} 已存在。`, "red");
    renderView();
    return;
  }
  appState.courses.unshift({
    name,
    subject: text(formData.get("subject")).trim(),
    grade: text(formData.get("grade")).trim(),
    type: text(formData.get("type")),
    mode: text(formData.get("mode")),
    hours: numberFromForm(formData, "hours", 20),
    price: numberFromForm(formData, "price", 0),
    status: "在售"
  });
  setNotice("masters", `课程 ${name} 已保存。`);
  saveState();
  setView("masters");
}

function addTeacher(formData) {
  const name = text(formData.get("name")).trim();
  if (appState.teachers.some((item) => item.name === name)) {
    setNotice("masters", `教师 ${name} 已存在。`, "red");
    renderView();
    return;
  }
  appState.teachers.unshift({
    name,
    phone: text(formData.get("phone")).trim(),
    subjects: text(formData.get("subjects")).trim(),
    grades: text(formData.get("grades")).trim(),
    role: text(formData.get("role")),
    weeklyHours: numberFromForm(formData, "weeklyHours", 20),
    status: "在职"
  });
  setNotice("masters", `教师 ${name} 已保存，可用于排课。`);
  saveState();
  setView("masters");
}

function addRoom(formData) {
  const name = text(formData.get("name")).trim();
  if (appState.rooms.some((item) => item.name === name)) {
    setNotice("masters", `教室 ${name} 已存在。`, "red");
    renderView();
    return;
  }
  appState.rooms.unshift({
    name,
    campus: text(formData.get("campus")).trim(),
    capacity: numberFromForm(formData, "capacity", 12),
    type: text(formData.get("type")),
    status: "可排课",
    note: text(formData.get("note")).trim()
  });
  setNotice("masters", `教室 ${name} 已保存，可用于排课。`);
  saveState();
  setView("masters");
}

document.addEventListener("submit", (event) => {
  if (event.target.id === "courseForm") {
    event.preventDefault();
    addCourse(new FormData(event.target));
  }

  if (event.target.id === "teacherForm") {
    event.preventDefault();
    addTeacher(new FormData(event.target));
  }

  if (event.target.id === "roomForm") {
    event.preventDefault();
    addRoom(new FormData(event.target));
  }
});

document.addEventListener("change", (event) => {
  if (event.target.name === "template" && event.target.closest("#courseForm")) {
    applyCourseTemplate(event.target.form, event.target.value);
    return;
  }

  if (event.target.name === "template" && event.target.closest("#teacherForm")) {
    applyTeacherTemplate(event.target.form, event.target.value);
    return;
  }

  if (event.target.name === "template" && event.target.closest("#roomForm")) {
    applyRoomTemplate(event.target.form, event.target.value);
    return;
  }

  if (event.target.id !== "lessonTargetSelect") return;
  syncLessonTargetDefaults(event.target.form || event.target.closest("form"));
});

saveState();
renderNav();
