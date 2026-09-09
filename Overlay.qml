import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import qs.Ui
import "MathEngine.js" as MathEngine

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
  property var progress: ({ schemaVersion: 1, learners: {}, lastAssessment: null })
  property var questions: []
  property int questionIndex: 0
  property var currentQuestion: null
  property var choiceValues: []
  property int choiceCursor: 0
  property string typed: ""
  property string feedback: ""
  property int attempts: 0
  property int streak: 0
  property var sessionItems: []
  property bool sessionOpen: false
  property string startedAt: ""
  property double questionStartedMs: 0
  property var lastResultObject: null
  property string lastResultJson: ""
  property real seed: 1
  property var rng: null
  property string resultFile: ""
  property string doneFile: ""
  property string overrideInput: ""
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
  property int cardWidth: Math.min(Style.space(920), panel.width - Style.gapsOut * 2)
  property int cardHeight: Math.min(Style.space(740), panel.height - Style.gapsOut * 2)

  readonly property var currentLevel: MathEngine.levelById(root.levelId)
  readonly property bool usingChoices: {
    if (!root.currentQuestion) return true
    if (root.overrideInput) return root.overrideInput === "choices"
    return root.currentQuestion.input !== "keypad"
  }

  function pluginId() {
    return (root.manifest && root.manifest.id) || "omarchykids.math"
  }

  function open(payloadJson) {
    root.progress = MathEngine.normalizeProgress(root.progress)
    root.payload = MathEngine.parsePayload(payloadJson || "{}")
    root.mode = root.payload.mode
    root.learnerId = root.payload.learnerId
    root.roundSize = root.payload.count
    root.adaptive = root.payload.adaptive === true
    root.seed = root.payload.seed
    root.resultFile = root.payload.resultFile
    root.doneFile = root.payload.doneFile
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

    Qt.callLater(function () { keyCatcher.forceActiveFocus() })
  }

  function close() {
    if (root.sessionOpen && root.mode === "assessment")
      root.finishSession("abandoned")
    advanceTimer.stop()
    root.opened = false
  }

  function dismiss() {
    root.close()
    if (root.shell && typeof root.shell.hide === "function")
      root.shell.hide(root.pluginId())
  }

  function toggle() {
    if (root.opened) root.dismiss()
    else root.open("{}")
  }

  function lastResult() {
    return root.lastResultJson || "{}"
  }

  function catalog() {
    return MathEngine.catalogJson()
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
      root.questions = MathEngine.generateRound(root.levelId, root.roundSize, root.rng)
    }
    root.showQuestionAt(0)
    root.screen = "play"
  }

  function pushAdaptiveQuestion() {
    var q = MathEngine.generateQuestion(root.levelId, root.rng)
    root.questions = root.questions.concat([q])
  }

  function showQuestionAt(index) {
    if (index < 0 || index >= root.questions.length) return
    root.questionIndex = index
    root.currentQuestion = root.questions[index]
    root.choiceValues = (root.currentQuestion && root.currentQuestion.choices) || []
    root.choiceCursor = 0
    root.typed = ""
    root.feedback = ""
    root.attempts = 0
    root.questionStartedMs = Date.now()
  }

  function currentInput() {
    if (root.usingChoices) {
      if (root.choiceCursor < 0 || root.choiceCursor >= root.choiceValues.length) return null
      return root.choiceValues[root.choiceCursor]
    }
    return root.typed
  }

  function submitCurrent() {
    if (!root.currentQuestion || root.feedback === "correct") return
    if (!root.usingChoices && !root.typed.length) return
    var graded = MathEngine.grade(root.currentQuestion, root.currentInput())
    root.attempts++
    if (graded.correct) {
      root.feedback = "correct"
      root.streak++
      root.recordItem(true, graded.response)
      advanceTimer.interval = root.mode === "assessment" ? 550 : 900
      advanceTimer.restart()
    } else if (root.mode === "assessment") {
      root.feedback = "wrong"
      root.streak = 0
      root.recordItem(false, graded.response)
      advanceTimer.interval = 550
      advanceTimer.restart()
    } else if (root.attempts >= 2) {
      root.feedback = "reveal"
      root.streak = 0
      root.recordItem(false, graded.response)
    } else {
      root.feedback = "wrong"
      root.streak = 0
      if (!root.usingChoices) root.typed = ""
    }
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
      ms: Math.max(0, Date.now() - root.questionStartedMs)
    }
    root.sessionItems = root.sessionItems.concat([item])
  }

  function goNext() {
    advanceTimer.stop()
    if (!root.sessionOpen) return

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
    if (!root.sessionOpen) return
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
    root.progress.lastAssessment = result
    root.progress = MathEngine.recordRound(root.progress, root.learnerId, root.levelId, result.correct, result.total, root.streak)
    if (root.mode === "assessment") {
      var learner = MathEngine.learnerRecord(root.progress, root.learnerId)
      learner.preferredLevel = result.recommendedLevel
    }
    root.saveProgress()
    root.writeTutorFiles(root.lastResultJson)
    root.screen = "complete"
  }

  function writeTutorFiles(json) {
    if (!root.resultFile && !root.doneFile) return
    var cmd = "true"
    if (root.resultFile)
      cmd = "printf '%s\\n' " + Util.shellQuote(json) + " > " + Util.shellQuote(root.resultFile)
    if (root.doneFile)
      cmd += "; : > " + Util.shellQuote(root.doneFile)
    doneProc.command = ["bash", "-c", cmd]
    doneProc.running = true
  }

  function appendDigit(digit) {
    if (root.usingChoices || root.feedback === "correct" || root.feedback === "reveal") return
    if (root.typed.length >= 8) return
    root.feedback = ""
    root.typed += digit
  }

  function backspace() {
    if (root.usingChoices) return
    root.typed = root.typed.slice(0, -1)
  }

  function toggleSign() {
    if (root.usingChoices) return
    if (root.typed.indexOf("-") === 0) root.typed = root.typed.slice(1)
    else root.typed = "-" + root.typed
  }

  function selectChoice(index) {
    if (!root.usingChoices) return
    if (index < 0 || index >= root.choiceValues.length) return
    root.choiceCursor = index
    root.submitCurrent()
  }

  function moveChoice(delta) {
    if (!root.usingChoices || root.choiceValues.length === 0) return
    var next = root.choiceCursor + delta
    if (next < 0) next = root.choiceValues.length - 1
    if (next >= root.choiceValues.length) next = 0
    root.choiceCursor = next
  }

  function handleKey(event) {
    if (event.key === Qt.Key_Escape) {
      if (root.screen === "play" && root.mode === "assessment") {
        root.finishSession("abandoned")
      } else if (root.screen === "play") {
        root.sessionOpen = false
        root.screen = "home"
      } else if (root.screen === "levels" || root.screen === "complete") {
        root.screen = "home"
      } else {
        root.dismiss()
      }
      event.accepted = true
      return
    }

    if (root.screen !== "play") return

    if (root.feedback === "reveal" && (event.key === Qt.Key_Return || event.key === Qt.Key_Enter || event.key === Qt.Key_Space)) {
      root.goNext()
      event.accepted = true
      return
    }

    if (event.key === Qt.Key_Backspace) {
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

  function starsText(count) {
    var n = Math.max(0, Math.min(3, count))
    var out = ""
    for (var i = 0; i < 3; i++) out += i < n ? "★" : "☆"
    return out
  }

  function completeMessage() {
    if (root.mode === "assessment") return "All done. You practiced a lot of math."
    var stars = root.lastResultObject ? MathEngine.starsForAccuracy(root.lastResultObject.accuracy) : 0
    if (stars >= 3) return "Wow — you crushed it."
    if (stars === 2) return "Nice work. Keep going."
    if (stars === 1) return "Good try. Want another round?"
    return "Practice makes this easier. Go again?"
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

  Process { id: doneProc }

  ListModel { id: levelModel }

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

  component KidButton: Rectangle {
    id: btn
    property string label: ""
    property string hint: ""
    property bool active: false
    property bool primary: false
    property bool hovered: mouse.containsMouse
    signal tapped()

    implicitHeight: Math.max(Style.space(hint !== "" ? 92 : 52), (hint ? Style.font.title + Style.font.bodySmall + Style.spacing.labelGap : Style.font.title) + Style.spacing.controlPaddingY * 2)
    radius: root.cornerRadius
    color: primary || active || hovered ? root.selectedBackground : "transparent"
    border.width: Style.normalBorderWidth
    border.color: Util.alpha(root.border, primary || active || hovered ? 0.9 : 0.35)

    Column {
      anchors.centerIn: parent
      spacing: Style.spacing.labelGap
      width: parent.width - Style.space(16)

      Text {
        width: parent.width
        text: btn.label
        color: btn.primary || btn.active || btn.hovered ? root.selectedText : root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.title
        font.bold: btn.primary
        horizontalAlignment: Text.AlignHCenter
        wrapMode: Text.WordWrap
      }

      Text {
        width: parent.width
        visible: btn.hint !== ""
        text: btn.hint
        color: btn.primary || btn.active || btn.hovered ? root.selectedText : root.foreground
        opacity: 0.65
        font.family: root.fontFamily
        font.pixelSize: Style.font.bodySmall
        horizontalAlignment: Text.AlignHCenter
        wrapMode: Text.WordWrap
      }
    }

    MouseArea {
      id: mouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: btn.tapped()
    }
  }

  PanelWindow {
    id: panel
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
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
        if (root.screen === "home" || root.screen === "levels" || root.screen === "complete")
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

      MouseArea { anchors.fill: parent; onClicked: {} }

      Item {
        id: keyCatcher
        anchors.fill: parent
        focus: true
        Keys.priority: Keys.BeforeItem
        Keys.onPressed: function (event) { root.handleKey(event) }
      }

      Column {
        id: body
        anchors.fill: parent
        anchors.topMargin: card.contentTopInset
        anchors.rightMargin: card.contentRightInset
        anchors.bottomMargin: card.contentBottomInset
        anchors.leftMargin: card.contentLeftInset
        spacing: Style.spacing.md

        Row {
          width: parent.width
          spacing: Style.spacing.md

          Text {
            width: parent.width - closeBtn.width - parent.spacing
            text: root.screen === "levels" ? "Pick a level" : (root.screen === "play" ? root.currentLevel.name : "Math")
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.heading
            font.bold: true
            elide: Text.ElideRight
          }

          KidButton {
            id: closeBtn
            width: Style.space(88)
            label: "Close"
            onTapped: root.dismiss()
          }
        }

        // Home
        Column {
          width: parent.width
          spacing: Style.spacing.md
          visible: root.screen === "home"

          Text {
            width: parent.width
            text: "Practice math, or check how you are doing."
            color: root.foreground
            opacity: 0.78
            font.family: root.fontFamily
            font.pixelSize: Style.font.title
            wrapMode: Text.WordWrap
          }

          Text {
            width: parent.width
            text: "Level " + root.currentLevel.id + " · " + root.currentLevel.name + " · ages " + root.currentLevel.ages
            color: root.foreground
            opacity: 0.7
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
          }

          KidButton {
            width: parent.width
            primary: true
            label: "Practice"
            hint: "10 questions at your level"
            onTapped: {
              root.mode = "practice"
              root.adaptive = false
              root.roundSize = 10
              root.beginRound(root.levelId)
            }
          }

          KidButton {
            width: parent.width
            label: "Check my skills"
            hint: "A short mix the tutor can read later"
            onTapped: {
              root.mode = "assessment"
              root.adaptive = true
              root.roundSize = 12
              root.seed = Date.now()
              root.beginRound(root.levelId)
            }
          }

          KidButton {
            width: parent.width
            label: "Change level"
            hint: "Ages 5–12, from counting to percents"
            onTapped: root.screen = "levels"
          }
        }

        // Levels
        Grid {
          width: parent.width
          visible: root.screen === "levels"
          columns: 2
          rowSpacing: Style.spacing.md
          columnSpacing: Style.spacing.md

          Repeater {
            model: levelModel
            delegate: KidButton {
              required property int levelId
              required property string title
              required property string ages
              required property string blurb
              width: (body.width - Style.spacing.md) / 2
              label: levelId + ". " + title
              hint: "Ages " + ages + " · " + blurb
              active: root.levelId === levelId
              onTapped: {
                root.levelId = levelId
                root.mode = "practice"
                root.adaptive = false
                root.roundSize = 10
                root.beginRound(levelId)
              }
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
              text: root.starsText(Math.min(3, Math.floor(root.streak / 3)))
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
            visible: root.currentQuestion && root.currentQuestion.promptKind !== "dots"
            text: root.currentQuestion ? root.currentQuestion.prompt : ""
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.displayLarge
            wrapMode: Text.WordWrap
            horizontalAlignment: Text.AlignHCenter
          }

          Flow {
            width: parent.width
            visible: root.currentQuestion && root.currentQuestion.promptKind === "dots"
            spacing: Style.space(10)
            leftPadding: Math.max(0, (parent.width - Math.min(root.currentQuestion ? root.currentQuestion.dots : 0, 5) * Style.space(38)) / 2)

            Repeater {
              model: root.currentQuestion && root.currentQuestion.promptKind === "dots" ? root.currentQuestion.dots : 0
              delegate: Rectangle {
                width: Style.space(28)
                height: Style.space(28)
                radius: width / 2
                color: root.accent
              }
            }
          }

          Text {
            width: parent.width
            visible: root.feedback !== ""
            text: {
              if (root.feedback === "correct") return "Yes!"
              if (root.feedback === "reveal") return "It was " + root.currentQuestion.answer
              if (root.mode === "assessment") return "On to the next one"
              return "Not quite — try again"
            }
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.title
            horizontalAlignment: Text.AlignHCenter
          }

          Grid {
            width: parent.width
            visible: root.usingChoices
            columns: Math.min(2, Math.max(1, root.choiceValues.length))
            rowSpacing: Style.spacing.md
            columnSpacing: Style.spacing.md

            Repeater {
              model: root.choiceValues.length
              delegate: KidButton {
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
            visible: !root.usingChoices
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
            visible: !root.usingChoices
            columns: 3
            rowSpacing: Style.space(8)
            columnSpacing: Style.space(8)

            Repeater {
              model: 12
              delegate: KidButton {
                required property int index
                readonly property string keyLabel: root.keypadLabels[index]
                width: (body.width - Style.space(16)) / 3
                label: keyLabel
                onTapped: {
                  if (keyLabel === "⌫") root.backspace()
                  else if (keyLabel === "−") root.toggleSign()
                  else root.appendDigit(keyLabel)
                }
              }
            }
          }

          KidButton {
            width: parent.width
            visible: !root.usingChoices || root.feedback === "reveal"
            primary: true
            label: root.feedback === "reveal" ? "Next" : "Check"
            onTapped: root.feedback === "reveal" ? root.goNext() : root.submitCurrent()
          }
        }

        // Complete
        Column {
          width: parent.width
          spacing: Style.spacing.md
          visible: root.screen === "complete"

          Text {
            width: parent.width
            text: root.lastResultObject ? root.starsText(root.mode === "assessment" ? 3 : MathEngine.starsForAccuracy(root.lastResultObject.accuracy)) : ""
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
            text: root.lastResultObject ? (root.lastResultObject.correct + " out of " + root.lastResultObject.total) : ""
            color: root.foreground
            opacity: 0.7
            font.family: root.fontFamily
            font.pixelSize: Style.font.heading
            horizontalAlignment: Text.AlignHCenter
          }

          KidButton {
            width: parent.width
            primary: true
            label: "Again"
            onTapped: root.beginRound(root.levelId)
          }

          KidButton {
            width: parent.width
            label: "Home"
            onTapped: root.screen = "home"
          }
        }
      }
    }
  }
}
