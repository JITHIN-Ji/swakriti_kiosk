// Text-to-speech — pauses recognition while speaking so the mic doesn't
// pick up the kiosk's own voice and misinterpret it as user speech.
export function speak(text, onDone) {
  if (!window.speechSynthesis) {
    if (onDone) onDone();
    return;
  }

  pauseListeningForSpeech();

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;

  utterance.onend = () => {
    resumeListeningAfterSpeech();
    if (onDone) onDone();
  };
  utterance.onerror = () => {
    resumeListeningAfterSpeech();
    if (onDone) onDone();
  };

  window.speechSynthesis.speak(utterance);
}

// Singleton continuous recognition — starts once, restarts itself forever,
// so the user never has to press a mic button again after the first grant.
let recognitionInstance = null;
let onFinalTranscriptCallback = null;
let isPausedForSpeech = false;

export function startContinuousListening(onFinalTranscript) {
  onFinalTranscriptCallback = onFinalTranscript;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Speech recognition not supported in this browser.');
    return;
  }

  if (recognitionInstance) {
    recognitionInstance.stop();
  }

  recognitionInstance = new SpeechRecognition();
  recognitionInstance.lang = 'en-IN';
  recognitionInstance.continuous = true;
  recognitionInstance.interimResults = false;

  recognitionInstance.onresult = (event) => {
    if (isPausedForSpeech) return; // ignore anything heard while TTS is talking
    const last = event.results[event.results.length - 1];
    const transcript = last[0].transcript.trim();
    if (transcript && onFinalTranscriptCallback) {
      onFinalTranscriptCallback(transcript);
    }
  };

  recognitionInstance.onerror = (event) => {
    if (event.error !== 'no-speech') {
      console.warn('Speech recognition error:', event.error);
    }
  };

  recognitionInstance.onend = () => {
    // auto-restart to stay always-listening, unless deliberately paused
    if (recognitionInstance && !isPausedForSpeech) {
      try { recognitionInstance.start(); } catch (e) { /* already started, ignore */ }
    }
  };

  recognitionInstance.start();
}

export function stopContinuousListening() {
  if (recognitionInstance) {
    const instance = recognitionInstance;
    recognitionInstance = null;
    isPausedForSpeech = false;
    instance.stop();
  }
}

function pauseListeningForSpeech() {
  isPausedForSpeech = true;
  if (recognitionInstance) {
    try { recognitionInstance.stop(); } catch (e) { /* ignore */ }
  }
}

function resumeListeningAfterSpeech() {
  isPausedForSpeech = false;
  if (recognitionInstance) {
    try { recognitionInstance.start(); } catch (e) { /* ignore */ }
  }
}

export function updateTranscriptCallback(onFinalTranscript) {
  onFinalTranscriptCallback = onFinalTranscript;
}