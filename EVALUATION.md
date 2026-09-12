# Repository evaluation

The original repository has useful foundations: a small offline plugin, six
flexible learning bands, reproducible question generation, a testable JavaScript
engine, and a simple tutor contract. Its largest product gap was that nearly all
interaction was answering a worksheet. Accuracy stars supplied little reason to
explore, make something, or explain an idea.

The strongest direction is **math as an invention tool**. A child should be able
to change something, see a mathematical consequence, discover another solution,
and keep a creation that means something to them. This is a distinctive direction
for this plugin, not a claim that number machines or manipulatives are new ideas.

## Implemented

| Gap | Change and purpose |
| --- | --- |
| One answer, little agency | Number Lab build puzzles accept multiple solutions. Two dials make equivalence, grouping, and compensation visible through experimentation. |
| Limited reasoning | Mystery machines present three examples, ask for a prediction, and encourage checking a rule against every clue. Rules become more complex across levels. |
| No meaningful artifact | A local invention book preserves actual equations and discovered rules. Saved inventions reopen with their original parameters; versioned offline codes let another person try the same puzzle. |
| Feedback gave little teaching | Every arithmetic skill now has a strategy and explanation. Counting lights can be marked one at a time. Arrays, crossed-out counters, and quarter bars connect quantities to symbols in the lab. |
| Practice ignored learning history | Practice retains whole-level coverage and adds extra questions for skills with less independent success. Hints and retries do not count as independent mastery. |
| Pressure to continue | Practice waits for Next. Feedback acknowledges work and discovery; finding two solutions offers a stopping point. No daily streak obligation or timed reward loop was added. |
| Access depended on mouse and screen size | Buttons support Tab, Enter, Space, focus indicators, and accessible labels. Content scrolls with keyboard focus, and Close remains visible. |
| Incorrect comparisons and session accounting | Comparison prompts now show both numbers. Submission locks prevent duplicate grading; assessments give neutral feedback; empty checks do not write progress; practice preserves the last assessment; adaptive statistics follow each item's actual level. |
| Youngest children faced text and symbols first | The native Math Garden (ages 5–8) offers counting apples, joining and removing frogs, filling a ten-frame, and building tens and ones. Qt Quick 3D objects share their state and positions with accessible QML buttons and a native 2D fallback. "Show me" acts out a solution step by step; "Listen" uses Qt's local voice support when available. Five discoveries make a visit. |
| The browser handoff broke the shell experience | The garden now stays in the same overlay with theme-aware controls, consistent Back/Escape navigation, per-learner file persistence, and renderer/timer cleanup on close. There is no browser launch or bundled web app. |
| Arithmetic lacked connections to later concepts | A seven-level Discovery Trail introduces odd/even pairing, prime factor rectangles, powers and exponential growth, coordinate paths, angle measurement, unit-square area, and slope as rise/run. Each topic provides a visual experiment, teaching support, and a connection to later mathematical ideas. |

The implementation keeps the shell integration and schema 1 result fields, adds
no network access, and normalizes older learner records when
new fields are needed. Local UI practice starts fresh question streams; supplied
seeds remain repeatable given the same practice history.

The native garden requires `qt6-quick3d` for 3D rendering and optionally
`qt6-speech` plus a local English voice for narration. Missing 3D imports and
the Qt software scene graph use QML picture counters. Garden observations now
live under each learner's `garden` record in `kids-math/progress.json`; they are practice
notes, never mastery claims, and never enter tutor skill checks. Old browser
observations are retained in browser storage but are not automatically imported.
No JavaScript bundling or package installation hook runs during plugin install.

The native test harness exercises Mesa OpenGL, the software scene graph, and
a missing QtQuick3D module. It checks input against rendered objects, all seven
trail levels, duplicate submissions, settings, per-learner persistence, speech
component integration with a mock local voice, and cancellation on navigation.
These checks use mocked Quickshell services, not a live Omarchy session.

## Why this approach

The EEF recommends connecting manipulatives and visual representations explicitly
to mathematical ideas, including opportunities for children to invent their own
representations and discuss different approaches. That supports the choice to
make the counters, arrays, and fractions part of the puzzle itself.
[EEF guidance](https://educationendowmentfoundation.org.uk/early-years/maths/use-manipulatives-and-representations-to-develop-understanding).

Self-determination theory identifies autonomy, competence, and relatedness as
conditions supporting motivation. Choice of activity, useful feedback, personal
inventions, and puzzles to try together are design responses to those principles.
They are hypotheses for this app, not evidence that this implementation improves
learning or retention.
[Self-determination theory](https://selfdeterminationtheory.org/the-theory/).

## Still missing, in priority order

1. **Observation with children.** Try short sessions with beginning readers,
   middle-primary children, and confident older learners. Observe whether they
   understand the dials, explain a second solution, use hints, and return
   voluntarily. Code tests cannot establish enjoyment or learning gains.
2. **Spoken instructions and localization.** The garden's "Listen" now uses a
   local Qt speech engine; actual voice quality, engine setup and audio output
   still need testing on the shell installation. Practice and Number Lab do not
   have narration. Five-year-olds may still need adult help reading text.
   Accessible button labels alone do not establish complete screen-reader support.
3. **Broader mathematical coverage.** This remains an arithmetic and number-sense
   app, not a complete ages 5–12 curriculum. The Discovery Trail introduces
   geometry and precalculus foundations; it does not teach a full trigonometry or
   calculus course. Curves, varying rates, triangle ratios, measurement, time,
   money, decimals, data and richer word problems remain useful future domains.
4. **Visible household profiles and adult review.** Learner IDs already isolate
   saved data through the tutor contract, but the standalone home screen still
   uses the default learner. A family-facing profile picker and concise adult
   progress view would make shared-device use clearer.
5. **Live shell validation.** Qt smoke tests use stand-ins for Omarchy services.
   Validate theme contrast, Wayland keyboard focus, file creation and reload, and
   scaling in a real Quattro session before publishing. Verify the target GPU's
   Qt Quick 3D rendering and the optional local speech engine. The development
   environment has Qt and Mesa but is not an Omarchy desktop.
6. **Historical garden observations.** Native progress is unified with shell
   storage, but older browser observations need an explicit import workflow if
   families want those historical practice notes in the native grown-up view.

The immediate success criterion is a child saying “I found another way” and being
able to show it. Longer sessions or compulsive return visits would not establish
that the product is doing its educational job.
