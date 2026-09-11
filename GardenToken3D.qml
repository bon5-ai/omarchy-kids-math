import QtQuick
import QtQuick3D
import "GardenEngine.js" as Garden

Node {
  id: token
  property string kind: "count"
  property bool gold: false
  property bool tower: false
  property real unit: 70
  scale: Qt.vector3d(unit / 100, unit / 100, unit / 100)
  eulerRotation.y: kind === "tens" ? 16 : 0
  Model {
    visible: token.kind === "count"
    source: "#Rectangle"
    scale: Qt.vector3d(1.08, 1.08, 1)
    materials: PrincipledMaterial {
      lighting: PrincipledMaterial.NoLighting
      alphaMode: PrincipledMaterial.Blend
      baseColorMap: Texture {
        source: "garden/assets/apple-realistic.png"
        generateMipmaps: true
      }
    }
  }
  Repeater3D {
    model: token.kind === "count" ? [] : Garden.parts(token.kind, token.gold, token.tower)
    delegate: Model {
      id: piece
      required property var modelData
      source: modelData.box ? "#Cube" : "#Sphere"
      position: Qt.vector3d(modelData.x, modelData.y, modelData.z)
      scale: Qt.vector3d(modelData.sx, modelData.sy, modelData.sz)
      eulerRotation.z: modelData.rotation
      materials: PrincipledMaterial {
        baseColor: piece.modelData.color
        roughness: 0.68
        metalness: 0
      }
    }
  }
}
