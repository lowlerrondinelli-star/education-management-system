function feedbackFollowUpStudent(feedback) {
  return appState.students.find((student) => student.id === feedback.studentId || student.name === feedback.student);
}

function feedbackFollowUpKey(feedback) {
  return `高风险反馈:${feedback.lessonId}:${feedback.studentId || feedback.student}`;
}

function feedbackFollowUpNote(feedback, lesson) {
  const message = text(feedback.parentMessage).trim();
  const homework = text(feedback.homework).trim();
  const detail = message || homework || "老师已在课后反馈中标记为高风险。";
  return `${lesson.date} ${lesson.time} ${lesson.subject} / ${lesson.target}：${detail}`;
}

function syncFeedbackFollowUps(lessonId) {
  if (typeof ensureFollowUpData !== "function") return 0;
  if (!Array.isArray(appState.followUps)) appState.followUps = [];

  ensureFollowUpData();
  const lesson = appState.lessons.find((item) => item.id === lessonId);
  if (!lesson) return 0;

  const now = new Date().toLocaleString("zh-CN", { hour12: false });
  let changed = 0;

  lessonFeedbacks(lessonId)
    .filter((feedback) => feedback.risk === "高")
    .forEach((feedback) => {
      const student = feedbackFollowUpStudent(feedback);
      const key = feedbackFollowUpKey(feedback);
      const existing = appState.followUps.find((item) => item.key === key);
      const payload = {
        key,
        studentId: student?.id || feedback.studentId || "",
        student: feedback.student,
        phone: student?.phone || "",
        type: "高风险反馈",
        owner: student?.owner || lesson.teacher || "教务老师",
        dueDate: typeof todayText === "function" ? todayText() : new Date().toISOString().slice(0, 10),
        status: "待跟进",
        result: "待联系",
        priority: "高",
        source: "课后反馈",
        note: feedbackFollowUpNote(feedback, lesson),
        updatedAt: now
      };

      if (existing) {
        if (existing.status === "已完成") return;
        Object.assign(existing, payload);
      } else {
        appState.followUps.unshift({ id: nextId("F"), ...payload });
      }
      changed += 1;
    });

  return changed;
}

const baseSaveLessonFeedbackForFollowUp = saveLessonFeedback;
saveLessonFeedback = function saveLessonFeedbackWithFollowUp(form, status) {
  const lessonId = form.dataset.lessonId;
  baseSaveLessonFeedbackForFollowUp(form, status);
  const changed = syncFeedbackFollowUps(lessonId);
  if (!changed) return;

  setNotice("feedback", `课后反馈已保存，并同步生成/更新 ${changed} 个高风险跟进待办。`);
  saveState();
  renderNav();
  if (currentView === "feedback") renderView();
};
