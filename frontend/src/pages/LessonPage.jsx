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
      
      setCurrentStep(data.step_index);
      setIsProcessing(false);

      if (data.audioBase64) {
        playAudio(data.audioBase64);
      }

      if (data.completed) {
        setCompleted(true);
        setFinalScore(data.final_score);
        refreshUserDoc(); // update dashboard stats
      }

    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      alert("Connection error. Please try again.");
    }
  };

  if (loading) return <div className="lesson-page"><div className="lesson-main"><div className="thinking-state" style={{margin:'auto'}}>Loading lesson...</div></div></div>;
  if (error) return <div className="lesson-page"><div className="lesson-main"><div style={{margin:'auto', color:'#f87171'}}>{error}</div></div></div>;

  // Completion View
  if (completed) {
    return (
      <div className="lesson-page">
        <div className="lesson-main">
          <div className="lesson-content completion-view">
            <h2>Lesson Complete!</h2>
            <div className="score-circle">
              <span className="score-value">{finalScore}</span>
              <span className="score-label">Score</span>
            </div>
            
            <div className="feedback-lists">
              <div>
                <h4>Strengths</h4>
                <ul>
                  <li>Great comprehension of spoken prompts</li>
                  <li>Good effort maintaining conversation</li>
                </ul>
              </div>
              <div>
                <h4>Focus Areas</h4>
                <ul>
                  <li>Review recent feedback items</li>
                </ul>
              </div>
            </div>

            <div className="completion-actions">
              <button className="btn-secondary" onClick={() => window.location.reload()}>Try Again</button>
              <button className="btn-primary" onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
            </div>
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
        {!isInputStep && !isPlaying && !isProcessing && (
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
