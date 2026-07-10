import { useEffect, useState, useRef } from 'react';
import { speak } from '../utils/voice';

export default function Results({ state, currentUser, onRestart, backendUrl }) {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    async function fetchRecommendations() {
      try {
        const res = await fetch(`${backendUrl}/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        });
        const data = await res.json();
        setRecommendations(data.recommendations || []);

        if ((data.recommendations || []).length > 0) {
          speak("Thank you! Based on everything you told me, here are your closest matches. Enjoy!");
        } else {
          speak("Sorry, I couldn't find a close match this time. Please try again with different preferences.");
        }
      } catch (e) {
        console.warn('recommend failed', e);
        setRecommendations([]);
        speak("Something went wrong fetching your recommendations.");
      }
      setLoading(false);
    }
    fetchRecommendations();
  }, []);

  // final_score is a 0-100-ish weighted composite from the rule engine —
  // clamp into a sane percent range for the match bar display
  function toMatchPercent(finalScore) {
    if (finalScore == null) return 50;
    return Math.min(99, Math.max(30, Math.round(finalScore)));
  }

  return (
    <div className="results-screen">
      <style>{`
        @keyframes swakriti-spin {
          to { transform: rotate(360deg); }
        }

        .results-screen {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 16px 24px;
          box-sizing: border-box;
        }

        @media (min-width: 768px) {
          .results-screen {
            padding: 0 32px 32px;
          }
        }

        @media (min-width: 1024px) {
          .results-screen {
            padding: 0 48px 48px;
          }
        }

        .results-header {
          width: 100%;
          box-sizing: border-box;
          padding: clamp(16px, 5vw, 28px) clamp(16px, 5vw, 24px);
          border-radius: 16px;
          overflow-wrap: break-word;
        }

        .results-title {
          margin: 0;
          font-size: clamp(1.4rem, 6vw, 2rem);
          line-height: 1.25;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          word-break: break-word;
        }

        .results-header-subtext {
          margin: 6px 0 0;
          font-size: clamp(0.8rem, 3.2vw, 0.95rem);
          line-height: 1.4;
          white-space: normal;
          overflow-wrap: break-word;
          opacity: 0.85;
        }

        .results-subtext,
        .hero-subtext {
          font-size: clamp(0.85rem, 3.5vw, 1rem);
          line-height: 1.5;
          text-align: center;
          padding: 0 4px;
        }

        .result-cards {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          width: 100%;
        }

        @media (min-width: 480px) {
          .result-cards {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 900px) {
          .result-cards {
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
          }
        }

        @media (min-width: 1200px) {
          .result-cards {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .result-card {
          width: 100%;
          box-sizing: border-box;
          padding: clamp(12px, 4vw, 18px);
          border-radius: 14px;
        }

        .result-name {
          font-size: clamp(1rem, 4vw, 1.15rem);
          overflow-wrap: break-word;
          margin: 0 0 4px;
        }

        .result-desc {
          font-size: clamp(0.8rem, 3.2vw, 0.9rem);
          overflow-wrap: break-word;
        }

        .tag-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .cta-button {
          width: 100%;
          max-width: 320px;
          box-sizing: border-box;
        }
      `}</style>

      <div className="results-header">
        <h1 className="results-title">Your Swakriti Picks <span aria-hidden="true">✨</span></h1>
        <p className="results-header-subtext">
          {currentUser ? `Logged in as ${currentUser}` : 'Guest session — not saved'}
        </p>
      </div>

      {loading && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '2.5rem 0',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid rgba(0,0,0,0.1)',
              borderTopColor: '#0d4d3c',
              borderRadius: '50%',
              animation: 'swakriti-spin 0.8s linear infinite',
            }}
          />
          <p className="voice-hint">Matching from our collection…</p>
        </div>
      )}

      {!loading && recommendations && recommendations.length > 0 && (
        <p className="results-subtext">
          These are your closest matches based on what you told us — not a perfect
          filter, just the best fit from our current collection.
        </p>
      )}

      {!loading && recommendations && recommendations.length > 0 && (
        <div className="result-cards">
          {recommendations.map((p) => {
            const matchPercent = toMatchPercent(p.final_score);
            const tags = [p.occasion_primary, p.fabric_category, p.style]
              .filter(Boolean)
              .slice(0, 3);

            return (
              <div className="result-card" key={p.sku_id}>
                <div className="badge">{p.rank_label || 'Match'}</div>
                <h3 className="result-name">{p.name}</h3>
                <p className="result-desc">
                  {[p.brand, p.category].filter(Boolean).join(' · ')}
                  {p.specific_color ? ` — ${p.specific_color}` : ''}
                </p>
                <p className="result-price">
                  {p.price != null ? `₹${p.price}` : 'Price unavailable'}
                </p>
                <div className="match-bar">
                  <div className="match-fill" style={{ width: `${matchPercent}%` }} />
                </div>
                <p className="match-label">{matchPercent}% match</p>
                {tags.length > 0 && (
                  <div className="tag-row">
                    {tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}
                  </div>
                )}
                {p.is_new_arrival && (
                  <div className="tag-row" style={{ marginTop: '6px' }}>
                    <span className="tag">New arrival</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && recommendations && recommendations.length === 0 && (
        <p className="hero-subtext">
          No close matches found in your budget/occasion combo — try starting over
          with a wider budget.
        </p>
      )}

      {!loading && (
        <>
          <p className="results-thankyou">Thank you for shopping with Swakriti 🙏</p>
          <button className="cta-button" onClick={onRestart}>Start over</button>
        </>
      )}
    </div>
  );
}