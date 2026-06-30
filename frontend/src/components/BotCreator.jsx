import React, { useState, useEffect } from 'react';
import { databases, CONFIG } from '../lib/appwrite';
import { ID } from 'appwrite';

export default function BotCreator({ currentBot, BACKEND_URL, uploadedDocs = [], setUploadedDocs, isSyncing, setIsSyncing }) {
  const [name, setName] = useState(currentBot?.name || '');
  const [prompt, setPrompt] = useState(currentBot?.system_prompt || '');
  
  // Refined Interactive States
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
  
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Sync local UI state when switching workspaces
  useEffect(() => {
    setName(currentBot?.name || '');
    setPrompt(currentBot?.system_prompt || '');
    setSaveStatus(null);
    setUploadError('');
    setFiles([]);
  }, [currentBot?.$id]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      await databases.updateDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.CHATBOTS, currentBot.$id, { name, system_prompt: prompt });
      await fetch(`${BACKEND_URL}/bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbot_id: currentBot.$id, name, system_prompt: prompt })
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000); // Fade out success after 3 seconds
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;
    
    setIsUploading(true);
    setUploadError('');

    try {
      const docPromises = files.map(file => 
        databases.createDocument(CONFIG.DATABASE_ID, CONFIG.COLLECTIONS.DOCUMENTS, ID.unique(), {
          chatbot_id: currentBot.$id, name: file.name, status: 'processing', storage_id: 'pending'
        })
      );
      const newDocs = await Promise.all(docPromises);
      setUploadedDocs(prev => [...newDocs, ...prev]);

      const formData = new FormData();
      formData.append('chatbot_id', currentBot.$id);
      files.forEach(file => formData.append('files', file));

      const res = await fetch(`${BACKEND_URL}/ingest/batch`, { method: 'POST', body: formData });
      if (res.ok) {
        setFiles([]);
        setIsSyncing(true);
      } else {
        setUploadError('Failed to transfer files to extraction engine.');
      }
    } catch (err) {
      setUploadError('Network timeout during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!currentBot) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-white selection:bg-gray-100">
      <div className="max-w-2xl mx-auto px-8 py-12 flex flex-col gap-12">
        
        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Workspace Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Configure your agent's identity and semantic knowledge base.</p>
        </div>

        {/* Configuration Section */}
        <section className="flex flex-col gap-5">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="text-sm font-semibold text-gray-900">Identity</h3>
          </div>
          
          <form className="flex flex-col gap-5" onSubmit={handleSaveConfig}>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Display Name</label>
              <input 
                type="text" 
                className="w-full bg-transparent border-none text-lg font-medium text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-0 p-0"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name your agent..."
                disabled={isSyncing || isSaving}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">System Instructions</label>
              <textarea 
                rows="4"
                className="w-full bg-[#F9FAFB] border border-gray-100 rounded-xl p-4 text-[13px] font-mono text-gray-700 leading-relaxed focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 transition-all resize-none shadow-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Define the agent's core behavior, tone, and operational boundaries..."
                disabled={isSyncing || isSaving}
              />
            </div>

            <div className="flex items-center gap-4 mt-2">
              <button 
                type="submit"
                disabled={isSyncing || isSaving}
                className="bg-gray-900 text-white text-[12px] font-semibold py-2 px-6 rounded-lg shadow-sm hover:bg-gray-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
              >
                {isSaving ? (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  'Save Configuration'
                )}
              </button>

              {/* Animated Inline Feedback Toasts */}
              {saveStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 animate-fade-in-out">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  Committed successfully
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-red-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  Failed to update configuration
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Knowledge Section */}
        <section className="flex flex-col gap-5">
          <div className="border-b border-gray-100 pb-2">
            <h3 className="text-sm font-semibold text-gray-900">Knowledge Context</h3>
          </div>

          <form onSubmit={handleBatchUpload} className="flex flex-col gap-4">
            
            {/* The Dropzone / Syncing State Swap */}
            {isSyncing ? (
              <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-blue-400 rounded-full blur animate-pulse opacity-20"></div>
                  <div className="relative bg-white border border-blue-100 p-3 rounded-2xl shadow-sm">
                    <svg className="animate-spin w-6 h-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  </div>
                </div>
                <h4 className="text-[13px] font-bold text-gray-900">Constructing Knowledge Graph</h4>
                <p className="text-[11px] text-gray-500 mt-1 max-w-[250px]">Extracting text chunks, generating vector embeddings, and mapping relationships in the background.</p>
              </div>
            ) : (
              <div className={`relative group border border-dashed rounded-xl p-8 text-center transition-all duration-200 ${files.length > 0 ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400 bg-white cursor-pointer'}`}>
                <input 
                  type="file" multiple accept=".pdf,.txt,.docx"
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  onChange={(e) => { setFiles(Array.from(e.target.files)); setUploadError(''); }}
                  disabled={isUploading}
                />
                <div className="flex flex-col items-center gap-2">
                  <svg className={`w-6 h-6 transition-colors ${files.length > 0 ? 'text-gray-900' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" /></svg>
                  <span className="text-[13px] font-medium text-gray-900">
                    {files.length > 0 ? `${files.length} files queued for extraction` : 'Drag & drop or click to add files'}
                  </span>
                  <span className="text-[11px] text-gray-400">Supported: PDF, TXT, DOCX</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="text-[11px] font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {uploadError}
              </div>
            )}

            {/* Upload Action Button */}
            {files.length > 0 && !isSyncing && (
              <button 
                type="submit"
                disabled={isUploading}
                className="w-full bg-gray-900 text-white text-[13px] font-semibold py-3 rounded-lg shadow-sm hover:bg-gray-800 transition-all disabled:bg-gray-800 flex items-center justify-center gap-2 relative overflow-hidden"
              >
                {isUploading ? (
                  <>
                    {/* Simulated sweeping gradient progress bar in the background */}
                    <div className="absolute inset-0 bg-white/20 animate-pulse w-full"></div>
                    <svg className="animate-spin h-4 w-4 text-white relative z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="relative z-10">Uploading payload...</span>
                  </>
                ) : (
                  'Commence Extraction Pipeline'
                )}
              </button>
            )}
          </form>

          {/* Active Documents List */}
          {uploadedDocs.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {uploadedDocs.map((doc) => (
                <div key={doc.$id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 group">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:border-gray-300 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <span className="text-[13px] text-gray-700 font-medium truncate max-w-[300px]">{doc.name}</span>
                  </div>
                  {doc.status === 'processing' ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                      Syncing
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Active</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}