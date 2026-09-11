import QtQuick
import "GardenEngine.js" as Garden

Canvas {
  id: diagram
  required property var lesson
  required property var picture
  onLessonChanged: requestPaint()
  onPictureChanged: requestPaint()
  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onPaint: {
    var ctx = getContext("2d")
    ctx.reset()
    if (!lesson || !lesson.trail) return
    ctx.font = "15px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    function line(x1, y1, x2, y2, color, weight) {
      ctx.strokeStyle = color; ctx.lineWidth = weight || 1
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    }
    if (lesson.kind === "coordinates" || lesson.kind === "slope") {
      var g = Garden.graph(lesson, width, height)
      for (var x = 0; x <= g.maxX; x++) {
        var px = g.left + x * g.unit
        line(px, g.bottom, px, g.bottom - g.maxY * g.unit, "#becdb9", 1)
        ctx.fillStyle = "#385748"; ctx.fillText(String(x), px, g.bottom + 18)
      }
      for (var y = 0; y <= g.maxY; y++) {
        var py = g.bottom - y * g.unit
        line(g.left, py, g.left + g.maxX * g.unit, py, "#becdb9", 1)
        ctx.fillStyle = "#385748"; ctx.fillText(String(y), g.left - 18, py)
      }
      line(g.left, g.bottom, g.left + g.maxX * g.unit, g.bottom, "#466553", 2)
      line(g.left, g.bottom, g.left, g.bottom - g.maxY * g.unit, "#466553", 2)
      ctx.fillStyle = "#385748"
      ctx.fillText("x", g.left + g.maxX * g.unit + 18, g.bottom)
      ctx.fillText("y", g.left, g.bottom - g.maxY * g.unit - 18)
      var tx = g.left + lesson.a * g.unit, ty = g.bottom - lesson.b * g.unit
      if (lesson.kind === "slope") {
        line(g.left, g.bottom, tx, ty, "#729b81", 4)
        for (var step = 0; step < picture.walk; step++) {
          var sx = g.left + step * g.unit, sy = g.bottom - step * lesson.answer * g.unit
          line(sx, sy, sx + g.unit, sy, "#b88437", 3)
          line(sx + g.unit, sy, sx + g.unit, sy - lesson.answer * g.unit, "#437f99", 3)
        }
      }
      ctx.strokeStyle = "#ad762f"; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(tx, ty, 12, 0, 2 * Math.PI); ctx.stroke()
      ctx.fillStyle = "#ad762f"; ctx.fillText("✦", tx, ty)
    } else if (lesson.kind === "angles") {
      var cx = width / 2, cy = height - 43, radius = Math.min(width * 0.39, height - 80)
      for (var degree = 0; degree <= 180; degree += 15) {
        var angle = degree * Math.PI / 180
        line(cx + Math.cos(angle) * (radius - 6), cy - Math.sin(angle) * (radius - 6), cx + Math.cos(angle) * radius, cy - Math.sin(angle) * radius, "#8ca289", 2)
        if (degree % 30 === 0) { ctx.fillStyle = "#385748"; ctx.fillText(degree + "°", cx + Math.cos(angle) * (radius + 20), cy - Math.sin(angle) * (radius + 20)) }
      }
      var target = lesson.a * Math.PI / 180, current = picture.angle * Math.PI / 180
      ctx.fillStyle = "#407dad88"; ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, radius * 0.56, -current, 0); ctx.closePath(); ctx.fill()
      line(cx, cy, cx + radius, cy, "#527563", 3)
      for (var dash = 0; dash < 12; dash++) {
        line(cx + Math.cos(target) * radius * dash / 12, cy - Math.sin(target) * radius * dash / 12, cx + Math.cos(target) * radius * (dash + 0.5) / 12, cy - Math.sin(target) * radius * (dash + 0.5) / 12, "#ad762f", 4)
      }
      line(cx, cy, cx + Math.cos(current) * radius * 0.9, cy - Math.sin(current) * radius * 0.9, "#376d63", 5)
      ctx.fillStyle = "#376d63"; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill()
    } else if (lesson.kind === "parity") {
      for (var id = 0; id < lesson.a; id += 2) {
        var p = Garden.layout(lesson, picture, id, width, height)
        var end = Garden.layout(lesson, picture, id + 1, width, height)
        line(p.x, p.y, end.x, end.y, "#b6c8a8", 3)
        if (id + 1 === lesson.a) {
          ctx.strokeStyle = "#a6b697"; ctx.lineWidth = 2
          ctx.beginPath(); ctx.arc(end.x, end.y, p.size * 0.35, 0, Math.PI * 2); ctx.stroke()
        }
      }
    } else if (lesson.kind === "area") {
      var first = Garden.layout(lesson, picture, 0, width, height), gap = first.size / 0.83
      var left = first.x - gap / 2, top = first.y - gap / 2
      for (var col = 0; col <= lesson.a; col++) line(left + col * gap, top, left + col * gap, top + lesson.b * gap, "#a5b999", 1)
      for (var row = 0; row <= lesson.b; row++) line(left, top + row * gap, left + lesson.a * gap, top + row * gap, "#a5b999", 1)
      ctx.fillStyle = "#385748"
      ctx.fillText(lesson.a + " units", width / 2, top - 15)
      ctx.fillText(lesson.b + " rows", width / 2, top + lesson.b * gap + 18)
    }
  }
}
