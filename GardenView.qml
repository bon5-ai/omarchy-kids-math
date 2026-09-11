import QtQuick
import qs.Commons
import "GardenEngine.js" as Garden

Column {
  id: garden
  objectName: "mathGarden"
  property string initialActivity: ""
  property int levelId: 1
  property var progress: Garden.loadProgress(null)
  property string page: "home"
  property string returnPage: "home"
  property var session: null
  property var picture: Garden.blankPicture()
  property string feedback: ""
  property string speechText: ""
  property bool hintShown: false
  property double serial: Date.now()
  property alias sceneBoard: board
  readonly property var narrator: speechLoader.item
  readonly property var lesson: session ? session.lesson : null
  readonly property bool reducedMotion: progress.reducedMotion === true
  readonly property bool demonstrating: demo.running
  readonly property var activity: lesson ? Garden.activities().filter(function(a) { return a.id === (garden.lesson.kind === "take" ? "join" : garden.lesson.kind) })[0] : null
  signal saved(var value)
  signal homeRequested
  signal navigated
  spacing: Style.spacing.md

  function stop() {
    demo.stop()
    if (speechLoader.item) speechLoader.item.stop()
  }
  function back() {
    stop()
    if (page === "grownups") { page = returnPage; navigated() }
    else if (page === "home") homeRequested()
    else { page = "home"; session = null; navigated() }
  }
  function showGrownups() {
    stop()
    if (page !== "grownups") returnPage = page
    page = "grownups"
    navigated()
  }
  function start(kind) {
    stop()
    session = Garden.begin(kind, levelId, ++serial)
    picture = Garden.blankPicture()
    feedback = ""
    hintShown = false
    page = "lesson"
    navigated()
  }
  function touch(id) {
    if (!lesson || demonstrating) return
    var next = Garden.activate(lesson, picture, id)
    if (next === picture && !lesson.trail) {
      feedback = lesson.kind === "ten" ? "This flower is already growing. Try an empty space." : lesson.kind === "join" ? "Touch a golden frog to bring a friend in." : "That frog has hopped away. Count the ones that stay."
    } else { picture = next; feedback = "" }
  }
  function performOne() { if (lesson) picture = Garden.step(lesson, picture) }
  function adjust(field, delta) {
    stop()
    if (lesson) picture = Garden.adjust(lesson, picture, field, delta)
  }
  function showMe() {
    if (!session || session.solved) return
    if (demonstrating) { demo.stop(); return }
    session = Garden.help(session)
    hintShown = true
    if (reducedMotion) {
      // One deliberate step per press makes reduced-motion demonstrations readable.
      performOne()
    } else { picture = Garden.blankPicture(); demo.start() }
  }
  function choose(value) {
    if (!session || session.solved || session.complete) return
    stop()
    var previous = session
    session = Garden.submit(session, value)
    if (previous === session) return
    if (session.solved) {
      var nextProgress = Garden.record(progress, session.answers[session.answers.length - 1])
      nextProgress.level = levelId
      saved(nextProgress)
      feedback = "You found it!"
      Qt.callLater(function() { nextButton.forceActiveFocus() })
    } else {
      hintShown = true
      feedback = "Let’s try the picture together. You can choose again."
    }
  }
  function advance() {
    if (!session || !session.solved || session.complete) return
    stop()
    session = Garden.next(session)
    if (session.complete) page = "complete"
    else { picture = Garden.blankPicture(); feedback = ""; hintShown = false }
    navigated()
  }
  function resetPicture() { stop(); picture = Garden.blankPicture(); feedback = "" }
  function saveSettings(level, reduced) {
    stop()
    var value = Garden.loadProgress(progress)
    value.level = Garden.clampLevel(level)
    value.reducedMotion = reduced
    levelId = value.level
    saved(value)
  }
  function listen() {
    if (!lesson) return
    speechText = lesson.question + ". " + lesson.steps.join(". ")
    if (speechLoader.item) {
      if (speechLoader.item.available) speechLoader.item.say(speechText)
      else feedback = "A local English voice is not available. Read this one together."
    } else {
      speechLoader.setSource(Qt.resolvedUrl("GardenSpeech.qml"))
    }
  }
  Component.onCompleted: if (initialActivity) start(initialActivity)
  Component.onDestruction: stop()
  onVisibleChanged: if (!visible) stop()
  onReducedMotionChanged: if (reducedMotion) demo.stop()
  Timer {
    id: demo
    interval: 820
    repeat: true
    onTriggered: {
      garden.performOne()
      if (Garden.pictureComplete(garden.lesson, garden.picture)) stop()
    }
  }
  Loader {
    id: speechLoader
    width: 0; height: 0
    onLoaded: {
      if (item.available) item.say(garden.speechText)
      else garden.feedback = "A local English voice is not available. Read this one together."
    }
    onStatusChanged: if (status === Loader.Error) garden.feedback = "A local English voice is not available. Read this one together."
  }

  Flow {
    width: parent.width
    spacing: Style.space(8)
    MathButton {
      width: Math.min(Style.space(190), garden.width)
      label: garden.page === "home" ? "← All math" : garden.page === "grownups" ? "← Back" : "← Math Garden"
      onTapped: garden.back()
    }
    MathButton {
      width: Math.min(Style.space(190), garden.width)
      label: garden.reducedMotion ? "Motion: gentle" : "Motion: playful"
      onTapped: garden.saveSettings(garden.levelId, !garden.reducedMotion)
    }
    MathButton {
      width: Math.min(Style.space(190), garden.width)
      label: "For grown-ups"
      onTapped: garden.showGrownups()
    }
  }

  GardenHome {
    width: parent.width
    visible: garden.page === "home"
    insideGarden: true
    onLaunchRequested: function(activity) { garden.start(activity || "count") }
  }

  Column {
    width: parent.width
    visible: garden.page === "lesson" && garden.lesson !== null
    spacing: Style.spacing.md
    Row {
      width: parent.width
      Text {
        width: parent.width - visit.width
        text: garden.activity ? garden.activity.title : "Let’s discover"
        color: Color.menu.text
        font.family: Style.font.menuFamily
        font.pixelSize: Style.font.display
        font.bold: true
        wrapMode: Text.WordWrap
      }
      Text {
        id: visit
        text: garden.session ? (garden.session.index + 1) + " of 5" : ""
        color: Color.menu.text
        opacity: 0.7
        font.family: Style.font.menuFamily
        font.pixelSize: Style.font.body
        width: Style.space(72)
        horizontalAlignment: Text.AlignRight
        topPadding: Style.space(10)
      }
    }
    Row {
      spacing: Style.space(7)
      Repeater {
        model: 5
        Rectangle {
          required property int index
          width: garden.width < Style.space(650) ? Style.space(30) : Style.space(44)
          height: Style.space(5); radius: height / 2
          color: garden.session && index <= garden.session.index ? Color.accent : Util.alpha(Color.menu.border, 0.3)
        }
      }
    }

    Grid {
      id: lessonGrid
      width: parent.width
      columns: width >= Style.space(880) ? 2 : 1
      spacing: Style.spacing.md
      Column {
        width: lessonGrid.columns === 2 ? lessonGrid.width - Style.space(300) - lessonGrid.spacing : lessonGrid.width
        spacing: Style.space(10)
        GardenBoard {
          id: board
          width: parent.width
          height: Math.max(Style.space(270), Math.min(Style.space(350), width * 0.58))
          lesson: garden.lesson
          picture: garden.picture
          reducedMotion: garden.reducedMotion
          interactive: !garden.demonstrating
          onActivated: function(tokenId) { garden.touch(tokenId) }
          onPlaced: function(pointX, pointY) {
            garden.adjust("pointX", pointX - garden.picture.pointX)
            garden.adjust("pointY", pointY - garden.picture.pointY)
          }
          onTurned: function(degrees) { garden.adjust("angle", degrees - garden.picture.angle) }
        }
        Flow {
          width: parent.width
          spacing: Style.space(8)
          visible: garden.lesson !== null && ["primes", "powers", "coordinates", "angles", "slope"].includes(garden.lesson.kind)
          Repeater {
            model: {
              if (!garden.lesson) return []
              switch (garden.lesson.kind) {
              case "primes": return [{ label: "− Row", field: "rows", delta: -1 }, { label: "+ Row", field: "rows", delta: 1 }]
              case "powers": return [{ label: "← Step", field: "stage", delta: -1 }, { label: "Grow ×" + garden.lesson.a, field: "stage", delta: 1 }]
              case "coordinates": return [{ label: "← x", field: "pointX", delta: -1 }, { label: "x →", field: "pointX", delta: 1 }, { label: "↓ y", field: "pointY", delta: -1 }, { label: "y ↑", field: "pointY", delta: 1 }]
              case "angles": return [{ label: "−15°", field: "angle", delta: -15 }, { label: "+15°", field: "angle", delta: 15 }]
              case "slope": return [{ label: "← Step", field: "walk", delta: -1 }, { label: "Step →", field: "walk", delta: 1 }]
              default: return []
              }
            }
            MathButton {
              required property var modelData
              width: Math.max(Style.space(90), (board.width - Style.space(24)) / 4)
              label: modelData.label
              enabled: garden.lesson !== null && Garden.adjust(garden.lesson, garden.picture, modelData.field, modelData.delta)[modelData.field] !== garden.picture[modelData.field]
              onTapped: garden.adjust(modelData.field, modelData.delta)
            }
          }
        }
        Text {
          width: parent.width
          text: Garden.caption(garden.lesson, garden.picture)
          color: Color.menu.text
          font.family: Style.font.menuFamily
          font.pixelSize: Style.font.body
          horizontalAlignment: Text.AlignHCenter
          wrapMode: Text.WordWrap
          Accessible.role: Accessible.StaticText
          Accessible.name: text
        }
        Row {
          width: parent.width
          spacing: Style.space(8)
          MathButton {
            width: parent.width - reset.width - parent.spacing
            label: Garden.actionLabel(garden.lesson, garden.picture)
            enabled: garden.lesson !== null && !garden.demonstrating && !Garden.pictureComplete(garden.lesson, garden.picture)
            onTapped: garden.performOne()
          }
          MathButton {
            id: reset
            width: Style.space(100)
            label: "Reset"
            onTapped: garden.resetPicture()
          }
        }
        Row {
          width: parent.width
          spacing: Style.space(8)
          MathButton {
            width: (parent.width - parent.spacing) / 2
            label: garden.demonstrating ? "Pause" : "Show me"
            enabled: garden.session !== null && !garden.session.solved
            onTapped: garden.showMe()
          }
          MathButton {
            width: (parent.width - parent.spacing) / 2
            label: "Listen"
            onTapped: garden.listen()
          }
        }
        Row {
          width: parent.width
          spacing: Style.space(8)
          visible: garden.lesson !== null && (garden.lesson.kind === "join" || garden.lesson.kind === "take")
          MathButton {
            width: (parent.width - parent.spacing) / 2
            label: "Friends hop in"
            active: garden.lesson !== null && garden.lesson.kind === "join"
            onTapped: garden.start("join")
          }
          MathButton {
            width: (parent.width - parent.spacing) / 2
            label: "Friends hop away"
            active: garden.lesson !== null && garden.lesson.kind === "take"
            onTapped: garden.start("take")
          }
        }
      }

      Rectangle {
        width: lessonGrid.columns === 2 ? Style.space(300) : lessonGrid.width
        height: questionColumn.implicitHeight + Style.space(36)
        radius: Style.cornerRadius
        color: Util.alpha(Color.accent, 0.07)
        border.color: Util.alpha(Color.menu.border, 0.3)
        Column {
          id: questionColumn
          x: Style.space(18); y: Style.space(18)
          width: parent.width - Style.space(36)
          spacing: Style.space(14)
          Text {
            width: parent.width
            text: garden.lesson ? garden.lesson.question : ""
            color: Color.menu.text
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.heading
            font.bold: true
            wrapMode: Text.WordWrap
          }
          Text {
            width: parent.width
            text: Garden.equation(garden.lesson, garden.session !== null && garden.session.solved)
            color: Color.accent
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.display
            font.bold: true
            wrapMode: Text.WordWrap
          }
          Repeater {
            model: garden.lesson ? garden.lesson.choices : []
            delegate: MathButton {
              required property var modelData
              objectName: "gardenAnswer" + modelData
              width: questionColumn.width
              label: garden.lesson && garden.lesson.choiceLabels ? garden.lesson.choiceLabels[modelData] : String(modelData) + (garden.lesson && garden.lesson.kind === "angles" ? "°" : "")
              primary: garden.session !== null && garden.session.solved && modelData === garden.lesson.answer
              enabled: garden.session !== null && !garden.session.solved
              onTapped: garden.choose(modelData)
            }
          }
          Text {
            width: parent.width
            visible: text !== ""
            text: garden.feedback
            color: Color.menu.text
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
          }
          Text {
            width: parent.width
            visible: garden.hintShown || (garden.session !== null && garden.session.solved)
            text: garden.lesson ? (garden.session.solved ? garden.lesson.explanation : garden.lesson.hint) : ""
            color: Color.menu.text
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
          }
          MathButton {
            id: nextButton
            objectName: "gardenNext"
            width: parent.width
            visible: garden.session !== null && garden.session.solved
            primary: true
            label: garden.session && garden.session.index === 4 ? "Finish this visit ✓" : "Next discovery →"
            onTapped: garden.advance()
          }
          Text {
            width: parent.width
            visible: garden.lesson !== null && !!garden.lesson.trail
            text: garden.lesson && garden.lesson.bridge ? "A stepping stone to " + garden.lesson.bridge.toLowerCase() + "." : ""
            color: Color.menu.text
            opacity: 0.65
            font.family: Style.font.menuFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.WordWrap
          }
        }
      }
    }
  }

  Column {
    width: parent.width
    visible: garden.page === "complete"
    spacing: Style.spacing.md
    Image {
      width: parent.width; height: Style.space(200)
      source: "garden/assets/welcome.jpg"
      fillMode: Image.PreserveAspectCrop
      sourceSize.width: 1200
    }
    Text {
      width: parent.width
      text: "Look what you discovered."
      color: Color.menu.text
      font.family: Style.font.menuFamily
      font.pixelSize: Style.font.display
      font.bold: true
      wrapMode: Text.WordWrap
    }
    Text {
      width: parent.width
      text: "Five little discoveries. A lovely place to pause.\nShow someone a picture and tell them how you figured it out."
      color: Color.menu.text
      font.family: Style.font.menuFamily
      font.pixelSize: Style.font.body
      wrapMode: Text.WordWrap
    }
    MathButton { width: parent.width; label: "Back to the garden"; primary: true; onTapped: garden.back() }
    MathButton { width: parent.width; label: "All done for now"; onTapped: garden.homeRequested() }
  }

  Column {
    width: parent.width
    visible: garden.page === "grownups"
    spacing: Style.spacing.md
    Text {
      width: parent.width
      text: "Room to grow"
      color: Color.menu.text
      font.family: Style.font.menuFamily
      font.pixelSize: Style.font.display
      font.bold: true
    }
    Text {
      width: parent.width
      text: "Choose a comfortable range for the next visit. Every activity is available. These observations record exploration, not mastery or a test score."
      color: Color.menu.text
      font.family: Style.font.menuFamily
      font.pixelSize: Style.font.body
      wrapMode: Text.WordWrap
    }
    Flow {
      width: parent.width
      spacing: Style.space(8)
      Repeater {
        model: ["Small steps", "Growing confidence", "A bigger stretch"]
        MathButton {
          required property int index
          required property string modelData
          width: Math.min(Style.space(260), garden.width)
          label: modelData
          active: garden.levelId === index + 1
          onTapped: garden.saveSettings(index + 1, garden.reducedMotion)
        }
      }
    }
    Repeater {
      model: Garden.activities().concat([{ id: "take", title: "Frogs hop away" }])
      Text {
        required property var modelData
        width: garden.width
        text: {
          var entry = garden.progress.activities[modelData.id] || { solved: 0, supported: 0 }
          return modelData.title + " · " + entry.solved + " explored · " + entry.supported + " with support"
        }
        color: Color.menu.text
        font.family: Style.font.menuFamily
        font.pixelSize: Style.font.body
        wrapMode: Text.WordWrap
      }
    }
  }
}
