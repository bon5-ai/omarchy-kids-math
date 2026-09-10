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
| Youngest children faced text and symbols first | The Math Garden (ages 5–8) opens as a bundled local web page with four picture activities: counting apples one by one, joining and removing frogs, filling a ten-frame, and building tens and ones. Each object is a touchable button whose state is the mathematical model; the animated three.js picture is decorative to assistive technology and falls back to plain HTML counters without WebGL. "Show me" acts out a solution step by step; "Listen" uses a local voice when one exists; wrong answers open help rather than a lockout. Five discoveries make a visit, then the page suggests stopping. |

The implementation keeps the shell integration and schema 1 result fields, adds
no runtime packages or network access, and normalizes older learner records when
new fields are needed. Local UI practice starts fresh question streams; supplied
seeds remain repeatable given the same practice history.

The garden is a deliberate trade-off. A browser page gives young children a
large, animated, touch-friendly canvas that Quickshell overlays do not offer
today, at the cost of leaving the shell overlay and keeping garden observations
in browser storage rather than `kids-math.json`. Those observations are shown
to adults as practice notes, never as mastery, and never enter tutor skill
checks. The bundle is built from source with esbuild and committed, so
installation remains a plain `git clone` with no package manager.

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
2. **Spoken instructions and localization.** The garden's "Listen" depends on
   whatever local English voice the browser exposes, and the shell overlay has no
   narration at all. Five-year-olds may still need adult help reading text.
   Narration needs an intentional offline voice strategy and testing on the actual
   shell installation. Accessible button labels alone do not establish complete
   screen-reader support.
3. **Broader mathematical coverage.** This remains an arithmetic and number-sense
   app, not a complete ages 5–12 curriculum. Geometry, measurement, time, money,
   decimals, data, richer word problems, and more fraction representations remain
   useful future domains.
4. **Visible household profiles and adult review.** Learner IDs already isolate
   saved data through the tutor contract, but the standalone home screen still
   uses the default learner. A family-facing profile picker and concise adult
   progress view would make shared-device use clearer.
5. **Live shell validation.** Qt smoke tests use stand-ins for Omarchy services.
   Validate theme contrast, Wayland keyboard focus, file creation and reload, and
   scaling in a real Quattro session before publishing. For the garden, confirm
   that `Qt.openUrlExternally` reaches the default browser on the target
   install, that the browser allows `file://` local storage, and how the
   overlay-to-browser handoff feels to a child.
6. **One place for progress.** Garden observations stay in the browser; shell
   practice and tutor results stay in `kids-math.json`. A single adult view, or a
   shell-hosted garden once the shell can render it, would remove that split.

The immediate success criterion is a child saying “I found another way” and being
able to show it. Longer sessions or compulsive return visits would not establish
that the product is doing its educational job.
