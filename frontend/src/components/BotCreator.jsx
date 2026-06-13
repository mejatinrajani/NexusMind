import React, { useState, useEffect } from 'react';

export default function BotCreator({ currentBot, BACKEND_URL, onUpdateBot }) {
  const [name, setName] = useState(currentBot.name);
  const [prompt, setPrompt] = useState(currentBot.prompt);
  const [syncStatus, setSyncStatus] = useState('');
  
  const [files, setFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // New States for precise UI tracking
  const [isUploading, setIsUploading] = useState(false); // HTTP upload state
  const [isSyncing, setIsSyncing] = useState(false);     // Background graph building state

  // Poll the backend status when a sync is active
  useEffect(() => {
    let intervalId;
    
    const checkStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/bots/${currentBot.id}/status`);
        const data = await res.json();
        
        if (data.status === 'idle' && isSyncing) {
          setIsSyncing(false);
          setUploadStatus('✅ Graph database synced! Agent is ready to chat.');
          setFiles([]); // Clear the queue after successful sync
        } else if (data.status === 'processing') {
          setIsSyncing(true);
        }
      } catch (err) {
        console.error("Failed to check status", err);
      }
    };

    if (isSyncing) {
      intervalId = setInterval(checkStatus, 2000); // Check every 2 seconds
    } else {
      // Do an initial check just in case we switch tabs while it's syncing
      checkStatus(); 
    }

    return () => clearInterval(intervalId);
  }, [isSyncing, currentBot.id, BACKEND_URL]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSyncStatus('Saving parameters...');
    try {
      const res = await fetch(`${BACKEND_URL}/bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbot_id: currentBot.id, name, system_prompt: prompt })
      });
      if (res.ok) {
        onUpdateBot({ name, prompt });
        setSyncStatus('✅ Configuration committed.');
      } else {
        setSyncStatus('Error updating configuration.');
      }
    } catch {
      setSyncStatus('Backend connection exception.');
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
    setUploadStatus(''); // Reset status on new selection
  };

  const handleBatchUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadStatus('Uploading files to server...');
    
    const formData = new FormData();
    formData.append('chatbot_id', currentBot.id);
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const res = await fetch(`${BACKEND_URL}/ingest/batch`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setUploadStatus('Upload complete. Agents are parsing the data...');
        setIsSyncing(true); // Trigger the polling effect
      } else {
        setUploadStatus(`Extraction exception: Failed to upload.`);
      }
    } catch {
      setUploadStatus('Agentic indexing pipeline timeout.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-10 mt-4 pb-20">
      
      {/* Column A: Persona Engine */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-base font-bold text-gray-900 tracking-tight">Agent Engine Properties</h2>
          <p className="text-xs text-gray-500 mt-0.5">Control instructions, contextual parameters, and agent identities.</p>
        </div>

        <form onSubmit={handleSaveConfig} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Display Name</label>
            <input 
              type="text" 
              className="w-full bg-white border border-gray-200 rounded-md p-2.5 text-xs text-gray-800 font-medium focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 shadow-2xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSyncing}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">System Prompt Persona</label>
            <textarea 
              rows="8"
              className="w-full bg-white border border-gray-200 rounded-md p-2.5 text-xs font-mono text-gray-800 leading-relaxed focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 shadow-2xs resize-none"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Inject core behavioral configurations here..."
              disabled={isSyncing}
            />
          </div>

          <button 
            type="submit"
            disabled={isSyncing}
            className="bg-gray-900 text-white disabled:bg-gray-300 text-xs font-semibold py-2 px-4 rounded-md shadow-xs hover:bg-gray-800 self-start transition-all"
          >
            Commit Persona Config
          </button>
          
          {syncStatus && <span className="text-[11px] font-medium text-emerald-600 border-l-2 border-emerald-400 pl-2">{syncStatus}</span>}
        </form>
      </div>

      {/* Column B: Knowledge Ingestion */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-base font-bold text-gray-900 tracking-tight">Multimodal Knowledge Stream</h2>
          <p className="text-xs text-gray-500 mt-0.5">Upload text configurations, documents, layout matrices, or text-heavy images.</p>
        </div>

        <form onSubmit={handleBatchUpload} className="flex flex-col gap-4">
          
          {/* Drag & Drop Zone */}
          <div className={`relative group border-2 border-dashed rounded-lg p-6 text-center transition-all ${isSyncing ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-gray-900 bg-[#FAFAFA] cursor-pointer'}`}>
            <input 
              type="file" 
              multiple 
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              onChange={handleFileChange}
              disabled={isSyncing}
            />
            <svg className={`w-6 h-6 mx-auto mb-2 transition-colors ${isSyncing ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className={`text-xs font-medium block ${isSyncing ? 'text-gray-400' : 'text-gray-700'}`}>
              {isSyncing ? 'System locked during graph sync...' : 'Click or Drag to select multiple files'}
            </span>
            <span className="text-[10px] text-gray-400 mt-1 block">PDF, DOCX, TXT, PNG, JPG</span>
          </div>

          {/* Active File List */}
          {files.length > 0 && (
            <div className="bg-gray-50 rounded-md border border-gray-200 p-3 max-h-[200px] overflow-y-auto space-y-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Files Selected ({files.length})
                </span>
                {!isSyncing && (
                  <button type="button" onClick={() => setFiles([])} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Clear All</button>
                )}
              </div>
              
              {files.map((f, index) => (
                <div key={index} className="flex items-center justify-between text-xs bg-white border border-gray-200 p-2 rounded shadow-sm">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span className="truncate max-w-[180px] font-mono text-[11px] text-gray-700">{f.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">{(f.size / 1024).toFixed(1)} KB</span>
                </div>
              ))}
            </div>
          )}

          {/* Sync Button */}
          <button 
            type="submit"
            disabled={files.length === 0 || isUploading || isSyncing}
            className="w-full bg-blue-600 text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-xs font-bold py-3 rounded-md shadow-sm hover:bg-blue-700 transition-all flex justify-center items-center gap-2"
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span className="text-gray-500">Constructing Knowledge Graph...</span>
              </>
            ) : isUploading ? (
              'Uploading to Node...'
            ) : (
              'Sync Files to Database'
            )}
          </button>

          {/* Status Message */}
          {uploadStatus && (
            <div className={`text-[11px] font-medium p-3 rounded border-l-2 ${isSyncing ? 'bg-blue-50 border-blue-400 text-blue-700' : uploadStatus.includes('✅') ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-gray-50 border-gray-400 text-gray-600'}`}>
              {uploadStatus}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}