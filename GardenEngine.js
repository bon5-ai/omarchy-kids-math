// Shared by the native QML garden and Node tests. No browser or shell services.
function activities() { return [
  { id: 'count', title: 'Apple orchard', skill: 'Count one by one', ages: 'Ages 5–6', image: 'apples.jpg', color: 'coral', icon: 'apple', invitation: 'Every apple counts.', action: 'Let’s count', noun: 'apples' },
  { id: 'join', title: 'Frog pond', skill: 'Add & take away', ages: 'Ages 5–7', image: 'pond.jpg', color: 'blue', icon: 'pond', invitation: 'Little hops. Big ideas.', action: 'Let’s hop', noun: 'frogs' },
  { id: 'ten', title: 'Make-ten meadow', skill: 'Find the missing part', ages: 'Ages 5–8', image: 'meadow.jpg', color: 'yellow', icon: 'flower', invitation: 'A space for every flower.', action: 'Let’s grow', noun: 'flowers' },
  { id: 'tens', title: 'Tiny town', skill: 'Explore tens & ones', ages: 'Ages 6–8', image: 'town.jpg', color: 'purple', icon: 'blocks', invitation: 'Small blocks, bigger numbers.', action: 'Let’s build', noun: 'blocks' },
  { id: 'parity', title: 'Odd & even', skill: 'Find pairs and leftovers', trail: 1, bridge: 'Patterns and divisibility' },
  { id: 'primes', title: 'Prime builders', skill: 'Discover factors with rectangles', trail: 2, bridge: 'Factors and mathematical reasoning' },
  { id: 'powers', title: 'Power steps', skill: 'Watch repeated multiplication grow', trail: 3, bridge: 'Powers and exponential growth' },
  { id: 'coordinates', title: 'Coordinate paths', skill: 'Move across, then up', trail: 4, bridge: 'Coordinates and graphing' },
  { id: 'angles', title: 'Angle turns', skill: 'Measure a turn in degrees', trail: 5, bridge: 'Geometry and trigonometry' },
  { id: 'area', title: 'Area builders', skill: 'Cover a rectangle with unit squares', trail: 6, bridge: 'Geometry and measuring area' },
  { id: 'slope', title: 'Slope & change', skill: 'Explore rise for each step across', trail: 7, bridge: 'Ratios, graphs and rates of change' }
]; }
function clampLevel(value) { return Math.max(1, Math.min(3, Math.floor(Number(value)) || 1)); }
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
  if (activities().some(a => a.id === kind && a.trail)) return trailLesson(kind, clampLevel(level), seed, index);
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
function help(session) { return Object.assign({}, session, { helped: true }); }
function submit(session, value) {
  if (session.solved || session.complete || !Number.isInteger(value) || !session.lesson.choices.includes(value)) return session;
  const attempts = session.attempts + 1;
  if (value !== session.lesson.answer) return Object.assign({}, session, { attempts, helped: true });
  return Object.assign({}, session, { attempts, solved: true, answers: session.answers.concat([{ kind: session.kind, a: session.lesson.a, b: session.lesson.b, answer: value, attempts, helped: session.helped }]) });
}
function next(session) {
  if (!session.solved || session.complete) return session;
  if (session.index + 1 === session.total) return Object.assign({}, session, { complete: true });
  const index = session.index + 1;
  return Object.assign({}, session, { index, lesson: makeLesson(session.kind, session.level, session.seed, index), attempts: 0, helped: false, solved: false });
}
function loadProgress(raw) {
  let value;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { value = null; }
  const clean = { version: 1, activities: {}, reducedMotion: value?.reducedMotion === true, level: clampLevel(value?.level) };
  for (const kind of activities().map(a => a.id).concat(['take'])) {
    const entry = value?.activities?.[kind];
    const safe = n => Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 1000000) : 0;
    const solved = safe(entry?.solved);
    clean.activities[kind] = { solved, supported: Math.min(solved, safe(entry?.supported)) };
  }
  return clean;
}
function record(progress, answer) {
  const clean = loadProgress(JSON.stringify(progress));
  if (!answer || !Object.prototype.hasOwnProperty.call(clean.activities, answer.kind)) return clean;
  clean.activities[answer.kind].solved = Math.min(1000000, clean.activities[answer.kind].solved + 1);
  if (answer.helped) clean.activities[answer.kind].supported = Math.min(1000000, clean.activities[answer.kind].supported + 1);
  return clean;
}
function isPrime(n) {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}
function trailLesson(kind, level, seed, index) {
  const rng = random(seed + index * 997), int = (low, high) => low + Math.floor(rng() * (high - low + 1));
  const first = index === 0;
  let a, b = 0, answer, question, hint, explanation, steps, choices, choiceLabels;
  if (kind === 'parity') {
    a = first ? 7 : int(2, level === 1 ? 10 : 20); answer = a % 2;
    question = a + ' stones. Is that odd or even?';
    hint = 'Make pairs. An even number has a partner for every stone. An odd number has one left over.';
    explanation = a + ' = 2 × ' + Math.floor(a / 2) + (answer ? ' + 1. One unpaired stone makes this odd.' : '. Every stone has a partner, so this is even.');
    steps = ['Find a stone.', 'Give it a partner.', 'Look for a leftover.'];
    choices = [0, 1]; choiceLabels = { 0: 'Even · all paired', 1: 'Odd · one left' };
  } else if (kind === 'primes') {
    a = first ? 7 : index === 1 ? 12 : index === 2 ? 1 : int(2, level === 1 ? 12 : level === 2 ? 20 : 30);
    answer = a === 1 ? 0 : isPrime(a) ? 1 : 2;
    question = 'Is ' + a + ' prime, composite, or neither?';
    hint = 'Change the number of rows. A full rectangle with more than one row and more than one column shows extra factors.';
    const factors = [];
    for (let d = 1; d <= a; d++) if (a % d === 0) factors.push(d);
    explanation = a === 1 ? '1 has only one positive factor. A prime needs exactly two, so 1 is neither prime nor composite.' : isPrime(a) ? a + ' has exactly two positive factors: 1 and ' + a + '. It is prime.' : a + ' has factors ' + factors.join(', ') + '. More than two positive factors makes it composite.';
    steps = ['Start with one row.', 'Try other numbers of rows.', 'Look for a full rectangle.'];
    choices = [1, 2, 0]; choiceLabels = { 0: 'Neither', 1: 'Prime', 2: 'Composite' };
  } else if (kind === 'powers') {
    a = level === 3 && !first ? 3 : 2; b = first ? 3 : int(1, a === 3 ? 3 : level === 1 ? 3 : 5); answer = Math.pow(a, b);
    question = 'Start with 1. ' + (a === 2 ? 'Double' : 'Triple') + ' it ' + b + ' times. How many?';
    hint = 'Each step multiplies the whole group by ' + a + '. The exponent counts how many times to multiply.';
    explanation = a + '^' + b + ' = ' + Array(b).fill(a).join(' × ') + ' = ' + answer + '. Equal steps multiply by the same factor: this is exponential growth.';
    steps = ['Begin with one block.', 'Multiply the whole group.', 'Repeat for ' + b + ' steps.'];
  } else if (kind === 'coordinates') {
    a = first ? 3 : int(0, 5); b = first ? 2 : int(0, 5); answer = a;
    question = 'The treasure is at (?, ' + b + '). What is its x-coordinate?';
    hint = 'Start at (0, 0). The first coordinate counts steps across; the second counts steps up. Tap a grid point or use the arrows.';
    explanation = '(' + a + ', ' + b + ') means ' + a + ' across and ' + b + ' up. Coordinates connect shapes, movement and graphs.';
    steps = ['Start at the origin.', 'Move across on x.', 'Then move up on y.'];
  } else if (kind === 'angles') {
    const angles = level === 1 ? [30, 60, 90, 120, 180] : [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];
    a = first ? 90 : angles[int(0, angles.length - 1)]; answer = a;
    question = 'How many degrees is the dotted turn?';
    hint = 'Turn the solid ray to match the dotted ray. A quarter-turn is 90°. A straight angle is 180°.';
    explanation = a + '° is ' + (a < 90 ? 'an acute angle, smaller than a right angle.' : a === 90 ? 'a right angle: one quarter of a full turn.' : a < 180 ? 'an obtuse angle, between 90° and 180°.' : 'a straight angle: half of a full turn.') + ' Measuring turns is a foundation for triangles and trigonometry.';
    steps = ['Start along the baseline.', 'Turn to the dotted ray.', 'Read the degrees.'];
  } else if (kind === 'area') {
    a = first ? 4 : int(2, level === 1 ? 4 : 6); b = first ? 3 : int(2, level === 1 ? 3 : 5); answer = a * b;
    question = 'A rectangle is ' + a + ' units wide and ' + b + ' units tall. What is its area?';
    hint = 'Cover it with unit squares. Count the squares in a row, then count how many rows there are.';
    explanation = a + ' × ' + b + ' = ' + answer + ' square units. Area measures the surface covered. Counting small pieces of area is also an idea you will use in calculus.';
    steps = ['Find one unit square.', 'Cover one row.', 'Count all the rows.'];
  } else {
    a = first ? 3 : int(2, 4); const rate = first ? 2 : int(1, 3); b = a * rate; answer = rate;
    question = 'Go right ' + a + ' and up ' + b + '. How much up for each 1 across?';
    hint = 'Walk along the path one horizontal step at a time. Compare how far up you move each time.';
    explanation = 'Slope = rise ÷ run = ' + b + ' ÷ ' + a + ' = ' + answer + '. Every 1 across gives ' + answer + ' up. Slope describes a rate of change; later, derivatives describe local rates of change on curves.';
    steps = ['Start at (0, 0).', 'Take one step across.', 'Measure the matching rise.'];
  }
  if (!choices) {
    const candidates = [answer];
    const jump = kind === 'angles' ? 15 : 1;
    for (const offset of [-jump, jump, 2 * jump, -2 * jump]) {
      const value = answer + offset;
      if (value >= 0 && (kind !== 'angles' || value <= 180) && candidates.length < 3) candidates.push(value);
    }
    choices = candidates;
    for (let i = choices.length - 1; i > 0; i--) { const j = int(0, i); const swap = choices[i]; choices[i] = choices[j]; choices[j] = swap; }
  }
  const activity = activities().filter(item => item.id === kind)[0];
  return { kind, level, a, b, answer, title: activity.title, question, hint, explanation, steps, choices, choiceLabels, trail: activity.trail, bridge: activity.bridge };
}
function blankPicture() { return { marked: [], moved: [], filled: [], rows: 1, stage: 0, pointX: 0, pointY: 0, angle: 0, walk: 0 }; }
function tokenCount(q) {
  if (!q || q.kind === 'angles') return 0;
  if (q.kind === 'coordinates' || q.kind === 'slope') return 1;
  if (q.kind === 'area' || q.kind === 'powers') return q.answer;
  return q.kind === 'ten' ? 10 : q.kind === 'join' || q.kind === 'tens' ? q.a + q.b : q.a;
}
function tokenVisible(q, state, id) { return q.kind !== 'powers' || id < Math.pow(q.a, state.stage); }
function adjust(q, state, field, delta) {
  const limits = { rows: [1, q.a], stage: [0, q.b], pointX: [0, 5], pointY: [0, 5], angle: [0, 180], walk: [0, q.a] };
  const allowed = { primes: ['rows'], powers: ['stage'], coordinates: ['pointX', 'pointY'], angles: ['angle'], slope: ['walk'] };
  if (!(allowed[q.kind] || []).includes(field) || !Number.isFinite(delta)) return state;
  const copy = Object.assign({}, state);
  copy[field] = Math.max(limits[field][0], Math.min(limits[field][1], Math.round(state[field] + delta)));
  return copy;
}
function activate(q, picture, id) {
  if (!q || !Number.isInteger(id) || id < 0 || id >= tokenCount(q)) return picture;
  const state = Object.assign({}, picture, { marked: picture.marked.slice(), moved: picture.moved.slice(), filled: picture.filled.slice() });
  if (q.kind === 'powers') return adjust(q, state, 'stage', 1);
  if (q.kind === 'coordinates' || q.kind === 'slope') return state;
  if (q.kind === 'parity') {
    const partner = id % 2 ? id - 1 : id + 1;
    if (!state.marked.includes(id)) state.marked.push(id);
    if (partner < q.a && !state.marked.includes(partner)) state.marked.push(partner);
  } else if (q.kind === 'ten') {
    if (id < q.a) return picture;
    state.filled = state.filled.includes(id) ? state.filled.filter(n => n !== id) : state.filled.concat([id]);
  } else if (q.kind === 'take') {
    if (state.moved.includes(id)) return picture;
    if (state.moved.length < q.b) state.moved.push(id);
    else if (!state.marked.includes(id)) state.marked.push(id);
  } else if (q.kind === 'join' && id >= q.a && !state.moved.includes(id)) {
    state.moved.push(id); state.marked = [];
  } else if (q.kind === 'join' && state.moved.length < q.b) {
    return picture;
  } else if (!state.marked.includes(id)) state.marked.push(id);
  return state;
}
function pictureComplete(q, state) {
  if (!q) return false;
  if (q.kind === 'powers') return state.stage === q.b;
  if (q.kind === 'primes') return state.rows === q.a;
  if (q.kind === 'coordinates') return state.pointX === q.a && state.pointY === q.b;
  if (q.kind === 'angles') return state.angle === q.a;
  if (q.kind === 'slope') return state.walk === q.a;
  if (q.kind === 'ten') return state.filled.length === q.b;
  if (q.kind === 'join' || q.kind === 'take') return state.moved.length === q.b && state.marked.length === q.answer;
  return state.marked.length === tokenCount(q);
}
function step(q, state) {
  if (q.kind === 'powers') return adjust(q, state, 'stage', 1);
  if (q.kind === 'primes') return adjust(q, state, 'rows', 1);
  if (q.kind === 'coordinates') return state.pointX !== q.a ? adjust(q, state, 'pointX', Math.sign(q.a - state.pointX)) : adjust(q, state, 'pointY', Math.sign(q.b - state.pointY));
  if (q.kind === 'angles') return adjust(q, state, 'angle', Math.sign(q.a - state.angle) * 15);
  if (q.kind === 'slope') return adjust(q, state, 'walk', 1);
  for (let i = 0; i < tokenCount(q); i++) {
    if (q.kind === 'ten' && (i < q.a || state.filled.includes(i))) continue;
    if (q.kind === 'join' && state.moved.length < q.b && (i < q.a || state.moved.includes(i))) continue;
    if (q.kind === 'take' && state.moved.includes(i)) continue;
    if (state.marked.includes(i)) continue;
    return activate(q, state, i);
  }
  return state;
}
function counted(q, state, end) {
  return state.marked.slice(0, end === undefined ? state.marked.length : end).reduce((sum, id) => sum + (q.kind === 'tens' && id < q.a ? 10 : 1), 0);
}
function caption(q, state) {
  if (!q) return '';
  if (q.kind === 'parity') return Math.floor(state.marked.length / 2) + ' pairs made' + (state.marked.length % 2 ? ' · one stone without a partner' : ' · touch a stone to make a pair');
  if (q.kind === 'primes') return q.a + ' blocks · ' + state.rows + ' rows · ' + (q.a % state.rows === 0 ? (q.a / state.rows) + ' in each row. A full rectangle!' : 'the last column has gaps. Try another arrangement.');
  if (q.kind === 'powers') return 'Step ' + state.stage + ' of ' + q.b + ' · ' + Math.pow(q.a, state.stage) + ' blocks · multiply by ' + q.a + ' each step';
  if (q.kind === 'coordinates') return 'You are at (' + state.pointX + ', ' + state.pointY + ')' + (pictureComplete(q, state) ? ' · treasure found!' : ' · across first, then up');
  if (q.kind === 'angles') return 'Your turn: ' + state.angle + '°' + (pictureComplete(q, state) ? ' · the rays match!' : ' · turn to match the dotted ray');
  if (q.kind === 'area') return state.marked.length + ' unit squares covered · ' + q.a + ' in each row';
  if (q.kind === 'slope') return state.walk + ' across → ' + state.walk * q.answer + ' up · each step rises by ' + q.answer;
  if (q.kind === 'count') return state.marked.length ? counted(q, state) + ' apples counted. ' + (pictureComplete(q, state) ? 'The last number tells how many!' : 'Find another apple.') : 'Touch an apple. Say “one.” Keep going!';
  if (q.kind === 'join') return q.a + ' here + ' + state.moved.length + ' joined · ' + (q.b - state.moved.length) + ' still waiting';
  if (q.kind === 'take') return state.moved.length + ' hopped away · ' + (q.a - state.moved.length) + ' stay in the pond';
  if (q.kind === 'ten') return q.a + ' growing + ' + state.filled.length + ' planted · ' + (q.b - state.filled.length) + ' empty spaces';
  return state.marked.length ? counted(q, state) + ' blocks counted. ' + (pictureComplete(q, state) ? 'Tens and ones work together!' : 'Try another tower or loose block.') : 'Each tower is 10. Each little block is 1.';
}
function actionLabel(q, state) {
  if (!q) return '';
  if (pictureComplete(q, state)) return 'Picture complete ✓';
  if (q.kind === 'parity') return 'Make a pair';
  if (q.kind === 'primes') return 'Try another row count';
  if (q.kind === 'powers') return 'Multiply by ' + q.a;
  if (q.kind === 'coordinates') return 'Take a step';
  if (q.kind === 'angles') return 'Turn 15° toward the ray';
  if (q.kind === 'area') return 'Cover a square';
  if (q.kind === 'slope') return 'Walk one step across';
  if (q.kind === 'count') return 'Count an apple';
  if (q.kind === 'ten') return 'Plant a flower';
  if (q.kind === 'join') return state.moved.length < q.b ? 'Hop a friend in' : 'Count a frog';
  if (q.kind === 'take') return state.moved.length < q.b ? 'Hop a frog away' : 'Count a frog that stayed';
  return 'Count the next group';
}
function tokenLabel(q, state, id) {
  if (q.kind === 'coordinates') return 'Explorer at ' + state.pointX + ' across, ' + state.pointY + ' up';
  if (q.kind === 'slope') return 'Explorer at ' + state.walk + ' across, ' + state.walk * q.answer + ' up';
  if (q.trail) return (q.kind === 'parity' ? 'Pair stone ' : 'Unit block ') + (id + 1) + (state.marked.includes(id) ? ', counted' : '');
  if (q.kind === 'ten') return id < q.a ? 'Flower ' + (id + 1) + ', already growing' : (state.filled.includes(id) ? 'Remove your flower from' : 'Plant a flower in') + ' space ' + (id + 1);
  if (q.kind === 'tens') return (id < q.a ? 'Tower ' + (id + 1) + ', ten blocks' : 'One block ' + (id - q.a + 1)) + (state.marked.includes(id) ? ', counted' : '');
  return (q.kind === 'count' ? 'Apple ' : 'Frog ') + (id + 1) + (q.kind === 'take' && state.moved.includes(id) ? ', hopped away' : state.marked.includes(id) ? ', counted' : q.kind === 'join' && id >= q.a && !state.moved.includes(id) ? ', waiting to hop in' : '');
}
function equation(q, solved) {
  if (!q) return '';
  const answer = solved ? q.answer : '?';
  if (q.kind === 'parity') return solved ? (q.answer ? 'Odd' : 'Even') : 'Pairs or a leftover?';
  if (q.kind === 'primes') return solved ? q.choiceLabels[q.answer] : 'Try making rectangles';
  if (q.kind === 'powers') return q.a + ['⁰', '¹', '²', '³', '⁴', '⁵'][q.b] + ' = ' + answer;
  if (q.kind === 'coordinates') return '(' + answer + ', ' + q.b + ')';
  if (q.kind === 'angles') return answer + '°';
  if (q.kind === 'area') return q.a + ' × ' + q.b + ' = ' + answer;
  if (q.kind === 'slope') return q.b + ' ÷ ' + q.a + ' = ' + answer;
  if (q.kind === 'count') return answer + ' apples';
  if (q.kind === 'ten') return q.a + ' + ' + answer + ' = 10';
  return (q.kind === 'tens' ? q.a * 10 : q.a) + (q.kind === 'take' ? ' − ' : ' + ') + q.b + ' = ' + answer;
}
// Logical positions keep every object, its accessible button and its badge aligned.
// The 3D camera uses one world unit per logical pixel; no projection guessing.
function layout(q, state, id, width, height) {
  const grid = (index, count, columns, x, y, w, h) => {
    const cols = Math.min(columns, Math.max(1, count)), rows = Math.ceil(Math.max(1, count) / columns);
    const gap = Math.min(w / cols, h / rows, 112);
    return { x: x + (index % columns - (cols - 1) / 2) * gap, y: y + (Math.floor(index / columns) - (rows - 1) / 2) * gap, size: Math.min(88, gap * 0.79), tower: false };
  };
  if (q.kind === 'coordinates' || q.kind === 'slope') {
    const plane = graph(q, width, height);
    const x = q.kind === 'coordinates' ? state.pointX : state.walk, y = q.kind === 'coordinates' ? state.pointY : state.walk * q.answer;
    return { x: plane.left + x * plane.unit, y: plane.bottom - y * plane.unit, size: 30, tower: false };
  }
  if (q.kind === 'parity') {
    const pairs = Math.ceil(q.a / 2), cols = Math.min(5, pairs), rows = Math.ceil(pairs / cols), gap = Math.min((width - 36) / cols, (height - 45) / rows, 145);
    return { x: width / 2 + (Math.floor(id / 2) % cols - (cols - 1) / 2) * gap + (id % 2 ? 1 : -1) * gap * 0.21, y: height / 2 + (Math.floor(id / 2 / cols) - (rows - 1) / 2) * gap, size: Math.min(55, gap * 0.36), tower: false };
  }
  if (q.kind === 'primes' || q.kind === 'area') {
    const rows = q.kind === 'area' ? q.b : state.rows, cols = q.kind === 'area' ? q.a : Math.ceil(q.a / rows);
    const gap = Math.min((width - 70) / cols, (height - 60) / rows, 65);
    // Column-major prime arrays distribute across the requested rows exactly.
    const x = q.kind === 'primes' ? Math.floor(id / rows) : id % cols, y = q.kind === 'primes' ? id % rows : Math.floor(id / cols);
    return { x: width / 2 + (x - (cols - 1) / 2) * gap, y: height / 2 + (y - (rows - 1) / 2) * gap, size: gap * 0.83, tower: false };
  }
  if (q.kind === 'powers') return grid(id, q.answer, q.answer <= 16 ? 4 : 8, width / 2, height / 2, width - 36, height - 50);
  if (q.kind === 'tens') {
    if (id < q.a) {
      const cols = Math.min(5, q.a), rows = Math.ceil(q.a / cols), gap = Math.min(width * 0.57 / cols, 94);
      const size = Math.min(65, gap * 0.8, (height - 45) / rows / 2.85);
      return { x: width * 0.32 + (id % cols - (cols - 1) / 2) * gap, y: height / 2 + (Math.floor(id / cols) - (rows - 1) / 2) * (height - 40) / rows, size, tower: true };
    }
    return grid(id - q.a, q.b, 3, width * 0.81, height / 2, width * 0.31, height - 50);
  }
  if (q.kind === 'join' && state.moved.length < q.b) {
    if (id < q.a || state.moved.includes(id)) return grid(id < q.a ? id : q.a + state.moved.indexOf(id), q.a + state.moved.length, 4, width * 0.27, height / 2, width * 0.46, height - 50);
    const waiting = [];
    for (let n = q.a; n < q.a + q.b; n++) if (!state.moved.includes(n)) waiting.push(n);
    return grid(waiting.indexOf(id), waiting.length, 4, width * 0.77, height / 2, width * 0.40, height - 50);
  }
  return grid(id, tokenCount(q), 5, width / 2, height / 2, width - 36, height - 45);
}
function parts(kind, gold, tower) {
  const result = [];
  const piece = (color, x, y, z, sx, sy, sz, box, rotation) => result.push({ color, x, y, z, sx, sy, sz, box: box || false, rotation: rotation || 0 });
  if (kind === 'count') {
    piece('#d95145', -12, 0, 0, 0.57, 0.67, 0.64);
    piece('#ec6650', 12, 0, 0, 0.57, 0.67, 0.64);
    piece('#75442b', 0, 39, 0, 0.075, 0.26, 0.07, true, -10);
    piece('#71a758', 17, 45, 0, 0.37, 0.13, 0.11, false, 25);
    piece('#ffc5a1', -19, 15, 27, 0.10, 0.19, 0.045, false, -25);
  } else if (kind === 'join' || kind === 'take') {
    const color = gold ? '#e9b94d' : '#5faa8b';
    piece('#739d68', 0, -32, -15, 1.12, 0.15, 0.65);
    piece(color, 0, -3, 0, 0.77, 0.60, 0.59);
    piece('#f8e8b4', 0, -11, 25, 0.46, 0.34, 0.15);
    for (const side of [-1, 1]) {
      piece(color, side * 23, 23, 3, 0.35, 0.38, 0.36);
      piece('#fff8de', side * 23, 25, 19, 0.21, 0.23, 0.12);
      piece('#233f36', side * 23, 24, 25, 0.095, 0.14, 0.06);
      piece(color, side * 35, -28, 10, 0.35, 0.17, 0.24);
      piece('#ea9873', side * 30, 3, 26, 0.12, 0.07, 0.035);
    }
    piece('#475348', 0, 1, 30, 0.15, 0.035, 0.03);
  } else if (kind === 'ten') {
    piece('#6d9654', 0, -16, -4, 0.065, 0.56, 0.06, true);
    piece('#83b467', 17, -22, 0, 0.36, 0.14, 0.08, false, 25);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      piece(gold ? '#f3c56a' : '#d7bee5', Math.sin(angle) * 23, 13 + Math.cos(angle) * 23, 7, 0.33, 0.34, 0.16);
    }
    piece('#cb893d', 0, 13, 17, 0.25, 0.25, 0.12);
  } else {
    for (let b = 0; b < (tower ? 10 : 1); b++) piece(tower ? (b % 2 ? '#8cb7ca' : '#71a0b8') : '#efbd63', 0, tower ? b * 24 - 108 : 0, 0, 0.55, tower ? 0.22 : 0.55, 0.48, true);
    if (kind !== 'tens') result.forEach(p => { p.color = gold ? '#eab859' : '#7ca9a1'; if (kind === 'parity' || kind === 'coordinates' || kind === 'slope') p.box = false; });
  }
  return result;
}
function graph(q, width, height) {
  const maxY = q.kind === 'slope' ? q.b + 1 : 5, maxX = q.kind === 'slope' ? q.a + 1 : 5;
  const unit = Math.min((width - 90) / maxX, (height - 65) / maxY);
  return { left: (width - maxX * unit) / 2, bottom: (height + maxY * unit) / 2 - 10, unit, maxX, maxY };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { activities, clampLevel, makeLesson, begin, help, submit, next, loadProgress, record, blankPicture, tokenCount, tokenVisible, activate, adjust, pictureComplete, step, counted, caption, actionLabel, tokenLabel, equation, layout, parts, graph, isPrime };
