import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Send, Sparkles, Trash2, Search, Settings, Cloud, CloudOff, LogIn, LogOut } from 'lucide-react';

const CLIENT_ID = '225390370216-6ss986645gnsb7jqbgiqv5sbrn282c74.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FILE_NAME = 'minimalizer_data.json';

const ContractManager = () => {
  const [contracts, setContracts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [aiSuggestion, setAISuggestion] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [driveFileId, setDriveFileId] = useState(null);
  // ✅ 修正: 手動追加用の専用state
  const [newContract, setNewContract] = useState({ name: '', monthlyFee: '' });
  const chatEndRef = useRef(null);

  // 1. 初期化ロジック
  useEffect(() => {
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) setGeminiApiKey(savedKey);
    else setShowApiKeyInput(true);

    // Google Identity Servicesの準備
    const script = document.createElement('script');
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => {
      window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            loadDataFromDrive(response.access_token);
          }
        },
      });
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 2. Google Drive連携 (Limbs: 手足)
  const handleAuth = () => window.tokenClient.requestAccessToken();

  const loadDataFromDrive = async (token) => {
    setIsLoading(true);
    try {
      const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}'&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const listData = await listRes.json();
      
      if (listData.files && listData.files.length > 0) {
        const fileId = listData.files[0].id;
        setDriveFileId(fileId);
        const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const content = await contentRes.json();
        setContracts(Array.isArray(content) ? content : []);
      } else {
        await saveDataToDrive([], token);
      }
    } catch (e) {
      console.error("Drive Sync Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDataToDrive = async (newData, token = accessToken, fileId = driveFileId) => {
    if (!token) return;
    const metadata = { name: FILE_NAME, mimeType: 'application/json' };
    const blob = new Blob([JSON.stringify(newData)], { type: 'application/json' });
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', blob);

    const url = fileId 
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    
    await fetch(url, {
      method: fileId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    }).then(res => res.json()).then(data => { if(data.id) setDriveFileId(data.id); });
  };

  // 3. AI・業務ロジック (Brain: 脳)
  const addContract = async (contractData) => {
    const contract = {
      id: Date.now().toString(),
      ...contractData,
      monthlyFee: contractData.monthlyFee ? parseInt(contractData.monthlyFee) : 0,
      addedAt: new Date().toISOString().split('T')[0]
    };
    const updated = [...contracts, contract];
    setContracts(updated);
    if (accessToken) await saveDataToDrive(updated);
    setShowAddModal(false);
    setShowAISuggestion(false);
    // ✅ 修正: 追加後にフォームをリセット
    setNewContract({ name: '', monthlyFee: '' });
  };

  const deleteContract = async (id) => {
    const updated = contracts.filter(c => c.id !== id);
    setContracts(updated);
    if (accessToken) await saveDataToDrive(updated);
    setShowDeleteModal(false);
  };

  const callGeminiAPI = async (userMessage) => {
    if (!geminiApiKey) return;
    const contractsContext = contracts.map(c => `- ${c.name} (¥${c.monthlyFee}/月)`).join('\n');
    const systemPrompt = `あなたはサブスク管理アシスタントです。\n現在の契約リスト:\n${contractsContext || 'なし'}\n提案時は SUGGEST: {"name": "...", "monthlyFee": ...} 形式を必ず含めてください。`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nユーザー: ${userMessage}` }] }]
        })
      });
      const data = await response.json();
      const aiResponse = data.candidates[0].content.parts[0].text;
      const suggestMatch = aiResponse.match(/SUGGEST:\s*({.*?})/);

      if (suggestMatch) {
        setAISuggestion(JSON.parse(suggestMatch[1]));
        setShowAISuggestion(true);
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse.replace(/SUGGEST:\s*{.*?}/, '').trim() }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `脳の通信エラー: ${e.message}` }]);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: inputMessage }]);
    setInputMessage('');
    setIsLoading(true);
    await callGeminiAPI(inputMessage);
    setIsLoading(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden font-sans">
      {/* 左：インベントリ（静） */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-black text-blue-600 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm">断</div>
              断捨離君
            </h1>
            <div className="flex gap-1">
              <button onClick={handleAuth} title="Google Drive接続" className={`p-2 rounded-xl transition-colors ${accessToken ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                {accessToken ? <Cloud className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
              </button>
              <button onClick={() => setShowApiKeyInput(true)} className="p-2 bg-gray-100 text-gray-400 rounded-xl hover:bg-gray-200">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
          <button onClick={() => { setNewContract({ name: '', monthlyFee: '' }); setShowAddModal(true); }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center justify-center gap-2 mb-4">
            <Plus className="w-5 h-5" /> 手動で追加
          </button>
          <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Monthly Total</span>
            <span className="text-lg font-black text-blue-900">¥{contracts.reduce((s,c)=>s+c.monthlyFee,0).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {contracts.map(c => (
            <div key={c.id} className="group p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-400 shadow-sm transition-all relative">
              <button onClick={() => { setDeleteTarget(c); setShowDeleteModal(true); }} className="absolute -top-2 -right-2 p-1 bg-white border border-gray-200 rounded-full text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                <X className="w-3 h-3" />
              </button>
              <h3 className="font-bold text-sm truncate pr-4">{c.name}</h3>
              <div className="text-xs font-bold text-blue-600 mt-1">¥{c.monthlyFee.toLocaleString()}/月</div>
            </div>
          ))}
        </div>
      </div>

      {/* 右：チャット（動） */}
      <div className="flex-1 flex flex-col bg-gray-50">
        <div className="p-4 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-2xl flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h2 className="font-black text-sm">AIエージェント</h2>
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${accessToken ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">{accessToken ? 'Sync Active' : 'Offline Mode'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-3xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && <div className="flex gap-2 items-center text-[10px] font-black text-gray-400 animate-pulse uppercase tracking-widest"><Sparkles className="w-3 h-3" /> Processing...</div>}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-gray-200">
          <div className="max-w-4xl mx-auto flex gap-3">
            <input type="text" value={inputMessage} onChange={(e)=>setInputMessage(e.target.value)} onKeyPress={(e)=>e.key==='Enter'&&sendMessage()} placeholder="最近のサブスク事情を相談..." className="flex-1 px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
            <button onClick={sendMessage} className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      {/* 設定・提案モーダル */}
      {showApiKeyInput && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
            <h3 className="font-black text-xl mb-2 text-center">Gemini API Key</h3>
            <p className="text-[10px] text-gray-400 mb-6 text-center font-bold uppercase tracking-widest">Browser-Only Memory Storage</p>
            <input type="password" id="apiInput" className="w-full px-4 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 mb-6 font-mono" placeholder="AIza..." defaultValue={geminiApiKey} />
            <button onClick={()=>{const k=document.getElementById('apiInput').value; localStorage.setItem('geminiApiKey',k); setGeminiApiKey(k); setShowApiKeyInput(false);}} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all">保存して接続</button>
          </div>
        </div>
      )}

      {showAISuggestion && aiSuggestion && (
        <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-blue-100">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6"><Sparkles className="text-blue-600 w-6 h-6" /></div>
            <h3 className="font-black text-xl mb-1">AIからの提案</h3>
            <p className="text-xs text-gray-500 mb-6">現在のリストに以下を追加・更新しますか？</p>
            <div className="bg-blue-50 p-5 rounded-2xl mb-8 border border-blue-100 shadow-inner">
              <div className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Proposed Item</div>
              <div className="font-black text-lg text-blue-900">{aiSuggestion.name}</div>
              <div className="text-blue-600 font-black">¥{aiSuggestion.monthlyFee.toLocaleString()}/月</div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>addContract(aiSuggestion)} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">承認してDrive更新</button>
              <button onClick={()=>setShowAISuggestion(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black hover:bg-gray-200 transition-all">無視</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm">
            <h3 className="font-black text-xl mb-6 text-center">この契約を解除（削除）しますか？</h3>
            <div className="flex gap-3">
              <button onClick={()=>deleteContract(deleteTarget.id)} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black shadow-lg shadow-red-200">削除を実行</button>
              <button onClick={()=>setShowDeleteModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black">戻る</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ 修正: 手動追加モーダル - 専用stateを使用 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm">
            <h3 className="font-black text-xl mb-6">新規サブスク登録</h3>
            <input type="text" placeholder="サービス名" className="w-full p-4 bg-gray-50 rounded-2xl mb-3 border-none focus:ring-2 focus:ring-blue-500" value={newContract.name} onChange={e=>setNewContract({...newContract, name:e.target.value})} />
            <input type="number" placeholder="月額" className="w-full p-4 bg-gray-50 rounded-2xl mb-6 border-none focus:ring-2 focus:ring-blue-500" value={newContract.monthlyFee} onChange={e=>setNewContract({...newContract, monthlyFee:e.target.value})} />
            <div className="flex gap-3">
              <button onClick={()=>addContract(newContract)} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200">登録</button>
              <button onClick={()=>setShowAddModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractManager;
