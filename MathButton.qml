import QtQuick
import qs.Commons

Rectangle {
  id: control
  property string label: ""
  property string hint: ""
  property bool primary: false
  property bool active: false
  signal tapped
  // Qt already excludes hidden and disabled items from the tab chain.
  activeFocusOnTab: true
  implicitHeight: Math.max(Style.space(52), copy.implicitHeight + Style.space(24))
  radius: Style.cornerRadius
  color: primary || active || mouse.containsMouse ? Color.menu.selectedBackground : "transparent"
  border.width: activeFocus ? Math.max(2, Style.space(3)) : Style.normalBorderWidth
  border.color: activeFocus ? Color.accent : Util.alpha(Color.menu.border, enabled ? 0.65 : 0.2)
  opacity: enabled ? 1 : 0.45
  Accessible.role: Accessible.Button
  Accessible.name: label
  Accessible.description: hint
  Accessible.onPressAction: if (enabled)
    tapped()
  Keys.onReturnPressed: function (event) {
    if (!event.isAutoRepeat)
      tapped()
  }
  Keys.onEnterPressed: function (event) {
    if (!event.isAutoRepeat)
      tapped()
  }
  Keys.onSpacePressed: function (event) {
    if (!event.isAutoRepeat)
      tapped()
  }
  onActiveFocusChanged: {
    if (!activeFocus)
      return
    // Keep keyboard focus in view inside the overlay's Flickable.
    var ancestor = parent
    while (ancestor) {
      if (typeof ancestor.ensureVisible === "function") {
        ancestor.ensureVisible(control)
        break
      }
      ancestor = ancestor.parent
    }
  }
  Column {
    id: copy
    anchors.centerIn: parent
    width: parent.width - Style.space(24)
    spacing: Style.spacing.labelGap
    Text {
      width: parent.width
      text: control.label
      color: control.primary || control.active || mouse.containsMouse ? Color.menu.selectedText : Color.menu.text
      font.family: Style.font.menuFamily
      font.pixelSize: Style.font.title
      font.bold: control.primary
      horizontalAlignment: Text.AlignHCenter
      wrapMode: Text.WordWrap
    }
    Text {
      width: parent.width
      visible: control.hint !== ""
      text: control.hint
      color: control.primary || control.active || mouse.containsMouse ? Color.menu.selectedText : Color.menu.text
      opacity: 0.8
      font.family: Style.font.menuFamily
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
    onClicked: {
      control.forceActiveFocus()
      control.tapped()
    }
  }
}
