import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import BotCreator from './components/BotCreator';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import AuthScreen from './components/AuthScreen'; 
import { account, databases, CONFIG } from './lib/appwrite';
import { ID, Query } from 'appwrite';

export default function App() {
  // Authentication & Session States
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Multi-Tenant Workspace States
  const [bots, setBots] = useState([]);
  const [activeBotId, setActiveBotId] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  
  // Navigation & UI Management
  const [activeTab, setActiveTab] = useState('configure'); 
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Global Toast Notification State
  const [toast, setToast] = useState(null);
  
  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const previousSyncStatus = useRef(false);
  const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
  const currentBot = bots.find(b => b.$id === activeBotId) || null;

  // 1. LIFECYCLE HOOK: Validate User Session on Boot
  useEffect(() => {
    account.get()
      .then((res) => setUser(res))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  // 2. DATA HOOK: Fetch User's Distributed Chatbots
  useEffect(() => {
    if (!user) return;

    const fetchChatbots = async () => {
      try {
        const res = await databases.listDocuments(
          CONFIG.DATABASE_ID,
          CONFIG.COLLECTIONS.CHATBOTS,
          [Query.equal('user_id', user.$id), Query.orderDesc('$createdAt')]
        );
        setBots(res.documents);
        if (res.documents.length > 0) {
          setActiveBotId(res.documents[0].$id);
        }
      } catch (err) {
        console.error("Failed to fetch custom workspace agents:", err);
      }
    };
    fetchChatbots();
  }, [user]);

  // 3. DATA HOOK: Fetch Threads and Knowledge Docs when Active Bot Switches
  useEffect(() => {
    if (!user || !activeBotId) return;

    const fetchBotContext = async () => {
      try {
        // Fetch active threads for this chatbot
        const threadRes = await databases.listDocuments(
          CONFIG.DATABASE_ID,
          CONFIG.COLLECTIONS.THREADS,
          [Query.equal('chatbot_id', activeBotId), Query.equal('user_id', user.$id)]
        );
        setThreads(threadRes.documents);
        
        if (threadRes.documents.length > 0) {
          setActiveThreadId(threadRes.documents[0].$id);
        } else {
          setActiveThreadId(null);
          setMessages([]);
        }

        // Fetch registered training materials
        const docRes = await databases.listDocuments(
          CONFIG.DATABASE_ID,
          CONFIG.COLLECTIONS.DOCUMENTS,
          [Query.equal('chatbot_id', activeBotId)]
        );
        setUploadedDocs(docRes.documents);
      } catch (err) {
        console.error("Context synchronization failure:", err);
      }
    };
    fetchBotContext();
  }, [activeBotId, user]);

  // 4. DATA HOOK: Fetch Historical Chat Messages when Thread Switches
  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const res = await databases.listDocuments(
          CONFIG.DATABASE_ID,
          CONFIG.COLLECTIONS.MESSAGES,
          [Query.equal('thread_id', activeThreadId), Query.orderAsc('$createdAt')]
        );

        const formatted = res.documents.map(m => ({
          $id: m.$id,
          role: m.role,
          content: m.content,
          reasoning: m.reasoning_path ? JSON.parse(m.reasoning_path) : null,
          feedback: m.feedback || null 
        }));
        setMessages(formatted);
      } catch (err) {
        console.error("Failed to reconstruct historical thread:", err);
      }
    };
    fetchMessages();
  }, [activeThreadId]);

  // 5. GLOBAL POLLING LOOP: Monitor Engine Synchronization Statuses
  useEffect(() => {
    if (!activeBotId) return;
    let intervalId;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/bots/${activeBotId}/status`);
        const data = await res.json();
        
        const processing = data.status === 'processing' || data.status === 'ingesting';
        setIsSyncing(processing);

        if (previousSyncStatus.current === true && !processing) {
          // Trigger hot reloading for document state changes
          const docRes = await databases.listDocuments(
            CONFIG.DATABASE_ID,
            CONFIG.COLLECTIONS.DOCUMENTS,
            [Query.equal('chatbot_id', activeBotId)]
          );
          setUploadedDocs(docRes.documents);
          setActiveTab('chat');
        }
        previousSyncStatus.current = processing;
      } catch (err) {
        console.error("Failed to poll background pipeline metrics:", err);
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, 2000);
    return () => clearInterval(intervalId);
  }, [activeBotId, BACKEND_URL]);

  // 🛠️ WORKSPACE ACTION: Create a Brand New Agent Instance
  const handleCreateChatbot = async (name, prompt) => {
    try {
      const newBot = await databases.createDocument(
        CONFIG.DATABASE_ID,
        CONFIG.COLLECTIONS.CHATBOTS,
        ID.unique(),
        { user_id: user.$id, name, system_prompt: prompt, status: 'ready' }
      );
      setBots(prev => [newBot, ...prev]);
      setActiveBotId(newBot.$id);
      setActiveTab('configure');
    } catch (err) {
      console.error("Agent generation failed:", err);
    }
  };

  // 🛠️ WORKSPACE ACTION: Initialize a New Conversational Thread
  const handleCreateNewThread = async () => {
    if (!activeBotId) return;
    try {
      const title = `Session Thread #${threads.length + 1}`;
      const newThread = await databases.createDocument(
        CONFIG.DATABASE_ID,
        CONFIG.COLLECTIONS.THREADS,
        ID.unique(),
        { chatbot_id: activeBotId, user_id: user.$id, title }
      );
      setThreads(prev => [newThread, ...prev]);
      setActiveThreadId(newThread.$id);
      setMessages([]);
    } catch (err) {
      console.error("Failed to clear execution context and branch thread:", err);
    }
  };

  // 🛠️ WORKSPACE ACTION: Rename Chatbot
  const handleRenameChatbot = async (botId, newName) => {
    try {
      await databases.updateDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.CHATBOTS, botId, { name: newName });
      setBots(prev => prev.map(b => b.$id === botId ? { ...b, name: newName } : b));
      showToast('Workspace renamed successfully');
    } catch (err) {
      console.error("Rename failed:", err);
      showToast('Error renaming workspace');
    }
  };

  // 🛠️ WORKSPACE ACTION: Delete Chatbot
  const handleDeleteChatbot = async (botId) => {
    if (!window.confirm("Are you sure you want to delete this agent? This cannot be undone.")) return;
    try {
      await databases.deleteDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.CHATBOTS, botId);
      setBots(prev => prev.filter(b => b.$id !== botId));
      if (activeBotId === botId) {
        setActiveBotId(bots.length > 1 ? bots.find(b => b.$id !== botId).$id : null);
        setActiveTab('configure');
      }
      showToast('Workspace deleted');
    } catch (err) {
      console.error("Delete failed:", err);
      showToast('Error deleting workspace');
    }
  };

  // 🛠️ WORKSPACE ACTION: Rename Thread (Session)
  const handleRenameThread = async (threadId, newTitle) => {
    try {
      await databases.updateDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.THREADS, threadId, { title: newTitle });
      setThreads(prev => prev.map(t => t.$id === threadId ? { ...t, title: newTitle } : t));
      showToast('Session renamed');
    } catch (err) {
      console.error("Rename thread failed:", err);
      showToast('Error renaming session');
    }
  };

  // 🛠️ WORKSPACE ACTION: Delete Thread (Session)
  const handleDeleteThread = async (threadId) => {
    if (!window.confirm("Delete this chat session? This cannot be undone.")) return;
    try {
      await databases.deleteDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.THREADS, threadId);
      
      // Update UI state
      const remainingThreads = threads.filter(t => t.$id !== threadId);
      setThreads(remainingThreads);
      
      // If we deleted the active thread, switch to the next available one (or clear the screen)
      if (activeThreadId === threadId) {
        if (remainingThreads.length > 0) {
          setActiveThreadId(remainingThreads[0].$id);
        } else {
          setActiveThreadId(null);
          setMessages([]); // Clear the screen if no threads are left
        }
      }
      showToast('Session deleted');
    } catch (err) {
      console.error("Delete thread failed:", err);
      showToast('Error deleting session');
    }
  };

  const handleFeedback = async (messageId, feedbackType) => {
    if (!messageId) return;
    try {
      await databases.updateDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.MESSAGES, messageId, { feedback: feedbackType });
      // Update local state so the UI stays green/red instantly!
      setMessages(prev => prev.map(m => m.$id === messageId || m.id === messageId ? { ...m, feedback: feedbackType } : m));
      showToast(feedbackType === 'like' ? 'Marked as helpful' : 'Marked as unhelpful');
    } catch (err) {
      console.error("Feedback failed:", err);
    }
  };

  // 🛠️ WORKSPACE ACTION: Toggle Pin Chatbot
  const handleTogglePinBot = async (botId, currentStatus) => {
    try {
      await databases.updateDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.CHATBOTS, botId, { pinned: !currentStatus });
      setBots(prev => prev.map(b => b.$id === botId ? { ...b, pinned: !currentStatus } : b));
    } catch (err) {
      console.error("Pinning failed:", err);
    }
  };

  // 🛠️ WORKSPACE ACTION: Toggle Pin Thread (Session)
  const handleTogglePinThread = async (threadId, currentStatus) => {
    try {
      await databases.updateDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.THREADS, threadId, { pinned: !currentStatus });
      setThreads(prev => prev.map(t => t.$id === threadId ? { ...t, pinned: !currentStatus } : t));
    } catch (err) {
      console.error("Pinning failed:", err);
    }
  };

  // 🚀 CORE INFERENCE PIPE: Dispatches Queries, Persists Exchange to Appwrite
  const handleChat = async (e) => {
    e.preventDefault();
    if (!query.trim() || isSyncing || !activeBotId) return;

    let targetThreadId = activeThreadId;

    // Lazy initialization of parent thread container if none exists
    if (!targetThreadId) {
      try {
        const newThread = await databases.createDocument(
          CONFIG.DATABASE_ID,
          CONFIG.COLLECTIONS.THREADS,
          ID.unique(),
          { chatbot_id: activeBotId, user_id: user.$id, title: query.substring(0, 24) }
        );
        setThreads(prev => [newThread, ...prev]);
        targetThreadId = newThread.$id;
        setActiveThreadId(newThread.$id);
      } catch (err) {
        console.error("Thread fallback tracking failure:", err);
        return;
      }
    }

    const currentQuery = query;
    const userMsgObj = { role: 'user', content: currentQuery, reasoning: null };
    setMessages(prev => [...prev, userMsgObj]);
    setQuery('');
    setLoading(true);

    // Save prompt to database
    databases.createDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.MESSAGES, ID.unique(), {
      thread_id: targetThreadId,
      role: 'user',
      content: currentQuery
    });

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbot_id: activeBotId, thread_id: targetThreadId, question: currentQuery }),
      });
      const data = await res.json();

        if (res.ok) {
          // 1. Save inference payload to historical database FIRST to get its real ID
          const savedMsg = await databases.createDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.MESSAGES, ID.unique(), {
            thread_id: targetThreadId,
            role: 'assistant',
            content: data.answer,
            reasoning_path: data.reasoning_path ? JSON.stringify(data.reasoning_path) : null
          });

          // 2. Add it to the UI with the real Appwrite $id attached!
          const assistantMsgObj = { 
            $id: savedMsg.$id, 
            role: 'assistant', 
            content: data.answer, 
            reasoning: data.reasoning_path,
            feedback: null
          };

          setMessages(prev => [...prev, assistantMsgObj]);
        } 
        else {
          throw new Error(data.detail || 'Execution failed');
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection timed out or network drop.', reasoning: [] }]);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white text-gray-500 text-sm font-medium">
        Loading project environment context...
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans overflow-hidden antialiased">
      <Sidebar 
        bots={bots} 
        activeBotId={activeBotId} 
        setActiveBotId={setActiveBotId} 
        onCreateBot={handleCreateChatbot}
        threads={threads}
        activeThreadId={activeThreadId}
        setActiveThreadId={setActiveThreadId}
        onCreateThread={handleCreateNewThread}
        onRenameBot={handleRenameChatbot}
        onDeleteBot={handleDeleteChatbot}
        onRenameThread={handleRenameThread} 
        onDeleteThread={handleDeleteThread}
        onTogglePinBot={handleTogglePinBot}
        onTogglePinThread={handleTogglePinThread} 
        onLogout={async () => { await account.deleteSession('current'); setUser(null); }}
      />
      
      <div className="flex-1 flex flex-col h-full relative bg-white">
        {/* Top Header Controls */}
        <div className="h-14 border-b border-gray-100 px-8 flex items-center justify-between z-20 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">{currentBot ? currentBot.name : 'Select or Create an Agent'}</span>
            {isSyncing && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                Syncing Context
              </span>
            )}
          </div>
          
          {currentBot && (
            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
              <button 
                onClick={() => setActiveTab('chat')}
                disabled={uploadedDocs.length === 0 || isSyncing} 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'chat' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : (uploadedDocs.length === 0 || isSyncing)
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Playground Engine
              </button>
              <button 
                onClick={() => setActiveTab('configure')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeTab === 'configure' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Knowledge ({uploadedDocs.length}) & Prompts
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Workspace Matrix */}
        {!currentBot ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Create an agent from the workspace menu panel to begin training context.
          </div>
        ) : activeTab === 'configure' ? (
          <BotCreator 
            currentBot={currentBot} 
            BACKEND_URL={BACKEND_URL}
            uploadedDocs={uploadedDocs}
            setUploadedDocs={setUploadedDocs}
            isSyncing={isSyncing}
            setIsSyncing={setIsSyncing}
          />
        ) : (
          <div className="relative flex-1 flex flex-col h-full overflow-hidden">
            <div className={`flex-1 flex flex-col h-full bg-[#FAFAFA] transition-all duration-500 ${isSyncing ? 'blur-md opacity-40 pointer-events-none select-none' : ''}`}>
              <ChatWindow messages={messages} loading={loading} chatbotId={activeBotId} showToast={showToast} onFeedback={handleFeedback} />
              <ChatInput query={query} setQuery={setQuery} handleChat={handleChat} loading={loading} />
            </div>

            {/* Sync Overlay Interface Layer */}
            {isSyncing && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/20 backdrop-blur-[2px]">
                <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 flex flex-col items-center gap-5">
                  <div className="relative flex items-center justify-center w-14 h-14">
                    <svg className="animate-spin absolute w-full h-full text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-bold text-gray-900">Synchronizing Tenant Data Matrix</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-[200px]">Extracting layout semantics and constructing the knowledge graph.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-[12px] font-medium px-4 py-3 rounded-lg shadow-2xl z-50 animate-[fadeIn_0.2s_ease-out] flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
          {toast}
        </div>
      )}
    </div>
  );
}