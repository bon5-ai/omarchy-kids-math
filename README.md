# Kids Math

A fullscreen [Omarchy](https://omarchy.org) overlay for Omarchy Kids: short,
leveled math practice for ages 5–12, plus a JSON assessment contract the
Kids AI Tutor can use for an initial aptitude check.

This is a standalone shell plugin (`omarchykids.math`). It is **not** the
AI Tutor. Development also lives under `plugins/math` in
[omarchy-kids-ai-tutor](https://github.com/mikeg0/omarchy-kids-ai-tutor).

It follows the Quattro plugin contract (`overlay` + `bar-widget`), uses the
active theme tokens, and does not start a second Quickshell process.

**Dependencies:** Omarchy Quattro (`omarchy-shell` / Quickshell). No extra
packages, network calls, or install hooks. Progress is stored in
`~/.local/state/omarchy/kids-math.json` and is not written unless the child
plays. License: MIT.

## Install

```sh
omarchy plugin add https://github.com/mikeg0/omarchy-kids-math.git --enable
```

That clones the plugin into `~/.config/omarchy/plugins/omarchykids.math/`,
enables it, and places a `1+1` launcher on the left of the bar. Plugins run
unsandboxed inside `omarchy-shell`; read the QML before enabling if you omit
`--enable`.

Confirm:

```sh
omarchy plugin list | grep omarchykids.math
```

## Use

- Click `1+1` on the bar, or
- Summon it:

```sh
omarchy-shell shell toggle omarchykids.math
```

**Practice** runs 10 questions at the current level. Younger levels use large
multiple-choice buttons; older levels use a number pad. A first miss can be
retried; a second miss shows the answer.

**Check my skills** runs a 12-question adaptive mix. It does not reveal
answers. The child sees encouragement; scores are written for parents and the
tutor, not as a report-card overlay.

Escape goes back a screen. During a skill check, Escape saves a partial result
so a waiting tutor is not left hanging.

### Menu

Add a row in `~/.config/omarchy/extensions/omarchy-menu.jsonc`:

```jsonc
"kids": { "icon": "󰀑", "label": "Kids" },
"kids.math": {
  "icon": "󰿈",
  "label": "Math",
  "action": "omarchy-shell shell toggle omarchykids.math"
}
```

### Keybind

In `~/.config/hypr/bindings.lua`:

```lua
o.bind("SUPER + SHIFT + M", "Kids math", "omarchy-shell shell toggle omarchykids.math")
```

## Levels

Mapped to typical US grade bands, not as a hard age gate. A 7-year-old who is
ready can sit in Tens; a 10-year-old who needs fluency can sit in Add & take
away.

| Level | Name | Ages | Focus |
| --- | --- | --- | --- |
| 1 | Count | 5–6 | Count to 10, compare, add within 5 |
| 2 | Add & take away | 6–7 | Add/subtract within 20, missing addend |
| 3 | Tens | 7–8 | Two-digit add/subtract, skip count |
| 4 | Times | 8–9 | Facts to 10×10, exact division, add to 1000 |
| 5 | Bigger numbers | 9–10 | 2-digit × 1-digit, exact division, mixed +/− |
| 6 | Parts & percents | 10–12 | Fraction of a whole, percent of, order of ops, negatives |

Progress lives in `~/.local/state/omarchy/kids-math.json` (preferred level,
round counts). Removing the plugin does not delete that file.

## AI Tutor contract

Keep the overlay loaded (`keepLoaded` is set) so the tutor can summon it with
a payload and later `call` for the same session’s JSON. The file round-trip
matches Omarchy’s image-picker pattern: the tutor creates temp files, the
plugin writes the result, then touches `doneFile`.

Summon an assessment:

```sh
RESULT="$(mktemp)"
DONE="$(mktemp)"
omarchy-shell shell summon omarchykids.math "$(cat <<EOF
{
  "mode": "assessment",
  "learnerId": "sam",
  "level": 3,
  "count": 12,
  "seed": 42,
  "adaptive": true,
  "resultFile": "$RESULT",
  "doneFile": "$DONE"
}
EOF
)"
```

Wait until `"$DONE"` exists, then read `"$RESULT"`.

| Payload field | Meaning |
| --- | --- |
| `mode` | `practice` or `assessment` (assessment starts immediately) |
| `learnerId` | Child key used in the progress file |
| `level` | 1–6 starting band; omitted assessment starts at 3 |
| `count` | Question cap (default 10 practice / 12 assessment, max 40) |
| `seed` | Repeatable item stream |
| `adaptive` | Assessment default `true`; every 3 items may move a level |
| `input` | Force `choices` or `keypad` |
| `resultFile` | Path to write the result JSON |
| `doneFile` | Touched when the write is finished (including abandon) |

Result shape:

```json
{
  "pluginId": "omarchykids.math",
  "schemaVersion": 1,
  "mode": "assessment",
  "status": "complete",
  "learnerId": "sam",
  "level": 3,
  "levelName": "Tens",
  "ageBand": "7–8",
  "total": 12,
  "correct": 9,
  "accuracy": 0.75,
  "avgMs": 4200,
  "recommendedLevel": 3,
  "skillScores": { "add-within-100": { "correct": 3, "total": 4 } },
  "items": []
}
```

`status` is `complete` or `abandoned`. `recommendedLevel` is the highest band
with at least three items at ≥ 70% correct. Sister plugins can emit the same
`schemaVersion` / `skillScores` / `recommendedLevel` shape so the tutor can
stitch one aptitude snapshot.

While the overlay is loaded:

```sh
omarchy-shell shell call omarchykids.math catalog '{}'
omarchy-shell shell call omarchykids.math lastResult '{}'
omarchy-shell shell call omarchykids.math learnerProgress '{}'
```

## Develop

```sh
omarchy plugin validate .
node tests/math-engine-test.js
```

If Omarchy is installed, also:

```sh
qmllint -I "$OMARCHY_PATH/shell" Overlay.qml BarWidget.qml
omarchy-shell shell rescanPlugins
```

Question generation is in `MathEngine.js` so Node can test it without QML.

## Remove

```sh
omarchy plugin remove omarchykids.math
```
