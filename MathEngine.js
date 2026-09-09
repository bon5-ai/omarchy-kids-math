// Shared by Overlay.qml (QML) and tests/math-engine-test.js (Node).
// Keep this file free of QML types so both runtimes can load it.

function levels() {
  return [
    {
      id: 1,
      key: "count",
      name: "Count",
      ages: "5–6",
      grade: "K",
      blurb: "Count, compare, and add tiny numbers.",
      input: "choices",
      skills: ["count-to-10", "compare-to-10", "add-within-5"]
    },
    {
      id: 2,
      key: "facts",
      name: "Add & take away",
      ages: "6–7",
      grade: "1",
      blurb: "Addition and subtraction within 20.",
      input: "choices",
      skills: ["add-within-20", "sub-within-20", "missing-addend-20"]
    },
    {
      id: 3,
      key: "tens",
      name: "Tens",
      ages: "7–8",
      grade: "2",
      blurb: "Two-digit adding, subtracting, and skip counting.",
      input: "choices",
      skills: ["add-within-100", "sub-within-100", "skip-count"]
    },
    {
      id: 4,
      key: "times",
      name: "Times",
      ages: "8–9",
      grade: "3",
      blurb: "Times tables, sharing equally, and bigger adding.",
      input: "keypad",
      skills: ["mul-to-10", "div-to-10", "add-within-1000"]
    },
    {
      id: 5,
      key: "big",
      name: "Bigger numbers",
      ages: "9–10",
      grade: "4",
      blurb: "Multi-digit multiply, divide, and mixed facts.",
      input: "keypad",
      skills: ["mul-2digit", "div-exact", "mixed-add-sub"]
    },
    {
      id: 6,
      key: "parts",
      name: "Parts & percents",
      ages: "10–12",
      grade: "5–6",
      blurb: "Fractions, percents, order of operations, negatives.",
      input: "keypad",
      skills: ["fraction-of", "percent-of", "order-ops", "negatives"]
    }
  ]
}

function levelById(id) {
  var wanted = Number(id)
  var all = levels()
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === wanted) return all[i]
  }
  return all[0]
}

function clampLevelId(id) {
  var n = parseInt(id, 10)
  if (isNaN(n) || n < 1) return 1
  if (n > 6) return 6
  return n
}

function createRng(seed) {
  var t = Number(seed)
  if (!isFinite(t)) t = 1
  t = t >>> 0
  if (t === 0) t = 1
  return function () {
    t += 0x6D2B79F5
    var r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function rngInt(rng, min, max) {
  var lo = Math.ceil(min)
  var hi = Math.floor(max)
  if (hi < lo) {
    var tmp = lo
    lo = hi
    hi = tmp
  }
  return lo + Math.floor(rng() * (hi - lo + 1))
}

function pick(rng, values) {
  if (!values || values.length === 0) return undefined
  return values[rngInt(rng, 0, values.length - 1)]
}

function shuffle(values, rng) {
  var out = values.slice()
  for (var i = out.length - 1; i > 0; i--) {
    var j = rngInt(rng, 0, i)
    var tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function uniqueChoices(answer, rng, extras, count) {
  var want = count || 4
  var seen = {}
  var out = []

  function add(value) {
    if (typeof value !== "number" || !isFinite(value)) return
    if (Math.floor(value) !== value) return
    var key = String(value)
    if (seen[key]) return
    seen[key] = true
    out.push(value)
  }

  add(answer)
  if (Array.isArray(extras)) {
    for (var i = 0; i < extras.length; i++) add(extras[i])
  }

  var guard = 0
  while (out.length < want && guard < 80) {
    var span = Math.max(3, Math.abs(answer) + 4)
    add(answer + rngInt(rng, -span, span))
    guard++
  }

  var n = 1
  while (out.length < want) {
    add(answer + n)
    add(answer - n)
    n++
  }

  return shuffle(out.slice(0, want), rng)
}

function question(fields) {
  var q = fields || {}
  q.promptKind = q.promptKind || "text"
  q.dots = q.dots || 0
  q.left = q.left || 0
  q.right = q.right || 0
  q.input = q.input || "choices"
  if (!Array.isArray(q.choices)) q.choices = []
  return q
}

function genCountTo10(rng, level) {
  var n = rngInt(rng, 1, 10)
  return question({
    skill: "count-to-10",
    levelId: level.id,
    prompt: "How many?",
    promptKind: "dots",
    dots: n,
    answer: n,
    input: "choices",
    choices: uniqueChoices(n, rng, [n - 1, n + 1, n + 2], 4)
  })
}

function genCompareTo10(rng, level) {
  var a = rngInt(rng, 1, 10)
  var b = rngInt(rng, 1, 10)
  while (b === a) b = rngInt(rng, 1, 10)
  var answer = a > b ? a : b
  return question({
    skill: "compare-to-10",
    levelId: level.id,
    prompt: "Which is more?",
    promptKind: "compare",
    left: a,
    right: b,
    answer: answer,
    input: "choices",
    choices: shuffle([a, b], rng)
  })
}

function genAdd(rng, level, skill, maxSum, minAddend) {
  var lo = minAddend === undefined ? 0 : minAddend
  var sum = rngInt(rng, Math.max(lo + lo, 1), maxSum)
  var a = rngInt(rng, lo, sum - lo)
  var b = sum - a
  return question({
    skill: skill,
    levelId: level.id,
    prompt: a + " + " + b,
    answer: sum,
    input: level.input,
    choices: uniqueChoices(sum, rng, [a, b, sum + 1, sum - 1, Math.abs(a - b)], 4)
  })
}

function genSub(rng, level, skill, maxStart, minStart) {
  var hi = maxStart
  var lo = minStart === undefined ? 1 : minStart
  var a = rngInt(rng, lo, hi)
  var b = rngInt(rng, 0, a)
  return question({
    skill: skill,
    levelId: level.id,
    prompt: a + " − " + b,
    answer: a - b,
    input: level.input,
    choices: uniqueChoices(a - b, rng, [a + b, a, b, a - b + 1], 4)
  })
}

function genMissingAddend(rng, level, maxSum) {
  var sum = rngInt(rng, 4, maxSum)
  var a = rngInt(rng, 1, sum - 1)
  var missing = sum - a
  return question({
    skill: "missing-addend-20",
    levelId: level.id,
    prompt: a + " + □ = " + sum,
    answer: missing,
    input: level.input,
    choices: uniqueChoices(missing, rng, [sum, a, missing + 1, sum - missing], 4)
  })
}

function genSkipCount(rng, level) {
  var step = pick(rng, [2, 5, 10])
  var start = rngInt(rng, 1, 8) * (step === 10 ? 1 : 1)
  if (step === 10) start = rngInt(rng, 1, 5) * 10
  if (step === 5) start = rngInt(rng, 1, 6) * 5
  if (step === 2) start = rngInt(rng, 1, 10)
  var seq = [start, start + step, start + step * 2]
  var answer = start + step * 3
  return question({
    skill: "skip-count",
    levelId: level.id,
    prompt: "What comes next?\n" + seq.join(", ") + ", …",
    answer: answer,
    input: level.input,
    choices: uniqueChoices(answer, rng, [start + step * 2, answer + step, answer - 1], 4)
  })
}

function genMulTo10(rng, level) {
  var a = rngInt(rng, 0, 10)
  var b = rngInt(rng, 1, 10)
  return question({
    skill: "mul-to-10",
    levelId: level.id,
    prompt: a + " × " + b,
    answer: a * b,
    input: level.input,
    choices: uniqueChoices(a * b, rng, [a + b, a * (b + 1), a * Math.max(1, b - 1)], 4)
  })
}

function genDivTo10(rng, level) {
  var b = rngInt(rng, 2, 10)
  var a = rngInt(rng, 1, 10)
  var product = a * b
  return question({
    skill: "div-to-10",
    levelId: level.id,
    prompt: product + " ÷ " + b,
    answer: a,
    input: level.input,
    choices: uniqueChoices(a, rng, [b, product, a + 1, Math.max(1, a - 1)], 4)
  })
}

function genAddWithin1000(rng, level) {
  var a = rngInt(rng, 100, 800)
  a = Math.round(a / 10) * 10
  var b = rngInt(rng, 10, 190)
  b = Math.round(b / 10) * 10
  return question({
    skill: "add-within-1000",
    levelId: level.id,
    prompt: a + " + " + b,
    answer: a + b,
    input: level.input,
    choices: uniqueChoices(a + b, rng, [a - b, a, b, a + b + 10], 4)
  })
}

function genMul2Digit(rng, level) {
  var a = rngInt(rng, 11, 19)
  var b = rngInt(rng, 2, 9)
  return question({
    skill: "mul-2digit",
    levelId: level.id,
    prompt: a + " × " + b,
    answer: a * b,
    input: level.input,
    choices: uniqueChoices(a * b, rng, [a + b, (a - 1) * b, a * (b + 1)], 4)
  })
}

function genDivExact(rng, level) {
  var b = rngInt(rng, 2, 9)
  var a = rngInt(rng, 4, 12)
  var product = a * b
  return question({
    skill: "div-exact",
    levelId: level.id,
    prompt: product + " ÷ " + b,
    answer: a,
    input: level.input,
    choices: uniqueChoices(a, rng, [b, a + 1, product - b], 4)
  })
}

function genMixedAddSub(rng, level) {
  var a = rngInt(rng, 20, 90)
  var b = rngInt(rng, 10, 40)
  var c = rngInt(rng, 5, 20)
  var addFirst = rng() < 0.5
  var prompt
  var answer
  if (addFirst) {
    prompt = a + " + " + b + " − " + c
    answer = a + b - c
  } else {
    prompt = a + " − " + b + " + " + c
    answer = a - b + c
  }
  return question({
    skill: "mixed-add-sub",
    levelId: level.id,
    prompt: prompt,
    answer: answer,
    input: level.input,
    choices: uniqueChoices(answer, rng, [a + b + c, a - b - c, a + c], 4)
  })
}

function genFractionOf(rng, level) {
  var options = [
    { n: 1, d: 2 },
    { n: 1, d: 3 },
    { n: 1, d: 4 },
    { n: 3, d: 4 },
    { n: 2, d: 3 }
  ]
  var frac = pick(rng, options)
  var groups = rngInt(rng, 2, 8)
  var whole = frac.d * groups
  var answer = frac.n * groups
  return question({
    skill: "fraction-of",
    levelId: level.id,
    prompt: "What is " + frac.n + "/" + frac.d + " of " + whole + "?",
    answer: answer,
    input: level.input,
    choices: uniqueChoices(answer, rng, [whole, frac.d, whole - answer], 4)
  })
}

function genPercentOf(rng, level) {
  var pct = pick(rng, [10, 25, 50, 100])
  var whole
  if (pct === 10) whole = rngInt(rng, 2, 12) * 10
  else if (pct === 25) whole = rngInt(rng, 2, 8) * 4
  else if (pct === 50) whole = rngInt(rng, 2, 12) * 2
  else whole = rngInt(rng, 4, 20)
  var answer = (whole * pct) / 100
  return question({
    skill: "percent-of",
    levelId: level.id,
    prompt: "What is " + pct + "% of " + whole + "?",
    answer: answer,
    input: level.input,
    choices: uniqueChoices(answer, rng, [whole, pct, whole - answer], 4)
  })
}

function genOrderOps(rng, level) {
  var a = rngInt(rng, 1, 9)
  var b = rngInt(rng, 2, 8)
  var c = rngInt(rng, 2, 6)
  var parens = rng() < 0.4
  var prompt
  var answer
  if (parens) {
    prompt = "(" + a + " + " + b + ") × " + c
    answer = (a + b) * c
  } else {
    prompt = a + " + " + b + " × " + c
    answer = a + b * c
  }
  return question({
    skill: "order-ops",
    levelId: level.id,
    prompt: prompt,
    answer: answer,
    input: level.input,
    choices: uniqueChoices(answer, rng, [(a + b) * c, a + b * c, a * b + c], 4)
  })
}

function genNegatives(rng, level) {
  var a = rngInt(rng, 0, 9)
  var b = rngInt(rng, a + 1, a + 12)
  return question({
    skill: "negatives",
    levelId: level.id,
    prompt: a + " − " + b,
    answer: a - b,
    input: level.input,
    choices: uniqueChoices(a - b, rng, [b - a, a + b, -a], 4)
  })
}

var SKILL_GENERATORS = {
  "count-to-10": genCountTo10,
  "compare-to-10": genCompareTo10,
  "add-within-5": function (rng, level) { return genAdd(rng, level, "add-within-5", 5, 0) },
  "add-within-20": function (rng, level) { return genAdd(rng, level, "add-within-20", 20, 1) },
  "sub-within-20": function (rng, level) { return genSub(rng, level, "sub-within-20", 20, 4) },
  "missing-addend-20": function (rng, level) { return genMissingAddend(rng, level, 20) },
  "add-within-100": function (rng, level) { return genAdd(rng, level, "add-within-100", 99, 10) },
  "sub-within-100": function (rng, level) { return genSub(rng, level, "sub-within-100", 99, 20) },
  "skip-count": genSkipCount,
  "mul-to-10": genMulTo10,
  "div-to-10": genDivTo10,
  "add-within-1000": genAddWithin1000,
  "mul-2digit": genMul2Digit,
  "div-exact": genDivExact,
  "mixed-add-sub": genMixedAddSub,
  "fraction-of": genFractionOf,
  "percent-of": genPercentOf,
  "order-ops": genOrderOps,
  "negatives": genNegatives
}

function generateQuestion(levelId, rng, skill) {
  var level = levelById(clampLevelId(levelId))
  var chosen = skill && SKILL_GENERATORS[skill] ? skill : pick(rng, level.skills)
  var gen = SKILL_GENERATORS[chosen]
  var q = gen(rng, level)
  q.id = level.key + ":" + q.skill + ":" + Math.floor(rng() * 1e9)
  q.levelKey = level.key
  q.levelName = level.name
  if (q.input !== "choices") q.input = level.input
  return q
}

function generateRound(levelId, count, seed) {
  var n = parseInt(count, 10)
  if (!isFinite(n) || n < 1) n = 10
  if (n > 40) n = 40
  var rng = typeof seed === "function" ? seed : createRng(seed === undefined ? Date.now() : seed)
  var items = []
  var level = levelById(clampLevelId(levelId))
  for (var i = 0; i < n; i++) {
    var skill = level.skills[i % level.skills.length]
    items.push(generateQuestion(level.id, rng, skill))
  }
  return items
}

function parseResponse(value) {
  if (typeof value === "number" && isFinite(value)) return value
  var text = String(value === undefined || value === null ? "" : value).trim()
  if (!text) return null
  if (!/^-?\d+$/.test(text)) return null
  var n = parseInt(text, 10)
  return isFinite(n) ? n : null
}

function grade(question, response) {
  var actual = parseResponse(response)
  var expected = question && typeof question.answer === "number" ? question.answer : null
  return {
    response: actual,
    correct: actual !== null && expected !== null && actual === expected
  }
}

function skillScores(items) {
  var scores = {}
  if (!Array.isArray(items)) return scores
  for (var i = 0; i < items.length; i++) {
    var item = items[i]
    if (!item || !item.skill) continue
    if (!scores[item.skill]) scores[item.skill] = { correct: 0, total: 0 }
    scores[item.skill].total++
    if (item.correct) scores[item.skill].correct++
  }
  return scores
}

function accuracy(items) {
  if (!Array.isArray(items) || items.length === 0) return 0
  var ok = 0
  for (var i = 0; i < items.length; i++) {
    if (items[i] && items[i].correct) ok++
  }
  return ok / items.length
}

function starsForAccuracy(value) {
  if (value >= 0.9) return 3
  if (value >= 0.7) return 2
  if (value >= 0.45) return 1
  return 0
}

function nextAdaptiveLevel(levelId, windowItems) {
  var current = clampLevelId(levelId)
  if (!Array.isArray(windowItems) || windowItems.length < 3) return current
  var acc = accuracy(windowItems)
  if (acc >= 0.84 && current < 6) return current + 1
  if (acc <= 0.34 && current > 1) return current - 1
  return current
}

function recommendLevel(items) {
  var byLevel = {}
  if (Array.isArray(items)) {
    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      if (!item) continue
      var id = clampLevelId(item.levelId || 1)
      if (!byLevel[id]) byLevel[id] = { correct: 0, total: 0 }
      byLevel[id].total++
      if (item.correct) byLevel[id].correct++
    }
  }
  var recommended = 1
  for (var level = 1; level <= 6; level++) {
    var row = byLevel[level]
    if (!row || row.total < 3) continue
    if (row.correct / row.total >= 0.7) recommended = level
  }
  return recommended
}

function emptyProgress() {
  return {
    schemaVersion: 1,
    learners: {},
    lastAssessment: null
  }
}

function normalizeProgress(raw) {
  var data
  try {
    data = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw || {})
  } catch (e) {
    return emptyProgress()
  }
  if (!data || typeof data !== "object") return emptyProgress()
  if (!data.learners || typeof data.learners !== "object") data.learners = {}
  if (data.schemaVersion !== 1) data.schemaVersion = 1
  if (data.lastAssessment === undefined) data.lastAssessment = null
  return data
}

function learnerRecord(progress, learnerId) {
  var id = String(learnerId || "default")
  var data = progress || emptyProgress()
  if (!data.learners[id]) {
    data.learners[id] = {
      preferredLevel: 1,
      lastPlayedAt: "",
      rounds: 0,
      bestStreak: 0,
      byLevel: {}
    }
  }
  return data.learners[id]
}

function recordRound(progress, learnerId, levelId, correct, total, streak) {
  var data = normalizeProgress(progress)
  var learner = learnerRecord(data, learnerId)
  var id = clampLevelId(levelId)
  learner.lastPlayedAt = new Date().toISOString()
  learner.rounds++
  if (streak > (learner.bestStreak || 0)) learner.bestStreak = streak
  if (!learner.byLevel[id]) learner.byLevel[id] = { rounds: 0, correct: 0, total: 0 }
  learner.byLevel[id].rounds++
  learner.byLevel[id].correct += correct
  learner.byLevel[id].total += total
  var acc = total > 0 ? correct / total : 0
  if (acc >= 0.85 && id < 6) learner.preferredLevel = id + 1
  else if (acc <= 0.4 && id > 1) learner.preferredLevel = id - 1
  else learner.preferredLevel = id
  return data
}

function parsePayload(raw) {
  var args = {}
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    args = raw
  } else if (raw) {
    try {
      args = JSON.parse(String(raw)) || {}
    } catch (e) {
      args = {}
    }
  }

  var mode = args.mode === "assessment" ? "assessment" : "practice"
  var level = args.level === undefined || args.level === null || args.level === ""
    ? (mode === "assessment" ? 3 : 0)
    : clampLevelId(args.level)
  var count = parseInt(args.count, 10)
  if (!isFinite(count) || count < 1) count = mode === "assessment" ? 12 : 10
  if (count > 40) count = 40

  var seed = args.seed
  if (seed === undefined || seed === null || seed === "") seed = Date.now()
  seed = Number(seed)
  if (!isFinite(seed)) seed = Date.now()

  var input = args.input
  if (input !== "choices" && input !== "keypad") input = ""

  return {
    mode: mode,
    level: level,
    count: count,
    learnerId: String(args.learnerId || "default"),
    seed: seed,
    input: input,
    adaptive: args.adaptive !== false && mode === "assessment",
    start: args.start === true || mode === "assessment"
  }
}

function buildResult(session) {
  var s = session || {}
  var items = Array.isArray(s.items) ? s.items : []
  var correct = 0
  var totalMs = 0
  for (var i = 0; i < items.length; i++) {
    if (items[i] && items[i].correct) correct++
    totalMs += Number(items[i] && items[i].ms) || 0
  }
  var total = items.length
  var acc = total ? correct / total : 0
  var recommended = recommendLevel(items)
  if (s.levelId && total < 3) recommended = clampLevelId(s.levelId)
  var level = levelById(s.levelId || recommended)
  return {
    pluginId: "omarchykids.math",
    schemaVersion: 1,
    mode: s.mode || "practice",
    status: s.status || "complete",
    learnerId: s.learnerId || "default",
    startedAt: s.startedAt || "",
    finishedAt: s.finishedAt || new Date().toISOString(),
    level: level.id,
    levelName: level.name,
    ageBand: level.ages,
    seed: s.seed || 0,
    total: total,
    correct: correct,
    accuracy: Math.round(acc * 1000) / 1000,
    avgMs: total ? Math.round(totalMs / total) : 0,
    recommendedLevel: recommended,
    skillScores: skillScores(items),
    items: items
  }
}

function catalogJson() {
  return JSON.stringify({
    pluginId: "omarchykids.math",
    schemaVersion: 1,
    ageRange: "5-12",
    levels: levels()
  })
}

if (typeof module !== "undefined") {
  module.exports = {
    levels: levels,
    levelById: levelById,
    clampLevelId: clampLevelId,
    createRng: createRng,
    rngInt: rngInt,
    generateQuestion: generateQuestion,
    generateRound: generateRound,
    parseResponse: parseResponse,
    grade: grade,
    skillScores: skillScores,
    accuracy: accuracy,
    starsForAccuracy: starsForAccuracy,
    nextAdaptiveLevel: nextAdaptiveLevel,
    recommendLevel: recommendLevel,
    emptyProgress: emptyProgress,
    normalizeProgress: normalizeProgress,
    learnerRecord: learnerRecord,
    recordRound: recordRound,
    parsePayload: parsePayload,
    buildResult: buildResult,
    catalogJson: catalogJson
  }
}
