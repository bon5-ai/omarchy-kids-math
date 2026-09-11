#!/usr/bin/env python3
"""Qt smoke tests with in-memory stand-ins for Omarchy/Quickshell services.

Requires PySide6 (development only). No live shell or progress file is touched.
Only the three Wayland attached-property lines are removed from the test copy;
all UI, JavaScript, signals, timers, input handling, and layout run in Qt Quick.
"""
import argparse
import os
from pathlib import Path
import tempfile
import shutil
import sys
import re

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
from PySide6.QtCore import QUrl, Qt, qInstallMessageHandler, QObject, QPointF
from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlEngine, QQmlComponent, QQmlExpression
from PySide6.QtTest import QTest
from PySide6.QtQuick import QQuickWindow, QSGRendererInterface

parser = argparse.ArgumentParser()
parser.add_argument("--screenshots", type=Path)
parser.add_argument("--screenshot-filter", default="", help="Comma-separated capture names; empty captures all")
parser.add_argument("--preview", type=Path, help="Optional marketplace preview image path")
parser.add_argument("--renderer", choices=("software", "opengl"), default="software")
parser.add_argument("--missing-3d", action="store_true")
parser.add_argument("--light-theme", action="store_true")
args = parser.parse_args()
QQuickWindow.setGraphicsApi(QSGRendererInterface.Software if args.renderer == "software" else QSGRendererInterface.OpenGL)
repo = Path(__file__).resolve().parent.parent
app = QGuiApplication([])
warnings = []
expected_warnings = []
def failure(kind, value, traceback):
    if warnings:
        print("\n".join(warnings), file=sys.stderr)
    sys.__excepthook__(kind, value, traceback)
sys.excepthook = failure
def log(kind, context, message):
    if args.missing_3d and ("MissingQtQuick3D" in message or "GardenScene3D.qml" in message):
        expected_warnings.append(message)
        return
    if "file:" in message or "Error" in message or "Cannot" in message:
        warnings.append(message)
qInstallMessageHandler(log)

with tempfile.TemporaryDirectory(prefix="kids-math-qml-") as directory:
    base = Path(directory)
    shutil.copytree(repo / "garden" / "assets", base / "garden" / "assets")
    for source in list(repo.glob("*.qml")) + list(repo.glob("*.js")):
        content = source.read_text()
        if source.name == "Overlay.qml":
            content = "\n".join(line for line in content.splitlines() if "WlrLayershell." not in line)
        if args.missing_3d and source.name == "GardenScene3D.qml":
            content = content.replace("import QtQuick3D", "import MissingQtQuick3D")
        (base / source.name).write_text(content)

    def module(name, files, singletons=()):
        folder = base / name.replace(".", "/")
        folder.mkdir(parents=True)
        entries = ["module " + name]
        for typename, body in files.items():
            if args.light_theme and typename == "Color":
                body = body.replace('"#13222d"', '"#f5f3ea"').replace('"#eff5ef"', '"#233e36"').replace('"#b6e2a1"', '"#376e58"')
            singleton = typename in singletons
            entries.append(("singleton " if singleton else "") + typename + " 1.0 " + typename + ".qml")
            (folder / (typename + ".qml")).write_text(("pragma Singleton\n" if singleton else "") + body)
        (folder / "qmldir").write_text("\n".join(entries))

    module("qs.Commons", {
        "Style": '''import QtQuick
QtObject {
 property var font: ({menuFamily: "DejaVu Sans", title: 20, body: 18, bodySmall: 14, heading: 26, display: 32, displayLarge: 44})
 property var spacing: ({panelPadding: 24, sm: 10, md: 16, labelGap: 6, controlPaddingY: 12})
 property int cornerRadius: 12
 property int normalBorderWidth: 1
 property int gapsOut: 16
 function space(value) { return value }
}''',
        "Color": '''import QtQuick
QtObject {
 property var menu: ({background: "#13222d", text: "#eff5ef", border: "#80999a", scrim: "#dd071017", selectedBackground: "#b6e2a1", selectedText: "#13222d"})
 property color accent: "#b6e2a1"
}''',
        "Util": '''import QtQuick
QtObject { function alpha(color, opacity) { return Qt.rgba(color.r, color.g, color.b, opacity) } }''',
        "Border": '''import QtQuick
QtObject { function surfaceSpec() { return {} } }''',
    }, ("Style", "Color", "Util", "Border"))
    module("qs.Ui", {
        "BorderSurface": '''import QtQuick
Rectangle {
 property var borderSpec
 property int padding: 24
 property int contentTopInset: padding
 property int contentRightInset: padding
 property int contentBottomInset: padding
 property int contentLeftInset: padding
}''',
    })
    module("Quickshell", {
        "Quickshell": '''import QtQuick
QtObject { function env(name) { return "/tmp/kids-math-test-unused" } }''',
        "ExclusionMode": '''import QtQuick
QtObject { enum Mode { Ignore } }''',
        "PanelWindow": '''import QtQuick
import QtQuick.Window
Window {
 width: 1280; height: 800
 property int exclusionMode
 component Edges: QtObject { property bool top; property bool bottom; property bool left; property bool right }
 property Edges anchors: Edges {}
}''',
    }, ("Quickshell", "ExclusionMode"))
    # Exercise the speech UI without a system daemon or audio output. The actual
    # optional GardenSpeech.qml component still loads and selects its voice.
    module("QtTextToSpeech", {
        "TextToSpeech": '''import QtQuick
QtObject {
 enum State { Ready, Speaking, Paused, Error }
 property string engine
 property real rate: 0
 property int state: TextToSpeech.Ready
 property var voice
 property string lastSpoken: ""
 function availableEngines() { return ["speechd"] }
 function findVoices(criteria) { return [{name: "Local test voice"}] }
 function say(text) { lastSpoken = text; state = TextToSpeech.Speaking }
 function stop() { lastSpoken = ""; state = TextToSpeech.Ready }
}''',
    })
    module("Quickshell.Wayland", {"Placeholder": "import QtQuick\nQtObject {}"})
    module("Quickshell.Io", {
        "FileView": '''import QtQuick
QtObject {
 objectName: "progressFile"
 property string path
 property bool watchChanges
 property bool atomicWrites
 property bool printErrors
 property int writes: 0
 property string savedText: ""
 signal loaded()
 signal loadFailed()
 signal fileChanged()
 function text() { return "{}" }
 function setText(value) { writes++; savedText = value }
 function reload() {}
 Component.onCompleted: loaded()
}''',
    })
    engine = QQmlEngine()
    engine.addImportPath(str(base))
    component = QQmlComponent(engine, QUrl.fromLocalFile(str(base / "Overlay.qml")))
    if component.isError():
        raise AssertionError("\n".join(error.toString() for error in component.errors()))
    root = component.create()
    assert root, "\n".join(error.toString() for error in component.errors())
    host = QQuickWindow()
    host.resize(1280, 800)
    root.setParentItem(host.contentItem())
    host.show()
    def js(source, scope=root):
        engine.rootContext().setContextProperty("testSubject", scope)
        source = re.sub(r"(?<![\w.])(?:lab|garden)\.", "testSubject.", source)
        expression = QQmlExpression(QQmlEngine.contextForObject(scope), scope, source)
        value, _ = expression.evaluate()
        assert not expression.hasError(), expression.error().toString()
        return value.toVariant() if hasattr(value, "toVariant") else value
    def check(source, message, scope=root):
        assert js(source, scope), message
        print("ok  " + message)
    def settle():
        app.processEvents()
        QTest.qWait(30)
    def screenshot(name):
        if args.screenshots and (not args.screenshot_filter or name in args.screenshot_filter.split(",")):
            args.screenshots.mkdir(parents=True, exist_ok=True)
            settle()
            assert window.grabWindow().save(str(args.screenshots / (name + ".png")))
        if args.preview and name == "home":
            settle()
            assert window.grabWindow().save(str(args.preview))
    js('root.open("{}")')
    settle()
    window = next(w for w in app.topLevelWindows() if isinstance(w, QQuickWindow) and w != host)
    progress = root.findChild(QObject, "progressFile")
    assert progress.property("writes") == 0
    screenshot("home")
    js('root.launchGarden("count")')
    settle()
    garden = root.findChild(QObject, "mathGarden")
    assert garden, "native garden loads"
    check('root.opened && root.screen === "garden"', "garden stays in the same shell overlay")
    check('garden.lesson.a === 5 && garden.levelId === 1', "native engine creates the first counting lesson", garden)
    check('garden.sceneBoard.rendering3D === ' + str(args.renderer == "opengl" and not args.missing_3d).lower(), "garden selects the available renderer (window API: " + str(window.rendererInterface().graphicsApi()) + ", board API: " + str(js('garden.sceneBoard.GraphicsInfo.api', garden)) + ")", garden)
    if args.missing_3d:
        assert expected_warnings, "missing-module fallback was exercised"
    assert progress.property("writes") == 0, "opening a garden never writes progress"
    # Exercise real input over the composited scene, then keyboard activation.
    token = js('garden.sceneBoard.tokens.itemAt(0)', garden)
    point = token.mapToScene(QPointF(token.width() / 2, token.height() / 2)).toPoint()
    QTest.mouseClick(window, Qt.LeftButton, pos=point)
    QTest.mouseClick(window, Qt.LeftButton, pos=point)
    check('garden.picture.marked.length === 1', "touching a rendered apple twice counts it once", garden)
    token = js('garden.sceneBoard.tokens.itemAt(1)', garden)
    token.forceActiveFocus()
    QTest.keyClick(window, Qt.Key_Space)
    check('garden.picture.marked.length === 2', "Space activates an accessible picture counter", garden)
    screenshot("garden-count")
    js('garden.listen()', garden)
    settle()
    check('garden.narrator !== null && garden.narrator.available', "Listen loads the optional Qt speech component", garden)
    js('garden.showGrownups(); garden.back()', garden)
    check('garden.page === "lesson" && garden.picture.marked.length === 2', "grown-up settings return to the same activity without losing the picture", garden)
    js('garden.choose(4); garden.choose(5); garden.choose(5)', garden)
    check('garden.session.solved && garden.progress.activities.count.solved === 1 && garden.progress.activities.count.supported === 1', "helped garden answers persist exactly once", garden)
    check('root.progress.learners.default.rounds === 0 && root.progress.lastAssessment === null', "garden observations do not alter practice or assessment scores")
    js('garden.advance(); garden.advance()', garden)
    check('garden.session.index === 1 && !garden.session.solved', "native Next never skips an unanswered discovery", garden)
    js('garden.saveSettings(3, true); garden.showMe(); garden.showMe()', garden)
    check('!garden.demonstrating && garden.picture.marked.length === Math.min(2, garden.lesson.a) && garden.session.helped', "gentle Show me advances deliberately without animation", garden)
    js('for (var i = 0; i < 4; i++) { garden.choose(garden.lesson.answer); garden.advance() }', garden)
    check('garden.page === "complete" && garden.session.answers.length === 5', "a garden visit ends after five discoveries", garden)
    screenshot("garden-complete")
    js('garden.start("join"); garden.touch(4); garden.performOne()', garden)
    check('garden.picture.moved.length === 2', "frog input mixes direct touch and step controls", garden)
    screenshot("garden-join")
    js('garden.start("take"); garden.touch(3); garden.performOne(); garden.touch(3)', garden)
    check('garden.picture.moved.length === 2 && garden.picture.marked.length === 0', "departed frogs cannot be removed or counted again", garden)
    screenshot("garden-take")
    js('garden.start("ten"); garden.touch(6); garden.touch(6); garden.touch(7)', garden)
    check('garden.picture.filled.length === 1 && garden.sceneBoard.tokens.count === 10', "ten-frame planting is reversible and preserves ten spaces", garden)
    screenshot("garden-ten")
    js('garden.start("tens"); garden.touch(0); garden.touch(1); garden.touch(2)', garden)
    check('Garden.counted(garden.lesson, garden.picture) === 21', "native towers represent ten units apiece", garden)
    screenshot("garden-tens")
    for activity in ("parity", "primes", "powers", "coordinates", "angles", "area", "slope"):
        js('garden.start("' + activity + '")', garden)
        if activity == "primes":
            js('garden.adjust("rows", 1)', garden)
            check('garden.picture.rows === 2 && garden.lesson.answer === 1', "prime experiment rearranges seven blocks without changing their quantity", garden)
        elif activity == "coordinates":
            js('garden.adjust("pointX", 3); garden.adjust("pointY", 2)', garden)
            check('Garden.pictureComplete(garden.lesson, garden.picture)', "coordinate movement reaches the target", garden)
        elif activity == "angles":
            js('garden.adjust("angle", 90)', garden)
            check('garden.picture.angle === 90 && Garden.pictureComplete(garden.lesson, garden.picture)', "angle experiment measures a quarter-turn", garden)
        else:
            js('garden.performOne(); garden.performOne()', garden)
        screenshot("trail-" + activity)
        js('garden.choose(garden.lesson.answer)', garden)
        check('garden.session.solved && garden.progress.activities[garden.lesson.kind].solved === 1', activity + " observations persist in QML", garden)
    js('garden.saveSettings(3, false); garden.start("count"); garden.showMe()', garden)
    check('garden.demonstrating', "playful Show me starts a teaching timer", garden)
    QTest.keyClick(window, Qt.Key_Escape)
    check('garden.page === "home" && !garden.demonstrating', "Escape returns to the garden and cancels its timer", garden)
    QTest.qWait(850)
    check('garden.session === null', "an abandoned demonstration cannot change the next screen", garden)
    js('root.open(JSON.stringify({learnerId:"a&b #c",level:6})); root.launchGarden("primes")')
    settle()
    garden = root.findChild(QObject, "mathGarden")
    check('garden.levelId === 3 && garden.progress.activities.count.solved === 0', "learner IDs remain isolated and garden ranges are capped", garden)
    js('garden.choose(garden.lesson.answer)', garden)
    check('root.progress.learners["a&b #c"].garden.activities.primes.solved === 1 && root.progress.learners.default.garden.activities.count.solved === 5', "each learner keeps their own native observations")
    js('root.open("{}"); root.launchGarden("count")')
    settle()
    garden = root.findChild(QObject, "mathGarden")
    check('garden.progress.activities.count.solved === 5 && garden.levelId === 3', "returning to the garden restores learner settings and observations", garden)
    js('garden.showMe(); root.close()', garden)
    settle()
    check('!gardenLoader.active && gardenLoader.item === null', "closing unloads the garden and releases its renderer")

    js('root.open(JSON.stringify({mode:"assessment", input:"keypad", level:3, count:3, seed:42, adaptive:false}))')
    js('root.typed = String(root.currentQuestion.answer + 1); root.submitCurrent(); root.submitCurrent()')
    check('root.sessionItems.length === 1 && root.attempts === 1 && root.feedback === "recorded"', "assessment locks repeated wrong submissions and shows neutral feedback")
    js('root.showHint()')
    check('!root.hintUsed && !root.hintShown', "assessment cannot expose hints")
    QTest.qWait(620)
    check('root.questionIndex === 1 && root.sessionItems.length === 1', "assessment timer advances exactly once")
    js('root.finishSession("abandoned")')
    check('root.lastResultObject.status === "abandoned" && root.lastResultObject.total === 1 && root.progress.learners.default.rounds === 0', "partial assessment saves answers without a completed round")
    old_writes = progress.property("writes")
    js('root.open(JSON.stringify({mode:"assessment", seed:42})); root.close()')
    assert progress.property("writes") == old_writes
    check('root.lastResultObject.total === 0', "empty abandonment is returned without writing progress")

    js('root.open(JSON.stringify({mode:"practice", start:true, input:"keypad", level:2, count:3, seed:12}))')
    js('root.typed = String(root.currentQuestion.answer + 1); root.submitCurrent()')
    check('root.hintShown && root.hintUsed && !root.itemLocked && root.sessionItems.length === 0', "practice mistake offers a teaching idea before retry")
    js('root.typed = String(root.currentQuestion.answer); root.submitCurrent(); root.submitCurrent()')
    check('root.sessionItems.length === 1 && root.itemLocked', "practice success is recorded once")
    js('root.goNext(); root.goNext()')
    check('root.questionIndex === 1 && !root.itemLocked', "Next cannot skip unanswered questions")
    js('root.typed = String(root.currentQuestion.answer + 1); root.submitCurrent(); root.typed = String(root.currentQuestion.answer + 1); root.submitCurrent(); root.submitCurrent()')
    check('root.feedback === "reveal" && root.sessionItems.length === 2', "revealed answers cannot be resubmitted")
    screenshot("practice-help")
    js('root.goNext(); root.typed = String(root.currentQuestion.answer); root.submitCurrent(); root.goNext()')
    check('root.screen === "complete" && root.lastResultObject.total === 3 && root.lastResultObject.independentCorrect === 1', "completed practice distinguishes independent and helped answers")
    check('root.progress.lastAssessment.mode === "assessment"', "practice preserves the last assessment")
    screenshot("complete")

    js('root.open(JSON.stringify({mode:"practice", start:true, input:"choices", level:2, count:3, seed:12}))')
    settle()
    js('var correctIndex = root.choiceValues.indexOf(root.currentQuestion.answer); var wrongIndex = (correctIndex + 1) % root.choiceValues.length; root.choiceCursor = wrongIndex; choiceButtons.itemAt(wrongIndex).forceActiveFocus(); root.moveChoice(correctIndex - wrongIndex)')
    settle()
    expected = js('root.currentInput()')
    QTest.keyClick(window, Qt.Key_Return)
    check('root.attempts === 1 && root.feedback === "correct"', "Enter activates the choice selected with arrow keys")
    if js('root.itemLocked'):
        assert js('root.sessionItems[0].response') == expected

    js('root.screen = "home"')
    settle()
    QTest.keyClick(window, Qt.Key_Tab)
    settle()
    assert window.activeFocusItem() is not None
    QTest.keyClick(window, Qt.Key_Escape)
    check('!root.opened', "Escape bubbles from a focused button")

    js('root.open("{}"); root.levelId = 1; root.screen = "lab"')
    settle()
    lab = root.findChild(QObject, "numberLab")
    assert lab, "lab loads"
    check('lab.puzzle.level === 1', "lab uses the chosen learner level", lab)
    js('var solution = Lab.solutions(lab.puzzle)[0]; lab.leftIndex = lab.puzzle.left.indexOf(solution.a); lab.rightIndex = lab.puzzle.right.indexOf(solution.b); lab.remember()', lab)
    settle()
    check('lab.notebook.length === 1 && lab.discoveries.length === 1', "invention save updates persisted notebook and live view", lab)
    js('lab.remember()', lab)
    check('lab.notebook.length === 1', "saving the same invention twice is idempotent", lab)
    screenshot("lab-count")
    js('lab.levelId = 2; lab.start("build")', lab)
    check('!lab.canAdjust(1, 1)', "early subtraction dials cannot go below zero", lab)
    js('lab.leftIndex = 10; lab.rightIndex = 4', lab)
    screenshot("lab-subtraction")
    js('lab.levelId = 4; lab.start("build")', lab)
    screenshot("lab-array")
    js('lab.levelId = 6; lab.start("build"); lab.leftIndex = 1; lab.rightIndex = 4', lab)
    screenshot("lab-fraction")
    js('lab.start("mystery"); lab.guess(lab.puzzle.answer + 1)', lab)
    check('lab.hintShown && !lab.mysterySolved', "mystery encourages testing the clues after a miss", lab)
    screenshot("lab-mystery")
    js('lab.guess(lab.puzzle.answer)', lab)
    check('lab.mysterySolved && lab.notebook.length === 2', "solved mystery is added to the invention book", lab)
    js('lab.browsing = true', lab)
    screenshot("notebook")
    js('lab.reopen(lab.notebook[0])', lab)
    check('lab.atTarget && lab.puzzle.level === 1', "saved invention reopens with its exact dials and level", lab)

    window.setWidth(640)
    window.setHeight(480)
    js('root.screen = "home"; root.levelId = 6; root.startPractice()')
    settle()
    # Tab through controls: the keyboard focus must scroll into the clipped viewport.
    scrolled = False
    for _ in range(22):
        QTest.keyClick(window, Qt.Key_Tab)
        settle()
        scrolled = scrolled or js("viewport.contentY > 0")
    screenshot("small-screen")
    assert scrolled, "keyboard focus must scroll into view"
    check('viewport.contentHeight > viewport.height', "small-screen keyboard navigation scrolls to controls")
    js('root.close()')
    settle()
    # Native garden focus and scrolling at small sizes, including long prompts.
    js('root.open("{}"); root.launchGarden("slope")')
    settle()
    garden = root.findChild(QObject, "mathGarden")
    assert js('garden.sceneBoard.width <= garden.width', garden)
    saw_answer = False
    for _ in range(24):
        QTest.keyClick(window, Qt.Key_Tab)
        settle()
        focus = window.activeFocusItem()
        if focus and focus.objectName().startswith("gardenAnswer"):
            saw_answer = True
            point = focus.mapToScene(QPointF(0, 0))
            assert 0 <= point.y() < window.height() and point.y() + focus.height() <= window.height()
            break
    assert saw_answer, "small-screen trail answers remain reachable by keyboard"
    screenshot("garden-small-screen")
    js('root.close()')
    settle()
    assert not warnings, "\n".join(warnings)
    print("\nAll QML smoke tests passed (shell services mocked).")
