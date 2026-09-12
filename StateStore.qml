import QtQuick
import Quickshell.Io
import "MathEngine.js" as MathEngine

Item {
  id: store
  property bool ready: false
  property bool writable: false
  property string error: ""
  property string pending: ""
  property string writing: ""
  property string received: ""
  signal loaded(string raw)

  // This is a bundled, fixed-purpose helper, with no shell, PATH lookup, Python
  // startup hooks, inherited environment, user-selected program or path.
  readonly property string helper: decodeURIComponent(Qt.resolvedUrl("StateStore.py").toString().slice(7))

  function save(raw) {
    if (!ready || !writable || MathEngine.utf8Bytes(raw, MathEngine.LIMITS.stateBytes) > MathEngine.LIMITS.stateBytes) return false
    pending = raw
    flush()
    return true
  }

  function flush() {
    if (!pending || writing || !writable) return
    writing = pending
    pending = ""
    writer.stdinEnabled = true
    writer.running = true
  }

  function reject() {
    writable = false
    error = "Progress could not be loaded safely. Changes will stay in this session."
  }

  Process {
    id: reader
    command: ["/usr/bin/python3", "-I", "-S", store.helper, "read"]
    clearEnvironment: true
    running: true
    stdout: StdioCollector {
      onStreamFinished: store.received = this.text
    }
    onExited: (exitCode, exitStatus) => {
      // Deferring handles either ordering of streamFinished and exited.
      Qt.callLater(function () {
        if (store.ready) return
        store.writable = exitCode === 0 && exitStatus === 0
        if (!store.writable) store.reject()
        store.ready = true
        store.loaded(store.writable ? store.received : "")
        store.received = ""
      })
    }
  }

  Process {
    id: writer
    command: ["/usr/bin/python3", "-I", "-S", store.helper, "write"]
    clearEnvironment: true
    onStarted: {
      write(store.writing)
      stdinEnabled = false
    }
    onExited: (exitCode, exitStatus) => {
      store.writing = ""
      if (exitCode !== 0 || exitStatus !== 0) {
        store.pending = ""
        store.writable = false
        store.error = "Progress could not be saved. Changes will stay in this session."
      } else Qt.callLater(store.flush)
    }
  }

  // Failed process startup does not emit exited in every Quickshell version.
  Timer {
    interval: 6500
    running: !store.ready || store.writing !== ""
    onTriggered: {
      if (!store.ready) {
        reader.signal(9)
        store.reject()
        store.ready = true
        store.loaded("")
      }
      if (store.writing) {
        writer.signal(9)
        store.reject()
        store.pending = ""
        store.writing = ""
      }
    }
  }
}
