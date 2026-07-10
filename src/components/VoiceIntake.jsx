import { useEffect } from 'react';
import { speak } from '../utils/voice';
import { QUESTIONS } from '../data/questions';

const occasionOptions = QUESTIONS.find(q => q.id === 'occasion').options;

export default function VoiceIntake({ voiceStatus, onEnableVoice, onManualPick, onSkipVoice }) {
  useEffect(() => {
    speak("Welcome to Swakriti. What's the occasion? You can tap an option, or enable voice and just tell me everything at once.");
  }, []);

  return (
    <div className="question-screen">
      <h2 className="question-title">What's the occasion?</h2>
      <p className="hero-subtext">
        Tap an option below, or enable voice once — after that just speak naturally through every question.
      </p>

      {voiceStatus === 'off' && (
        <button className="mic-button" onClick={onEnableVoice}>
          🎤 Enable voice for this session
        </button>
      )}
      {voiceStatus === 'listening' && (
        <p className="voice-hint">
                🎙️ Voice enabled — Try saying, "Show me a silk saree for a wedding under ₹5,000."
                </p>
      )}
      {voiceStatus === 'processing' && <p className="voice-hint">Thinking…</p>}

      <div className="chip-grid">
        {occasionOptions.map(opt => (
          <button key={opt} className="chip" onClick={() => onManualPick(opt)}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}