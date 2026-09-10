import { activities, clampLevel, begin, help, submit, next, loadProgress, record } from './lessons.js';
import { NumberScene } from './scene.js';

const main = document.querySelector('main');
const parameters = new URLSearchParams(location.hash.slice(1));
const learner = (parameters.get('learner') || 'default').slice(0, 80);
const progressKey = `kids-math-garden:v1:${encodeURIComponent(learner)}`;
let level = clampLevel(parameters.get('level'));
let session, scene, model, demoTimer, demoRunning = false, progress;
let storageAvailable = true;
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let motionOverride = null;
try {
  progress = loadProgress(localStorage.getItem(progressKey));
  const savedMotion = localStorage.getItem('kids-math-garden:motion');
  if (savedMotion !== null) motionOverride = savedMotion === 'reduced';
} catch { progress = loadProgress(null); storageAvailable = false; }
let reduced = motionOverride ?? motionQuery.matches;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icons = {
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  sound: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  play: '<path d="m9 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 8M3 3v7h7"/>',
  leaf: '<path d="M5 20c0-9 5-12 14-16 2 12-3 16-10 13M5 20l9-10"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  hand: '<path d="M8 12V5a2 2 0 0 1 4 0v6-3a2 2 0 0 1 4 0v3a2 2 0 0 1 4 0v5c0 5-11 7-14 1l-3-5a2 2 0 0 1 3-2l2 2Z"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  flower: '<circle cx="12" cy="12" r="3"/><path d="M9 8C2 1 16-2 15 7c9-4 11 9 3 8 5 8-9 13-9 4-9 3-11-10-2-9Z"/>',
  blocks: '<path d="m3 7 6-3 6 3-6 3-6-3v8l6 3 6-3V7M9 10v8m6-7 6-3v9l-6 3-4-2"/>',
  apple: '<path d="M12 6c-4-5-11 0-9 7 2 9 7 7 9 6 2 1 7 3 9-6 2-7-5-12-9-7Zm0 0c0-3 2-5 5-5"/>',
  pond: '<path d="M3 17c3-3 6 3 9 0s6 3 9 0M3 21c3-3 6 3 9 0s6 3 9 0"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="7" r="3"/><path d="M5 9c-2 7 16 7 14 0"/>'
};
const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
function announce(text) { document.querySelector('#announcement').textContent = text; }
function focusTitle() { main.querySelector('h1')?.focus({ preventScroll: true }); window.scrollTo(0, 0); }
function stopDemo() {
  clearTimeout(demoTimer); demoRunning = false;
  const button = document.querySelector('[data-action="demo"]');
  if (button) { button.innerHTML = `${icon('play')} Show me`; button.setAttribute('aria-pressed', 'false'); }
}
function cleanup() {
  stopDemo();
  scene?.dispose(); scene = null;
  window.speechSynthesis?.cancel();
}
function activityFor(kind) { return activities.find(a => a.id === (kind === 'take' ? 'join' : kind)); }
function home({ focus = true } = {}) {
  cleanup(); session = null;
  main.className = 'home-view';
  main.innerHTML = `
    <section class="welcome" aria-labelledby="welcome-title">
      <img class="welcome-art" src="assets/welcome.jpg" alt="A friendly frog with a golden counting pebble in a sunny garden" fetchpriority="high">
      <div class="welcome-copy"><span class="eyebrow">A HAPPY PLACE TO FIGURE THINGS OUT</span>
        <h1 id="welcome-title" tabindex="-1">Small steps.<br><em>Big discoveries.</em></h1>
        <p>Touch, count, and play your way to<br class="desktop-break"> “I can do it!”</p>
        <button class="button primary" data-action="explore">Let’s explore ${icon('arrow')}</button>
        <span class="reassurance">${icon('leaf')} Your pace. Your way.</span>
      </div>
      <span class="welcome-note">A little help makes a big difference.</span>
    </section>
    <section class="activity-section" aria-labelledby="activities-title">
      <div class="section-heading"><div><span class="eyebrow">FOLLOW YOUR CURIOSITY</span><h2 id="activities-title" tabindex="-1">What shall we discover?</h2></div><span class="small-note">Pick a picture to begin ${icon('arrow')}</span></div>
      <div class="activity-grid">${activities.map((a, i) => `<button class="activity-card ${a.color}" data-activity="${a.id}">
        <div class="card-picture"><img src="assets/${a.image}" alt="" loading="eager"><span class="age-tag">${a.ages}</span></div>
        <div class="card-copy"><span class="activity-skill">${icon(a.icon)} ${a.skill}</span><h3>${a.title}</h3><p>${a.invitation}</p><span class="card-action">${a.action}<span>${icon('arrow')}</span></span></div>
      </button>`).join('')}</div>
    </section>
    <section class="learning-strip" aria-label="How we learn"><div class="strip-intro">Understanding grows<br><strong>one little step at a time.</strong></div><div>${icon('eye')}<span><strong>See it</strong><small>Pictures make it real.</small></span></div><div>${icon('hand')}<span><strong>Try it</strong><small>Little hands, busy minds.</small></span></div><div>${icon('leaf')}<span><strong>Make sense of it</strong><small>Discover the “why.”</small></span></div></section>`;
  if (focus) focusTitle();
}
function start(kind) {
  cleanup();
  session = begin(kind, level, Date.now());
  renderLesson();
}
function blankModel() { return { marked: [], moved: [], filled: [] }; }
function renderLesson() {
  cleanup();
  model = blankModel();
  const q = session.lesson, activity = activityFor(q.kind);
  main.className = `lesson-view ${activity.color}`;
  main.innerHTML = `
    <div class="lesson-navigation"><button class="text-button" data-action="home">${icon('back')} Back to the garden</button><span class="session-progress" aria-label="Activity ${session.index + 1} of ${session.total}">${Array.from({ length: session.total }, (_, i) => `<span class="progress-seed ${i < session.index ? 'done' : ''} ${i === session.index ? 'now' : ''}">${i < session.index ? icon('check') : i + 1}</span>`).join('')}</span><span class="small-note">No rush. Take your time.</span></div>
    <div class="lesson-heading"><div><span class="eyebrow">${activity.title} · ${activity.skill}</span><h1 tabindex="-1">${q.title}</h1></div><button class="button quiet listen-button" data-action="listen">${icon('sound')} Listen</button></div>
    ${['join', 'take'].includes(q.kind) ? `<div class="operation-switch" role="group" aria-label="Pond activity"><button data-activity="join" aria-pressed="${q.kind === 'join'}">+ Join together</button><button data-activity="take" aria-pressed="${q.kind === 'take'}">− Take away</button></div>` : ''}
    <div class="lesson-grid"><section class="workbench" aria-label="Picture and question">
      <div class="board-heading"><span>${icon(activity.icon)} ${q.kind === 'tens' ? 'BLUE TOWERS = TENS · GOLD CUBES = ONES' : q.kind === 'ten' ? 'TWO ROWS OF FIVE MAKE TEN' : 'A PICTURE YOU CAN PLAY WITH'}</span><button class="text-button" data-action="reset" aria-label="Reset the picture">${icon('reset')} Start over</button></div>
      <div class="scene-window" tabindex="0" aria-label="Math picture. Scroll sideways if needed."><div class="number-scene ${q.kind} ${q.kind === 'tens' && q.a > 3 ? 'many-towers' : ''}" id="number-scene"></div></div>
      <div class="model-caption" id="model-caption" aria-live="polite" aria-atomic="true"></div>
      <div class="manipulate-tools"><button class="button secondary" data-action="manipulate"></button><span class="touch-note">${icon('hand')} You can touch the picture, too.</span></div>
      <div class="equation" id="equation" aria-label="Number sentence"></div>
    </section>
    <aside class="guide" aria-label="Step by step help">
      <div class="guide-image"><img src="assets/${activity.image}" alt=""><span class="guide-sticker">Let’s figure it out.</span></div>
      <div class="guide-copy"><span class="eyebrow">LITTLE STEPS</span><ol class="guide-steps">${q.steps.map((step, i) => `<li data-step="${i}" class="${i === 0 ? 'active' : ''}"><span>${i + 1}</span><p>${step}</p></li>`).join('')}</ol>
        <button class="button guide-demo" data-action="demo" aria-pressed="false">${icon('play')} Show me</button>
        <p class="guide-hint" id="guide-hint">It’s okay to need a little help.</p>
      </div>
    </aside></div>
    <section class="answer-area" aria-labelledby="question"><div class="answer-prompt"><span class="eyebrow">WHAT DO YOU THINK?</span><h2 id="question">${q.question}</h2></div><div class="answer-choices" role="group" aria-label="Choose an answer">${q.choices.map(value => `<button class="answer-button" data-answer="${value}" aria-label="Answer ${value}">${value}</button>`).join('')}</div></section>
    <div class="feedback-area" id="feedback-area" aria-live="polite" aria-atomic="true"><div id="feedback-copy">${icon('leaf')} You can use the picture for as long as you like.</div><button class="button primary" data-action="next" hidden>Another little discovery ${icon('arrow')}</button></div>`;
  scene = new NumberScene(document.querySelector('#number-scene'), { reduced, activate: touchToken, changed: announce });
  scene.show(q); updatePicture(true);
  focusTitle();
}
function updatePicture(instant = false) {
  if (!scene || !session) return;
  scene.update(model, instant);
  const q = session.lesson;
  let caption, action, finished = false;
  if (q.kind === 'count') {
    caption = model.marked.length ? `${model.marked.length} ${model.marked.length === 1 ? 'apple' : 'apples'} counted. ${model.marked.length === q.a ? 'The last number tells how many!' : 'Find another apple.'}` : 'Touch an apple. Say “one.” Keep going!';
    action = 'Count the next apple'; finished = model.marked.length === q.a;
  } else if (q.kind === 'join') {
    caption = `${q.a} here + ${model.moved.length} joined · ${q.b - model.moved.length} still waiting`;
    action = model.moved.length === q.b ? 'Count the next frog' : 'Hop one friend in';
    finished = model.moved.length === q.b && model.marked.length === q.answer;
  } else if (q.kind === 'take') {
    caption = `${model.moved.length} hopped away · ${q.a - model.moved.length} ${q.a - model.moved.length === 1 ? 'frog stays' : 'frogs stay'} in the pond`;
    action = model.moved.length === q.b ? 'Count a frog that stayed' : 'Hop one frog away';
    finished = model.moved.length === q.b && model.marked.length === q.answer;
  } else if (q.kind === 'ten') {
    caption = `${q.a} growing + ${model.filled.length} planted · ${q.b - model.filled.length} empty ${q.b - model.filled.length === 1 ? 'space' : 'spaces'}`;
    action = 'Plant one more flower'; finished = model.filled.length === q.b;
  } else {
    const total = model.marked.reduce((sum, i) => sum + (i < q.a ? 10 : 1), 0);
    caption = model.marked.length ? `${total} blocks counted. ${model.marked.length === q.a + q.b ? 'Tens and ones work together!' : 'Count another tower or loose block.'}` : 'Each tower has 10 blocks. Each loose block is 1.';
    action = 'Count the next group'; finished = model.marked.length === q.a + q.b;
  }
  document.querySelector('#model-caption').textContent = caption;
  const actionButton = document.querySelector('[data-action="manipulate"]');
  actionButton.innerHTML = `${icon(finished ? 'check' : 'hand')} ${finished ? 'Picture complete' : action}`;
  actionButton.disabled = finished || demoRunning;
  const step = session.solved ? 2 : model.marked.length || model.moved.length || model.filled.length ? 1 : 0;
  document.querySelectorAll('[data-step]').forEach((el, i) => el.classList.toggle('active', i === step));
  const missing = `<span class="number missing">${session.solved ? q.answer : '?'}</span>`;
  const num = (n, extra = '') => `<span class="number ${extra}">${n}</span>`;
  document.querySelector('#equation').innerHTML = q.kind === 'count' ? `${missing}<span class="equation-word">apples altogether</span>` : q.kind === 'ten' ? `${num(q.a)}<span>+</span>${missing}<span>=</span>${num(10)}` : q.kind === 'tens' ? `${num(q.a * 10, 'blue-number')}<span>+</span>${num(q.b, 'gold-number')}<span>=</span>${missing}` : `${num(q.a)}<span>${q.kind === 'take' ? '−' : '+'}</span>${num(q.b, 'gold-number')}<span>=</span>${missing}`;
  if (session.solved) document.querySelector('#equation').classList.add('solved');
}
function mark(id) { if (!model.marked.includes(id)) model.marked.push(id); }
function touchToken(id) {
  if (!session || demoRunning) return;
  const q = session.lesson;
  if (q.kind === 'ten') {
    if (id < q.a) { announce('This flower is already growing. Plant in an empty space.'); return; }
    model.filled = model.filled.includes(id) ? model.filled.filter(n => n !== id) : [...model.filled, id];
  } else if (q.kind === 'take') {
    if (model.moved.includes(id)) { announce('That frog has hopped away. Count the frogs that stay.'); return; }
    if (model.moved.length < q.b) model.moved.push(id);
    else mark(id);
  } else if (q.kind === 'join' && id >= q.a && !model.moved.includes(id)) {
    model.moved.push(id);
    model.marked = [];
  } else if (q.kind === 'join' && model.moved.length < q.b) {
    announce('Touch a golden frog to bring a friend into the pond.'); return;
  } else mark(id);
  updatePicture();
}
function performOne() {
  const q = session.lesson;
  const find = (n, occupied, start = 0) => Array.from({ length: n }, (_, i) => i + start).find(i => !occupied.includes(i));
  if (q.kind === 'ten') {
    const id = find(q.b, model.filled, q.a); if (id !== undefined) model.filled.push(id);
  } else if (q.kind === 'join' && model.moved.length < q.b) {
    model.moved.push(find(q.b, model.moved, q.a)); model.marked = [];
  } else if (q.kind === 'take' && model.moved.length < q.b) {
    model.moved.push(Array.from({ length: q.a }, (_, i) => q.a - 1 - i).find(i => !model.moved.includes(i)));
  } else {
    const n = q.kind === 'join' || q.kind === 'tens' ? q.a + q.b : q.a;
    const id = find(n, [...model.marked, ...model.moved.filter(() => q.kind === 'take')]);
    if (id !== undefined) mark(id);
  }
}
function pictureComplete() {
  const q = session.lesson;
  if (q.kind === 'ten') return model.filled.length === q.b;
  if (q.kind === 'join') return model.moved.length === q.b && model.marked.length === q.answer;
  if (q.kind === 'take') return model.moved.length === q.b && model.marked.length === q.answer;
  return model.marked.length === (q.kind === 'tens' ? q.a + q.b : q.a);
}
function demonstrate() {
  if (demoRunning) { stopDemo(); updatePicture(true); return; }
  session = help(session); model = blankModel();
  document.querySelector('#guide-hint').textContent = session.lesson.hint;
  if (reduced) {
    while (!pictureComplete()) performOne();
    updatePicture(true);
    document.querySelector('#guide-hint').textContent = session.lesson.explanation;
    return;
  }
  demoRunning = true;
  const button = document.querySelector('[data-action="demo"]');
  button.innerHTML = `${icon('pause')} Pause`; button.setAttribute('aria-pressed', 'true');
  updatePicture(true);
  const step = () => {
    if (!session || !demoRunning) return;
    performOne(); updatePicture();
    if (pictureComplete()) {
      stopDemo(); updatePicture();
      document.querySelector('#guide-hint').textContent = session.lesson.explanation;
    } else demoTimer = setTimeout(step, 850);
  };
  demoTimer = setTimeout(step, 500);
}
function choose(value) {
  if (!session || session.solved) return;
  stopDemo();
  const old = session;
  session = submit(session, value);
  if (session === old) return;
  const feedback = document.querySelector('#feedback-copy');
  if (session.solved) {
    while (!pictureComplete()) performOne();
    progress = record(progress, session.answers.at(-1));
    try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch { storageAvailable = false; }
    feedback.innerHTML = `${icon('leaf')}<span><strong>You worked it out!</strong> ${session.lesson.explanation}</span>`;
    document.querySelector('#feedback-area').classList.add('success');
    document.querySelectorAll('[data-answer]').forEach(button => { button.disabled = true; button.classList.toggle('correct', Number(button.dataset.answer) === value); });
    const nextButton = document.querySelector('[data-action="next"]');
    nextButton.hidden = false;
    nextButton.innerHTML = `${session.index === session.total - 1 ? 'Finish for now' : 'Another little discovery'} ${icon('arrow')}`;
    nextButton.focus({ preventScroll: true });
  } else {
    feedback.innerHTML = `${icon('hand')}<span><strong>Let’s look together.</strong> ${session.lesson.hint}</span>`;
    document.querySelector('#guide-hint').textContent = session.attempts >= 2 ? session.lesson.explanation : session.lesson.hint;
    // A mistake opens help; it never locks the child out or races ahead.
    document.querySelector(`[data-answer="${value}"]`)?.classList.add('tried');
  }
  updatePicture();
}
function complete() {
  const activity = activityFor(session.kind);
  cleanup();
  main.className = 'complete-view';
  main.innerHTML = `<section class="completion-card"><img src="assets/${activity.image}" alt="${activity.title}"><div><span class="eyebrow">LOOK WHAT YOU DISCOVERED</span><h1 tabindex="-1">A little more<br>“I can do it!”</h1><p>You explored ${activity.skill.toLowerCase()} with pictures and a little thinking.</p><div class="completion-seeds" aria-label="Five discoveries">${Array.from({ length: 5 }, () => icon('flower')).join('')}</div><p>That’s a lovely place to stop.<br>The garden will be here another day.</p><button class="button primary" data-action="home">Back to the garden ${icon('arrow')}</button><button class="text-button" data-activity="${session.kind}">Try five more</button></div></section>`;
  focusTitle();
}
function setMotion(value) {
  reduced = value;
  document.documentElement.classList.toggle('reduced-motion', reduced);
  const button = document.querySelector('#motion-button');
  button.innerHTML = icon(reduced ? 'play' : 'pause');
  button.setAttribute('aria-pressed', String(reduced));
  button.setAttribute('aria-label', reduced ? 'Enable animation' : 'Reduce animation');
  button.title = reduced ? 'Animation reduced' : 'Reduce animation';
  if (demoRunning) stopDemo();
  scene?.setReduced(reduced);
  if (scene) updatePicture(true);
}
function grownups() {
  const dialog = document.querySelector('#grownups');
  const rows = ['count', 'join', 'take', 'ten', 'tens'].map(kind => {
    const data = progress.activities[kind];
    return `<tr><th scope="row">${kind === 'take' ? 'Taking away' : kind === 'join' ? 'Adding' : activityFor(kind).skill}</th><td>${data.solved}</td><td>${data.supported}</td></tr>`;
  }).join('');
  dialog.innerHTML = `<div class="dialog-heading"><span class="eyebrow">A LITTLE GUIDANCE</span><button class="icon-button" data-action="close-dialog" aria-label="Close grown-up information">${icon('close')}</button></div><h2 id="grownup-title">Make room for understanding.</h2><p>Try asking: “How did you know?” Let your child point, move things, and explain. Using a picture is part of learning.</p><label class="setting-label" for="number-range">A comfortable starting place</label><select id="number-range"><option value="1">Small steps · count to 5, sums to 5, tens to 39</option><option value="2">Growing confidence · count to 10, sums to 10, tens to 69</option><option value="3">A little stretch · count to 10, sums to 20, tens to 99</option></select><p class="small-note">Each visit starts with an easy example. Make-ten always uses ten spaces. Changing this setting starts the next activity at that range.</p><h3>What we’ve been exploring</h3><div class="table-scroll"><table><thead><tr><th>Activity</th><th>Solved</th><th>With a hint or retry</th></tr></thead><tbody>${rows}</tbody></table></div><p class="small-note">These are practice observations, not a mastery score. ${storageAvailable ? 'Saved in this browser for the current learner.' : 'Browser storage is unavailable; observations last for this visit only.'} Garden practice is separate from the shell’s tutor skill checks.</p><p class="small-note">Listen uses an English voice installed on this device, when available. No account, internet connection, or microphone is needed.</p><button class="button primary" data-action="close-dialog">Back to exploring ${icon('arrow')}</button>`;
  dialog.querySelector('select').value = String(level);
  dialog.querySelector('select').addEventListener('change', event => { level = clampLevel(event.target.value); });
  stopDemo(); if (scene) updatePicture(true);
  dialog.showModal();
}
function listen() {
  if (!session) return;
  const synth = window.speechSynthesis;
  const voices = synth?.getVoices().filter(v => v.localService && /^en(?:-|_)/i.test(v.lang));
  if (!voices?.length) {
    const text = 'An English voice is not installed in this browser. Read the little steps together.';
    document.querySelector('#guide-hint').textContent = text; announce(text); return;
  }
  synth.cancel();
  const speech = new SpeechSynthesisUtterance(`${session.lesson.question} ${session.lesson.steps.join(' ')}`);
  speech.voice = voices[0]; speech.lang = voices[0].lang; speech.rate = 0.82;
  synth.speak(speech);
}
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.activity) { start(button.dataset.activity); return; }
  if (button.hasAttribute('data-answer')) { choose(Number(button.dataset.answer)); return; }
  switch (button.dataset.action) {
    case 'home': home(); break;
    case 'explore': document.querySelector('#activities-title').focus(); document.querySelector('#activities-title').scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' }); break;
    case 'grownups': grownups(); break;
    case 'close-dialog': document.querySelector('#grownups').close(); break;
    case 'listen': listen(); break;
    case 'motion': motionOverride = !reduced; setMotion(motionOverride); try { localStorage.setItem('kids-math-garden:motion', reduced ? 'reduced' : 'full'); } catch {} announce(reduced ? 'Animation reduced.' : 'Animation enabled.'); break;
    case 'demo': demonstrate(); break;
    case 'manipulate': if (session && !demoRunning) { performOne(); updatePicture(); } break;
    case 'reset': stopDemo(); model = blankModel(); updatePicture(); break;
    case 'next': if (session?.solved) { session = next(session); session.complete ? complete() : renderLesson(); } break;
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.querySelector('#grownups').open && session) { home(); event.preventDefault(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopDemo(); window.speechSynthesis?.cancel(); }
  else if (scene) updatePicture(true);
});
motionQuery.addEventListener('change', () => { if (motionOverride === null) setMotion(motionQuery.matches); });
window.addEventListener('pagehide', cleanup);
// A browser may reuse the same local page when the shell opens another learner.
window.addEventListener('hashchange', () => location.reload());
setMotion(reduced);
home({ focus: false });
if (['count', 'join', 'take', 'ten', 'tens'].includes(parameters.get('activity'))) start(parameters.get('activity'));
