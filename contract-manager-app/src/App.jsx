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

  // 1. 初期読み込み（APIキーとデータを取得）
  useEffect(() => {
    const saved = localStorage.getItem('contracts');
    if (saved) {
      setContracts(JSON.parse(saved));
    }
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
      setGeminiApiKey(savedKey);
    } else {
      setShowApiKeyInput(true);
    }
  }, []);

  // 2. データの保存
  useEffect(() => {
    localStorage.setItem('contracts', JSON.stringify(contracts));
  }, [contracts]);

  // 3. チャット自動スクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. 契約追加
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

  // 5. 契約削除
  const deleteContract = (id) => {
    setContracts(contracts.filter(c => c.id !== id));
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  // 6. Gemini API 呼び出し (★2.0 Flash 確定版)
  const callGeminiAPI = async (userMessage) => {
    if (!geminiApiKey) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'APIキーが設定されていません。右上の設定ボタンから入力してください。'
      }]);
      return;
    }

    const contractsContext = contracts.map(c => 
      `- ${c.name} (${c.category || '未分類'}, ¥${c.monthlyFee}/月)`
    ).join('\n');

    const systemPrompt = `あなたは契約・サブスクリプション管理のアシスタントです。
現在の登録契約:
${contractsContext || '（まだ契約はありません）'}

ユーザーの質問に答え、必要に応じて新規契約の追加を提案してください。
提案する場合は、必ず以下のJSON形式を含めてください：
SUGGEST: {"name": "契約名", "url": "URL", "category": "カテゴリ", "monthlyFee": 金額}`;

    try {
      // モデル名を gemini-2.0-flash に完全固定
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\nユーザー: ${userMessage}` }]
          }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`${data.error.message} (コード: ${data.error.code})`);
      }

      const aiResponse = data.candidates[0].content.parts[0].text;

      // AI提案の検出
      const suggestMatch = aiResponse.match(/SUGGEST:\s*({.*?})/);
      if (suggestMatch) {
        try {
          const suggestion = JSON.parse(suggestMatch[1]);
          setAISuggestion(suggestion);
          setShowAISuggestion(true);
          const cleanResponse = aiResponse.replace(/SUGGEST:\s*{.*?}/, '').trim();
          setMessages(prev => [...prev, { role: 'assistant', content: cleanResponse || '新しい契約を提案します。' }]);
        } catch (e) {
          setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `エラーが発生しました: ${error.message}`
      }]);
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
    const trimmedKey = key.trim();
    localStorage.setItem('geminiApiKey', trimmedKey);
    setGeminiApiKey(trimmedKey);
    setShowApiKeyInput(false);
    window.location.reload(); // 反映を確実にするためリロード
  };

  const filteredContracts = contracts.filter(c =>
    c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (c.category && c.category.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  const totalMonthly = contracts.reduce((sum, c) => sum + (c.monthlyFee || 0), 0);

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {/* 左：契約一覧パネル */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-lg">断</div>
              契約管理
            </h1>
            <button onClick={() => setShowApiKeyInput(true)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="契約を検索..."
              className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            新規登録
          </button>

          <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
            <span className="text-sm text-blue-700 font-medium">月額合計</span>
            <span className="text-lg font-bold text-blue-900">¥{totalMonthly.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredContracts.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <p className="text-sm">登録された契約はありません</p>
            </div>
          ) : (
            filteredContracts.map(contract => (
              <div key={contract.id} className="group p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all relative">
                <button
                  onClick={() => { setDeleteTarget(contract); setShowDeleteModal(true); }}
                  className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
                <h3 className="font-bold text-gray-800 pr-6">{contract.name}</h3>
                {contract.category && (
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full mt-1 inline-block">
                    {contract.category}
                  </span>
                )}
                <div className="flex justify-between items-end mt-2">
                  <span className="text-sm font-semibold text-gray-600">¥{contract.monthlyFee.toLocaleString()}/月</span>
                  <span className="text-[10px] text-gray-400">{contract.addedAt}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右：AIチャットパネル */}
      <div className="flex-1 flex flex-col bg-gray-50">
        <div className="p-4 bg-white border-b border-gray-200 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">AI相談窓口</h2>
            <p className="text-xs text-gray-500">Gemini 2.0 Flash がサポートします</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
              <div className="p-4 bg-white rounded-full shadow-sm"><Sparkles className="w-8 h-8 text-yellow-500" /></div>
              <div>
                <p className="text-gray-600 font-medium">何かお手伝いしましょうか？</p>
                <div className="flex gap-2 mt-4">
                  {["Netflixを追加して", "月額を減らしたい", "動画系を教えて"].map(t => (
                    <button key={t} onClick={() => setInputMessage(t)} className="text-xs px-3 py-2 bg-white border border-gray-200 rounded-full hover:border-blue-500 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-gray-200">
          <div className="max-w-4xl mx-auto flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="AIに相談する..."
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-200 transition-all active:scale-95 shadow-md shadow-blue-100"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* --- モーダル類 --- */}
      {/* APIキー入力 */}
      {showApiKeyInput && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">APIキーの設定</h3>
              <p className="text-sm text-gray-500 mt-1">Google AI Studioのキーを入力してください</p>
            </div>
            <input
              type="password"
              placeholder="AIzaSy..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              id="apiKeyInput"
              defaultValue={geminiApiKey}
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => saveApiKey(document.getElementById('apiKeyInput').value)}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
              >
                保存して開始
              </button>
              {geminiApiKey && (
                <button onClick={() => setShowApiKeyInput(false)} className="w-full py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl">
                  キャンセル
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI提案承認 */}
      {showAISuggestion && aiSuggestion && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">AIの提案</h3>
                <p className="text-xs text-gray-500">この内容を登録しますか？</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500">名前</span><span className="font-bold">{aiSuggestion.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">月額</span><span className="font-bold text-blue-600">¥{aiSuggestion.monthlyFee}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">カテゴリ</span><span className="font-medium text-gray-700">{aiSuggestion.category}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => addContract(aiSuggestion)} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                <Check className="w-5 h-5" /> 登録する
              </button>
              <button onClick={() => { setShowAISuggestion(false); setAISuggestion(null); }} className="px-6 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl">
                却下
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 手動追加・削除確認（省略/同様のスタイル） */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-center">新規契約の登録</h3>
            <div className="space-y-3">
              <input type="text" placeholder="名前 (必須)" value={newContract.name} onChange={(e) => setNewContract({...newContract, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
              <input type="number" placeholder="月額料金 (円)" value={newContract.monthlyFee} onChange={(e) => setNewContract({...newContract, monthlyFee: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
              <input type="text" placeholder="カテゴリ" value={newContract.category} onChange={(e) => setNewContract({...newContract, category: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => addContract(newContract)} disabled={!newContract.name} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:bg-gray-200 transition-all">登録</button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold mb-2">削除の確認</h3>
            <p className="text-sm text-gray-500 mb-6">「{deleteTarget.name}」をリストから削除しますか？</p>
            <div className="flex gap-3">
              <button onClick={() => deleteContract(deleteTarget.id)} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700">削除する</button>
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl">やめる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractManager;
