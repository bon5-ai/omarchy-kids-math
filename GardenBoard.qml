import QtQuick
import qs.Commons
import "GardenEngine.js" as Garden

Rectangle {
  id: board
  objectName: "gardenBoard"
  required property var lesson
  required property var picture
  property bool reducedMotion: false
  property bool interactive: true
  property bool use3D: true
  property url sceneSource: Qt.resolvedUrl("GardenScene3D.qml")
  property alias tokens: tokens
  readonly property bool rendering3D: sceneLoader.status === Loader.Ready
  signal activated(int tokenId)
  signal placed(int pointX, int pointY)
  signal turned(int degrees)
  radius: Style.cornerRadius
  color: lesson && (lesson.kind === "join" || lesson.kind === "take") ? "#dcebea" : "#eaf0de"
  clip: true

  // Quiet landscape shapes frame the counters without competing with quantities.
  Rectangle {
    x: parent.width * 0.03; y: parent.height * 0.73
    width: parent.width * 0.94; height: parent.height * 0.22
    radius: width / 2
    color: board.lesson && (board.lesson.kind === "join" || board.lesson.kind === "take") ? "#c5deda" : "#d9e5c8"
  }
  Rectangle {
    x: parent.width * 0.65; y: -32
    width: 145; height: 100; radius: 70
    color: "#f6f4d8"; opacity: 0.55
  }

  TrailDiagram {
    anchors.fill: parent
    lesson: board.lesson
    picture: board.picture
  }
  MouseArea {
    anchors.fill: parent
    enabled: board.interactive && board.lesson !== null && (board.lesson.kind === "coordinates" || board.lesson.kind === "angles")
    onClicked: function(mouse) {
      if (board.lesson.kind === "coordinates") {
        var g = Garden.graph(board.lesson, board.width, board.height)
        board.placed(Math.max(0, Math.min(5, Math.round((mouse.x - g.left) / g.unit))), Math.max(0, Math.min(5, Math.round((g.bottom - mouse.y) / g.unit))))
      } else {
        var angle = Math.atan2(board.height - 43 - mouse.y, mouse.x - board.width / 2) * 180 / Math.PI
        board.turned(Math.max(0, Math.min(180, Math.round(angle / 15) * 15)))
      }
    }
  }
  Repeater {
    id: tokens
    model: Garden.tokenCount(board.lesson)
    delegate: Rectangle {
      id: token
      required property int index
      objectName: "gardenToken" + index
      readonly property var placement: Garden.layout(board.lesson, board.picture, index, board.width, board.height)
      readonly property bool gold: board.lesson.trail ? selected : (board.lesson.kind === "join" || board.lesson.kind === "ten") && index >= board.lesson.a
      readonly property bool empty: board.lesson.kind === "ten" && index >= board.lesson.a && !board.picture.filled.includes(index)
      readonly property bool removed: board.lesson.kind === "take" && board.picture.moved.includes(index)
      readonly property int countOrder: board.picture.marked.indexOf(index)
      readonly property bool selected: countOrder >= 0 || board.picture.filled.includes(index) || board.picture.moved.includes(index)
      property real lift: 0
      visible: Garden.tokenVisible(board.lesson, board.picture, index)
      x: placement.x - width / 2
      y: placement.y - height / 2
      width: placement.size * 1.14
      height: placement.size * (placement.tower ? 2.8 : 1.22)
      radius: board.lesson.kind === "ten" ? 12 : width / 3
      color: board.lesson.kind === "ten" ? (empty ? "#c9d7b8" : "#f3f4e7") : hover.containsMouse ? "#40ffffff" : "transparent"
      border.width: activeFocus ? 3 : board.lesson.kind === "ten" ? 1 : 0
      border.color: activeFocus ? "#30584d" : "#afc19b"
      activeFocusOnTab: true
      enabled: board.interactive && board.lesson.kind !== "coordinates" && board.lesson.kind !== "slope"
      Accessible.role: Accessible.Button
      Accessible.name: Garden.tokenLabel(board.lesson, board.picture, index)
      Accessible.checkable: true
      Accessible.checked: selected
      Accessible.onPressAction: if (enabled) board.activated(index)
      Keys.onReturnPressed: function(event) { if (!event.isAutoRepeat) board.activated(index) }
      Keys.onEnterPressed: function(event) { if (!event.isAutoRepeat) board.activated(index) }
      Keys.onSpacePressed: function(event) { if (!event.isAutoRepeat) board.activated(index) }
      onActiveFocusChanged: if (activeFocus) {
        var ancestor = parent
        while (ancestor) {
          if (typeof ancestor.ensureVisible === "function") { ancestor.ensureVisible(token); break }
          ancestor = ancestor.parent
        }
      }
      Behavior on x { enabled: !board.reducedMotion; NumberAnimation { duration: 440; easing.type: Easing.InOutCubic } }
      Behavior on y { enabled: !board.reducedMotion; NumberAnimation { duration: 440; easing.type: Easing.InOutCubic } }
      onSelectedChanged: if (selected && !board.reducedMotion) hop.restart()
      SequentialAnimation {
        id: hop
        NumberAnimation { target: token; property: "lift"; to: 12; duration: 140; easing.type: Easing.OutQuad }
        NumberAnimation { target: token; property: "lift"; to: 0; duration: 210; easing.type: Easing.InQuad }
      }
      Connections {
        target: board
        function onReducedMotionChanged() { if (board.reducedMotion) { hop.stop(); token.lift = 0 } }
      }
      Rectangle {
        anchors.horizontalCenter: parent.horizontalCenter
        y: parent.height * 0.74
        width: parent.width * 0.7; height: 8; radius: width / 2
        color: "#1935472d"
        visible: !token.empty
      }
      GardenPicture {
        anchors.centerIn: parent
        anchors.verticalCenterOffset: -token.lift
        width: token.placement.size
        height: token.placement.size * (token.placement.tower ? 2.8 : 1)
        kind: board.lesson.kind
        gold: token.gold
        tower: token.placement.tower
        visible: !board.rendering3D && !token.empty
        opacity: token.removed ? 0.3 : 1
      }
      Text {
        anchors.centerIn: parent
        text: "+"
        color: "#51684a"
        font.pixelSize: 28
        visible: token.empty
      }
      MouseArea {
        id: hover
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: { token.forceActiveFocus(); board.activated(token.index) }
      }
    }
  }
  Loader {
    id: sceneLoader
    anchors.fill: parent
    active: board.visible && board.use3D && board.GraphicsInfo.api !== GraphicsInfo.Software && board.GraphicsInfo.api !== GraphicsInfo.Unknown
    onActiveChanged: if (active) setSource(board.sceneSource, { board: board })
    Component.onCompleted: if (active) setSource(board.sceneSource, { board: board })
    // The View3D remains a separate file so an absent QtQuick3D import cannot
    // prevent the plugin (including assessments) from loading.
  }
  // Badges are above the composited 3D image; input stays with the same tokens.
  Repeater {
    model: tokens.count
    delegate: Rectangle {
      required property int index
      readonly property var token: tokens.itemAt(index)
      visible: token !== null && (token.countOrder >= 0 || token.removed)
      x: token ? token.x + token.width / 2 - width / 2 : 0
      y: token ? token.y + token.height - height * 0.65 : 0
      width: 32; height: 28; radius: 14
      color: "#30584d"
      Text {
        anchors.centerIn: parent
        text: parent.token ? (parent.token.removed ? "↗" : Garden.counted(board.lesson, board.picture, parent.token.countOrder + 1)) : ""
        color: "#fff9e9"
        font.family: Style.font.menuFamily
        font.pixelSize: 16
        font.bold: true
      }
    }
  }
}
