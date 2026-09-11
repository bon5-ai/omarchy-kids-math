const { test } = require('node:test');
const assert = require('node:assert/strict');
const Garden = require('../GardenEngine');

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
test('hints and corrupt native progress are handled without creating mastery claims', () => {
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

test('all discovery levels produce correct, repeatable mathematics and reachable models', () => {
  for (const activity of Garden.activities().filter(a => a.trail)) {
    for (let level = 1; level <= 3; level++) {
      for (let seed = 1; seed <= 80; seed++) {
        for (let index = 0; index < 5; index++) {
          const q = Garden.makeLesson(activity.id, level, seed, index);
          assert.deepEqual(q, Garden.makeLesson(activity.id, level, seed, index));
          assert(q.choices.includes(q.answer));
          assert.equal(new Set(q.choices).size, q.choices.length);
          if (q.kind === 'parity') assert.equal(q.answer, q.a % 2);
          if (q.kind === 'primes') {
            const divisors = Array.from({length:q.a}, (_, i) => i + 1).filter(d => q.a % d === 0);
            assert.equal(q.answer, divisors.length === 1 ? 0 : divisors.length === 2 ? 1 : 2);
          }
          if (q.kind === 'powers') assert.equal(q.answer, Array(q.b).fill(q.a).reduce((a, b) => a * b, 1));
          if (q.kind === 'coordinates' || q.kind === 'angles') assert.equal(q.answer, q.a);
          if (q.kind === 'area') assert.equal(q.answer, q.a * q.b);
          if (q.kind === 'slope') assert.equal(q.answer * q.a, q.b);
          let state = Garden.blankPicture();
          for (let step = 0; step < 100 && !Garden.pictureComplete(q, state); step++) state = Garden.step(q, state);
          assert(Garden.pictureComplete(q, state), q.kind + ' demonstration terminates');
        }
      }
    }
  }
});

test('manipulatives conserve quantities, pair once, and respect experiment bounds', () => {
  for (const kind of ['count', 'join', 'take', 'ten', 'tens', 'parity']) {
    const q = Garden.makeLesson(kind), initial = Garden.blankPicture();
    assert.equal(Garden.activate(q, initial, -1), initial);
    assert.equal(Garden.activate(q, initial, Garden.tokenCount(q)), initial);
    let state = initial;
    for (let step = 0; step < 100 && !Garden.pictureComplete(q, state); step++) state = Garden.step(q, state);
    assert(Garden.pictureComplete(q, state));
    assert.deepEqual(initial, Garden.blankPicture(), 'input state is immutable');
    assert.equal(new Set(state.marked).size, state.marked.length);
    if (kind === 'take') assert.equal(state.marked.length + state.moved.length, q.a);
    if (kind === 'join') assert.equal(state.marked.length, q.a + q.b);
    if (kind === 'ten') assert.equal(state.filled.length + q.a, 10);
  }
  const q = Garden.makeLesson('powers');
  let state = Garden.blankPicture();
  assert.equal(Array.from({length:q.answer}, (_, i) => i).filter(i => Garden.tokenVisible(q, state, i)).length, 1);
  state = Garden.adjust(q, state, 'stage', 100);
  assert.equal(state.stage, q.b);
  assert.equal(Array.from({length:q.answer}, (_, i) => i).filter(i => Garden.tokenVisible(q, state, i)).length, q.answer);
  assert.equal(Garden.adjust(q, state, 'angle', 15), state, 'unrelated experiment fields cannot change');
  assert.equal(Garden.isPrime(1), false);
  assert.equal(Garden.isPrime(2), true);
  assert.equal(Garden.makeLesson('primes', 3, 1, 2).answer, 0, 'one is neither prime nor composite');
});

test('native progress preserves observations, bounds counters and isolates malformed settings', () => {
  const original = Garden.loadProgress({reducedMotion:true, level:99, activities:{slope:{solved:1000000,supported:1000000}}});
  assert.equal(original.level, 3);
  const saved = Garden.record(original, {kind:'slope', helped:true});
  assert.deepEqual(saved.activities.slope, {solved:1000000,supported:1000000});
  assert(saved.reducedMotion);
  assert.deepEqual(Garden.record(saved, {kind:'__proto__'}), saved);
  assert.equal(Garden.loadProgress({reducedMotion:'false'}).reducedMotion, false);
});
