import QtQuick

// Native canvas artwork for systems without the Quick 3D module or GPU backend.
Canvas {
  id: picture
  property string kind: "count"
  property bool gold: false
  property bool tower: false
  onKindChanged: requestPaint()
  onGoldChanged: requestPaint()
  onTowerChanged: requestPaint()
  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onPaint: {
    var ctx = getContext("2d")
    ctx.reset()
    ctx.translate(width / 2, height / 2)
    var unit = Math.min(width, height / (tower ? 2.8 : 1)) / 100
    ctx.scale(unit, unit)
    function oval(color, x, y, w, h, angle) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle || 0)
      ctx.scale(w, h); ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill(); ctx.restore()
    }
    function block(x, y, color, h) {
      ctx.fillStyle = color; ctx.fillRect(x - 25, y - h / 2, 44, h)
      ctx.fillStyle = "#d8e8de"; ctx.beginPath(); ctx.moveTo(x - 25, y - h / 2)
      ctx.lineTo(x - 16, y - h / 2 - 7); ctx.lineTo(x + 28, y - h / 2 - 7)
      ctx.lineTo(x + 19, y - h / 2); ctx.closePath(); ctx.fill()
      ctx.fillStyle = "#527f87"; ctx.beginPath(); ctx.moveTo(x + 19, y - h / 2)
      ctx.lineTo(x + 28, y - h / 2 - 7); ctx.lineTo(x + 28, y + h / 2 - 7)
      ctx.lineTo(x + 19, y + h / 2); ctx.closePath(); ctx.fill()
    }
    if (kind === "count") {
      oval("#d95145", -12, 0, 57, 67); oval("#ec6650", 12, 0, 57, 67)
      ctx.fillStyle = "#75442b"; ctx.fillRect(-3, -50, 7, 25)
      oval("#71a758", 17, -44, 37, 13, -0.4); oval("#ffc5a1", -19, -15, 10, 19, 0.4)
    } else if (kind === "join" || kind === "take") {
      var color = gold ? "#e9b94d" : "#5faa8b"
      oval("#739d68", 0, 32, 112, 20); oval(color, 0, 3, 77, 60)
      oval("#f8e8b4", 0, 11, 46, 34)
      for (var side = -1; side <= 1; side += 2) {
        oval(color, side * 23, -23, 35, 38); oval("#fff8de", side * 23, -25, 21, 23)
        oval("#233f36", side * 23, -24, 9.5, 14); oval(color, side * 35, 28, 35, 17)
        oval("#ea9873", side * 30, -3, 12, 7)
      }
      oval("#475348", 0, -1, 15, 3.5)
    } else if (kind === "ten") {
      ctx.fillStyle = "#6d9654"; ctx.fillRect(-3, -12, 6, 56)
      oval("#83b467", 17, 22, 36, 14, -0.4)
      for (var petal = 0; petal < 5; petal++) {
        var angle = petal * Math.PI * 2 / 5
        oval(gold ? "#f3c56a" : "#d7bee5", Math.sin(angle) * 23, -13 - Math.cos(angle) * 23, 33, 34)
      }
      oval("#cb893d", 0, -13, 25, 25)
    } else if (kind === "parity" || kind === "coordinates" || kind === "slope") {
      oval(gold ? "#eab859" : "#7ca9a1", 0, 0, 55, 55)
      oval("#dce9d3", -10, -12, 12, 10)
    } else {
      for (var b = 0; b < (tower ? 10 : 1); b++) block(0, tower ? 108 - b * 24 : 0, tower ? (b % 2 ? "#8cb7ca" : "#71a0b8") : kind !== "tens" && !gold ? "#7ca9a1" : "#efbd63", tower ? 22 : 48)
    }
  }
}
