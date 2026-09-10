// Pure lesson/session logic; also exercised by Node and browser tests.
const activities = [
  { id: 'count', title: 'Apple orchard', skill: 'Count one by one', ages: 'Ages 5–6', image: 'apples.jpg', color: 'coral', icon: 'apple', invitation: 'Every apple counts.', action: 'Let’s count', noun: 'apples' },
  { id: 'join', title: 'Frog pond', skill: 'Add & take away', ages: 'Ages 5–7', image: 'pond.jpg', color: 'blue', icon: 'pond', invitation: 'Little hops. Big ideas.', action: 'Let’s hop', noun: 'frogs' },
  { id: 'ten', title: 'Make-ten meadow', skill: 'Find the missing part', ages: 'Ages 5–8', image: 'meadow.jpg', color: 'yellow', icon: 'flower', invitation: 'A space for every flower.', action: 'Let’s grow', noun: 'flowers' },
  { id: 'tens', title: 'Tiny town', skill: 'Explore tens & ones', ages: 'Ages 6–8', image: 'town.jpg', color: 'purple', icon: 'blocks', invitation: 'Small blocks, bigger numbers.', action: 'Let’s build', noun: 'blocks' }
];
const clampLevel = value => Math.max(1, Math.min(3, Math.floor(Number(value)) || 1));
function random(seed) {
  let t = Number(seed) >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
function makeLesson(kind, level = 1, seed = 1, index = 0) {
  if (!['count', 'join', 'take', 'ten', 'tens'].includes(kind)) throw new Error('Unknown activity');
  level = clampLevel(level);
  const rng = random(seed + index * 997);
  const int = (low, high) => low + Math.floor(rng() * (high - low + 1));
  const first = index === 0;
  let a, b, answer, title, question, hint, explanation, steps;
  if (kind === 'count') {
    a = first ? 5 : int(1, level === 1 ? 5 : 10); b = 0; answer = a;
    title = 'An apple for every tap.'; question = 'How many apples can you see?';
    hint = 'Touch each apple once. Say one number for each apple.';
    explanation = `The last number you say tells how many. There are ${a} apples.`;
    steps = ['Look at the apples.', 'Touch each apple once.', 'The last number tells how many.'];
  } else if (kind === 'join') {
    const max = level === 1 ? 5 : level === 2 ? 10 : 20;
    a = first ? 3 : int(1, max - 1); b = first ? 2 : int(1, max - a); answer = a + b;
    title = 'Here come some friends!'; question = `${a} frogs meet ${b} more. How many altogether?`;
    hint = `Start with ${a}. Hop ${b} more frogs into the pond and keep counting.`;
    explanation = `${a} and ${b} make ${answer}. Adding joins two groups into one whole.`;
    steps = [`Start with ${a} teal frogs.`, `Bring in ${b} golden frogs.`, 'Count both groups together.'];
  } else if (kind === 'take') {
    a = first ? 5 : int(2, level === 1 ? 5 : level === 2 ? 10 : 20);
    b = first ? 2 : int(1, a); answer = a - b;
    title = 'A few friends hop away.'; question = `${a} frogs. ${b} hop away. How many stay?`;
    hint = `Move ${b} frogs out of the pond. Count only the frogs that stay.`;
    explanation = `${a} take away ${b} leaves ${answer}. ${answer === 0 ? 'Zero means no frogs are left in the pond.' : 'The faded frogs have hopped away.'}`;
    steps = [`Start with ${a} frogs.`, `Let ${b} frogs hop away.`, 'Count the frogs that stay.'];
  } else if (kind === 'ten') {
    a = first ? 6 : int(1, 9); b = 10 - a; answer = b;
    title = 'Let’s grow a full ten.'; question = `${a} flowers are growing. How many more make 10?`;
    hint = 'A ten-frame has 2 rows of 5 spaces. Put a flower in each empty space.';
    explanation = `${a} flowers and ${b} more fill all 10 spaces. ${a} + ${b} = 10.`;
    steps = [`Look at the ${a} flowers.`, 'Fill each empty space.', 'Count only the flowers you added.'];
  } else {
    a = first ? 2 : int(1, level === 1 ? 3 : level === 2 ? 6 : 9);
    b = first ? 3 : int(0, 9); answer = a * 10 + b;
    title = 'Little blocks make big numbers.'; question = `${a} tens and ${b} ones. What number is that?`;
    hint = 'Each tall tower has 10 little blocks. Count the towers by tens, then count the loose ones.';
    explanation = `${a} tens is ${a * 10}. Add ${b} ones to make ${answer}. ${b === 0 ? 'There are no loose ones this time.' : ''}`.trim();
    steps = ['Each tall tower is one ten.', `Count ${a} towers by tens.`, `Then count ${b} loose ones.`];
  }
  const candidates = new Set([answer]);
  const maxChoice = kind === 'ten' || kind === 'count' ? 10 : kind === 'tens' ? 99 : 20;
  for (const offset of [-1, 1, 2, -2, 3]) {
    const value = answer + offset;
    if (value >= 0 && value <= maxChoice && candidates.size < 3) candidates.add(value);
  }
  const choices = [...candidates];
  for (let i = choices.length - 1; i > 0; i--) { const j = int(0, i); [choices[i], choices[j]] = [choices[j], choices[i]]; }
  return { kind, level, a, b, answer, title, question, hint, explanation, steps, choices };
}
function begin(kind, level, seed) {
  return { kind, level: clampLevel(level), seed, index: 0, total: 5, lesson: makeLesson(kind, level, seed), attempts: 0, helped: false, solved: false, complete: false, answers: [] };
}
function help(session) { return { ...session, helped: true }; }
function submit(session, value) {
  if (session.solved || session.complete || !Number.isInteger(value) || !session.lesson.choices.includes(value)) return session;
  const attempts = session.attempts + 1;
  if (value !== session.lesson.answer) return { ...session, attempts, helped: true };
  return { ...session, attempts, solved: true, answers: [...session.answers, { kind: session.kind, a: session.lesson.a, b: session.lesson.b, answer: value, attempts, helped: session.helped }] };
}
function next(session) {
  if (!session.solved || session.complete) return session;
  if (session.index + 1 === session.total) return { ...session, complete: true };
  const index = session.index + 1;
  return { ...session, index, lesson: makeLesson(session.kind, session.level, session.seed, index), attempts: 0, helped: false, solved: false };
}
function loadProgress(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { value = null; }
  const clean = { version: 1, activities: {} };
  for (const kind of ['count', 'join', 'take', 'ten', 'tens']) {
    const entry = value?.activities?.[kind];
    const safe = n => Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 1000000) : 0;
    const solved = safe(entry?.solved);
    clean.activities[kind] = { solved, supported: Math.min(solved, safe(entry?.supported)) };
  }
  return clean;
}
function record(progress, answer) {
  const clean = loadProgress(JSON.stringify(progress));
  if (!Object.hasOwn(clean.activities, answer.kind)) return clean;
  clean.activities[answer.kind].solved++;
  if (answer.helped) clean.activities[answer.kind].supported++;
  return clean;
}
module.exports = { activities, clampLevel, makeLesson, begin, help, submit, next, loadProgress, record };
