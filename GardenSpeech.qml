import QtQuick
import QtTextToSpeech

Item {
  id: narrator
  readonly property bool available: voiceReady && speech.state !== TextToSpeech.Error
  property bool voiceReady: false
  function configure() {
    if (speech.state === TextToSpeech.Error) return
    var voices = speech.findVoices({ "locale": Qt.locale("en_US") })
    if (!voices.length) voices = speech.findVoices({ "language": Qt.locale("en") })
    voiceReady = voices.length > 0
    if (voiceReady) speech.voice = voices[0]
  }
  function say(text) { if (available) speech.say(text) }
  function stop() { speech.stop() }
  TextToSpeech {
    id: speech
    // speechd and espeak are local Linux speech engines; do not select a
    // provider implicitly if the installation has a different engine.
    engine: availableEngines().includes("speechd") ? "speechd" : "espeak"
    rate: -0.15
    onStateChanged: if (state === TextToSpeech.Ready && !narrator.voiceReady) narrator.configure()
  }
  Component.onCompleted: configure()
  Component.onDestruction: speech.stop()
}
