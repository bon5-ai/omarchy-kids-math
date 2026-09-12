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
    if (Math.floor(value) !== value || (answer >= 0 && value < 0)) return
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
    prompt: "Which is more?\n" + a + " or " + b,
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
    operands: [a, b],
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
    operands: [a, b],
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
    operands: [a, sum],
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
    operands: [start, step],
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
    operands: [a, b],
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
    operands: [product, b],
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
    operands: [a, b],
    skill: "add-within-1000",
    levelId: level.id,
    prompt: a + " + " + b,
    answer: a + b,
    input: level.input,
    choices: uniqueChoices(a + b, rng, [a - b, a, b, a + b + 10], 4)
  })
}

function genMul2Digit(rng, level) {
  var a = rngInt(rng, 11, 49)
  var b = rngInt(rng, 2, 9)
  return question({
    operands: [a, b],
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
    operands: [product, b],
    skill: "div-exact",
    levelId: level.id,
    prompt: product + " ÷ " + b,
    answer: a,
    input: level.input,
    choices: uniqueChoices(a, rng, [b, a + 1, product - b], 4)
  })
}

function genMixedAddSub(rng, level) {
  var a = rngInt(rng, 40, 90)
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
    operands: [a, b, c, addFirst],
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
    operands: [frac.n, frac.d, whole],
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
    operands: [pct, whole],
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
    operands: [a, b, c, parens],
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
    operands: [a, b],
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
  q.support = teachingSupport(q)
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

function teachingSupport(q) {
  var o = q.operands || []
  var hint = ""
  var explanation = ""
  var counters = []
  if (q.skill === "count-to-10") {
    hint = "Touch each light once. Say one number for each light."
    explanation = "The last number you say tells you how many: " + q.answer + "."
  } else if (q.skill === "compare-to-10") {
    hint = "Match the lights in pairs. Which group has lights left over?"
    explanation = q.answer + " is more than " + Math.min(q.left, q.right) + "."
  } else if (q.skill.indexOf("add-within") === 0) {
    hint = o[0] + " is your starting number. Count on " + o[1] + ", or split the numbers into tens and ones."
    explanation = o[0] + " and " + o[1] + " together make " + q.answer + "."
    if (q.levelId <= 2) counters = [o[0], o[1]]
  } else if (q.skill.indexOf("sub-within") === 0) {
    hint = "Start at " + o[0] + ". Take away " + o[1] + ". You can count back in small jumps."
    explanation = q.answer + " + " + o[1] + " = " + o[0] + ", so " + q.answer + " are left."
  } else if (q.skill === "missing-addend-20") {
    hint = "Start at " + o[0] + ". Count the jumps to " + o[1] + "."
    explanation = o[1] + " − " + o[0] + " = " + q.answer + ". That fills the box."
  } else if (q.skill === "skip-count") {
    hint = "Look at the jump between two neighbors. Repeat the same jump."
    explanation = "Each jump is " + o[1] + ". Add " + o[1] + " again to get " + q.answer + "."
  } else if (q.skill.indexOf("mul-") === 0) {
    hint = "Think of " + o[0] + " groups of " + o[1] + ". Split a big group into smaller groups you know."
    explanation = q.skill === "mul-2digit" ?
      Math.floor(o[0] / 10) * 10 + " × " + o[1] + " + " + o[0] % 10 + " × " + o[1] + " = " + q.answer + "." :
      o[0] + " equal groups of " + o[1] + " make " + q.answer + "."
  } else if (q.skill.indexOf("div-") === 0) {
    hint = "How many groups of " + o[1] + " fit into " + o[0] + "? Use a times fact."
    explanation = q.answer + " × " + o[1] + " = " + o[0] + ". Division undoes multiplication."
  } else if (q.skill === "mixed-add-sub") {
    hint = "Addition and subtraction have the same priority. Work from left to right."
    explanation = "First you get " + (o[3] ? o[0] + o[1] : o[0] - o[1]) + ". Then " + (o[3] ? "subtract " : "add ") + o[2] + " to get " + q.answer + "."
  } else if (q.skill === "fraction-of") {
    hint = "Divide " + o[2] + " into " + o[1] + " equal parts. Then take " + o[0] + " of those parts."
    explanation = "Each part is " + o[2] / o[1] + ". " + o[0] + " of those parts make " + q.answer + "."
  } else if (q.skill === "percent-of") {
    var divisor = 100 / o[0]
    hint = o[0] === 100 ? "100% means the whole amount." : o[0] + "% means 1 of " + divisor + " equal parts."
    explanation = o[1] + " ÷ " + divisor + " = " + q.answer + "."
  } else if (q.skill === "order-ops") {
    hint = o[3] ? "Do the part inside the parentheses first." : "Multiply first, then add."
    explanation = o[3] ? "The parentheses make " + (o[0] + o[1]) + ". Multiply that by " + o[2] + " to get " + q.answer + "." :
      o[1] + " × " + o[2] + " = " + o[1] * o[2] + ". Add " + o[0] + " to get " + q.answer + "."
  } else if (q.skill === "negatives") {
    hint = "Move left on a number line. You can keep going past zero."
    explanation = "From " + o[0] + ", use " + o[0] + " steps to reach zero, then " + (o[1] - o[0]) + " more to reach " + q.answer + "."
  }
  return { hint: hint, explanation: explanation, counters: counters }
}

function safeCount(value) {
  return typeof value === "number" && isFinite(value) && value >= 0 ? Math.min(1000000, Math.floor(value)) : 0
}

function recordPracticeSkills(learner, items) {
  items.forEach(function (item) {
    if (!Object.prototype.hasOwnProperty.call(SKILL_GENERATORS, item.skill)) return
    var previous = learner.practiceSkills[item.skill] || {}
    var row = { total: safeCount(previous.total), independent: safeCount(previous.independent) }
    row.total++
    if (item.correct && item.attempts === 1 && !item.hintUsed) row.independent++
    learner.practiceSkills[item.skill] = row
  })
}

function generatePracticeRound(levelId, count, seed, learner) {
  var items = generateRound(levelId, count, seed)
  var level = levelById(levelId)
  var history = learner && learner.practiceSkills || {}
  var weakest = level.skills.slice().sort(function (a, b) {
    var x = history[a] || {}, y = history[b] || {}
    return (safeCount(x.independent) + 1) / (safeCount(x.total) + 2) -
      (safeCount(y.independent) + 1) / (safeCount(y.total) + 2)
  })[0]
  // Keep coverage of every skill; use alternating later items for extra support.
  if (history[weakest] && history[weakest].total > 0) {
    var rng = createRng(Number(seed) + 7919)
    for (var i = level.skills.length; i < items.length; i += 2)
      items[i] = generateQuestion(level.id, rng, weakest)
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

// These ceilings also apply before serialization. Keep the transport limits in
// StateStore.py in sync; the shell independently validates everything it reads.
var LIMITS = { stateBytes: 262144, payloadBytes: 4096, ipcBytes: 65536,
  depth: 12, keys: 64, nodes: 12000, learners: 16, notebook: 60, items: 40 }

function utf8Bytes(text, ceiling) {
  if (typeof text !== "string" || text.length > ceiling) return ceiling + 1
  var bytes = 0
  for (var i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i)
    if (c < 0x80) bytes++
    else if (c < 0x800) bytes += 2
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length &&
             text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
      bytes += 4
      i++
    } else if (c >= 0xd800 && c <= 0xdfff) return ceiling + 1
    else bytes += 3
    if (bytes > ceiling) return bytes
  }
  return bytes
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function validLearnerId(id) {
  return typeof id === "string" && id.length > 0 && utf8Bytes(id, 64) <= 64 &&
    !/[\u0000-\u001f\u007f]/.test(id)
}

// A bounded walk measures the exact compact JSON size using only small scalar
// serializations. It rejects getters, cycles, exotic objects and excess keys
// before JSON.stringify can traverse them or allocate an oversized result.
function boundedValue(value, ceiling, maxDepth) {
  var bytes = 0, nodes = 0
  function visit(item, depth) {
    if (++nodes > LIMITS.nodes || bytes > ceiling) return false
    if (item === null || typeof item === "boolean") bytes += item === null ? 4 : item ? 4 : 5
    else if (typeof item === "number") {
      if (!isFinite(item) || Math.abs(item) > Number.MAX_SAFE_INTEGER) return false
      bytes += String(item).length
    } else if (typeof item === "string") {
      if (item.length > 512 || utf8Bytes(item, 2048) > 2048) return false
      bytes += utf8Bytes(JSON.stringify(item), ceiling)
    } else if (typeof item === "object") {
      if (depth >= maxDepth) return false
      var array = Array.isArray(item)
      var prototype = Object.getPrototypeOf(item)
      if (!array && prototype !== Object.prototype && prototype !== null) return false
      if (array && prototype !== Array.prototype) return false
      if (array && item.length > LIMITS.notebook) return false
      bytes += 2
      var count = 0
      for (var key in item) {
        if (!Object.prototype.hasOwnProperty.call(item, key)) continue
        if (++count > (array ? LIMITS.notebook : LIMITS.keys) || utf8Bytes(key, 64) > 64) return false
        var descriptor = Object.getOwnPropertyDescriptor(item, key)
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) return false
        if (count > 1) bytes++
        if (!array) bytes += utf8Bytes(JSON.stringify(key), ceiling) + 1
        if (!visit(descriptor.value, depth + 1)) return false
      }
      if (array && count !== item.length) return false
    } else return false
    return bytes <= ceiling
  }
  try { return visit(value, 0) } catch (e) { return false }
}

function parseBounded(raw, ceiling, maxDepth) {
  if (typeof raw !== "string") return boundedValue(raw, ceiling, maxDepth) ? raw : null
  if (utf8Bytes(raw, ceiling) > ceiling) return null
  var depth = 0, quoted = false, escaped = false
  // Strings are opaque to this scan, including escaped quotes and brackets.
  // Container and separator counts bound allocations before JSON.parse.
  var counts = [], nodes = 0
  for (var i = 0; i < raw.length; i++) {
    var c = raw.charAt(i)
    if (quoted) {
      if (escaped) escaped = false
      else if (c === "\\") escaped = true
      else if (c === '"') quoted = false
    } else if (c === '"') quoted = true
    else if (c === "{" || c === "[") {
      if (++depth > maxDepth || ++nodes > LIMITS.nodes) return null
      counts.push(1)
    } else if (c === "}" || c === "]") {
      if (--depth < 0) return null
      counts.pop()
    } else if (c === ",") {
      if (!depth || ++counts[depth - 1] > LIMITS.keys || ++nodes > LIMITS.nodes) return null
    }
  }
  if (depth || quoted) return null
  try {
    var data = JSON.parse(raw)
    return boundedValue(data, ceiling, maxDepth) ? data : null
  } catch (e) { return null }
}

function boundedJson(value, ceiling) {
  return boundedValue(value, ceiling, LIMITS.depth) ? JSON.stringify(value) : ""
}

function cleanText(value, limit) {
  return typeof value === "string" && value.length <= limit ? value : ""
}

function normalizeLearner(raw) {
  var value = isRecord(raw) ? raw : {}
  var learner = { preferredLevel: clampLevelId(value.preferredLevel || 1),
    rounds: safeCount(value.rounds), bestStreak: safeCount(value.bestStreak),
    lastPlayedAt: cleanText(value.lastPlayedAt, 32), byLevel: {}, practiceSkills: {}, notebook: [] }
  for (var level = 1; level <= 6; level++) {
    var row = isRecord(value.byLevel) && value.byLevel[level]
    if (isRecord(row)) learner.byLevel[level] = { rounds: safeCount(row.rounds),
      correct: Math.min(safeCount(row.correct), safeCount(row.total)), total: safeCount(row.total) }
  }
  Object.keys(SKILL_GENERATORS).forEach(function (skill) {
    var row = isRecord(value.practiceSkills) && value.practiceSkills[skill]
    if (isRecord(row)) learner.practiceSkills[skill] = {
      total: safeCount(row.total), independent: Math.min(safeCount(row.independent), safeCount(row.total)) }
  })
  if (Array.isArray(value.notebook)) {
    value.notebook.slice(-LIMITS.notebook).forEach(function (entry) {
      if (!isRecord(entry) || typeof entry.code !== "string" ||
          !/^LAB1-[1-6]-\d{1,10}-[BM]$/.test(entry.code)) return
      learner.notebook.push({ code: entry.code, a: safeCount(entry.a), b: safeCount(entry.b),
        title: cleanText(entry.title, 80), note: cleanText(entry.note, 160) })
    })
  }
  if (isRecord(value.garden)) {
    learner.garden = { version: 1, level: Math.max(1, Math.min(3, safeCount(value.garden.level) || 1)),
      reducedMotion: value.garden.reducedMotion === true, activities: {} }
    var activities = isRecord(value.garden.activities) ? value.garden.activities : {}
    "count join take ten tens parity primes powers coordinates angles area slope".split(" ").forEach(function (kind) {
      var row = isRecord(activities[kind]) ? activities[kind] : {}
      learner.garden.activities[kind] = { solved: safeCount(row.solved),
        supported: Math.min(safeCount(row.solved), safeCount(row.supported)) }
    })
  }
  return learner
}

function decodeProgress(raw) {
  var data = parseBounded(raw || {}, LIMITS.stateBytes, LIMITS.depth)
  if (!isRecord(data)) return null
  var clean = emptyProgress()
  var learners = isRecord(data.learners) ? data.learners : {}
  var ids = Object.keys(learners)
  if (ids.length > LIMITS.learners) return null
  for (var i = 0; i < ids.length; i++) {
    if (!validLearnerId(ids[i])) return null
    Object.defineProperty(clean.learners, ids[i], { value: normalizeLearner(learners[ids[i]]),
      enumerable: true, writable: true, configurable: true })
  }
  if (isRecord(data.lastAssessment) && Array.isArray(data.lastAssessment.items)) {
    if (data.lastAssessment.items.length > LIMITS.items) return null
    var previous = data.lastAssessment
    clean.lastAssessment = buildResult({ mode: "assessment", status: previous.status,
      learnerId: previous.learnerId, levelId: previous.level, seed: previous.seed,
      startedAt: previous.startedAt, finishedAt: previous.finishedAt, items: previous.items })
  }
  return boundedValue(clean, LIMITS.stateBytes, LIMITS.depth) ? clean : null
}

function normalizeProgress(raw) {
  return decodeProgress(raw) || emptyProgress()
}

function learnerRecord(progress, learnerId) {
  var id = learnerId === undefined ? "default" : learnerId
  if (!validLearnerId(id)) return null
  var data = progress || emptyProgress()
  if (!data.learners || typeof data.learners !== "object" || Array.isArray(data.learners)) data.learners = {}
  if (!Object.prototype.hasOwnProperty.call(data.learners, id) || !data.learners[id] ||
      typeof data.learners[id] !== "object" || Array.isArray(data.learners[id])) {
    if (Object.keys(data.learners).length >= LIMITS.learners) return null
    Object.defineProperty(data.learners, id, { value: {}, enumerable: true, writable: true, configurable: true })
  }
  var learner = data.learners[id]
  learner.preferredLevel = clampLevelId(learner.preferredLevel || 1)
  learner.rounds = safeCount(learner.rounds)
  learner.bestStreak = safeCount(learner.bestStreak)
  if (typeof learner.lastPlayedAt !== "string") learner.lastPlayedAt = ""
  if (!learner.byLevel || typeof learner.byLevel !== "object" || Array.isArray(learner.byLevel)) learner.byLevel = {}
  if (!learner.practiceSkills || typeof learner.practiceSkills !== "object" || Array.isArray(learner.practiceSkills)) learner.practiceSkills = {}
  if (!Array.isArray(learner.notebook)) learner.notebook = []
  return data.learners[id]
}

function recordRound(progress, learnerId, levelId, correct, total, streak) {
  var data = normalizeProgress(progress)
  if (!(total > 0)) return data
  var learner = learnerRecord(data, learnerId)
  if (!learner) return data
  var id = clampLevelId(levelId)
  learner.lastPlayedAt = new Date().toISOString()
  learner.rounds++
  if (streak > (learner.bestStreak || 0)) learner.bestStreak = streak
  if (!learner.byLevel[id]) learner.byLevel[id] = { rounds: 0, correct: 0, total: 0 }
  learner.byLevel[id].rounds = safeCount(learner.byLevel[id].rounds) + 1
  learner.byLevel[id].correct = safeCount(learner.byLevel[id].correct) + correct
  learner.byLevel[id].total = safeCount(learner.byLevel[id].total) + total
  var acc = total > 0 ? correct / total : 0
  if (acc >= 0.85 && id < 6) learner.preferredLevel = id + 1
  else if (acc <= 0.4 && id > 1) learner.preferredLevel = id - 1
  else learner.preferredLevel = id
  return data
}

function recordSession(progress, result, bestStreak) {
  var data = normalizeProgress(progress)
  if (!result || !result.total) return data
  var learner = learnerRecord(data, result.learnerId)
  if (!learner) return data
  learner.lastPlayedAt = result.finishedAt
  learner.bestStreak = Math.max(learner.bestStreak, bestStreak || 0)
  if (result.status === "complete") learner.rounds++
  var visited = {}
  result.items.forEach(function (item) {
    var id = clampLevelId(item.levelId)
    var old = learner.byLevel[id] || {}
    var row = { rounds: safeCount(old.rounds), correct: safeCount(old.correct), total: safeCount(old.total) }
    row.total++
    if (item.correct) row.correct++
    if (!visited[id] && result.status === "complete") row.rounds++
    visited[id] = true
    learner.byLevel[id] = row
  })
  if (result.mode === "assessment") {
    data.lastAssessment = result
    if (result.status === "complete") learner.preferredLevel = result.recommendedLevel
  } else {
    recordPracticeSkills(learner, result.items)
    // A retry or a hint is useful learning, but isn't evidence for promotion.
    if (result.status === "complete" && result.total >= 3) {
      var independent = result.independentCorrect / result.total
      learner.preferredLevel = clampLevelId(result.level + (independent >= 0.85 ? 1 : result.accuracy <= 0.4 ? -1 : 0))
    }
  }
  return data
}

function parsePayload(raw) {
  var args = parseBounded(raw === undefined || raw === "" ? "{}" : raw, LIMITS.payloadBytes, 1)
  if (!isRecord(args)) return null
  var allowed = ["mode", "level", "count", "learnerId", "seed", "input", "adaptive", "start"]
  var keys = Object.keys(args)
  for (var i = 0; i < keys.length; i++) {
    if (allowed.indexOf(keys[i]) === -1) return null
  }
  if (args.mode !== undefined && args.mode !== "practice" && args.mode !== "assessment") return null
  if (args.learnerId !== undefined && !validLearnerId(args.learnerId)) return null
  if (args.input !== undefined && args.input !== "choices" && args.input !== "keypad") return null
  if (args.adaptive !== undefined && typeof args.adaptive !== "boolean") return null
  if (args.start !== undefined && typeof args.start !== "boolean") return null
  for (var n = 0; n < 3; n++) {
    var number = args[["level", "count", "seed"][n]]
    if (number !== undefined && (typeof number !== "number" || !isFinite(number) ||
        Math.floor(number) !== number || Math.abs(number) > Number.MAX_SAFE_INTEGER)) return null
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
  if (!boundedValue(s, LIMITS.ipcBytes, LIMITS.depth) ||
      (Array.isArray(s.items) && s.items.length > LIMITS.items)) return null
  var items = (Array.isArray(s.items) ? s.items : []).filter(function (item) {
    return isRecord(item) && Object.prototype.hasOwnProperty.call(SKILL_GENERATORS, item.skill)
  }).map(function (item) {
    return { id: cleanText(item.id, 100), skill: item.skill, levelId: clampLevelId(item.levelId),
      prompt: cleanText(item.prompt, 512),
      answer: typeof item.answer === "number" ? item.answer : null,
      response: typeof item.response === "number" ? item.response : null,
      correct: item.correct === true, attempts: Math.max(1, Math.min(2, safeCount(item.attempts) || 1)),
      hintUsed: item.hintUsed === true, ms: safeCount(item.ms) }
  })
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
  var result = {
    pluginId: "omarchykids.math",
    schemaVersion: 1,
    mode: s.mode === "assessment" ? "assessment" : "practice",
    status: s.status === "abandoned" ? "abandoned" : "complete",
    learnerId: validLearnerId(s.learnerId) ? s.learnerId : "default",
    startedAt: cleanText(s.startedAt, 32),
    finishedAt: cleanText(s.finishedAt, 32) || new Date().toISOString(),
    level: level.id,
    levelName: level.name,
    ageBand: level.ages,
    seed: s.seed || 0,
    total: total,
    correct: correct,
    accuracy: Math.round(acc * 1000) / 1000,
    independentCorrect: items.filter(function (item) { return item.correct && (item.attempts || 1) === 1 && !item.hintUsed }).length,
    avgMs: total ? Math.round(totalMs / total) : 0,
    recommendedLevel: recommended,
    skillScores: skillScores(items),
    items: items
  }
  return boundedValue(result, LIMITS.ipcBytes, LIMITS.depth) ? result : null
}

function catalogJson() {
  return boundedJson({
    pluginId: "omarchykids.math",
    schemaVersion: 1,
    ageRange: "5-12",
    levels: levels()
  }, LIMITS.ipcBytes) || "{}"
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
    generatePracticeRound: generatePracticeRound,
    recordPracticeSkills: recordPracticeSkills,
    parseResponse: parseResponse,
    grade: grade,
    skillScores: skillScores,
    accuracy: accuracy,
    starsForAccuracy: starsForAccuracy,
    nextAdaptiveLevel: nextAdaptiveLevel,
    recommendLevel: recommendLevel,
    emptyProgress: emptyProgress,
    LIMITS: LIMITS,
    utf8Bytes: utf8Bytes,
    boundedValue: boundedValue,
    boundedJson: boundedJson,
    parseBounded: parseBounded,
    decodeProgress: decodeProgress,
    normalizeProgress: normalizeProgress,
    learnerRecord: learnerRecord,
    recordRound: recordRound,
    recordSession: recordSession,
    parsePayload: parsePayload,
    buildResult: buildResult,
    catalogJson: catalogJson
  }
}
