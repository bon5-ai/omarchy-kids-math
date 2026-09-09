const assert = require("assert")
const path = require("path")
const engine = require(path.join(__dirname, "..", "MathEngine.js"))

function check(name, fn) {
  fn()
  console.log("ok  " + name)
}

check("six age-banded levels", function () {
  const levels = engine.levels()
  assert.equal(levels.length, 6)
  assert.equal(levels[0].ages, "5–6")
  assert.equal(levels[5].ages, "10–12")
  assert.equal(engine.clampLevelId(0), 1)
  assert.equal(engine.clampLevelId(99), 6)
})

check("deterministic rounds from a seed", function () {
  const a = engine.generateRound(2, 8, 42)
  const b = engine.generateRound(2, 8, 42)
  assert.equal(a.length, 8)
  assert.deepEqual(a.map(function (q) { return q.prompt }), b.map(function (q) { return q.prompt }))
  assert.deepEqual(a.map(function (q) { return q.answer }), b.map(function (q) { return q.answer }))
})

check("every generated question has an integer answer and choices", function () {
  for (let level = 1; level <= 6; level++) {
    const round = engine.generateRound(level, 24, 1000 + level)
    assert.equal(round.length, 24)
    round.forEach(function (q) {
      assert.equal(typeof q.answer, "number")
      assert.equal(Math.floor(q.answer), q.answer)
      assert.ok(Array.isArray(q.choices))
      assert.ok(q.choices.indexOf(q.answer) !== -1, q.skill + " missing answer in choices")
      const graded = engine.grade(q, q.answer)
      assert.equal(graded.correct, true)
      assert.equal(engine.grade(q, q.answer + 1).correct, false)
      if (q.promptKind === "dots") assert.equal(q.dots, q.answer)
      if (q.promptKind === "compare") assert.equal(q.answer, Math.max(q.left, q.right))
    })
  }
})

check("grade accepts numeric strings and rejects junk", function () {
  const q = { answer: 12 }
  assert.equal(engine.grade(q, "12").correct, true)
  assert.equal(engine.grade(q, " 12 ").correct, true)
  assert.equal(engine.grade(q, "-3").correct, false)
  assert.equal(engine.parseResponse("-3"), -3)
  assert.equal(engine.parseResponse("1.5"), null)
  assert.equal(engine.parseResponse("12abc"), null)
})

check("payload defaults and assessment start", function () {
  const practice = engine.parsePayload("{}")
  assert.equal(practice.mode, "practice")
  assert.equal(practice.start, false)
  assert.equal(practice.level, 0)
  const assessment = engine.parsePayload({
    mode: "assessment",
    learnerId: "sam",
    count: 15,
    seed: 7,
    resultFile: "/tmp/math.json",
    doneFile: "/tmp/math.done"
  })
  assert.equal(assessment.mode, "assessment")
  assert.equal(assessment.start, true)
  assert.equal(assessment.level, 3)
  assert.equal(assessment.count, 15)
  assert.equal(assessment.learnerId, "sam")
  assert.equal(assessment.adaptive, true)
  assert.equal(assessment.resultFile, undefined)
  assert.equal(assessment.doneFile, undefined)
})

check("adaptive level moves up and down", function () {
  const easy = [{ correct: true }, { correct: true }, { correct: true }]
  const hard = [{ correct: false }, { correct: false }, { correct: true }]
  assert.equal(engine.nextAdaptiveLevel(3, easy), 4)
  assert.equal(engine.nextAdaptiveLevel(3, hard), 2)
  assert.equal(engine.nextAdaptiveLevel(6, easy), 6)
  assert.equal(engine.nextAdaptiveLevel(1, hard), 1)
})

check("recommendLevel uses 70% with enough samples", function () {
  const items = []
  for (let i = 0; i < 4; i++) items.push({ levelId: 1, correct: true, skill: "a" })
  for (let i = 0; i < 4; i++) items.push({ levelId: 2, correct: true, skill: "b" })
  for (let i = 0; i < 4; i++) items.push({ levelId: 3, correct: i < 1, skill: "c" })
  assert.equal(engine.recommendLevel(items), 2)
})

check("progress records preferred level", function () {
  let progress = engine.emptyProgress()
  progress = engine.recordRound(progress, "sam", 2, 10, 10, 10)
  assert.equal(progress.learners.sam.preferredLevel, 3)
  progress = engine.recordRound(progress, "sam", 3, 1, 10, 0)
  assert.equal(progress.learners.sam.preferredLevel, 2)
})

check("buildResult matches tutor contract", function () {
  const result = engine.buildResult({
    mode: "assessment",
    status: "complete",
    learnerId: "sam",
    startedAt: "2026-09-09T00:00:00.000Z",
    finishedAt: "2026-09-09T00:05:00.000Z",
    levelId: 3,
    seed: 42,
    items: [
      { skill: "add-within-100", levelId: 3, prompt: "10 + 10", answer: 20, response: 20, correct: true, ms: 1000 },
      { skill: "sub-within-100", levelId: 3, prompt: "10 − 4", answer: 6, response: 5, correct: false, ms: 2000 }
    ]
  })
  assert.equal(result.pluginId, "omarchykids.math")
  assert.equal(result.correct, 1)
  assert.equal(result.total, 2)
  assert.equal(result.accuracy, 0.5)
  assert.equal(result.avgMs, 1500)
  assert.equal(result.skillScores["add-within-100"].correct, 1)
  assert.ok(JSON.parse(engine.catalogJson()).levels.length === 6)
})

check("every catalog skill has a generator", function () {
  engine.levels().forEach(function (level) {
    level.skills.forEach(function (skill) {
      const q = engine.generateQuestion(level.id, engine.createRng(99), skill)
      assert.equal(q.skill, skill)
      assert.equal(typeof q.answer, "number")
    })
  })
})

check("stars thresholds", function () {
  assert.equal(engine.starsForAccuracy(0.95), 3)
  assert.equal(engine.starsForAccuracy(0.7), 2)
  assert.equal(engine.starsForAccuracy(0.5), 1)
  assert.equal(engine.starsForAccuracy(0.2), 0)
})

console.log("\nAll MathEngine tests passed.")

check("every skill has teaching support and sensible number domains across seeds", () => {
  engine.levels().forEach(level => {
    level.skills.forEach(skill => {
      for (let seed = 1; seed <= 200; seed++) {
        const q = engine.generateQuestion(level.id, engine.createRng(seed), skill)
        assert(q.support.hint.length > 15, skill)
        assert(q.support.explanation.length > 5, skill)
        assert.strictEqual(new Set(q.choices).size, q.choices.length)
        if (level.id < 6) {
          assert(q.answer >= 0, skill)
          assert(q.choices.every(n => n >= 0), skill)
        }
        if (q.promptKind === "compare") {
          assert(q.prompt.includes(String(q.left)))
          assert(q.prompt.includes(String(q.right)))
        }
      }
    })
  })
})

check("corrupt progress and special learner IDs cannot corrupt other profiles", () => {
  for (const raw of ["null", "[]", "false", "broken", '{"learners":[]}']) {
    const data = engine.normalizeProgress(raw)
    const record = engine.learnerRecord(data, "sam")
    assert.strictEqual(record.rounds, 0)
    assert.deepStrictEqual(record.notebook, [])
  }
  const data = engine.normalizeProgress('{"learners":{"sam":{"rounds":"oops","byLevel":null,"practiceSkills":[]}}}')
  const sam = engine.learnerRecord(data, "sam")
  assert.strictEqual(sam.rounds, 0)
  assert.deepStrictEqual(sam.byLevel, {})
  for (const id of ["__proto__", "constructor", "toString"]) {
    const learner = engine.learnerRecord(data, id)
    learner.rounds = 7
    assert.strictEqual(engine.learnerRecord(JSON.parse(JSON.stringify(data)), id).rounds, 7)
  }
  assert.strictEqual({}.rounds, undefined)
  assert.strictEqual(sam.rounds, 0)
})

check("session progress attributes adaptive items to their actual levels", () => {
  const result = engine.buildResult({mode: "assessment", status: "complete", learnerId: "sam", levelId: 3, items: [
    {levelId: 2, skill: "add-within-20", correct: true, attempts: 1},
    {levelId: 3, skill: "add-within-100", correct: true, attempts: 1},
    {levelId: 3, skill: "sub-within-100", correct: false, attempts: 1}
  ]})
  const data = engine.recordSession(engine.emptyProgress(), result, 2)
  assert.strictEqual(data.learners.sam.byLevel[2].total, 1)
  assert.strictEqual(data.learners.sam.byLevel[3].total, 2)
  assert.strictEqual(data.learners.sam.bestStreak, 2)
  assert.strictEqual(data.learners.sam.rounds, 1)
  assert.strictEqual(data.lastAssessment, result)
  const practice = engine.buildResult({mode: "practice", learnerId: "sam", levelId: 2, items: [
    {levelId: 2, skill: "add-within-20", correct: true, attempts: 2, hintUsed: true}
  ]})
  engine.recordSession(data, practice, 0)
  assert.strictEqual(data.lastAssessment, result)
  assert.strictEqual(data.learners.sam.practiceSkills["add-within-20"].independent, 0)
  assert.strictEqual(data.learners.sam.practiceSkills["add-within-20"].total, 1)
})

check("abandonment doesn't change preferred level or count as completion", () => {
  const data = engine.emptyProgress()
  engine.learnerRecord(data, "sam").preferredLevel = 4
  engine.recordSession(data, engine.buildResult({mode: "assessment", status: "abandoned", learnerId: "sam", levelId: 4, items: [
    {levelId: 4, skill: "mul-to-10", correct: false, attempts: 1}
  ]}), 0)
  assert.strictEqual(data.learners.sam.preferredLevel, 4)
  assert.strictEqual(data.learners.sam.rounds, 0)
  const before = JSON.stringify(data)
  engine.recordSession(data, engine.buildResult({mode: "assessment", status: "abandoned", learnerId: "sam", items: []}), 0)
  assert.strictEqual(JSON.stringify(data), before)
})

check("practice supports weaker skills while retaining whole-level coverage", () => {
  const data = engine.emptyProgress()
  const learner = engine.learnerRecord(data, "sam")
  learner.practiceSkills = {
    "add-within-20": {independent: 20, total: 20},
    "sub-within-20": {independent: 0, total: 10},
    "missing-addend-20": {independent: 20, total: 20}
  }
  const round = engine.generatePracticeRound(2, 10, 99, learner)
  assert.deepStrictEqual(round, engine.generatePracticeRound(2, 10, 99, learner))
  engine.levels()[1].skills.forEach(skill => assert(round.some(q => q.skill === skill)))
  assert(round.filter(q => q.skill === "sub-within-20").length >= 5)
})

check("helped success is learning but not evidence for promotion", () => {
  const result = engine.buildResult({mode: "practice", learnerId: "sam", levelId: 3, items: Array.from({length: 10}, () => (
    {levelId: 3, skill: "add-within-100", correct: true, attempts: 2, hintUsed: true}
  ))})
  assert.strictEqual(result.correct, 10)
  assert.strictEqual(result.independentCorrect, 0)
  const data = engine.recordSession(engine.emptyProgress(), result, 0)
  assert.strictEqual(data.learners.sam.preferredLevel, 3, "using help alone must not lower the level")
})

console.log("\nAll extended MathEngine tests passed.")
