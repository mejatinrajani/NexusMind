import React, { useRef, useEffect, useState } from 'react';

export default function ChatInput({ query, setQuery, handleChat, loading }) {
  const inputRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Auto-focus input on load
  useEffect(() => {
    inputRef.current?.focus();
    
    // Cleanup active listening if component unmounts
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser doesn't support voice input. Try Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      // Compile the speech results into a single string
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      
      setQuery(transcript);
      
      // Auto-resize the text area as words come in
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    setIsListening(true);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent pt-12 pb-8 px-4 pointer-events-none">
      <div className="max-w-3xl mx-auto relative pointer-events-auto">
        
        <form 
          onSubmit={handleChat} 
          className="relative flex items-end bg-white/80 backdrop-blur-xl border border-gray-200 shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-gray-900/20 focus-within:border-gray-900 transition-all duration-300"
        >
          <textarea
            ref={inputRef}
            placeholder={isListening ? "Listening..." : "Message your agent..."}
            className="w-full max-h-[200px] bg-transparent pl-5 pr-24 py-4 text-[15px] focus:outline-none text-gray-900 resize-none overflow-y-auto leading-relaxed placeholder-gray-400"
            rows="1"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (query.trim() && !loading) handleChat(e);
              }
            }}
            disabled={loading}
          />
          
          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
            {/* Microphone Button */}
            <button
              type="button"
              onClick={toggleListening}
              disabled={loading}
              className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center ${
                isListening 
                  ? 'bg-red-50 text-red-500 hover:bg-red-100 animate-pulse' 
                  : 'bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title="Dictate message"
            >
              <svg className="w-5 h-5" fill={isListening ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 10v2a7 7 0 01-14 0v-2m7 6v4m-3-4h6M12 4a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z" />
              </svg>
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="p-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 transition-all duration-200 shadow-sm disabled:shadow-none hover:scale-105 active:scale-95 flex items-center justify-center"
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
            </button>
          </div>
        </form>
        
        <div className="text-center mt-3">
          <span className="text-[11px] text-gray-400 font-medium tracking-wide">
            Nexus AI can make mistakes. Verify critical logic.
          </span>
        </div>
      </div>
    </div>
  );
}