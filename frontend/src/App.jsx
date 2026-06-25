import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import BotCreator from './components/BotCreator';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';

export default function App() {
  const [bots, setBots] = useState([
    { id: 'organization_default_bot', name: 'Nexus Core Agent', prompt: 'You are a professional enterprise knowledge graph assistant.' }
  ]);
  const [activeBotId, setActiveBotId] = useState('organization_default_bot');
  const [activeTab, setActiveTab] = useState('chat');
  
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState({});
  const [loading, setLoading] = useState(false);
  
  // GLOBAL SYNC STATE
  const [isSyncing, setIsSyncing] = useState(false);

  const BACKEND_URL = 'https://nexusmind-zcn5.onrender.com/api/v1';
  const currentBot = bots.find(b => b.id === activeBotId) || bots[0];

  // GLOBAL POLLING LOOP: Checks bot status even if user switches tabs
  useEffect(() => {
    let intervalId;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/bots/${activeBotId}/status`);
        const data = await res.json();
        setIsSyncing(data.status === 'processing');
      } catch (err) {
        console.error("Failed to check status", err);
      }
    };

    // Check instantly on bot switch
    checkStatus();
    // Then poll every 2 seconds
    intervalId = setInterval(checkStatus, 2000);

    return () => clearInterval(intervalId);
  }, [activeBotId, BACKEND_URL]);

  const appendMessage = (botId, message) => {
    setMessages(prev => ({
      ...prev,
      [botId]: [...(prev[botId] || []), message]
    }));
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!query.trim() || isSyncing) return; // Prevent chat if syncing

    const currentQuery = query;
    appendMessage(activeBotId, { role: 'user', content: currentQuery, reasoning: null });
    setQuery('');
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbot_id: activeBotId, question: currentQuery }),
      });
      const data = await res.json();

      if (res.ok) {
        appendMessage(activeBotId, { role: 'assistant', content: data.answer, reasoning: data.reasoning_path });
      } else {
        throw new Error(data.detail || 'Execution failed');
      }
    } catch (err) {
      appendMessage(activeBotId, { role: 'assistant', content: 'Connection timed out.', reasoning: [] });
    } finally {
      setLoading(false);
    }
  };

  const activeBotHistory = messages[activeBotId] || [];

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans overflow-hidden antialiased">
      <Sidebar 
        bots={bots} 
        activeBotId={activeBotId} 
        setActiveBotId={setActiveBotId} 
        setBots={setBots}
        setActiveTab={setActiveTab}
      />
      
      <div className="flex-1 flex flex-col h-full relative bg-white">
        {/* Top Header */}
        <div className="h-14 border-b border-gray-100 px-8 flex items-center justify-between z-20 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">{currentBot.name}</span>
            {isSyncing && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                Syncing
              </span>
            )}
          </div>
          
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
            <button 
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'chat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Playground Engine
            </button>
            <button 
              onClick={() => setActiveTab('configure')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'configure' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Knowledge & Prompts
            </button>
          </div>
        </div>

        {activeTab === 'configure' ? (
          <BotCreator 
            currentBot={currentBot} 
            BACKEND_URL={BACKEND_URL}
            onUpdateBot={(updatedFields) => {
              setBots(prev => prev.map(b => b.id === activeBotId ? { ...b, ...updatedFields } : b));
            }}
            isSyncing={isSyncing}
            setIsSyncing={setIsSyncing}
          />
        ) : (
          <div className="relative flex-1 flex flex-col h-full overflow-hidden">
            
            {/* The Chat Area - Blurred and disabled when syncing */}
            <div className={`flex-1 flex flex-col h-full transition-all duration-500 ${isSyncing ? 'blur-md opacity-40 pointer-events-none select-none' : ''}`}>
              <ChatWindow messages={activeBotHistory} loading={loading} chatbotId={activeBotId} />
              <ChatInput query={query} setQuery={setQuery} handleChat={handleChat} loading={loading} />
            </div>

            {/* The Sync Overlay Lock Screen */}
            {isSyncing && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/20 backdrop-blur-[2px]">
                <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 flex flex-col items-center gap-5 transform transition-all">
                  <div className="relative flex items-center justify-center w-14 h-14">
                    <svg className="animate-spin absolute w-full h-full text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <svg className="w-5 h-5 text-gray-900 absolute" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-bold text-gray-900 tracking-tight">Agent is Syncing</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-[200px]">Extracting layout semantics and constructing the knowledge graph.</p>
                  </div>
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}