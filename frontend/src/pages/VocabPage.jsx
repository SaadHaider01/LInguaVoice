import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./vocab.css";

export default function VocabPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState("review"); // "all" or "review"
  const [allWords, setAllWords] = useState([]);
  const [dueWords, setDueWords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMethod, setSortMethod] = useState("due-first");

  // Flashcard State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [audioCache, setAudioCache] = useState({});

  const audioCtxRef = useRef(null);

  useEffect(() => {
    fetchVocab();
  }, [currentUser]);

  const initAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playAudio = async (base64String) => {
    if (!base64String) return;
    try {
      const ctx = initAudioCtx();
      const raw = window.atob(base64String);
      const buffer = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        buffer[i] = raw.charCodeAt(i);
      }
      const audioBuffer = await ctx.decodeAudioData(buffer.buffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch (err) {
      console.error("Audio playback failed:", err);
    }
  };

  const loadPronunciation = async (word) => {
    if (audioCache[word]) {
      playAudio(audioCache[word]);
      return;
    }
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/lesson/pronounce`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ word })
      });
      if (res.ok) {
        const data = await res.json();
        setAudioCache(prev => ({ ...prev, [word]: data.normal }));
        playAudio(data.normal);
      }
    } catch (err) {
      console.error("[TTS Fetch Error]", err);
    }
  };

  const fetchVocab = async () => {
    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const [allRes, dueRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/vocab`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL}/api/vocab/due`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const allData = await allRes.json();
      const dueData = await dueRes.json();
      setAllWords(allData.words || []);
      setDueWords(dueData.dueWords || []);
      
      if ((dueData.dueWords || []).length > 0) {
        setActiveTab("review");
      } else {
        setActiveTab("all");
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleReviewScore = async (quality) => {
    const currentWord = dueWords[currentCardIndex];
    if (!currentWord) return;

    try {
      const token = await currentUser.getIdToken();
      const apiRes = await fetch(`${import.meta.env.VITE_API_URL}/api/vocab/review`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ 
            word_id: currentWord.id, 
            quality,
            is_last_word: currentCardIndex === dueWords.length - 1
        })
      });
      const rawData = await apiRes.json();
      if (rawData.xp_payload) {
         window.dispatchEvent(new CustomEvent("gamification_pushed", { detail: rawData.xp_payload }));
      }
    } catch (error) {
      console.error("Failed to commit score", error);
    }

    // Move to next layout seamlessly regardless of API latency
    setIsFlipped(false);
    setTimeout(() => {
       setCurrentCardIndex(prev => prev + 1);
    }, 200); // Wait for unflip animation
  };

  const handleFlip = () => {
    if (!isFlipped) {
      setIsFlipped(true);
      if (dueWords[currentCardIndex]) loadPronunciation(dueWords[currentCardIndex].word);
    }
  };

  return (
    <div className="vocab-scroll-page">
      <nav className="dashboard-nav">
        <a href="/dashboard" className="nav-logo">
          🎤 <span>LinguaVoice</span>
        </a>
        <div className="nav-actions">
          <button className="btn-secondary" onClick={() => navigate("/dashboard")}>← Dashboard</button>
        </div>
      </nav>

      <main className="vocab-main">
        <div className="vocab-header">
          <h1>Vocabulary Notebook</h1>
          <div className="tab-buttons">
            <button className={`tab-btn ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>
              Review Due <span className="badge">{dueWords.length - currentCardIndex > 0 ? dueWords.length - currentCardIndex : 0}</span>
            </button>
            <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
              All Words <span className="badge muted">{allWords.length}</span>
            </button>
          </div>
        </div>

        {loading ? (
           <div className="thinking-state" style={{margin:'4rem auto'}}>Fetching vocabulary matrix...</div>
        ) : (
          <div className="tab-content">
            
            {/* ─── REVIEW TAB ─── */}
            {activeTab === 'review' && (
              <div className="review-area">
                {currentCardIndex >= dueWords.length ? (
                  <div className="all-caught-up-card">
                    <div className="celebration-emoji">🏁</div>
                    <h2>All Caught Up!</h2>
                    <p>You've crushed {dueWords.length} words today. Your retention memory is locked in.</p>
                    <button className="btn-primary" onClick={() => setActiveTab('all')}>Browse Collection</button>
                  </div>
                ) : (
                  <div className="flashcard-container">
                    <div className="flashcard-tracker">Card {currentCardIndex + 1} of {dueWords.length}</div>
                    
                    <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={handleFlip}>
                      <div className="flashcard-inner">
                        {/* Front */}
                        <div className="flashcard-front">
                           <h3>{dueWords[currentCardIndex].word}</h3>
                           <p className="hint-text">Tap to reveal & listen</p>
                        </div>
                        {/* Back */}
                        <div className="flashcard-back">
                           <div className="top-row">
                             <h3>{dueWords[currentCardIndex].word}</h3>
                             <button className="icon-btn" onClick={(e) => { e.stopPropagation(); loadPronunciation(dueWords[currentCardIndex].word); }}>🔊</button>
                           </div>
                           <div className="def">{dueWords[currentCardIndex].definition}</div>
                           <div className="ex">"{dueWords[currentCardIndex].example_sentence}"</div>
                           <div className="badge-src">{dueWords[currentCardIndex].source_module}</div>
                        </div>
                      </div>
                    </div>

                    {isFlipped && (
                      <div className="sm2-action-bar">
                        <button className="sm2-btn hard" onClick={() => handleReviewScore(0)}>Forgot <span>(Restart)</span></button>
                        <button className="sm2-btn good" onClick={() => handleReviewScore(3)}>Hard <span>(1d)</span></button>
                        <button className="sm2-btn easy" onClick={() => handleReviewScore(4)}>Good <span>(Normal)</span></button>
                        <button className="sm2-btn very-easy" onClick={() => handleReviewScore(5)}>Easy <span>(+Boost)</span></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─── ALL WORDS TAB ─── */}
            {activeTab === 'all' && (
              <div className="all-words-area">
                <div className="filters-bar">
                  <input 
                    type="text" 
                    placeholder="Search words or definitions..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="vocab-search"
                  />
                  <select value={sortMethod} onChange={(e) => setSortMethod(e.target.value)} className="vocab-sort">
                    <option value="due-first">Urgency (Due First)</option>
                    <option value="az">A-Z</option>
                    <option value="newest">Recently Added</option>
                  </select>
                </div>

                <div className="grid-cards">
                  {allWords
                    .filter(w => w.word.toLowerCase().includes(searchQuery.toLowerCase()) || w.definition.toLowerCase().includes(searchQuery.toLowerCase()))
                    .sort((a, b) => {
                      if (sortMethod === 'az') return a.word.localeCompare(b.word);
                      if (sortMethod === 'newest') return new Date(b.first_seen_date) - new Date(a.first_seen_date);
                      return new Date(a.next_review_date) - new Date(b.next_review_date);
                    })
                    .map((w, idx) => {
                      const isDue = new Date(w.next_review_date) <= new Date();
                      return (
                        <div key={idx} className="vocab-card glass-panel">
                          <div className="v-card-top">
                            <span className="v-word">{w.word}</span>
                            <div className="v-actions">
                               {isDue && <span className="v-due-indicator">🔥 Due</span>}
                               <button className="icon-btn" onClick={() => loadPronunciation(w.word)}>🔊</button>
                            </div>
                          </div>
                          <div className="v-def">{w.definition}</div>
                          <div className="v-ex">"{w.example_sentence}"</div>
                          <div className="v-card-bot">
                            <span className="v-mod">{w.source_module}</span>
                            <span className="v-rep">Lvl {w.review_count || 0}</span>
                          </div>
                        </div>
                      )
                    })
                  }
                  
                  {allWords.length === 0 && <div className="muted" style={{gridColumn: "1/-1", textAlign:"center", padding:"3rem 0"}}>Your notebook is empty. Complete lessons to discover words!</div>}
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
