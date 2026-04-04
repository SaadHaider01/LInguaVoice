// ============================================================
// frontend/src/pages/LessonPage.jsx
// LinguaVoice — Step 5: Lesson Engine UI
// Immersive conversational interface.
// ============================================================
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./lesson.css";

const stepNames = ["Warm Up", "Teaching", "Practice", "Free Talk", "Feedback"];

const PronunciationBadge = ({ score }) => {
  if (score === null || score === undefined) return null;
  const [offset, setOffset] = useState(157);

  useEffect(() => {
    const fillPercent = Math.max(0, Math.min(100, score)) / 100;
    const targetOffset = 157 - (157 * fillPercent);
    const t = setTimeout(() => setOffset(targetOffset), 50);
    return () => clearTimeout(t);
  }, [score]);

  const colorClass = score < 50 ? 'score-red' : score < 75 ? 'score-amber' : 'score-green';
  const label = score < 50 ? 'Keep going' : score < 75 ? 'Good' : 'Excellent';

  return (
    <div className={`pronunciation-badge ${colorClass}`}>
      <div className="svg-ring-container">
        <svg className="svg-ring" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="25" />
          <circle className="ring-fill" cx="30" cy="30" r="25" style={{ strokeDashoffset: offset }} />
        </svg>
        <div className="ring-score-text">{score}</div>
      </div>
      <div className="pronunciation-label">{label}</div>
    </div>
  );
};

export default function LessonPage() {
  const { moduleId, lessonId } = useParams();
  const { currentUser, userDoc, refreshUserDoc } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [sessionId, setSessionId] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [recapData, setRecapData] = useState(null);
  
  const [currentAnchor, setCurrentAnchor] = useState({ type: "none", content: "", translation: "" });
  const [recentScore, setRecentScore] = useState(null);
  
  const [guideData, setGuideData] = useState(null);
  const [isGuideFetching, setIsGuideFetching] = useState(false);
  const [showRepeatPrompt, setShowRepeatPrompt] = useState(false);
  
  const [conversation, setConversation] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const scrollRef = useRef(null);

  // Initialize AudioContext lazily on user gesture
  const initAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Play base64 audio
  const playAudio = async (base64String) => {
    if (!base64String) return;
    try {
      const ctx = initAudioCtx();
      const binaryString = window.atob(base64String);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      setIsPlaying(true);
      source.onended = () => setIsPlaying(false);
      source.start(0);
    } catch (err) {
      console.error("Audio playback failed:", err);
      setIsPlaying(false);
    }
  };

  // Scroll to bottom on updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation, isProcessing, isPlaying]);

  // Init Lesson
  useEffect(() => {
    let active = true;
    const initLesson = async () => {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/lesson/init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ moduleId, lessonId: lessonId || moduleId })
        });
        
        if (!res.ok) throw new Error("Failed to initialize lesson");
        const data = await res.json();
        
        if (active) {
          setSessionId(data.sessionId);
          setCurrentStep(data.step_index);
          setConversation([{
             role: "teacher", 
             text: data.aiResponseJSON?.teacher_response || "" 
          }]);
          
          if (data.aiResponseJSON?.anchor?.type) {
             setCurrentAnchor(data.aiResponseJSON.anchor);
          }
          
          setLoading(false);
          
          if (data.audioBase64) {
            playAudio(data.audioBase64);
          }
        }
      } catch (err) {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      }
    };
    
    initLesson();
    return () => { active = false; };
  }, [moduleId, lessonId, currentUser]);

  // Record functions
  const startRecording = async () => {
    setGuideData(null);
    setShowRepeatPrompt(false);
    try {
      initAudioCtx(); // unlock audio for subsequent playback
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = processTurn;
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      alert("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  // Submit turn
  const processTurn = async () => {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const formData = new FormData();
    formData.append("audio", blob);
    formData.append("sessionId", sessionId);

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/lesson/turn`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) throw new Error("Turn failed");
      const data = await res.json();

      setConversation(prev => [
        ...prev, 
        { role: "student", text: data.transcript, feedback: data.aiResponseJSON },
        { role: "teacher", text: data.aiResponseJSON?.teacher_response }
      ]);
      
      if (data.pronunciation_score !== undefined) {
         setRecentScore(data.pronunciation_score);
         setTimeout(() => setRecentScore(null), 4000);
      }
      
      if (data.aiResponseJSON?.anchor?.type) {
         setCurrentAnchor(data.aiResponseJSON.anchor);
      }
      
      const targetWord = data.aiResponseJSON?.focus_word || data.aiResponseJSON?.anchor?.content;
      const needsGuide = (data.pronunciation_score !== undefined && data.pronunciation_score < 70) 
                         || (data.aiResponseJSON?.focus_word);
      
      if (needsGuide && targetWord && targetWord !== "none") {
         fetchPronunciationGuide(targetWord);
      }
      
      setCurrentStep(data.step_index);
      setIsProcessing(false);

      if (data.audioBase64) {
        playAudio(data.audioBase64);
      }

      if (data.completed) {
        setCompleted(true);
        setFinalScore(data.final_score);
        if (data.recap) setRecapData(data.recap);
        if (data.xp_payload) window.dispatchEvent(new CustomEvent("gamification_pushed", { detail: data.xp_payload }));
        refreshUserDoc(); // update dashboard stats
      }

    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      alert("Connection error. Please try again.");
    }
  };

  const fetchPronunciationGuide = async (word) => {
    try {
      setIsGuideFetching(true);
      const token = await currentUser.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/lesson/pronounce`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ word })
      });
      if (res.ok) {
        const data = await res.json();
        setGuideData({
          word,
          phonetic: data.phonetic,
          normalAudio: data.normal,
          slowAudio: data.slow
        });
      }
    } catch (err) {
      console.error("[Pronounce Guide Error]", err);
    } finally {
      setIsGuideFetching(false);
    }
  };

  const playGuideAudio = (base64Audio, isSlow) => {
    if (isPlaying) return;
    playAudio(base64Audio);
    if (isSlow) {
      setTimeout(() => setShowRepeatPrompt(true), 2000);
    } else {
      setShowRepeatPrompt(false);
    }
  };

  if (loading) return <div className="lesson-page"><div className="lesson-main"><div className="thinking-state" style={{margin:'auto'}}>Loading lesson...</div></div></div>;
  if (error) return <div className="lesson-page"><div className="lesson-main"><div style={{margin:'auto', color:'#f87171'}}>{error}</div></div></div>;

  // Completion View (Post-Lesson Recap)
  if (completed) {
    if (!recapData) {
       return <div className="lesson-page"><div className="lesson-main"><div className="thinking-state" style={{margin:'auto'}}>Analyzing your performance...</div></div></div>;
    }

    const gradeClass = recapData.overall_grade ? `grade-${recapData.overall_grade.toLowerCase()}` : "grade-b";

    return (
      <div className="recap-card-fullscreen">
        <div className="confetti-burst"></div>
        <div className="recap-container">
          <div className="recap-top">
            <div className={`grade-circle ${gradeClass}`}>
              {recapData.overall_grade || "B"}
            </div>
            <div className="score-summary">
              <h2>Lesson Complete!</h2>
              <div className="score-number">Score: <span>{finalScore}</span></div>
            </div>
          </div>

          <div className="recap-summary soft-card">
            <p>{recapData.summary}</p>
          </div>

          <div className="recap-words">
            <h3>Words You Practiced</h3>
            <div className="words-scroll-row">
              {recapData.words_practiced && recapData.words_practiced.map((wp, i) => (
                <div key={i} className="word-chip" onClick={() => fetchPronunciationGuide(wp.word).then(() => { if (guideData?.normalAudio) playGuideAudio(guideData.normalAudio, false) })}>
                   <span className="w-text">{wp.word}</span>
                   <span className="w-def">{wp.definition}</span>
                   <span className="w-audio-icon">🔊</span>
                </div>
              ))}
            </div>
          </div>

          <div className="recap-insights">
            <div className="insight-card strength-card">
              <h4>What you did well</h4>
              <p>{recapData.top_strength}</p>
            </div>
            <div className="insight-card focus-card">
              <h4>Practice before next lesson</h4>
              <p>{recapData.focus_for_next}</p>
            </div>
          </div>

          <div className="recap-actions">
            <button className="btn-primary btn-large block-btn" onClick={() => navigate("/dashboard")}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Lesson View
  const progressPercent = ((currentStep + 1) / 5) * 100;
  // Hide record button on "input" step (step index 1 ordinarily, but dynamic logic allowed)
  const isInputStep = currentStep === 1;

  return (
    <div className="lesson-page">
      <div className="lesson-header">
        <div className="header-top">
          <span className="lesson-step-indicator">Step {currentStep + 1} of 5 — {stepNames[currentStep]}</span>
          <button className="lesson-close-btn" onClick={() => navigate("/dashboard")}>✕</button>
        </div>
        <div className="lesson-progress-wrap">
          <div className="lesson-progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className={`anchor-panel ${currentAnchor.type === 'none' ? 'collapsed' : `type-${currentAnchor.type}`}`}>
         {currentAnchor.type !== 'none' && (
           <>
             <div className="anchor-badge">{currentAnchor.type}</div>
             {currentAnchor.type === 'letter' ? (
               <div className="anchor-letter-pair">
                 <div className="anchor-letter-box">
                    <span className="letter">{currentAnchor.content ? currentAnchor.content.toUpperCase() : ""}</span>
                    <span className="phonetic">Uppercase</span>
                 </div>
                 <div className="anchor-letter-box">
                    <span className="letter">{currentAnchor.content ? currentAnchor.content.toLowerCase() : ""}</span>
                    <span className="phonetic">Lowercase</span>
                 </div>
               </div>
             ) : (
               <div className="anchor-content">{currentAnchor.content}</div>
             )}
             {currentAnchor.translation && (
               <div className="anchor-translation">{currentAnchor.translation}</div>
             )}
           </>
         )}
      </div>

      <div className="lesson-main" ref={scrollRef}>
        <div className="lesson-content">
          {conversation.map((msg, i) => {
            if (msg.role === "teacher") {
              return (
                <div key={i} className="teacher-box">
                  <div className="teacher-avatar">LV</div>
                  <div className="teacher-bubble">{msg.text}</div>
                </div>
              );
            } else {
              return (
                <div key={i} className="student-box">
                  <div className="student-bubble">{msg.text}</div>
                  {msg.feedback && (msg.feedback.praise || msg.feedback.correction) && (
                    <div className="ai-feedback">
                      {msg.feedback.praise && <div className="feedback-line feedback-praise">⭐ <strong>Great:</strong> {msg.feedback.praise}</div>}
                      {msg.feedback.correction && <div className="feedback-line feedback-correction">💡 <strong>Tip:</strong> {msg.feedback.correction}</div>}
                    </div>
                  )}
                </div>
              );
            }
          })}

          {isProcessing && (
             <div className="teacher-box">
               <div className="teacher-avatar">LV</div>
               <div className="teacher-bubble thinking-state">Teacher is thinking...</div>
             </div>
          )}
        </div>
      </div>

      <div className="lesson-controls">
        
        {(guideData || isGuideFetching) && (
          <div className={`pronunciation-modeling-card ${isRecording ? 'hide' : ''}`}>
             <div className="modeling-header">Pronunciation Guide</div>
             {isGuideFetching ? (
               <div style={{opacity: 0.5, padding: '2rem 0'}}>Preparing model...</div>
             ) : (
               <>
                 <div className="modeling-word">{guideData.word}</div>
                 <div className="modeling-ipa">/{guideData.phonetic}/</div>
                 <div className="modeling-actions">
                   <button 
                     className="btn-model-normal" 
                     onClick={() => playGuideAudio(guideData.normalAudio, false)}
                     disabled={isPlaying}
                   >
                     Hear Normal
                   </button>
                   <button 
                     className="btn-model-slow" 
                     onClick={() => playGuideAudio(guideData.slowAudio, true)}
                     disabled={isPlaying}
                   >
                     Hear Slowly
                   </button>
                 </div>
                 {showRepeatPrompt && <div className="repeat-prompt">Now you try! Hold the mic.</div>}
               </>
             )}
          </div>
        )}
      
        {!isInputStep && !isPlaying && !isProcessing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <button 
              className={`record-btn ${isRecording ? "recording" : ""}`}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              title="Hold to speak"
            >
              🎙️
            </button>
            {recentScore !== null && <PronunciationBadge score={recentScore} />}
          </div>
        )}
        {(isPlaying || isProcessing || isInputStep) && (
          <div style={{height: "80px", display: "flex", alignItems: "center", color: "rgba(255,255,255,0.5)"}}>
            {isPlaying ? "Teacher is speaking..." : isProcessing ? "Analyzing..." : "Listen closely..."}
          </div>
        )}
        
        {isInputStep && !isPlaying && !isProcessing && (
          <button 
             className="btn-primary" 
             style={{marginTop: "1rem"}}
             onClick={() => {
                // If it's the input step and audio finished, manually trigger next step
                // (Using a simple turn with empty audio or bypassing via an API call)
                setIsProcessing(true);
                processTurn(); // Empty buffer is sent, backend will handle or we just provide advance
             }}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
