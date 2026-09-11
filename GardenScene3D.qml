pragma ComponentBehavior: Bound
import QtQuick
import QtQuick3D

View3D {
  id: gardenViewport
  required property var board
  objectName: "gardenScene3D"
  // Offscreen compositing keeps the viewport correctly clipped by the shell.
  renderMode: View3D.Offscreen
  camera: OrthographicCamera {
    z: 1000
    clipNear: 1
    clipFar: 2000
    horizontalMagnification: 1
    verticalMagnification: 1
  }
  environment: SceneEnvironment {
    backgroundMode: SceneEnvironment.Transparent
    antialiasingMode: SceneEnvironment.MSAA
    antialiasingQuality: SceneEnvironment.High
  }
  DirectionalLight {
    eulerRotation: Qt.vector3d(-25, -30, 0)
    color: "#fff3d8"
    ambientColor: "#8b9691"
    brightness: 1.2
  }
  DirectionalLight {
    eulerRotation: Qt.vector3d(20, 130, 0)
    color: "#c8e1ee"
    brightness: 0.5
  }
  Repeater3D {
    model: gardenViewport.board.tokens.count
    delegate: Node {
      id: actor
      required property int index
      readonly property var button: gardenViewport.board.tokens.itemAt(index)
      visible: button !== null && button.visible && !button.empty
      x: button ? button.x + button.width / 2 - gardenViewport.width / 2 : 0
      y: button ? gardenViewport.height / 2 - button.y - button.height / 2 + button.lift : 0
      opacity: button && button.removed ? 0.28 : 1
      GardenToken3D {
        kind: gardenViewport.board.lesson.kind
        gold: actor.button ? actor.button.gold : false
        tower: actor.button ? actor.button.placement.tower : false
        unit: actor.button ? actor.button.placement.size * (actor.button.removed ? 0.7 : 1) : 0
      }
    }
  }
}
