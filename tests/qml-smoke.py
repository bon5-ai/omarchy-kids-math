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

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
os.environ.setdefault("QSG_RHI_BACKEND", "software")
from PySide6.QtCore import QUrl, Qt, qInstallMessageHandler, QObject
from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlEngine, QQmlComponent, QQmlExpression
from PySide6.QtTest import QTest
from PySide6.QtQuick import QQuickWindow

parser = argparse.ArgumentParser()
parser.add_argument("--screenshots", type=Path)
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
app = QGuiApplication([])
warnings = []
def log(kind, context, message):
    if "file:" in message or "Error" in message or "Cannot" in message:
        warnings.append(message)
qInstallMessageHandler(log)

with tempfile.TemporaryDirectory(prefix="kids-math-qml-") as directory:
    base = Path(directory)
    for source in list(repo.glob("*.qml")) + list(repo.glob("*.js")):
        content = source.read_text()
        if source.name == "Overlay.qml":
            content = "\n".join(line for line in content.splitlines() if "WlrLayershell." not in line)
        (base / source.name).write_text(content)

    def module(name, files, singletons=()):
        folder = base / name.replace(".", "/")
        folder.mkdir(parents=True)
        entries = ["module " + name]
        for typename, body in files.items():
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
        source = source.replace("lab.", "testSubject.")
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
        if args.screenshots:
            args.screenshots.mkdir(parents=True, exist_ok=True)
            settle()
            assert window.grabWindow().save(str(args.screenshots / (name + ".png")))
    js('root.open("{}")')
    settle()
    window = next(w for w in app.topLevelWindows() if isinstance(w, QQuickWindow) and w != host)
    progress = root.findChild(QObject, "progressFile")
    assert progress.property("writes") == 0
    screenshot("home")

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
    assert not warnings, "\n".join(warnings)
    print("\nAll QML smoke tests passed (shell services mocked).")
