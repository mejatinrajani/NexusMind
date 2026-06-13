import React, { useEffect, useRef } from 'react';

export default function ChatWindow({ messages, loading, chatbotId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-20 lg:px-48 py-8 flex flex-col gap-8 scroll-smooth pb-32">
      
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center gap-3 mt-20 opacity-80">
          <div className="w-12 h-12 bg-gray-50 border border-gray-200 rounded-full flex items-center justify-center mb-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Agentic Graph Initialized</h3>
          <p className="text-[13px] text-gray-500 max-w-[250px]">
            Connected to namespace <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono">{chatbotId}</code>. Ask a question to begin.
          </p>
        </div>
      )}

      {messages.map((msg, idx) => (
        <div key={idx} className="flex gap-4 w-full text-[15px] leading-relaxed">
          {/* Avatar Icon */}
          <div className="flex-shrink-0 mt-1">
            {msg.role === 'user' ? (
              <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xs font-bold">
                U
              </div>
            ) : (
              <div className="w-7 h-7 bg-gray-900 rounded-sm flex items-center justify-center shadow-sm text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
            )}
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <div className="text-gray-900 font-medium mb-1">
              {msg.role === 'user' ? 'You' : 'Nexus Agent'}
            </div>
            <div className="text-gray-700 whitespace-pre-wrap">
              {msg.content}
            </div>

            {/* Execution Trace Terminal */}
            {msg.reasoning && msg.reasoning.length > 0 && (
              <div className="mt-4 pt-4">
                <details className="group cursor-pointer">
                  <summary className="text-[12px] font-semibold text-gray-400 hover:text-gray-700 flex items-center gap-1.5 outline-none select-none transition-colors w-max">
                    <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                    View Agent Reasoning Path
                  </summary>
                  <div className="mt-3 bg-[#F8F9FA] rounded-lg p-3 border border-gray-200 font-mono text-[11px] text-gray-600 flex flex-wrap gap-2 items-center">
                    <span className="text-gray-400 select-none">❯</span>
                    {msg.reasoning.map((step, sIdx) => (
                      <React.Fragment key={sIdx}>
                        <span className="bg-white px-2 py-1 rounded shadow-sm border border-gray-100">{step}</span>
                        {sIdx < msg.reasoning.length - 1 && <span className="text-gray-300">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Loading State */}
      {loading && (
        <div className="flex gap-4 w-full">
          <div className="flex-shrink-0 mt-1">
            <div className="w-7 h-7 bg-gray-900 rounded-sm flex items-center justify-center shadow-sm text-white">
              <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2 text-[14px] text-gray-500 font-medium">
             Analyzing graph structure...
          </div>
        </div>
      )}
      
      <div ref={bottomRef} />
    </div>
  );
}