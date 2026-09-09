import QtQuick
import qs.Commons
import "LabEngine.js" as Lab

Column {
  id: lab
  objectName: "numberLab"
  property int levelId: 1
  property var notebook: []
  property var puzzle: null
  property int leftIndex: 0
  property int rightIndex: 0
  property string message: ""
  property bool hintShown: false
  property bool mysterySolved: false
  property bool browsing: false
  property double serial: Date.now()
  signal saved(var entries)
  signal homeRequested
  readonly property int a: puzzle && puzzle.kind === "build" ? puzzle.left[leftIndex] : 0
  readonly property int b: puzzle && puzzle.kind === "build" ? puzzle.right[rightIndex] : 0
  readonly property int value: puzzle && puzzle.kind === "build" ? Lab.output(puzzle, a, b) : 0
  readonly property bool atTarget: puzzle !== null && puzzle.kind === "build" && value === puzzle.target
  readonly property var discoveries: puzzle ? notebook.filter(function (entry) {
    return entry.code === lab.puzzle.code
  }) : []
  spacing: Style.spacing.md

  function start(kind, code) {
    leftIndex = 0
    rightIndex = 0
    puzzle = code ? Lab.fromCode(code) : Lab.create(levelId, ++serial, kind)
    message = ""
    hintShown = false
    mysterySolved = false
    browsing = false
  }
  function reopen(entry) {
    start("build", entry.code)
    if (puzzle.kind === "build") {
      leftIndex = puzzle.left.indexOf(entry.a)
      rightIndex = puzzle.right.indexOf(entry.b)
    }
  }
  function remember() {
    if (!puzzle || (puzzle.kind === "build" ? !atTarget : !mysterySolved))
      return
    var result = Lab.remember(notebook, puzzle, a, b)
    if (result.added)
      saved(result.entries)
    message = result.added ? "Saved in your invention book." : "You already saved this invention. Try a different way!"
  }
  function canAdjust(index, delta) {
    if (!puzzle || puzzle.kind !== "build")
      return false
    var values = index === 0 ? puzzle.left : puzzle.right
    var next = (index === 0 ? leftIndex : rightIndex) + delta
    if (next < 0 || next >= values.length)
      return false
    return puzzle.operation !== "subtract" || Lab.output(puzzle, index === 0 ? values[next] : a, index === 1 ? values[next] : b) >= 0
  }
  function guess(answer) {
    if (mysterySolved)
      return
    if (answer !== puzzle.answer) {
      hintShown = true
      message = "Test that idea against all three clues. You can try again."
      return
    }
    mysterySolved = true
    remember()
  }
  Component.onCompleted: start("build")

  component LabText: Text {
    width: parent.width
    color: Color.menu.text
    font.family: Style.font.menuFamily
    font.pixelSize: Style.font.body
    wrapMode: Text.WordWrap
  }

  Row {
    width: parent.width
    spacing: Style.spacing.sm
    MathButton {
      width: (parent.width - parent.spacing) / 2
      label: "Build a number"
      active: lab.puzzle && lab.puzzle.kind === "build" && !lab.browsing
      onTapped: lab.start("build")
    }
    MathButton {
      width: (parent.width - parent.spacing) / 2
      label: "Solve a mystery"
      active: lab.puzzle && lab.puzzle.kind === "mystery" && !lab.browsing
      onTapped: lab.start("mystery")
    }
  }

  Column {
    width: parent.width
    spacing: Style.spacing.md
    visible: !lab.browsing && lab.puzzle !== null

    LabText {
      text: lab.puzzle ? lab.puzzle.title : ""
      font.pixelSize: Style.font.heading
      font.bold: true
    }
    LabText {
      text: !lab.puzzle ? "" : lab.puzzle.kind === "build" ? "Make " + lab.puzzle.target + ". How many different ways can you invent?" : "One secret rule changes every number. What will come out next?"
      font.pixelSize: Style.font.title
    }

    Column {
      width: parent.width
      spacing: Style.spacing.md
      visible: lab.puzzle !== null && lab.puzzle.kind === "build"

      Row {
        width: parent.width
        spacing: Style.spacing.md
        Repeater {
          model: lab.puzzle && lab.puzzle.kind === "build" ? 2 : 0
          delegate: Column {
            id: dial
            required property int index
            readonly property var values: index === 0 ? lab.puzzle.left : lab.puzzle.right
            readonly property int cursor: index === 0 ? lab.leftIndex : lab.rightIndex
            width: (parent.width - Style.spacing.md) / 2
            spacing: Style.spacing.sm
            LabText {
              text: lab.puzzle.labels[dial.index]
              horizontalAlignment: Text.AlignHCenter
            }
            LabText {
              text: String(dial.values[dial.cursor])
              font.pixelSize: Style.font.displayLarge
              font.bold: true
              horizontalAlignment: Text.AlignHCenter
            }
            Row {
              width: parent.width
              spacing: Style.spacing.sm
              MathButton {
                width: (parent.width - parent.spacing) / 2
                label: "−"
                Accessible.name: "Decrease " + lab.puzzle.labels[dial.index]
                enabled: lab.canAdjust(dial.index, -1)
                onTapped: {
                  if (dial.index === 0)
                    lab.leftIndex--
                  else
                    lab.rightIndex--
                  lab.message = ""
                }
              }
              MathButton {
                width: (parent.width - parent.spacing) / 2
                label: "+"
                Accessible.name: "Increase " + lab.puzzle.labels[dial.index]
                enabled: lab.canAdjust(dial.index, 1)
                onTapped: {
                  if (dial.index === 0)
                    lab.leftIndex++
                  else
                    lab.rightIndex++
                  lab.message = ""
                }
              }
            }
          }
        }
      }

      Rectangle {
        width: parent.width
        implicitHeight: machineDrawing.implicitHeight + Style.space(32)
        radius: Style.cornerRadius
        color: Util.alpha(Color.accent, 0.09)
        border.width: 1
        border.color: Util.alpha(Color.accent, 0.5)
        Column {
          id: machineDrawing
          width: parent.width - Style.space(32)
          anchors.centerIn: parent
          spacing: Style.spacing.sm
          LabText {
            text: lab.puzzle && lab.puzzle.kind === "build" ? Lab.expression(lab.puzzle, lab.a, lab.b) : ""
            font.pixelSize: Style.font.display
            horizontalAlignment: Text.AlignHCenter
          }
          Row {
            width: parent.width
            visible: lab.puzzle !== null && lab.puzzle.operation === "add" && lab.puzzle.level === 1
            CounterField {
              width: parent.width / 2
              count: lab.a
              columns: 5
            }
            CounterField {
              width: parent.width / 2
              count: lab.b
              columns: 5
              ink: Color.menu.text
            }
          }
          CounterField {
            width: parent.width
            visible: lab.puzzle !== null && lab.puzzle.operation === "multiply"
            count: visible ? lab.a * lab.b : 0
            columns: lab.puzzle && lab.puzzle.level === 4 ? lab.b : lab.a
          }
          CounterField {
            width: parent.width
            visible: lab.puzzle !== null && lab.puzzle.operation === "subtract"
            count: visible ? lab.a : 0
            crossedOut: visible ? lab.b : 0
            columns: 10
          }
          Row {
            width: parent.width
            spacing: Style.space(6)
            visible: lab.puzzle !== null && lab.puzzle.operation === "fraction"
            Repeater {
              model: 4
              delegate: Rectangle {
                required property int index
                width: (parent.width - Style.space(18)) / 4
                height: Style.space(48)
                radius: Style.space(5)
                color: index < lab.a ? Color.menu.selectedBackground : "transparent"
                border.width: 1
                border.color: Color.accent
                Text {
                  anchors.centerIn: parent
                  text: String(lab.b / 4)
                  color: index < lab.a ? Color.menu.selectedText : Color.menu.text
                  font.pixelSize: Style.font.title
                }
              }
            }
          }
          LabText {
            text: lab.atTarget ? "Target reached! Save it, then try changing both dials." : "Output: " + lab.value + "    ·    Target: " + (lab.puzzle ? lab.puzzle.target : "")
            horizontalAlignment: Text.AlignHCenter
          }
        }
      }

      MathButton {
        width: parent.width
        label: "Save this invention"
        primary: true
        enabled: lab.atTarget
        onTapped: lab.remember()
      }
      LabText {
        visible: lab.discoveries.length > 0
        text: lab.discoveries.map(function (entry) {
          return entry.note
        }).join("   ·   ")
      }
      LabText {
        visible: lab.discoveries.length >= 2
        text: "You found more than one way! This is a good place to pause, or keep experimenting."
      }
    }

    Column {
      width: parent.width
      spacing: Style.spacing.md
      visible: lab.puzzle !== null && lab.puzzle.kind === "mystery"
      Repeater {
        model: lab.puzzle && lab.puzzle.kind === "mystery" ? lab.puzzle.inputs : []
        delegate: Rectangle {
          required property int modelData
          width: parent.width
          height: Style.space(56)
          radius: Style.cornerRadius
          color: Util.alpha(Color.accent, 0.09)
          LabText {
            anchors.centerIn: parent
            text: modelData + "   →   [ ? ]   →   " + Lab.runMachine(lab.puzzle, modelData)
            horizontalAlignment: Text.AlignHCenter
            font.pixelSize: Style.font.title
            Accessible.name: "Input " + modelData + ", output " + Lab.runMachine(lab.puzzle, modelData)
          }
        }
      }
      LabText {
        text: lab.puzzle ? lab.puzzle.probe + "   →   [ ? ]   →   " + (lab.mysterySolved ? lab.puzzle.answer : "what?") : ""
        font.pixelSize: Style.font.display
        horizontalAlignment: Text.AlignHCenter
      }
      Grid {
        width: parent.width
        columns: 2
        spacing: Style.spacing.sm
        visible: !lab.mysterySolved
        Repeater {
          model: lab.puzzle && lab.puzzle.kind === "mystery" ? lab.puzzle.choices : []
          delegate: MathButton {
            required property int modelData
            width: (parent.width - parent.spacing) / 2
            label: String(modelData)
            onTapped: lab.guess(modelData)
          }
        }
      }
      LabText {
        visible: lab.mysterySolved
        text: lab.puzzle && lab.puzzle.kind === "mystery" ? "You cracked it! " + Lab.ruleText(lab.puzzle) + " Can you explain why it fits every clue?" : ""
      }
    }

    LabText {
      visible: lab.message !== ""
      text: lab.message
    }
    MathButton {
      width: parent.width
      label: lab.hintShown ? "Hide idea" : "Give me an idea"
      onTapped: lab.hintShown = !lab.hintShown
    }
    LabText {
      visible: lab.hintShown
      text: lab.puzzle ? lab.puzzle.hint : ""
    }
    MathButton {
      width: parent.width
      label: "New puzzle"
      onTapped: lab.start(lab.puzzle.kind)
    }
    LabText {
      text: lab.puzzle ? "Puzzle code: " + lab.puzzle.code + "\nSomeone else can use this code to try the same puzzle." : ""
      font.pixelSize: Style.font.bodySmall
    }
  }

  Column {
    width: parent.width
    visible: lab.browsing
    spacing: Style.spacing.sm
    LabText {
      text: "Your invention book"
      font.pixelSize: Style.font.heading
      font.bold: true
    }
    LabText {
      text: lab.notebook.length ? "Open an invention and explore it again. Your latest 60 are kept here." : "Your book is ready. Save a number invention or solve a mystery to put something inside."
    }
    Repeater {
      model: lab.notebook.slice().reverse()
      delegate: MathButton {
        required property var modelData
        width: parent.width
        label: modelData.title
        hint: modelData.note
        onTapped: lab.reopen(modelData)
      }
    }
  }
  Row {
    width: parent.width
    spacing: Style.spacing.sm
    MathButton {
      width: (parent.width - parent.spacing) / 2
      label: lab.browsing ? "Back to puzzle" : "Invention book · " + lab.notebook.length
      onTapped: lab.browsing = !lab.browsing
    }
    MathButton {
      width: (parent.width - parent.spacing) / 2
      label: "Take a break"
      onTapped: lab.homeRequested()
    }
  }
  Rectangle {
    width: parent.width
    height: Style.space(52)
    radius: Style.cornerRadius
    color: "transparent"
    border.width: codeInput.activeFocus ? 2 : 1
    border.color: Color.menu.border
    TextInput {
      id: codeInput
      anchors.fill: parent
      anchors.margins: Style.space(12)
      color: Color.menu.text
      font.family: Style.font.menuFamily
      font.pixelSize: Style.font.body
      verticalAlignment: TextInput.AlignVCenter
      clip: true
      maximumLength: 28
      activeFocusOnTab: true
      selectByMouse: true
      Accessible.name: "Puzzle code"
      Text {
        anchors.fill: parent
        visible: !codeInput.text
        text: "Have a puzzle code? Type it here."
        color: Color.menu.text
        opacity: 0.65
        font: codeInput.font
        verticalAlignment: Text.AlignVCenter
      }
      onAccepted: if (Lab.fromCode(text)) {
        lab.start("build", text)
        text = ""
      }
    }
  }
  MathButton {
    width: parent.width
    label: "Open puzzle code"
    enabled: Lab.fromCode(codeInput.text) !== null
    onTapped: {
      lab.start("build", codeInput.text)
      codeInput.text = ""
    }
  }
}
