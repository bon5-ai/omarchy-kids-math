import QtQuick
import qs.Ui

BarWidget {
  id: root
  moduleName: "omarchykids.math"

  property var shell: null
  property var manifest: null

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  function pluginId() {
    return (root.manifest && root.manifest.id) || "omarchykids.math"
  }

  function toggleOverlay() {
    var id = root.pluginId()
    if (root.bar && root.bar.shell && typeof root.bar.shell.toggle === "function")
      root.bar.shell.toggle(id, "{}")
    else if (root.shell && typeof root.shell.toggle === "function")
      root.shell.toggle(id, "{}")
    else if (root.bar && typeof root.bar.run === "function")
      root.bar.run("omarchy-shell shell toggle " + id)
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "1+1"
    tooltipText: "Kids math"
    onPressed: function (buttonCode) {
      if (buttonCode === Qt.LeftButton) root.toggleOverlay()
    }
  }
}
