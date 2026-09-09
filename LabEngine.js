// Number Lab: deterministic, offline mathematical toys. Shared by QML and Node.
// Version the recipe in the code so saved inventions always reopen identically.
function rngFor(seed) {
  var state = Number(seed) >>> 0
  return function () {
    state += 0x6D2B79F5
    var value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function range(first, last, step) {
  var out = []
  for (var n = first; n <= last; n += step || 1) out.push(n)
  return out
}

function choose(rng, values) { return values[Math.floor(rng() * values.length)] }

function create(level, seed, kind) {
  level = Math.max(1, Math.min(6, parseInt(level, 10) || 1))
  seed = Number(seed) >>> 0
  kind = kind === "mystery" ? "mystery" : "build"
  var rng = rngFor(seed)
  var p = { version: 1, level: level, seed: seed, kind: kind,
    code: "LAB1-" + level + "-" + seed + "-" + (kind === "build" ? "B" : "M") }
  if (kind === "mystery") {
    p.title = "Mystery machine"
    p.factor = level < 3 ? 1 : choose(rng, level === 3 ? [2, 5, 10] : range(2, 5))
    p.divisor = level === 6 ? choose(rng, [2, 3, 4]) : 1
    if (level === 6) p.factor = 1
    p.offset = level === 1 ? choose(rng, [1, 2, 3]) :
      (level === 2 ? choose(rng, [-2, -1, 2, 3, 4]) : (level <= 4 ? 0 : choose(rng, [-3, -2, 2, 3, 5])))
    p.inputs = [2, 3, 4].map(function (n) { return n * p.divisor })
    p.probe = 6 * p.divisor
    p.answer = runMachine(p, p.probe)
    p.choices = [p.answer, p.answer + 1, p.answer + 2, p.answer - 1]
    for (var i = p.choices.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1))
      var temp = p.choices[i]; p.choices[i] = p.choices[j]; p.choices[j] = temp
    }
    p.hint = level < 3 ? "Compare each number going in with the number coming out. What changes every time?" :
      (level === 6 ? "Try dividing first. Is there one more step?" : "Try equal groups first. Does the same rule fit all three clues?")
    return p
  }
  var recipes = [
    { title: "Glow garden", operation: "add", left: range(0, 5), right: range(0, 5), targets: range(3, 8), labels: ["First patch", "Second patch"], hint: "Move one light from one patch to the other. What happens to the total?" },
    { title: "Bridge workshop", operation: "subtract", left: range(0, 20), right: range(0, 20), targets: range(2, 10), labels: ["Start with", "Take away"], hint: "Add one to both dials. Does the difference stay the same?" },
    { title: "Tens town", operation: "add", left: range(10, 90, 5), right: range(10, 90, 5), targets: range(40, 100, 10), labels: ["First tower", "Second tower"], hint: "Add five to one tower and take five from the other." },
    { title: "Array inventor", operation: "multiply", left: range(1, 10), right: range(1, 10), targets: [12, 18, 20, 24, 30, 36], labels: ["Rows", "In each row"], hint: "Could the same lights fit in fewer rows? Try turning your array sideways." },
    { title: "Power factory", operation: "multiply", left: range(2, 20), right: range(2, 12), targets: [24, 36, 48, 60, 72, 96, 120], labels: ["Power per pod", "Pods"], hint: "Try doubling one dial and halving the other. Does the output change?" },
    { title: "Fraction fountain", operation: "fraction", left: [1, 2, 3], right: range(8, 48, 4), targets: [6, 8, 9, 12, 18, 24], labels: ["Quarters to keep", "Whole amount"], hint: "Split the whole into four equal parts, then keep the number of parts on the first dial." }
  ]
  var recipe = recipes[level - 1]
  Object.keys(recipe).forEach(function (key) { p[key] = recipe[key] })
  p.target = choose(rng, p.targets)
  return p
}

function output(p, a, b) {
  if (p.operation === "subtract") return a - b
  if (p.operation === "multiply") return a * b
  if (p.operation === "fraction") return a * b / 4
  return a + b
}

function expression(p, a, b) {
  if (p.operation === "fraction") return a + "/4 of " + b + " = " + output(p, a, b)
  var sign = p.operation === "subtract" ? " − " : p.operation === "multiply" ? " × " : " + "
  return a + sign + b + " = " + output(p, a, b)
}

function solutions(p) {
  var out = []
  if (p.kind !== "build") return out
  p.left.forEach(function (a) {
    p.right.forEach(function (b) {
      if (output(p, a, b) === p.target) out.push({ a: a, b: b })
    })
  })
  return out
}

function runMachine(p, input) { return input * p.factor / p.divisor + p.offset }

function ruleText(p) {
  var rule = p.divisor !== 1 ? "Divide by " + p.divisor : p.factor !== 1 ? "Multiply by " + p.factor : ""
  if (p.offset !== 0) rule += (rule ? ", then " : "") + (p.offset < 0 ? "subtract " + -p.offset : "add " + p.offset)
  return rule.charAt(0).toUpperCase() + rule.slice(1) + "."
}

function fromCode(code) {
  var match = /^LAB1-([1-6])-(\d{1,10})-([BM])$/.exec(String(code).trim().toUpperCase())
  if (!match || Number(match[2]) > 4294967295) return null
  return create(Number(match[1]), Number(match[2]), match[3] === "B" ? "build" : "mystery")
}

// Store only verified discoveries, not an unbounded event log or editable answer key.
function normalizeNotebook(raw) {
  if (!Array.isArray(raw)) return []
  var out = []
  var seen = {}
  raw.slice(-60).forEach(function (entry) {
    if (!entry || typeof entry !== "object") return
    var p = fromCode(entry.code)
    if (!p) return
    var key = p.code + (p.kind === "build" ? ":" + entry.a + ":" + entry.b : "")
    if (seen[key]) return
    if (p.kind === "build" && (p.left.indexOf(entry.a) < 0 || p.right.indexOf(entry.b) < 0 || output(p, entry.a, entry.b) !== p.target)) return
    seen[key] = true
    out.push({ code: p.code, a: p.kind === "build" ? entry.a : 0, b: p.kind === "build" ? entry.b : 0,
      title: p.title, note: p.kind === "build" ? expression(p, entry.a, entry.b) : ruleText(p) })
  })
  return out
}

function remember(notebook, puzzle, a, b) {
  var clean = normalizeNotebook(notebook)
  if (clean.some(function (entry) {
    return entry.code === puzzle.code && (puzzle.kind === "mystery" || (entry.a === a && entry.b === b))
  })) return { entries: clean, added: false }
  var entry = normalizeNotebook([{ code: puzzle.code, a: a, b: b }])
  if (!entry.length) return { entries: clean, added: false }
  return { entries: clean.concat(entry).slice(-60), added: true }
}

if (typeof module !== "undefined") module.exports = {
  create: create, output: output, expression: expression, solutions: solutions,
  runMachine: runMachine, ruleText: ruleText, fromCode: fromCode,
  normalizeNotebook: normalizeNotebook, remember: remember
}
