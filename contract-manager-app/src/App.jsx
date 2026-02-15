import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Send, Sparkles, Check, AlertCircle, Trash2, Search, Settings } from 'lucide-react';

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
  const chatEndRef = useRef(null);

  const [newContract, setNewContract] = useState({
    name: '',
    url: '',
    category: '',
    monthlyFee: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem('contracts');
    if (saved) setContracts(JSON.parse(saved));
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) setGeminiApiKey(savedKey);
    else setShowApiKeyInput(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('contracts', JSON.stringify(contracts));
  }, [contracts]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addContract = (contractData) => {
    const contract = {
      id: Date.now().toString(),
      ...contractData,
      monthlyFee: contractData.monthlyFee ? parseInt(contractData.monthlyFee) : 0,
      addedAt: new Date().toISOString().split('T')[0]
    };
    setContracts([...contracts, contract]);
    setNewContract({ name: '', url: '', category: '', monthlyFee: '' });
    setShowAddModal(false);
    setShowAISuggestion(false);
  };

  const deleteContract = (id) => {
    setContracts(contracts.filter(c => c.id !== id));
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  // --- API呼び出し部分 ---
  const callGeminiAPI = async (userMessage) => {
    if (!geminiApiKey) {
      setMessages(prev => [...prev, { role: 'assistant', content: '設定からAPIキーを入力してください。' }]);
      return;
    }

    const contractsContext = contracts.map(c => `- ${c.name} (¥${c.monthlyFee}/月)`).join('\n');
    const systemPrompt = `あなたはサブスク管理アシスタントです。\n現在の契約:\n${contractsContext || 'なし'}\n提案時は SUGGEST: {"name": "...", "monthlyFee": ...} 形式を含めて。`;

    try {
      // 最も安定したエンドポイントを使用
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nユーザー: ${userMessage}` }] }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const aiResponse = data.candidates[0].content.parts[0].text;
      const suggestMatch = aiResponse.match(/SUGGEST:\s*({.*?})/);

      if (suggestMatch) {
        const suggestion = JSON.parse(suggestMatch[1]);
        setAISuggestion(suggestion);
        setShowAISuggestion(true);
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse.replace(/SUGGEST:\s*{.*?}/, '').trim() || '提案があります。' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `エラー: ${error.message}` }]);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    const userMsg = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);
    await callGeminiAPI(inputMessage);
    setIsLoading(false);
  };

  const saveApiKey = (key) => {
    localStorage.setItem('geminiApiKey', key.trim());
    setGeminiApiKey(key.trim());
    setShowApiKeyInput(false);
    window.location.reload();
  };

  const filteredContracts = contracts.filter(c =>
    c.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const totalMonthly = contracts.reduce((sum, c) => sum + (c.monthlyFee || 0), 0);

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {/* サイドバー */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">断</div>
              契約管理
            </h1>
            <button onClick={() => setShowApiKeyInput(true)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} placeholder="検索..." className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
          </div>
          <button onClick={() => setShowAddModal(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm transition-all">
            <Plus className="w-4 h-4" /> 新規登録
          </button>
          <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
            <span className="text-xs text-blue-700 font-medium">月額合計</span>
            <span className="text-lg font-bold text-blue-900">¥{totalMonthly.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredContracts.map(contract => (
            <div key={contract.id} className="group p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-all relative">
              <button onClick={() => { setDeleteTarget(contract); setShowDeleteModal(true); }} className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
              <h3 className="font-bold text-gray-800 text-sm">{contract.name}</h3>
              <div className="flex justify-between items-end mt-1">
                <span className="text-xs font-semibold text-gray-500">¥{contract.monthlyFee.toLocaleString()}/月</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* メインチャット */}
      <div className="flex-1 flex flex-col bg-gray-50">
        <div className="p-4 bg-white border-b border-gray-200 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">AI相談窓口</h2>
            <p className="text-[10px] text-gray-500">Gemini を使用中</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-100 shadow-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && <div className="text-xs text-gray-400">考え中...</div>}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="メッセージを入力..." className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none" />
            <button onClick={sendMessage} className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      {/* 設定モーダル */}
      {showApiKeyInput && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
            <h3 className="font-bold mb-4 text-center">APIキー設定</h3>
            <input type="password" id="apiKeyInput" placeholder="AIzaSy..." className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg mb-4" defaultValue={geminiApiKey} />
            <button onClick={() => saveApiKey(document.getElementById('apiKeyInput').value)} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold">保存して開始</button>
          </div>
        </div>
      )}

      {/* 提案モーダル */}
      {showAISuggestion && aiSuggestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-6 w-80">
            <h3 className="font-bold mb-4">AIからの提案</h3>
            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm">
              <div>{aiSuggestion.name}</div>
              <div className="font-bold text-blue-600">¥{aiSuggestion.monthlyFee}/月</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => addContract(aiSuggestion)} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold">登録</button>
              <button onClick={() => setShowAISuggestion(false)} className="flex-1 py-2 text-gray-400">無視</button>
            </div>
          </div>
        </div>
      )}

      {/* 削除・追加モーダル（簡易版） */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-6 w-80">
            <h3 className="font-bold mb-4">手動登録</h3>
            <input type="text" placeholder="名前" className="w-full p-2 border rounded-lg mb-2" value={newContract.name} onChange={e => setNewContract({...newContract, name: e.target.value})} />
            <input type="number" placeholder="月額" className="w-full p-2 border rounded-lg mb-4" value={newContract.monthlyFee} onChange={e => setNewContract({...newContract, monthlyFee: e.target.value})} />
            <button onClick={() => addContract(newContract)} className="w-full py-2 bg-blue-600 text-white rounded-lg">登録</button>
            <button onClick={() => setShowAddModal(false)} className="w-full py-2 text-gray-400 text-sm mt-2">キャンセル</button>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-6 w-80 text-center">
            <p className="mb-4">削除しますか？</p>
            <div className="flex gap-2">
              <button onClick={() => deleteContract(deleteTarget.id)} className="flex-1 py-2 bg-red-600 text-white rounded-lg">削除</button>
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 text-gray-400">戻る</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractManager;
