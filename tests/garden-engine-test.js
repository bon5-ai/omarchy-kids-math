const { test } = require('node:test');
const assert = require('node:assert/strict');
const Garden = require('../garden/src/lessons');

test('every picture corresponds to its equation, within the selected range', () => {
  for (const kind of ['count', 'join', 'take', 'ten', 'tens']) {
    for (let level = 1; level <= 3; level++) {
      for (let seed = 1; seed <= 400; seed++) {
        const q = Garden.makeLesson(kind, level, seed, 2);
        const max = level === 1 ? 5 : level === 2 ? 10 : 20;
        assert.equal(q.choices.length, 3);
        assert.equal(new Set(q.choices).size, 3);
        assert(q.choices.includes(q.answer));
        assert(q.choices.every(n => Number.isInteger(n) && n >= 0));
        if (kind === 'count') { assert.equal(q.answer, q.a); assert(q.a <= (level === 1 ? 5 : 10)); }
        if (kind === 'join') { assert.equal(q.answer, q.a + q.b); assert(q.answer <= max); }
        if (kind === 'take') { assert.equal(q.answer, q.a - q.b); assert(q.a <= max); assert(q.answer >= 0); }
        if (kind === 'ten') { assert.equal(q.a + q.b, 10); assert.equal(q.answer, q.b); }
        if (kind === 'tens') { assert.equal(q.answer, q.a * 10 + q.b); assert(q.b < 10); assert(q.answer <= [0, 39, 69, 99][level]); }
        assert.equal(q.steps.length, 3);
        assert(q.hint && q.explanation);
        assert.deepEqual(q, Garden.makeLesson(kind, level, seed, 2));
      }
    }
  }
});
test('mistakes offer another try, duplicate input cannot score twice, and Next never skips', () => {
  let session = Garden.begin('join', 1, 45);
  assert.equal(Garden.next(session), session);
  assert.equal(Garden.submit(session, ''), session);
  assert.equal(Garden.submit(session, null), session);
  assert.equal(Garden.submit(session, 999), session);
  session = Garden.submit(session, session.lesson.choices.find(n => n !== session.lesson.answer));
  assert.equal(session.solved, false);
  assert.equal(session.helped, true);
  assert.equal(session.answers.length, 0);
  session = Garden.submit(session, session.lesson.answer);
  assert.equal(session.answers.length, 1);
  assert.equal(session.answers[0].attempts, 2);
  assert.equal(session.answers[0].helped, true);
  assert.equal(Garden.submit(session, session.lesson.answer), session);
  session = Garden.next(session);
  assert.equal(session.attempts, 0);
  assert.equal(session.helped, false);
  for (let i = 1; i < 5; i++) session = Garden.next(Garden.submit(session, session.lesson.answer));
  assert.equal(session.complete, true);
  assert.equal(session.answers.length, 5);
  assert.equal(Garden.next(session), session);
});
test('hints and corrupt browser progress are handled without creating mastery claims', () => {
  let session = Garden.help(Garden.begin('ten', 2, 1));
  session = Garden.submit(session, session.lesson.answer);
  assert.equal(session.answers[0].helped, true);
  const progress = Garden.record(Garden.loadProgress('{broken'), session.answers[0]);
  assert.deepEqual(progress.activities.ten, { solved: 1, supported: 1 });
  const invalid = Garden.loadProgress(JSON.stringify({ activities: { count: { solved: -1, supported: Infinity }, tens: { solved: 4, supported: 99 } } }));
  assert.deepEqual(invalid.activities.count, { solved: 0, supported: 0 });
  assert.deepEqual(invalid.activities.tens, { solved: 4, supported: 4 });
  assert.deepEqual(Garden.loadProgress(JSON.stringify(progress)), progress);
  assert.equal(Garden.clampLevel(6), 3);
  assert.equal(Garden.clampLevel('oops'), 1);
});
