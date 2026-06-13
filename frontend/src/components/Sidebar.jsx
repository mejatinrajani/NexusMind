import React from 'react';

export default function Sidebar({ bots, activeBotId, setActiveBotId, setBots, setActiveTab }) {
  const handleAddNewBot = () => {
    const uniqueId = `bot_${Math.random().toString(36).substring(2, 9)}`;
    const newBot = {
      id: uniqueId,
      name: `Agent Alpha ${bots.length + 1}`,
      prompt: 'You are a helpful data analyst.'
    };
    setBots(prev => [...prev, newBot]);
    setActiveBotId(uniqueId);
    setActiveTab('configure');
  };

  return (
    <div className="w-[260px] bg-[#FAFAFA] border-r border-gray-200 p-4 flex flex-col justify-between z-20">
      <div className="flex flex-col gap-6 overflow-y-auto">
        {/* SaaS Identity */}
        <div className="flex items-center gap-2.5 px-2 mt-2">
          <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center shadow-sm">
             <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h1 className="text-[14px] font-bold tracking-tight text-gray-900 leading-none">NexusMind</h1>
            <p className="text-[9px] text-gray-400 font-semibold tracking-wider mt-0.5">AGENTIC LABS</p>
          </div>
        </div>

        {/* Workspaces List Navigation */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Chatbots</span>
            <button 
              onClick={handleAddNewBot}
              className="text-gray-400 hover:text-gray-900 p-0.5 rounded transition-colors"
              title="Deploy New Agent Instance"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          <div className="space-y-0.5">
            {bots.map((bot) => {
              const isSelected = bot.id === activeBotId;
              return (
                <button
                  key={bot.id}
                  onClick={() => {
                    setActiveBotId(bot.id);
                    setActiveTab('chat');
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium rounded-md transition-all text-left ${isSelected ? 'bg-gray-200/60 text-gray-900 font-semibold shadow-2xs' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                >
                  <svg className={`w-3.5 h-3.5 ${isSelected ? 'text-gray-900' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="truncate flex-1">{bot.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-2 mb-1 border-t border-gray-200/60 pt-3">
        <div className="flex items-center gap-2 text-[11px] font-medium text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Graph Engine v1.2
        </div>
      </div>
    </div>
  );
}