import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import qs.Ui
import "MathEngine.js" as MathEngine
import "LabEngine.js" as Lab
import "GardenEngine.js" as Garden

Item {
  id: root

  property string omarchyPath: Quickshell.env("OMARCHY_PATH")
  property string homePath: Quickshell.env("HOME")
  property var shell: null
  property var manifest: null

  property bool opened: false
  property string screen: "home"
  property string mode: "practice"
  property string learnerId: "default"
  property int levelId: 1
  property int roundSize: 10
  property bool adaptive: false
  property var payload: ({})
  property var progress: ({
      schemaVersion: 1,
      learners: {},
      lastAssessment: null
    })
  property var questions: []
  property int questionIndex: 0
  property var currentQuestion: null
  property var choiceValues: []
  property int choiceCursor: 0
  property string typed: ""
  property string feedback: ""
  property int attempts: 0
  property int streak: 0
  property int bestSessionStreak: 0
  property bool itemLocked: false
  property bool hintShown: false
  property bool hintUsed: false
  property var sessionItems: []
  property bool sessionOpen: false
  property string startedAt: ""
  property double questionStartedMs: 0
  property var lastResultObject: null
  property string lastResultJson: ""
  property real seed: 1
  property var rng: null
  property string overrideInput: ""
  property string gardenActivity: ""
  property var keypadLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "−", "0", "⌫"]

  property color background: Color.menu.background
  property color foreground: Color.menu.text
  property color border: Color.menu.border
  property var borderSpec: Border.surfaceSpec("menu", "border", border, Math.max(1, Style.space(2)))
  property color scrim: Color.menu.scrim
  property color selectedBackground: Color.menu.selectedBackground
  property color selectedText: Color.menu.selectedText
  property color accent: Color.accent
  readonly property int cornerRadius: Style.cornerRadius
  property string fontFamily: Style.font.menuFamily
  property int contentMargin: Style.spacing.panelPadding
  property int cardWidth: Math.min(Style.space(root.screen === "garden" ? 1240 : 1080), panel.width - Style.gapsOut * 2)
  property int cardHeight: Math.min(Style.space(820), panel.height - Style.gapsOut * 2)

  readonly property var currentLevel: MathEngine.levelById(root.levelId)
  readonly property bool usingChoices: {
    if (!root.currentQuestion)
      return true
    if (root.overrideInput)
      return root.overrideInput === "choices"
    return root.currentQuestion.input !== "keypad"
  }

  function pluginId() {
    return (root.manifest && root.manifest.id) || "omarchykids.math"
  }

  function open(payloadJson) {
    root.screen = "home"
    if (root.sessionOpen && root.mode === "assessment")
      root.finishSession("abandoned")
    advanceTimer.stop()
    root.progress = MathEngine.normalizeProgress(root.progress)
    root.payload = MathEngine.parsePayload(payloadJson || "{}")
    root.mode = root.payload.mode
    root.learnerId = root.payload.learnerId
    root.roundSize = root.payload.count
    root.adaptive = root.payload.adaptive === true
    root.seed = root.payload.seed
    root.overrideInput = root.payload.input
    root.feedback = ""
    root.typed = ""
    root.sessionOpen = false
    root.opened = true

    var learner = MathEngine.learnerRecord(root.progress, root.learnerId)
    var nextLevel = root.payload.level > 0 ? root.payload.level : MathEngine.clampLevelId(learner.preferredLevel || 1)
    root.levelId = nextLevel

    if (root.payload.start || root.mode === "assessment") {
      root.beginRound(nextLevel)
    } else {
      root.screen = "home"
    }

    Qt.callLater(function () {
      keyboardAnchor.forceActiveFocus()
    })
  }

  function close() {
    if (gardenLoader.item) gardenLoader.item.stop()
    if (root.sessionOpen && root.mode === "assessment")
      root.finishSession("abandoned")
    advanceTimer.stop()
    root.sessionOpen = false
    root.opened = false
  }

  function dismiss() {
    root.close()
    if (root.shell && typeof root.shell.hide === "function")
      root.shell.hide(root.pluginId())
  }

  function toggle() {
    if (root.opened)
      root.dismiss()
    else
      root.open("{}")
  }

  function lastResult() {
    return root.lastResultJson || "{}"
  }

  function catalog() {
    return MathEngine.catalogJson()
  }

  function launchGarden(activity) {
    root.gardenActivity = activity || ""
    root.screen = "garden"
  }

  function saveGarden(value) {
    var learner = MathEngine.learnerRecord(root.progress, root.learnerId)
    learner.garden = Garden.loadProgress(value)
    root.progress = MathEngine.normalizeProgress(JSON.stringify(root.progress))
    root.saveProgress()
  }

  function learnerProgress() {
    var learner = MathEngine.learnerRecord(root.progress, root.learnerId)
    return JSON.stringify(learner)
  }

  function loadProgress(raw) {
    root.progress = MathEngine.normalizeProgress(raw)
  }

  function saveProgress() {
    progressFile.setText(JSON.stringify(root.progress, null, 2) + "\n")
  }

  function beginRound(levelId) {
    advanceTimer.stop()
    root.lastResultObject = null
    root.lastResultJson = ""
    root.bestSessionStreak = 0
    root.levelId = MathEngine.clampLevelId(levelId)
    root.rng = MathEngine.createRng(root.seed)
    root.sessionItems = []
    root.questionIndex = 0
    root.streak = 0
    root.sessionOpen = true
    root.startedAt = new Date().toISOString()
    root.feedback = ""
    root.typed = ""
    if (root.adaptive) {
      root.questions = []
      root.pushAdaptiveQuestion()
    } else {
      root.questions = root.mode === "assessment" ? MathEngine.generateRound(root.levelId, root.roundSize, root.rng) : MathEngine.generatePracticeRound(root.levelId, root.roundSize, root.seed, MathEngine.learnerRecord(root.progress, root.learnerId))
    }
    root.showQuestionAt(0)
    root.screen = "play"
  }

  function pushAdaptiveQuestion() {
    var q = MathEngine.generateQuestion(root.levelId, root.rng)
    root.questions = root.questions.concat([q])
  }

  function showQuestionAt(index) {
    if (index < 0 || index >= root.questions.length)
      return
    root.questionIndex = index
    root.currentQuestion = root.questions[index]
    root.choiceValues = (root.currentQuestion && root.currentQuestion.choices) || []
    root.choiceCursor = 0
    root.typed = ""
    root.feedback = ""
    root.attempts = 0
    root.itemLocked = false
    root.hintShown = false
    root.hintUsed = false
    countingLights.reset()
    root.questionStartedMs = Date.now()
    Qt.callLater(function () {
      viewport.contentY = 0
      keyboardAnchor.forceActiveFocus()
    })
  }

  function currentInput() {
    if (root.usingChoices) {
      if (root.choiceCursor < 0 || root.choiceCursor >= root.choiceValues.length)
        return null
      return root.choiceValues[root.choiceCursor]
    }
    return root.typed
  }

  function submitCurrent() {
    if (!root.sessionOpen || !root.currentQuestion || root.itemLocked)
      return
    var response = root.currentInput()
    if (MathEngine.parseResponse(response) === null)
      return
    var graded = MathEngine.grade(root.currentQuestion, response)
    root.attempts++
    if (root.mode === "assessment") {
      root.itemLocked = true
      root.feedback = "recorded"
      root.recordItem(graded.correct, graded.response)
      advanceTimer.interval = 550
      advanceTimer.restart()
    } else if (graded.correct) {
      root.itemLocked = true
      root.feedback = "correct"
      root.streak = root.attempts === 1 && !root.hintUsed ? root.streak + 1 : 0
      root.bestSessionStreak = Math.max(root.bestSessionStreak, root.streak)
      root.recordItem(true, graded.response)
    } else if (root.attempts >= 2) {
      root.itemLocked = true
      root.feedback = "reveal"
      root.streak = 0
      root.recordItem(false, graded.response)
    } else {
      root.feedback = "wrong"
      root.hintShown = true
      root.hintUsed = true
      root.streak = 0
      if (!root.usingChoices)
        root.typed = ""
    }
  }

  function showHint() {
    if (root.mode === "assessment" || root.itemLocked)
      return
    root.hintUsed = true
    root.hintShown = !root.hintShown
  }

  function recordItem(correct, response) {
    var q = root.currentQuestion
    var item = {
      id: q.id,
      skill: q.skill,
      levelId: q.levelId,
      prompt: q.prompt,
      answer: q.answer,
      response: response,
      correct: correct === true,
      attempts: root.attempts,
      hintUsed: root.hintUsed,
      ms: Math.max(0, Date.now() - root.questionStartedMs)
    }
    root.sessionItems = root.sessionItems.concat([item])
  }

  function goNext() {
    advanceTimer.stop()
    if (!root.sessionOpen || !root.itemLocked)
      return
    if (root.adaptive && root.sessionItems.length < root.roundSize) {
      if (root.sessionItems.length >= 3 && (root.sessionItems.length % 3) === 0) {
        var window = root.sessionItems.slice(root.sessionItems.length - 3)
        root.levelId = MathEngine.nextAdaptiveLevel(root.levelId, window)
      }
      root.pushAdaptiveQuestion()
      root.showQuestionAt(root.questions.length - 1)
      return
    }

    var next = root.questionIndex + 1
    if (next < root.questions.length) {
      root.showQuestionAt(next)
      return
    }

    root.finishSession("complete")
  }

  function finishSession(status) {
    if (!root.sessionOpen)
      return
    root.sessionOpen = false
    advanceTimer.stop()
    var finishedAt = new Date().toISOString()
    var result = MathEngine.buildResult({
      mode: root.mode,
      status: status || "complete",
      learnerId: root.learnerId,
      startedAt: root.startedAt,
      finishedAt: finishedAt,
      levelId: root.levelId,
      seed: root.seed,
      items: root.sessionItems
    })
    root.lastResultObject = result
    root.lastResultJson = JSON.stringify(result, null, 2)
    if (result.total > 0) {
      root.progress = MathEngine.recordSession(root.progress, result, root.bestSessionStreak)
      root.saveProgress()
    }
    root.screen = "complete"
  }

  function appendDigit(digit) {
    if (root.usingChoices || root.itemLocked)
      return
    if (root.typed.length >= 8)
      return
    root.typed += digit
  }

  function backspace() {
    if (root.usingChoices || root.itemLocked)
      return
    root.typed = root.typed.slice(0, -1)
  }

  function toggleSign() {
    if (root.usingChoices || root.itemLocked)
      return
    if (root.typed.indexOf("-") === 0)
      root.typed = root.typed.slice(1)
    else
      root.typed = "-" + root.typed
  }

  function selectChoice(index) {
    if (!root.usingChoices || root.itemLocked)
      return
    if (index < 0 || index >= root.choiceValues.length)
      return
    root.choiceCursor = index
    root.submitCurrent()
  }

  function moveChoice(delta) {
    if (!root.usingChoices || root.itemLocked || root.choiceValues.length === 0)
      return
    var next = root.choiceCursor + delta
    if (next < 0)
      next = root.choiceValues.length - 1
    if (next >= root.choiceValues.length)
      next = 0
    root.choiceCursor = next
    var button = choiceButtons.itemAt(next)
    if (button)
      button.forceActiveFocus()
  }

  function handleKey(event) {
    if (event.isAutoRepeat) {
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_Escape) {
      if (root.screen === "garden" && gardenLoader.item) {
        gardenLoader.item.back()
      } else if (root.screen === "play" && root.mode === "assessment") {
        root.finishSession("abandoned")
      } else if (root.screen === "play") {
        advanceTimer.stop()
        root.sessionOpen = false
        root.screen = "home"
      } else if (root.screen === "levels" || root.screen === "complete" || root.screen === "lab") {
        root.screen = "home"
      } else {
        root.dismiss()
      }
      event.accepted = true
      return
    }

    if (root.screen !== "play")
      return
    if (root.itemLocked && root.mode !== "assessment" && (event.key === Qt.Key_Return || event.key === Qt.Key_Enter || event.key === Qt.Key_Space)) {
      root.goNext()
      event.accepted = true
      return
    }

    if (root.itemLocked) {
      event.accepted = true
      return
    }

    if (event.key === Qt.Key_H && root.mode === "practice") {
      root.showHint()
      event.accepted = true
    } else if (event.key === Qt.Key_Backspace) {
      root.backspace()
      event.accepted = true
    } else if (event.key === Qt.Key_Minus) {
      root.toggleSign()
      event.accepted = true
    } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
      root.submitCurrent()
      event.accepted = true
    } else if (root.usingChoices && event.key === Qt.Key_Left) {
      root.moveChoice(-1)
      event.accepted = true
    } else if (root.usingChoices && event.key === Qt.Key_Right) {
      root.moveChoice(1)
      event.accepted = true
    } else if (root.usingChoices && event.key === Qt.Key_Up) {
      root.moveChoice(-2)
      event.accepted = true
    } else if (root.usingChoices && event.key === Qt.Key_Down) {
      root.moveChoice(2)
      event.accepted = true
    } else if (root.usingChoices && event.key >= Qt.Key_1 && event.key <= Qt.Key_4) {
      root.selectChoice(event.key - Qt.Key_1)
      event.accepted = true
    } else if (!root.usingChoices && event.key >= Qt.Key_0 && event.key <= Qt.Key_9) {
      root.appendDigit(String(event.key - Qt.Key_0))
      event.accepted = true
    }
  }

  function completeMessage() {
    if (root.lastResultObject && root.lastResultObject.status === "abandoned")
      return "Skill check ended early. Your answers so far are saved."
    if (root.mode === "assessment")
      return "All done. Thanks for exploring what you know."
    return "You made time to learn. Take a break, or try an invention in the Number Lab."
  }

  function startPractice() {
    root.mode = "practice"
    root.adaptive = false
    root.roundSize = 10
    root.seed = Math.max(Date.now(), root.seed + 1)
    root.beginRound(root.levelId)
  }

  function saveNotebook(entries) {
    var learner = MathEngine.learnerRecord(root.progress, root.learnerId)
    learner.notebook = Lab.normalizeNotebook(entries)
    learner.preferredLevel = root.levelId
    root.progress = MathEngine.normalizeProgress(JSON.stringify(root.progress))
    root.saveProgress()
  }

  onScreenChanged: {
    viewport.contentY = 0
    Qt.callLater(function () {
      keyboardAnchor.forceActiveFocus()
    })
  }

  Timer {
    id: advanceTimer
    interval: 800
    repeat: false
    onTriggered: root.goNext()
  }

  FileView {
    id: progressFile
    path: root.homePath + "/.local/state/omarchy/kids-math.json"
    watchChanges: true
    atomicWrites: true
    printErrors: false
    onLoaded: root.loadProgress(text())
    onLoadFailed: root.loadProgress("{}")
    onFileChanged: reload()
  }

  ListModel {
    id: levelModel
  }

  Component.onCompleted: {
    var all = MathEngine.levels()
    for (var i = 0; i < all.length; i++) {
      levelModel.append({
        levelId: all[i].id,
        title: all[i].name,
        ages: all[i].ages,
        blurb: all[i].blurb
      })
    }
  }

  PanelWindow {
    id: panel
    visible: root.opened
    anchors {
      top: true
      bottom: true
      left: true
      right: true
    }
    color: "transparent"
    WlrLayershell.namespace: "omarchy-kids-math"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    Rectangle {
      anchors.fill: parent
      color: root.scrim
    }

    MouseArea {
      anchors.fill: parent
      onClicked: {
        if (root.screen === "home" || root.screen === "levels" || root.screen === "complete" || root.screen === "lab")
          root.dismiss()
      }
    }

    BorderSurface {
      id: card
      width: root.cardWidth
      height: root.cardHeight
      radius: root.cornerRadius
      anchors.centerIn: parent
      color: root.background
      borderSpec: root.borderSpec
      padding: root.contentMargin

      MouseArea {
        anchors.fill: parent
        onClicked: {}
      }

      FocusScope {
        id: keyCatcher
        anchors.fill: parent
        focus: true
        Keys.priority: Keys.AfterItem
        Keys.onPressed: function (event) {
          root.handleKey(event)
        }

        Item {
          id: keyboardAnchor
          anchors.fill: parent
          focus: true
        }

        Row {
          id: fixedHeader
          anchors.top: parent.top
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.topMargin: card.contentTopInset
          anchors.leftMargin: card.contentLeftInset
          anchors.rightMargin: card.contentRightInset
          spacing: Style.spacing.md

          Text {
            width: parent.width - closeBtn.width - parent.spacing
            text: root.screen === "levels" ? "Pick a level" : (root.screen === "play" ? root.currentLevel.name : root.screen === "lab" ? "Number Lab" : "Math Garden · room to grow")
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.heading
            font.bold: true
            elide: Text.ElideRight
          }

          MathButton {
            id: closeBtn
            width: Style.space(88)
            label: "Close"
            onTapped: root.dismiss()
          }
        }

        Flickable {
          id: viewport
          anchors.fill: parent
          anchors.topMargin: card.contentTopInset + fixedHeader.height + Style.spacing.md
          anchors.rightMargin: card.contentRightInset
          anchors.bottomMargin: card.contentBottomInset
          anchors.leftMargin: card.contentLeftInset
          contentWidth: width
          contentHeight: body.implicitHeight
          clip: true
          boundsBehavior: Flickable.StopAtBounds
          flickableDirection: Flickable.VerticalFlick
          function ensureVisible(item) {
            var position = item.mapToItem(contentItem, 0, 0)
            if (position.y < contentY)
              contentY = position.y
            else if (position.y + item.height > contentY + height)
              contentY = Math.min(Math.max(0, contentHeight - height), position.y + item.height - height)
          }

          Column {
            id: body
            width: viewport.width
            spacing: Style.spacing.md

            // Home
            Column {
              width: parent.width
              spacing: Style.spacing.md
              visible: root.screen === "home"

              GardenHome {
                width: parent.width
                onLaunchRequested: function (activity) { root.launchGarden(activity) }
              }

              Text {
                width: parent.width
                text: "More ways to explore · Level " + root.currentLevel.id + " · " + root.currentLevel.name
                color: root.foreground
                opacity: 0.7
                font.family: root.fontFamily
                font.pixelSize: Style.font.body
                wrapMode: Text.WordWrap
              }

              MathButton {
                width: parent.width
                label: "Number Lab"
                hint: "Build a number. Crack a mystery. Save an invention."
                onTapped: root.screen = "lab"
              }

              MathButton {
                width: parent.width
                label: "Practice"
                hint: "10 questions, with ideas when you need them"
                onTapped: root.startPractice()
              }

              MathButton {
                width: parent.width
                label: "Check my skills"
                hint: "Find a comfortable place to start"
                onTapped: {
                  root.mode = "assessment"
                  root.adaptive = true
                  root.roundSize = 12
                  root.seed = Math.max(Date.now(), root.seed + 1)
                  root.beginRound(root.levelId)
                }
              }

              MathButton {
                width: parent.width
                label: "Change level"
                hint: "Ages 5–12, from counting to percents"
                onTapped: root.screen = "levels"
              }
            }

            Loader {
              id: gardenLoader
              width: parent.width
              active: root.opened && root.screen === "garden"
              visible: active
              sourceComponent: Component {
                GardenView {
                  initialActivity: root.gardenActivity
                  levelId: {
                    var saved = MathEngine.learnerRecord(root.progress, root.learnerId).garden
                    return saved ? Garden.loadProgress(saved).level : Math.min(3, root.levelId)
                  }
                  progress: Garden.loadProgress(MathEngine.learnerRecord(root.progress, root.learnerId).garden)
                  onSaved: function(value) { root.saveGarden(value) }
                  onHomeRequested: root.screen = "home"
                  onNavigated: {
                    viewport.contentY = 0
                    Qt.callLater(function() { keyboardAnchor.forceActiveFocus() })
                  }
                }
              }
            }

            // Levels
            Grid {
              width: parent.width
              visible: root.screen === "levels"
              columns: body.width < Style.space(560) ? 1 : 2
              rowSpacing: Style.spacing.md
              columnSpacing: Style.spacing.md

              Repeater {
                model: levelModel
                delegate: MathButton {
                  required property int levelId
                  required property string title
                  required property string ages
                  required property string blurb
                  width: (body.width - (parent.columns - 1) * Style.spacing.md) / parent.columns
                  label: levelId + ". " + title
                  hint: "Ages " + ages + " · " + blurb
                  active: root.levelId === levelId
                  onTapped: {
                    root.levelId = levelId
                    root.mode = "practice"
                    root.adaptive = false
                    root.roundSize = 10
                    root.screen = "home"
                  }
                }
              }
            }

            Loader {
              width: parent.width
              active: root.screen === "lab"
              visible: active
              sourceComponent: Component {
                LabView {
                  levelId: root.levelId
                  notebook: Lab.normalizeNotebook(MathEngine.learnerRecord(root.progress, root.learnerId).notebook)
                  onSaved: function (entries) {
                    root.saveNotebook(entries)
                  }
                  onHomeRequested: root.screen = "home"
                }
              }
            }

            // Play
            Column {
              width: parent.width
              spacing: Style.spacing.md
              visible: root.screen === "play" && root.currentQuestion

              Row {
                width: parent.width
                spacing: Style.spacing.md

                Text {
                  text: (root.questionIndex + 1) + " / " + (root.adaptive ? root.roundSize : Math.max(root.questions.length, 1))
                  color: root.foreground
                  opacity: 0.7
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.body
                }

                Text {
                  visible: root.mode === "practice"
                  text: "Take your time"
                  color: root.accent
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.body
                }

                Text {
                  visible: root.mode === "assessment"
                  text: "Skill check"
                  color: root.foreground
                  opacity: 0.55
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.bodySmall
                }
              }

              Text {
                width: parent.width
                visible: root.currentQuestion !== null
                text: root.currentQuestion ? root.currentQuestion.prompt : ""
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.displayLarge
                wrapMode: Text.WordWrap
                horizontalAlignment: Text.AlignHCenter
              }

              CounterField {
                id: countingLights
                width: parent.width
                visible: root.currentQuestion && root.currentQuestion.promptKind === "dots"
                count: visible ? root.currentQuestion.dots : 0
                columns: 5
                touchToCount: root.mode === "practice"
              }

              Row {
                width: parent.width
                visible: root.currentQuestion && root.currentQuestion.promptKind === "compare"
                CounterField {
                  width: parent.width / 2
                  count: parent.visible ? root.currentQuestion.left : 0
                }
                CounterField {
                  width: parent.width / 2
                  count: parent.visible ? root.currentQuestion.right : 0
                  ink: root.foreground
                }
              }

              Text {
                width: parent.width
                visible: root.feedback !== ""
                text: {
                  if (root.mode === "assessment")
                    return "Answer saved"
                  if (root.feedback === "correct")
                    return root.attempts > 1 || root.hintUsed ? "You worked it out!" : "You found it!"
                  if (root.feedback === "reveal")
                    return "It was " + root.currentQuestion.answer
                  return "Let’s try an idea, then have another go."
                }
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.title
                horizontalAlignment: Text.AlignHCenter
              }

              Text {
                width: parent.width
                visible: root.mode === "practice" && (root.hintShown || root.itemLocked)
                text: !root.currentQuestion ? "" : root.itemLocked ? root.currentQuestion.support.explanation : root.currentQuestion.support.hint
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.body
                wrapMode: Text.WordWrap
                horizontalAlignment: Text.AlignHCenter
              }

              Row {
                width: parent.width
                visible: root.mode === "practice" && root.hintShown && root.currentQuestion && root.currentQuestion.support.counters.length === 2
                CounterField {
                  width: parent.width / 2
                  count: parent.visible ? root.currentQuestion.support.counters[0] : 0
                }
                CounterField {
                  width: parent.width / 2
                  count: parent.visible ? root.currentQuestion.support.counters[1] : 0
                  ink: root.foreground
                }
              }

              Grid {
                width: parent.width
                visible: root.usingChoices && !root.itemLocked
                columns: Math.min(2, Math.max(1, root.choiceValues.length))
                rowSpacing: Style.spacing.md
                columnSpacing: Style.spacing.md

                Repeater {
                  id: choiceButtons
                  model: root.choiceValues.length
                  delegate: MathButton {
                    required property int index
                    width: (body.width - Style.spacing.md) / 2
                    label: String(root.choiceValues[index])
                    primary: root.choiceCursor === index
                    onTapped: root.selectChoice(index)
                  }
                }
              }

              Rectangle {
                width: parent.width
                height: Style.space(64)
                visible: !root.usingChoices && !root.itemLocked
                radius: root.cornerRadius
                color: "transparent"
                border.width: Style.normalBorderWidth
                border.color: Util.alpha(root.border, 0.45)

                Text {
                  anchors.fill: parent
                  text: root.typed.length ? root.typed : "Type the answer"
                  color: root.foreground
                  opacity: root.typed.length ? 1 : 0.45
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.display
                  horizontalAlignment: Text.AlignHCenter
                  verticalAlignment: Text.AlignVCenter
                }
              }

              Grid {
                width: parent.width
                visible: !root.usingChoices && !root.itemLocked
                columns: 3
                rowSpacing: Style.space(8)
                columnSpacing: Style.space(8)

                Repeater {
                  model: 12
                  delegate: MathButton {
                    required property int index
                    readonly property string keyLabel: root.keypadLabels[index]
                    width: (body.width - Style.space(16)) / 3
                    label: keyLabel
                    onTapped: {
                      if (keyLabel === "⌫")
                        root.backspace()
                      else if (keyLabel === "−")
                        root.toggleSign()
                      else
                        root.appendDigit(keyLabel)
                    }
                  }
                }
              }

              MathButton {
                width: parent.width
                visible: (!root.usingChoices && !root.itemLocked) || (root.itemLocked && root.mode === "practice")
                primary: true
                label: root.itemLocked ? "Next" : "Check"
                onTapped: root.itemLocked ? root.goNext() : root.submitCurrent()
              }

              MathButton {
                width: parent.width
                visible: root.mode === "practice" && !root.itemLocked
                label: root.hintShown ? "Hide idea" : "Give me an idea"
                hint: "Keyboard: H"
                onTapped: root.showHint()
              }
            }

            // Complete
            Column {
              width: parent.width
              spacing: Style.spacing.md
              visible: root.screen === "complete"

              Text {
                width: parent.width
                text: "✦"
                color: root.accent
                font.family: root.fontFamily
                font.pixelSize: Style.font.displayLarge
                horizontalAlignment: Text.AlignHCenter
              }

              Text {
                width: parent.width
                text: root.completeMessage()
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.title
                wrapMode: Text.WordWrap
                horizontalAlignment: Text.AlignHCenter
              }

              Text {
                width: parent.width
                visible: root.mode === "practice" && root.lastResultObject
                text: root.lastResultObject ? root.lastResultObject.total + " ideas explored · " + root.lastResultObject.independentCorrect + " solved independently" : ""
                wrapMode: Text.WordWrap
                color: root.foreground
                opacity: 0.7
                font.family: root.fontFamily
                font.pixelSize: Style.font.heading
                horizontalAlignment: Text.AlignHCenter
              }

              MathButton {
                width: parent.width
                primary: true
                label: "Try the Number Lab"
                onTapped: root.screen = "lab"
              }

              MathButton {
                width: parent.width
                label: "Take a break"
                onTapped: root.screen = "home"
              }
            }
          }
        }
        Rectangle {
          anchors.right: parent.right
          anchors.rightMargin: Math.max(Style.space(4), card.contentRightInset / 3)
          anchors.top: viewport.top
          anchors.bottom: viewport.bottom
          width: Style.space(4)
          radius: width / 2
          color: Util.alpha(root.foreground, 0.1)
          visible: viewport.contentHeight > viewport.height
          Accessible.ignored: true
          Rectangle {
            width: parent.width
            height: Math.max(Style.space(24), parent.height * viewport.height / Math.max(1, viewport.contentHeight))
            y: Math.max(0, Math.min(parent.height - height, (parent.height - height) * viewport.contentY / Math.max(1, viewport.contentHeight - viewport.height)))
            radius: width / 2
            color: Util.alpha(root.foreground, 0.6)
          }
        }
      }
    }
  }
}
