import { useState, useEffect, useRef } from 'react';
import './App.css';
import Welcome from './components/Welcome';
import Auth from './components/Auth';
import VoiceIntake from './components/VoiceIntake';
import Question from './components/Question';
import Results from './components/Results';
import { QUESTIONS, getNextQuestion } from './data/questions';
import { upsertUserState } from './utils/storage';
import { startContinuousListening, stopContinuousListening, speak } from './utils/voice';

const BACKEND_URL = 'https://supercriminally-ununified-arnoldo.ngrok-free.dev';

function App() {
  const [phase, setPhase] = useState('welcome');
  const [currentUser, setCurrentUser] = useState(null);
  const [state, setState] = useState({});
  const [answered, setAnswered] = useState([]);
  const [voiceStatus, setVoiceStatus] = useState('off'); // off | listening | processing
  const [notUnderstood, setNotUnderstood] = useState(false);

  const stateRef = useRef(state);
  const answeredRef = useRef(answered);
  const phaseRef = useRef(phase);
  stateRef.current = state;
  answeredRef.current = answered;
  phaseRef.current = phase;

  function handleAuthenticated(email, savedState, savedAnswered) {
    setCurrentUser(email);
    setState(savedState);
    setAnswered(savedAnswered);
    setPhase(savedAnswered && savedAnswered.length > 0 ? 'questions' : 'intake');
  }

  // Sends transcript + ALL unanswered questions in one call, flagging which question is
  // currently on screen so the LLM prioritizes matching against it first.
  // Including all unanswered questions allows the LLM to extract any relevant field
  // (like color) that the user explicitly mentions, even if that question hasn't been
  // reached in the eligibility path yet. The "current_question_id" flag helps the LLM
  // prioritize if there are ambiguities.
  async function callParseAnswer(transcript, currentQuestionId) {
    const answeredSet = new Set(answeredRef.current);
    const remaining = QUESTIONS
      .filter(q => !answeredSet.has(q.id))
      .map(q => ({ id: q.id, text: q.text, options: q.options, type: q.type }));

    if (remaining.length === 0) return;

    setVoiceStatus('processing');
    setNotUnderstood(false);
    try {
      const res = await fetch(`${BACKEND_URL}/parse-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          remaining_questions: remaining,
          current_question_id: currentQuestionId || null,
          known_state: stateRef.current
        })
      });
      const data = await res.json();
      const extracted = data.extracted || {};
      const rawExtracted = data.raw_extracted || {};
      const rejected = data.rejected || {};

      // nothing confidently matched — tell the user plainly instead of
      // silently doing nothing and leaving them wondering if it heard them
      if (Object.keys(extracted).length === 0 && Object.keys(rawExtracted).length === 0) {
        setNotUnderstood(true);
        speak("Sorry, I couldn't understand that. Could you say it again, or tap an option?");
        setVoiceStatus('listening');
        return;
      }

      const newState = { ...stateRef.current, ...extracted };
      const answeredKeys = new Set([...answeredRef.current]);

      Object.keys(rawExtracted).forEach((qid) => {
        if (!(qid in extracted)) {
          newState[qid] = rawExtracted[qid];
          answeredKeys.add(qid);
        }
      });

      Object.keys(extracted).forEach((qid) => answeredKeys.add(qid));
      const newAnswered = Array.from(answeredKeys);

      // rejected colour options roll into avoid_colour
      if (rejected.colour) {
        newState.avoid_colour = Array.from(new Set([...(newState.avoid_colour || []), ...rejected.colour]));
      }

      setState(newState);
      setAnswered(newAnswered);
      upsertUserState(currentUser, newState, newAnswered);

      if (phaseRef.current === 'intake' && Object.keys(extracted).length > 0) {
        setPhase('questions');
      }
    } catch (e) {
      console.warn('parse-answer failed', e);
      setNotUnderstood(true);
      speak("Something went wrong. Please try again.");
    }
    setVoiceStatus('listening');
  }

  function handleAnswer(questionId, value) {
    setNotUnderstood(false);
    const newState = { ...stateRef.current, [questionId]: value };
    const newAnswered = [...answeredRef.current, questionId];
    setState(newState);
    setAnswered(newAnswered);
    upsertUserState(currentUser, newState, newAnswered);
  }

  function enableVoice() {
    setVoiceStatus('listening');
    startContinuousListening((transcript) => {
      // always read the LIVE current question at the moment of speaking,
      // not whatever it was when voice was first turned on
      const liveCurrentId = getNextQuestion(stateRef.current, answeredRef.current);
      callParseAnswer(transcript, liveCurrentId);
    });
  }

  useEffect(() => {
    if (phase === 'results') {
      stopContinuousListening();
      setVoiceStatus('off');
    }
  }, [phase]);

  function restart() {
    stopContinuousListening();
    setVoiceStatus('off');
    setNotUnderstood(false);
    setPhase('welcome');
    setCurrentUser(null);
    setState({});
    setAnswered([]);
  }

  if (phase === 'welcome') {
    return <Welcome onStart={() => setPhase('auth')} />;
  }

  if (phase === 'auth') {
    return <Auth onAuthenticated={handleAuthenticated} />;
  }

  if (phase === 'intake') {
    return (
      <VoiceIntake
        voiceStatus={voiceStatus}
        onEnableVoice={enableVoice}
        onManualPick={(occasion) => {
          handleAnswer('occasion', occasion);
          setPhase('questions');
        }}
      />
    );
  }

  const currentId = getNextQuestion(state, answered);

  if (currentId === 'RESULTS') {
    return <Results state={state} currentUser={currentUser} onRestart={restart} backendUrl={BACKEND_URL} />;
  }

  const question = QUESTIONS.find(q => q.id === currentId);
  return (
    <Question
      question={question}
      voiceStatus={voiceStatus}
      notUnderstood={notUnderstood}
      onEnableVoice={enableVoice}
      onAnswer={(value) => handleAnswer(question.id, value)}
    />
  );
}

export default App;