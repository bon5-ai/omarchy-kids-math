const assert = require("node:assert/strict")
const test = require("node:test")
const vm = require("node:vm")
const fs = require("node:fs")
const MathEngine = require("../MathEngine.js")
const Lab = require("../LabEngine.js")
const Garden = require("../GardenEngine.js")
const { LIMITS } = MathEngine

test("byte and nesting limits run before JSON.parse", () => {
  const context = vm.createContext({module: {exports: {}}})
  vm.runInContext(fs.readFileSync(require.resolve("../MathEngine.js"), "utf8"), context)
  vm.runInContext("JSON.parse = function () { throw new Error('parser reached') }", context)
  // Count parser calls, since parseBounded intentionally catches parse errors.
  vm.runInContext("var calls = 0; JSON.parse = function () { calls++; return {} }", context)
  const engine = context.module.exports
  for (const raw of [" ".repeat(LIMITS.stateBytes + 1), "[".repeat(10000) + "]".repeat(10000),
    '{"x":[' + '0,'.repeat(100) + '0]}']) {
    assert.equal(engine.decodeProgress(raw), null)
  }
  assert.equal(engine.parsePayload(" ".repeat(LIMITS.payloadBytes + 1)), null)
  assert.equal(engine.parsePayload('{"level":{"nested":3}}'), null)
  assert.equal(context.calls, 0)
})

test("payload schema is shallow, closed, typed and bounded in UTF-8 bytes", () => {
  for (const raw of ["null", "[]", "true", "broken", '{"extra":1}',
    {learnerId: "x".repeat(65)}, {learnerId: "😀".repeat(17)}, {learnerId: "a\nb"},
    {learnerId: []}, {learnerId: ""}, {learnerId: "\ud800"}, {mode: "unknown"}, {count: "4"},
    {seed: Infinity}, {start: 1}, {adaptive: "false"}, {input: "bogus"},
    {count: 1.5}, {seed: Number.MAX_SAFE_INTEGER + 1}]) {
    assert.equal(MathEngine.parsePayload(raw), null, JSON.stringify(raw))
  }
  const payload = MathEngine.parsePayload({learnerId: "😀".repeat(16), count: 999, mode: "assessment"})
  assert.equal(payload.learnerId.length, 32)
  assert.equal(payload.count, 40)
  assert.equal(MathEngine.parsePayload({learnerId: "a&b #c"}).learnerId, "a&b #c")
  assert.equal(MathEngine.utf8Bytes("aé😀", 7), 7)
})

test("learner cardinality is enforced without sharing or evicting profiles", () => {
  const state = MathEngine.emptyProgress()
  for (let i = 0; i < LIMITS.learners; i++) MathEngine.learnerRecord(state, "child" + i).rounds = i
  const before = JSON.stringify(state)
  assert.equal(MathEngine.learnerRecord(state, "new-child"), null)
  assert.equal(MathEngine.learnerRecord(state, "x".repeat(65)), null)
  assert.equal(JSON.stringify(state), before)
  assert.equal(MathEngine.learnerRecord(state, "child1").rounds, 1)
  state.learners.extra = {}
  assert.equal(MathEngine.decodeProgress(state), null)
})

test("state is projected to known fields and dictionary keys", () => {
  const raw = {learners: {sam: {rounds: 1e50, unknown: {retained: false},
    byLevel: {1: {total: 4, correct: 99, rounds: 2, unknown: true}, 7: {total: 8}},
    practiceSkills: {"add-within-20": {independent: 3, total: 4}, malicious: {total: 8}},
    notebook: [{code: "LAB1-1-1-B", a: 1, b: 2, title: "test", note: "test", unknown: true}],
    garden: {activities: {count: {solved: 2, supported: 99}, surprise: {solved: 5}}, unknown: true}}},
    unknown: "discard me"}
  // Non-safe numeric inputs are rejected as a whole before normalization.
  assert.equal(MathEngine.decodeProgress(raw), null)
  raw.learners.sam.rounds = 2000000
  const state = MathEngine.decodeProgress(raw)
  assert.equal(state.learners.sam.rounds, 1000000)
  assert.equal(state.unknown, undefined)
  assert.equal(state.learners.sam.unknown, undefined)
  assert.equal(state.learners.sam.byLevel[7], undefined)
  assert.equal(state.learners.sam.byLevel[1].correct, 4)
  assert.equal(state.learners.sam.practiceSkills.malicious, undefined)
  assert.equal(state.learners.sam.notebook[0].unknown, undefined)
  assert.equal(state.learners.sam.garden.activities.surprise, undefined)
  assert.equal(state.learners.sam.garden.activities.count.supported, 2)
})

test("key, notebook, assessment, string and aggregate budgets reject excess", () => {
  const keys = Object.fromEntries(Array.from({length: 65}, (_, i) => ["k" + i, 0]))
  for (const value of [keys, {learners: {sam: {notebook: Array(61).fill({})}}},
    {lastAssessment: {items: Array(41).fill({})}}, {unknown: "x".repeat(513)}]) {
    assert.equal(MathEngine.decodeProgress(JSON.stringify(value)), null)
  }
  const aggregate = {learners: {}}
  for (let i = 0; i < 16; i++) aggregate.learners["l" + i] = {
    notebook: Array.from({length: 60}, () => ({code: "LAB1-1-1-B", note: "x".repeat(512)}))
  }
  assert.equal(MathEngine.decodeProgress(aggregate), null)
  assert.equal(MathEngine.boundedJson(aggregate, LIMITS.stateBytes), "")
  const manyNodes = Array.from({length: 60}, () => Array.from({length: 60}, () => [0, 0, 0, 0]))
  assert.equal(MathEngine.decodeProgress({manyNodes}), null)
  assert(MathEngine.decodeProgress("{}".padEnd(LIMITS.stateBytes)))
  const cycle = {}; cycle.self = cycle
  assert.equal(MathEngine.boundedJson(cycle, LIMITS.stateBytes), "")
  let invoked = false
  const getter = {get value() { invoked = true; return 1 }}
  assert.equal(MathEngine.boundedJson(getter, LIMITS.stateBytes), "")
  assert.equal(invoked, false)
  assert.equal(MathEngine.boundedJson({toJSON() { throw Error("must not execute") }}, LIMITS.stateBytes), "")
})

test("valid legacy progress, garden, notebook and tutor results round-trip", () => {
  let state = MathEngine.emptyProgress()
  const learner = MathEngine.learnerRecord(state, "__proto__")
  learner.garden = Garden.record(Garden.loadProgress({level: 3, reducedMotion: true}), {kind: "primes", helped: true})
  for (let seed = 1; seed <= 60; seed++) {
    const puzzle = Lab.create(3, seed, "mystery")
    learner.notebook = Lab.remember(learner.notebook, puzzle, 0, 0).entries
  }
  const result = MathEngine.buildResult({mode: "assessment", learnerId: "__proto__", levelId: 3,
    items: MathEngine.generateRound(3, 40, 42).map(q => ({...q, correct: true, ms: 2000}))})
  state = MathEngine.recordSession(state, result, 40)
  const raw = MathEngine.boundedJson(state, LIMITS.stateBytes)
  assert(raw)
  const restored = MathEngine.decodeProgress(raw)
  assert.deepEqual(restored, state)
  assert.equal(restored.learners.__proto__.notebook.length, 60)
  assert.equal(restored.learners.__proto__.garden.activities.primes.solved, 1)
  assert.equal({}.rounds, undefined)
  assert(MathEngine.boundedJson(result, LIMITS.ipcBytes))
  assert.equal(MathEngine.buildResult({items: Array(41).fill({})}), null)
  assert.equal(MathEngine.boundedJson({message: "é".repeat(512)}, 1024), "")
  assert.equal(Buffer.byteLength(MathEngine.catalogJson()) < LIMITS.ipcBytes, true)
})
