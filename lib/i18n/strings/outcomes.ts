/** Item results on item pages and the card session (task 5.2c; Part B-M5 decision 3). */
export const outcomes = {
  /** The page header (§2.4): the item is in the plan check-ins and results go to (decision 13). */
  plan: {
    today: 'Trong kế hoạch hôm nay',
    /** The paused plan while the gate is closed, or the resumed plan on a resume day. */
    earlier: 'Trong kế hoạch đang dở',
  },
  /** A save that never got an answer (offline, a server error): the learner may try again. */
  failed: 'Chưa lưu được kết quả. Bạn thử lại nhé.',
  problem: {
    /** A new problem, or a redo (§5.5): solved alone, needed a hint, not solved. */
    solveLabel: 'Bạn giải bài này thế nào?',
    solve: { solved: 'Tự giải được', hint: 'Cần gợi ý', failed: 'Chưa giải được' },
    redoBody: 'Giải lại trên LeetCode từ đầu, không mở lời giải, rồi tự chấm.',
    /** Quick recall and explain-aloud (§5.5; decision 17): the same results, `mode: 'recall'`. */
    recallLabel: 'Bạn nhớ bài này đến đâu?',
    recall: { solved: 'Nhớ rõ', hint: 'Nhớ một phần', failed: 'Không nhớ' },
    recallPrompt: 'Nêu pattern, cách làm và độ phức tạp',
    recallBody: 'Nói to hoặc ghi nhanh vài dòng, rồi mở ghi chú để tự chấm.',
    explainAloudBody: 'Giải thích to bằng tiếng Anh như khi phỏng vấn, rồi mở ghi chú để tự chấm.',
    showNote: 'Xem ghi chú',
    hideNote: 'Ẩn ghi chú',
    /** Switches a quick recall to a redo (§5.5). */
    redo: 'Làm lại từ đầu',
    /** Decision 18 (DESIGN_SYSTEM §9): the nudge after "Xem lời giải"; `{grade}` is its label. */
    nudge: 'Bạn đã xem lời giải nên "{grade}" được chọn sẵn — bấm để lưu, hoặc chọn mức khác.',
  },
  flashcard: {
    label: 'Bạn nhớ thẻ này không?',
    grades: { know: 'Biết', unsure: 'Chưa chắc', dont_know: 'Không biết' },
    /** Keyboard 1 / 2 / 3 (DESIGN_SYSTEM §9). */
    keys: 'Phím tắt: 1 = Biết, 2 = Chưa chắc, 3 = Không biết.',
  },
  lesson: {
    complete: 'Hoàn thành bài học',
    /** The Quiz's score travels with `lesson.completed` (§4.4). */
    quizScore: 'Kèm điểm kiểm tra nhanh: {percent}%',
  },
  exercise: {
    /** A respond / rewrite exercise, graded by the learner against the rubric (§3.5). */
    selfGradeLabel: 'Tự chấm theo tiêu chí',
    grades: { pass: 'Đạt', close: 'Gần đạt', miss: 'Chưa đạt' },
  },
  prompt: {
    done: 'Đã làm xong',
    ratingLabel: 'Tự đánh giá (không bắt buộc)',
    ratings: { 1: '1 — Chưa tốt', 2: '2 — Tạm được', 3: '3 — Tốt' },
  },
  /** The mock-interview prompt's problem (§5.6; M4 decision 24: `mockInterviewProblem`). */
  mockInterview: {
    pick: 'Bài cho buổi phỏng vấn thử',
    none: 'Chưa có bài Medium nào đã học',
    noneBody: 'Học một bài Medium trong lộ trình DSA, rồi quay lại buổi phỏng vấn thử.',
  },
  /** Every item (§5.7): skip while not introduced or due; re-add a mastered item. */
  actions: {
    skip: 'Bỏ qua mục này',
    skipTitle: 'Bỏ qua mục này?',
    skipBody:
      'Mục này được tính là đã xử lý trong kế hoạch và không vào ôn tập nữa. Bạn vẫn có thể mở lại và học bất cứ lúc nào.',
    skipConfirm: 'Bỏ qua',
    readd: 'Ôn lại',
    readdBody: 'Bạn đã thành thạo mục này. "Ôn lại" đưa nó trở lại ôn tập từ hôm nay.',
  },
  /** CardSession (decision 19): due cards on /review, card blocks on /today. */
  session: {
    remaining: 'Còn {count} thẻ',
    /** Announced after a grade: the card's front and the grade's label (a new text each time). */
    saved: 'Đã lưu thẻ {front}: {grade}.',
    doneTitle: 'Đã ôn xong',
    doneBody: 'Bạn đã chấm {count} thẻ.',
    emptyTitle: 'Không có thẻ nào để ôn',
    errorTitle: 'Chưa lưu được kết quả',
  },
} as const
