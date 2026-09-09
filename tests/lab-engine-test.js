const assert = require("assert")
const lab = require("../LabEngine.js")
function check(name, fn) { fn(); console.log("ok  " + name) }

check("all six build recipes are deterministic and have multiple reachable solutions", () => {
  for (let level = 1; level <= 6; level++) {
    for (let seed = 0; seed < 300; seed++) {
      const puzzle = lab.create(level, seed, "build")
      assert.deepStrictEqual(puzzle, lab.create(level, seed, "build"))
      const solutions = lab.solutions(puzzle)
      assert(solutions.length >= 2, `${level}/${seed} needs multiple inventions`)
      solutions.forEach(({a, b}) => {
        assert(puzzle.left.includes(a) && puzzle.right.includes(b))
        assert.strictEqual(lab.output(puzzle, a, b), puzzle.target)
      })
    }
  }
})

check("every mystery clue follows its rule and has one correct answer choice", () => {
  for (let level = 1; level <= 6; level++) {
    for (let seed = 0; seed < 300; seed++) {
      const puzzle = lab.create(level, seed, "mystery")
      assert.deepStrictEqual(puzzle, lab.create(level, seed, "mystery"))
      assert.strictEqual(lab.runMachine(puzzle, puzzle.probe), puzzle.answer)
      assert.strictEqual(new Set(puzzle.choices).size, 4)
      assert.strictEqual(puzzle.choices.filter(n => n === puzzle.answer).length, 1)
      puzzle.inputs.forEach(n => assert(Number.isInteger(lab.runMachine(puzzle, n))))
      if (level < 6) assert(puzzle.choices.every(n => n >= 0))
      assert(puzzle.hint.length > 20 && lab.ruleText(puzzle).endsWith("."))
    }
  }
})

check("neighboring new-puzzle seeds produce a variety of targets", () => {
  for (let level = 1; level <= 6; level++) {
    const targets = new Set(Array.from({length: 30}, (_, i) => lab.create(level, 1700000000 + i).target))
    assert(targets.size >= 3)
  }
})

check("versioned puzzle codes reopen exact puzzles and reject malformed inputs", () => {
  for (const kind of ["build", "mystery"]) {
    for (const seed of [0, 1, 42, 4294967295]) {
      const puzzle = lab.create(6, seed, kind)
      assert.deepStrictEqual(lab.fromCode(puzzle.code), puzzle)
      assert.deepStrictEqual(lab.fromCode("  " + puzzle.code.toLowerCase() + "  "), puzzle)
    }
  }
  for (const code of [null, {}, "", "LAB1-7-42-B", "LAB2-1-42-B", "LAB1-1-4294967296-B", "LAB1-1-4-M/../../x", "LAB1-1--1-B"]) {
    assert.strictEqual(lab.fromCode(code), null)
  }
})

check("notebooks validate solutions, deduplicate, round-trip, and stay bounded", () => {
  let book = []
  for (let seed = 1; seed <= 65; seed++) {
    const puzzle = lab.create(4, seed)
    const {a, b} = lab.solutions(puzzle)[0]
    const result = lab.remember(book, puzzle, a, b)
    assert.strictEqual(result.added, true)
    book = result.entries
  }
  assert.strictEqual(book.length, 60)
  assert.deepStrictEqual(lab.normalizeNotebook(JSON.parse(JSON.stringify(book))), book)
  const first = book[0]
  const duplicate = lab.remember(book, lab.fromCode(first.code), first.a, first.b)
  assert.strictEqual(duplicate.added, false)
  assert.deepStrictEqual(duplicate.entries, book, "a duplicate must not evict a saved invention")
  assert.deepStrictEqual(lab.normalizeNotebook([null, {}, {code: first.code, a: -100, b: 10}]), [])
  const invalid = lab.remember(book, lab.fromCode(first.code), -100, 10)
  assert.strictEqual(invalid.added, false)
  assert.deepStrictEqual(invalid.entries, book)
  const mystery = lab.create(6, 100, "mystery")
  const result = lab.remember(book, mystery, 0, 0)
  assert(result.added)
  assert.strictEqual(result.entries.length, 60)
  assert.strictEqual(result.entries[59].note, lab.ruleText(mystery))
})
console.log("\nAll LabEngine tests passed.")
