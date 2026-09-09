import QtQuick
import qs.Commons

// A stable arrangement makes quantity visible. Optional touch-to-count markers
// let a beginning reader keep track without moving the objects around.
Item {
  id: field
  property int count: 0
  property int columns: 5
  property bool touchToCount: false
  property int crossedOut: 0
  property var marked: []
  property color ink: Color.accent
  readonly property real cell: Math.min(Style.space(30), width / Math.max(1, columns))
  implicitHeight: Math.max(1, Math.ceil(count / Math.max(1, columns))) * cell
  onCountChanged: marked = []
  Accessible.role: Accessible.StaticText
  Accessible.name: count + " counters" + (crossedOut ? ", " + crossedOut + " crossed out" : "")
  function reset() {
    marked = []
  }
  Grid {
    anchors.horizontalCenter: parent.horizontalCenter
    columns: Math.max(1, field.columns)
    Repeater {
      model: Math.max(0, Math.min(400, field.count))
      delegate: Item {
        required property int index
        width: field.cell
        height: field.cell
        Rectangle {
          anchors.centerIn: parent
          width: parent.width * 0.75
          height: width
          radius: width / 2
          color: index >= field.count - field.crossedOut ? "transparent" : field.marked.indexOf(index) >= 0 ? Color.menu.selectedBackground : field.ink
          border.color: field.ink
          border.width: 1
          Text {
            anchors.centerIn: parent
            text: index >= field.count - field.crossedOut ? "×" : field.marked.indexOf(index) >= 0 ? String(field.marked.indexOf(index) + 1) : ""
            color: index >= field.count - field.crossedOut ? field.ink : Color.menu.selectedText
            font.pixelSize: Math.max(10, field.cell * 0.45)
          }
        }
        MouseArea {
          anchors.fill: parent
          enabled: field.touchToCount
          onClicked: if (field.marked.indexOf(index) < 0)
            field.marked = field.marked.concat([index])
        }
      }
    }
  }
}
