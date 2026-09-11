import QtQuick
import qs.Commons
import "GardenEngine.js" as Garden

Column {
  id: garden
  spacing: Style.spacing.md
  property bool insideGarden: false
  signal launchRequested(string activity)

  Rectangle {
    width: parent.width
    height: Style.space(205)
    radius: Style.cornerRadius
    clip: true
    color: Color.menu.background

    Image {
      anchors.right: parent.right
      anchors.top: parent.top
      anchors.bottom: parent.bottom
      width: parent.width * 0.65
      source: "garden/assets/welcome.jpg"
      fillMode: Image.PreserveAspectCrop
      horizontalAlignment: Image.AlignRight
      sourceSize.width: 1200
    }
    Rectangle {
      anchors.fill: parent
      gradient: Gradient {
        orientation: Gradient.Horizontal
        GradientStop { position: 0; color: Color.menu.background }
        GradientStop { position: 0.37; color: Util.alpha(Color.menu.background, 0.92) }
        GradientStop { position: 0.85; color: "transparent" }
      }
    }
    Column {
      anchors.left: parent.left
      anchors.verticalCenter: parent.verticalCenter
      anchors.leftMargin: Style.space(22)
      width: parent.width * 0.63
      spacing: Style.space(8)
      Text {
        width: parent.width
        text: "Small steps.\nBig discoveries."
        color: Color.menu.text
        font.family: Style.font.menuFamily
        font.pixelSize: Style.font.display
        font.bold: true
        wrapMode: Text.WordWrap
      }
      Text {
        width: parent.width
        text: "Touch, count, and play your way to ‘I can do it!’"
        color: Color.menu.text
        font.family: Style.font.menuFamily
        font.pixelSize: Style.font.bodySmall
        wrapMode: Text.WordWrap
      }
    }
  }

  MathButton {
    width: parent.width
    primary: true
    label: "Explore Math Garden →"
    visible: !garden.insideGarden
    hint: "Picture adventures for ages 5–8 · touch, count, discover"
    onTapped: garden.launchRequested("")
  }

  Grid {
    id: activities
    width: parent.width
    columns: width < Style.space(700) ? 2 : 4
    columnSpacing: Style.space(12)
    rowSpacing: Style.space(12)
    Repeater {
      model: [
        { key: "count", title: "Apple orchard", hint: "Count one by one", art: "apples" },
        { key: "join", title: "Frog pond", hint: "Add & take away", art: "pond" },
        { key: "ten", title: "Make-ten meadow", hint: "Find the missing part", art: "meadow" },
        { key: "tens", title: "Tiny town", hint: "Build tens & ones", art: "town" }
      ]
      delegate: MathButton {
        id: activity
        required property var modelData
        width: (activities.width - (activities.columns - 1) * activities.columnSpacing) / activities.columns
        height: Style.space(172)
        label: modelData.title
        hint: modelData.hint
        // MathButton supplies focus, keyboard, scrolling and accessible actions.
        // Its copy is placed below the generated picture with topContentHeight.
        topContentHeight: Style.space(88)
        Image {
          x: Style.space(5)
          y: Style.space(5)
          width: parent.width - Style.space(10)
          height: Style.space(82)
          source: "garden/assets/" + activity.modelData.art + ".jpg"
          fillMode: Image.PreserveAspectCrop
          sourceSize.width: 400
        }
        onTapped: garden.launchRequested(modelData.key)
      }
    }
  }

  Text {
    width: parent.width
    text: "See it. Try it. Make sense of it.\nAnimated objects, little steps, and all the time you need."
    color: Color.menu.text
    opacity: 0.75
    font.family: Style.font.menuFamily
    font.pixelSize: Style.font.bodySmall
    wrapMode: Text.WordWrap
    horizontalAlignment: Text.AlignHCenter
  }

  Text {
    width: parent.width
    text: "The Discovery Trail"
    color: Color.menu.text
    font.family: Style.font.menuFamily
    font.pixelSize: Style.font.heading
    font.bold: true
  }
  Text {
    width: parent.width
    text: "Seven stepping stones from number patterns to shapes, graphs, and change. Start wherever curiosity takes you."
    color: Color.menu.text
    opacity: 0.8
    font.family: Style.font.menuFamily
    font.pixelSize: Style.font.body
    wrapMode: Text.WordWrap
  }
  Grid {
    id: trail
    width: parent.width
    columns: width < Style.space(580) ? 1 : width < Style.space(900) ? 2 : 3
    spacing: Style.space(12)
    Repeater {
      model: Garden.activities().filter(function(a) { return a.trail })
      MathButton {
        required property var modelData
        width: (trail.width - (trail.columns - 1) * trail.spacing) / trail.columns
        label: modelData.trail + " · " + modelData.title
        hint: modelData.skill
        onTapped: garden.launchRequested(modelData.id)
      }
    }
  }
}
