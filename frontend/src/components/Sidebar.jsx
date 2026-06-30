import React, { useState, useRef, useEffect } from 'react';

export default function Sidebar({ 
  bots, activeBotId, setActiveBotId, onCreateBot,
  threads, activeThreadId, setActiveThreadId, onCreateThread, onLogout,
  onRenameBot, onDeleteBot,
  onRenameThread, onDeleteThread,
  onTogglePinBot, onTogglePinThread // <-- New Pin Props
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingBotId, setEditingBotId] = useState(null);
  const [editBotName, setEditBotName] = useState('');
  const editBotInputRef = useRef(null);

  const [editingThreadId, setEditingThreadId] = useState(null);
  const [editThreadTitle, setEditThreadTitle] = useState('');
  const editThreadInputRef = useRef(null);

  useEffect(() => {
    if (editingBotId && editBotInputRef.current) editBotInputRef.current.focus();
    if (editingThreadId && editThreadInputRef.current) editThreadInputRef.current.focus();
  }, [editingBotId, editingThreadId]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newBotName.trim()) return;
    setIsSubmitting(true);
    await onCreateBot(newBotName, 'You are a helpful AI assistant.');
    setIsCreating(false);
    setNewBotName('');
    setIsSubmitting(false);
  };

  const submitBotRename = () => {
    if (editBotName.trim() && editingBotId) onRenameBot(editingBotId, editBotName);
    setEditingBotId(null);
  };

  const submitThreadRename = () => {
    if (editThreadTitle.trim() && editingThreadId) onRenameThread(editingThreadId, editThreadTitle);
    setEditingThreadId(null);
  };

  // Sort lists so Pinned items are always at the top
  const sortedBots = [...bots].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const sortedThreads = [...threads].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div className="w-64 bg-[#F9FAFB] border-r border-gray-200/60 flex flex-col h-full flex-shrink-0 selection:bg-gray-200">
      <div className="h-16 flex items-center px-5">
        <div className="w-6 h-6 bg-gray-900 rounded-md flex items-center justify-center mr-3 shadow-sm">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <h1 className="text-[13px] font-bold tracking-tight text-gray-900">NexusMind</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-8">
        
        {/* ================= AGENTS SECTION ================= */}
        <div>
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Workspaces</span>
            <button onClick={() => setIsCreating(!isCreating)} className="text-gray-400 hover:text-gray-900 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreateSubmit} className="mb-3 px-2 flex flex-col gap-2">
              <input 
                type="text" disabled={isSubmitting} placeholder="Agent name..." 
                className="w-full text-xs bg-white border border-gray-200 shadow-sm rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-gray-900"
                value={newBotName} onChange={(e) => setNewBotName(e.target.value)}
              />
            </form>
          )}

          <div className="space-y-0.5">
            {sortedBots.map((bot) => (
              <div key={bot.$id} className="relative group">
                {editingBotId === bot.$id ? (
                  <input
                    ref={editBotInputRef} type="text" value={editBotName}
                    onChange={(e) => setEditBotName(e.target.value)} onBlur={submitBotRename} onKeyDown={(e) => e.key === 'Enter' && submitBotRename()}
                    className="w-full text-[13px] font-medium bg-white border border-gray-900 shadow-sm rounded-md px-3 py-2 focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setActiveBotId(bot.$id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-[13px] font-medium transition-all flex items-center justify-between ${
                      activeBotId === bot.$id ? 'bg-white shadow-sm border border-gray-200/60 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate pr-8">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeBotId === bot.$id ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="truncate">{bot.name}</span>
                      {bot.pinned && <svg className="w-3 h-3 text-gray-400 flex-shrink-0 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M5.083 9.403a.75.75 0 011.058-.094L8 10.871V3.25a.75.75 0 011.5 0v7.621l1.86-1.562a.75.75 0 11.963 1.146l-3.25 2.729a.75.75 0 01-.963 0l-3.25-2.729a.75.75 0 01-.093-1.052z" /></svg>}
                    </div>

                    {/* Actions Menu (Always visible on hover!) */}
                    <div className="absolute right-1 flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5 bg-gradient-to-l from-white/90 via-white/80 to-transparent pl-4 rounded-r-md">
                      <div onClick={(e) => { e.stopPropagation(); onTogglePinBot(bot.$id, bot.pinned); }} className="p-1 text-gray-400 hover:text-gray-900 bg-white shadow-sm border border-gray-100 rounded transition-colors" title={bot.pinned ? "Unpin" : "Pin"}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v5.59l1.95-2.1a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 111.1-1.02l1.95 2.1V2.75A.75.75 0 0110 2z" clipRule="evenodd" /></svg>
                      </div>
                      <div onClick={(e) => { e.stopPropagation(); setEditBotName(bot.name); setEditingBotId(bot.$id); }} className="p-1 text-gray-400 hover:text-blue-600 bg-white shadow-sm border border-gray-100 rounded transition-colors ml-0.5" title="Rename">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                      <div onClick={(e) => { e.stopPropagation(); onDeleteBot(bot.$id); }} className="p-1 text-gray-400 hover:text-red-600 bg-white shadow-sm border border-gray-100 rounded transition-colors ml-0.5" title="Delete">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ================= SESSIONS SECTION ================= */}
        {activeBotId && (
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sessions</span>
              <button onClick={onCreateThread} className="text-gray-400 hover:text-gray-900 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            
            <div className="space-y-0.5">
              {sortedThreads.map((thread) => (
                <div key={thread.$id} className="relative group">
                  {editingThreadId === thread.$id ? (
                    <input
                      ref={editThreadInputRef} type="text" value={editThreadTitle}
                      onChange={(e) => setEditThreadTitle(e.target.value)} onBlur={submitThreadRename} onKeyDown={(e) => e.key === 'Enter' && submitThreadRename()}
                      className="w-full text-[12px] font-medium bg-white border border-gray-900 shadow-sm rounded-md px-3 py-1.5 focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setActiveThreadId(thread.$id)}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-[12px] font-medium transition-all flex items-center justify-between ${
                        activeThreadId === thread.$id ? 'bg-gray-200/60 text-gray-900' : 'text-gray-500 hover:bg-gray-200/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate pr-10">
                        {thread.pinned && <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M5.083 9.403a.75.75 0 011.058-.094L8 10.871V3.25a.75.75 0 011.5 0v7.621l1.86-1.562a.75.75 0 11.963 1.146l-3.25 2.729a.75.75 0 01-.963 0l-3.25-2.729a.75.75 0 01-.093-1.052z" /></svg>}
                        <span className="truncate">{thread.title}</span>
                      </div>

                      {/* Actions Menu (Always visible on hover) */}
                      <div className="absolute right-1 flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5 bg-gradient-to-l from-[#F9FAFB] via-[#F9FAFB] to-transparent pl-4 rounded-r-md">
                        <div onClick={(e) => { e.stopPropagation(); onTogglePinThread(thread.$id, thread.pinned); }} className="p-1 text-gray-400 hover:text-gray-900 bg-white shadow-sm border border-gray-100 rounded transition-colors" title="Pin Session">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v5.59l1.95-2.1a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 111.1-1.02l1.95 2.1V2.75A.75.75 0 0110 2z" clipRule="evenodd" /></svg>
                        </div>
                        <div onClick={(e) => { e.stopPropagation(); setEditThreadTitle(thread.title); setEditingThreadId(thread.$id); }} className="p-1 text-gray-400 hover:text-blue-600 bg-white shadow-sm border border-gray-100 rounded transition-colors ml-0.5" title="Rename">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </div>
                        <div onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.$id); }} className="p-1 text-gray-400 hover:text-red-600 bg-white shadow-sm border border-gray-100 rounded transition-colors ml-0.5" title="Delete">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200/60">
        <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-[12px] font-medium text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-200/50 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Log out
        </button>
      </div>
    </div>
  );
}