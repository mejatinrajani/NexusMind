import React, { useRef, useEffect, useState } from 'react';

export default function ChatWindow({ messages, loading, chatbotId, showToast, onFeedback }) {
  const bottomRef = useRef(null);
  const [isSpeakingId, setIsSpeakingId] = useState(null); // Track which message is currently being spoken

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Cleanup speech if the component unmounts
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    if (showToast) showToast('Copied to clipboard');
  };

  const handleSpeak = (text, messageId) => {
    if (!('speechSynthesis' in window)) {
      if (showToast) showToast('Text-to-speech not supported in this browser.');
      return;
    }

    // If clicking the same message that's currently speaking, stop it
    if (isSpeakingId === messageId && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeakingId(null);
      return;
    }

    // Stop any current speech before starting a new one
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    // Optional: Adjust voice properties
    utterance.rate = 1.0; 
    utterance.pitch = 1.0;
    
    utterance.onend = () => {
      setIsSpeakingId(null);
    };

    utterance.onerror = () => {
      setIsSpeakingId(null);
    };

    setIsSpeakingId(messageId);
    window.speechSynthesis.speak(utterance);
  };
  
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col scroll-smooth pb-40 bg-[#FAFAFA]">
      
      {/* Premium Empty State */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center gap-5 mt-20 animate-[fadeIn_0.5s_ease-out]">
          <div className="w-16 h-16 bg-gradient-to-tr from-gray-900 to-gray-700 shadow-xl shadow-gray-900/20 rounded-2xl flex items-center justify-center mb-2 ring-4 ring-white">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">Agentic Graph Initialized</h3>
            <p className="text-[14px] text-gray-500 max-w-[300px] mt-2 leading-relaxed">
              Connected to workspace <code className="bg-gray-200/60 text-gray-800 px-1.5 py-0.5 rounded-md font-mono text-xs border border-gray-300/50">{chatbotId}</code>. How can I assist you today?
            </p>
          </div>
        </div>
      )}

      {/* Message List */}
      <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto">
        {messages.map((msg, idx) => {
          const msgId = msg.$id || msg.id || idx; // Fallback ID for tracking
          
          return (
            <div key={idx} className="flex gap-4 w-full text-[15px] leading-relaxed group">
              
              {/* Distinct Avatars */}
              <div className="flex-shrink-0 mt-0.5">
                {msg.role === 'user' ? (
                  <div className="w-8 h-8 bg-gradient-to-tr from-gray-200 to-gray-100 border border-gray-300 rounded-full flex items-center justify-center text-gray-600 text-xs font-bold shadow-sm">
                    U
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center shadow-md shadow-gray-900/20 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50"></div>
                    <svg className="w-4 h-4 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0 pt-1.5">
                <div className="text-gray-900 font-semibold mb-1 text-[13px] tracking-wide">
                  {msg.role === 'user' ? 'You' : 'Nexus Agent'}
                </div>
                <div className="text-gray-700 whitespace-pre-wrap text-[15px] leading-7">
                  {msg.content}
                </div>

                {/* Action Bar (Copy, Speak, Like, Dislike) */}
                {msg.role === 'assistant' && (
                  <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    
                    {/* Read Aloud Button */}
                    <button 
                      onClick={() => handleSpeak(msg.content, msgId)}
                      className={`p-1.5 rounded-md transition-colors ${
                        isSpeakingId === msgId 
                          ? 'text-blue-600 bg-blue-50 animate-pulse' 
                          : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                      title={isSpeakingId === msgId ? "Stop speaking" : "Read aloud"}
                    >
                      {isSpeakingId === msgId ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                      )}
                    </button>

                    <button 
                      onClick={() => handleCopy(msg.content)}
                      className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-200/50 rounded-md transition-colors"
                      title="Copy to clipboard"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                    
                    <button 
                      onClick={() => onFeedback && onFeedback(msg.$id || msg.id, msg.feedback === 'like' ? null : 'like')}
                      className={`p-1.5 rounded-md transition-colors ${
                        msg.feedback === 'like' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title="Helpful"
                    >
                      <svg className="w-4 h-4" fill={msg.feedback === 'like' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                    </button>
                    
                    <button 
                      onClick={() => onFeedback && onFeedback(msg.$id || msg.id, msg.feedback === 'dislike' ? null : 'dislike')}
                      className={`p-1.5 rounded-md transition-colors ${
                        msg.feedback === 'dislike' ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                      }`}
                      title="Not helpful"
                    >
                      <svg className="w-4 h-4" fill={msg.feedback === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                    </button>
                  </div>
                )}

                {/* Upgraded Terminal-Style Reasoning Path */}
                {msg.reasoning && msg.reasoning.length > 0 && (
                  <div className="mt-3 pt-4 border-t border-gray-200/60">
                    <details className="group cursor-pointer">
                      <summary className="text-[12px] font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1.5 outline-none select-none transition-colors w-max">
                        <svg className="w-4 h-4 transition-transform group-open:rotate-90 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                        View Execution Trace
                      </summary>
                      <div className="mt-3 bg-[#0F1117] rounded-xl p-4 shadow-inner border border-gray-800 font-mono text-[12px] text-emerald-400 flex flex-col gap-2 relative overflow-hidden cursor-text">
                        <div className="absolute top-0 left-0 right-0 h-6 bg-[#1A1D24] border-b border-gray-800 flex items-center px-3 gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-red-500/80"></div>
                          <div className="w-2 h-2 rounded-full bg-yellow-500/80"></div>
                          <div className="w-2 h-2 rounded-full bg-green-500/80"></div>
                          <span className="text-[9px] text-gray-500 uppercase tracking-widest ml-2">Agent Context</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 items-center">
                          <span className="text-gray-500 select-none">~ %</span>
                          {msg.reasoning.map((step, sIdx) => (
                            <React.Fragment key={sIdx}>
                              <span className="bg-emerald-400/10 text-emerald-400 px-2 py-1 rounded border border-emerald-400/20">{step}</span>
                              {sIdx < msg.reasoning.length - 1 && <span className="text-gray-600">→</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Sleek Loading State */}
        {loading && (
          <div className="flex gap-4 w-full animate-pulse">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
            </div>
            <div className="flex-1 pt-2.5 flex items-center gap-1.5">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
}