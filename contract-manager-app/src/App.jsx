import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Send, Sparkles, Check, AlertCircle, Trash2, Search } from 'lucide-react';

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

  // localStorage から読み込み
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

  // localStorage に保存
  useEffect(() => {
    if (contracts.length > 0) {
      localStorage.setItem('contracts', JSON.stringify(contracts));
    }
  }, [contracts]);

  // チャット自動スクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 契約追加
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

  // 契約削除
  const deleteContract = (id) => {
    setContracts(contracts.filter(c => c.id !== id));
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  // Gemini API 呼び出し
  const callGeminiAPI = async (userMessage) => {
    if (!geminiApiKey) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Gemini APIキーが設定されていません。右上の設定ボタンから入力してください。'
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
提案する場合は、以下のJSON形式で出力してください：

SUGGEST: {"name": "契約名", "url": "https://example.com", "category": "カテゴリ", "monthlyFee": 金額}

例：
SUGGEST: {"name": "Spotify", "url": "https://spotify.com", "category": "エンタメ", "monthlyFee": 980}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `${systemPrompt}\n\nユーザー: ${userMessage}`
              }]
            }]
          })
        }
      );

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
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
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: cleanResponse || 'この契約を追加しますか？'
          }]);
        } catch (e) {
          setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `エラー: ${error.message}`
      }]);
    }
  };

  // メッセージ送信
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMsg = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    await callGeminiAPI(inputMessage);
    setIsLoading(false);
  };

  // APIキー保存
  const saveApiKey = (key) => {
    localStorage.setItem('geminiApiKey', key);
    setGeminiApiKey(key);
    setShowApiKeyInput(false);
  };

  // フィルタリング
  const filteredContracts = contracts.filter(c =>
    c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (c.category && c.category.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  const totalMonthly = contracts.reduce((sum, c) => sum + (c.monthlyFee || 0), 0);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 左パネル：契約一覧 */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">契約管理</h1>
            <button
              onClick={() => setShowApiKeyInput(true)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ⚙️
            </button>
          </div>
          
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="検索..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新規追加
          </button>

          <div className="mt-3 text-sm text-gray-600">
            合計: <span className="font-bold text-gray-900">¥{totalMonthly.toLocaleString()}/月</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredContracts.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              <p>契約が登録されていません</p>
              <p className="text-sm mt-2">右のAIチャットで追加できます</p>
            </div>
          ) : (
            filteredContracts.map(contract => (
              <div
                key={contract.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{contract.name}</h3>
                    {contract.category && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded mt-1 inline-block">
                        {contract.category}
                      </span>
                    )}
                    {contract.url && (
                      <a
                        href={contract.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline block mt-1"
                      >
                        {contract.url}
                      </a>
                    )}
                    <div className="text-sm text-gray-600 mt-1">
                      ¥{contract.monthlyFee.toLocaleString()}/月
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      登録日: {contract.addedAt}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDeleteTarget(contract);
                      setShowDeleteModal(true);
                    }}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右パネル：AIチャット */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            AI相談窓口
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            契約について質問したり、新しい契約を追加できます
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-12">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">何かお手伝いしましょうか？</p>
              <div className="mt-4 space-y-2 text-sm">
                <p>例: 「Netflixを追加して」</p>
                <p>例: 「エンタメ系の契約を見せて」</p>
                <p>例: 「月額費用を削減したい」</p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-3 rounded-lg">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="メッセージを入力..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* APIキー入力モーダル */}
      {showApiKeyInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Gemini API キー設定</h3>
            <input
              type="password"
              placeholder="AIzaSy..."
              defaultValue={geminiApiKey}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  saveApiKey(e.target.value);
                }
              }}
              id="apiKeyInput"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const key = document.getElementById('apiKeyInput').value;
                  saveApiKey(key);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
              {geminiApiKey && (
                <button
                  onClick={() => setShowApiKeyInput(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              ※ APIキーはブラウザのlocalStorageに保存されます
            </p>
          </div>
        </div>
      )}

      {/* 手動追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">新規契約追加</h3>
            
            <div className="space-y-3">
              <input
                type="text"
                placeholder="契約名 *"
                value={newContract.name}
                onChange={(e) => setNewContract({ ...newContract, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="url"
                placeholder="URL"
                value={newContract.url}
                onChange={(e) => setNewContract({ ...newContract, url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="カテゴリ"
                value={newContract.category}
                onChange={(e) => setNewContract({ ...newContract, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="月額料金（円）"
                value={newContract.monthlyFee}
                onChange={(e) => setNewContract({ ...newContract, monthlyFee: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => addContract(newContract)}
                disabled={!newContract.name}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                追加
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewContract({ name: '', url: '', category: '', monthlyFee: '' });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI提案承認モーダル */}
      {showAISuggestion && aiSuggestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold">AI提案</h3>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg mb-4 space-y-2">
              <div><strong>契約名:</strong> {aiSuggestion.name}</div>
              <div><strong>URL:</strong> {aiSuggestion.url}</div>
              <div><strong>カテゴリ:</strong> {aiSuggestion.category}</div>
              <div><strong>月額:</strong> ¥{aiSuggestion.monthlyFee}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => addContract(aiSuggestion)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Check className="w-4 h-4" />
                承認して追加
              </button>
              <button
                onClick={() => {
                  setShowAISuggestion(false);
                  setAISuggestion(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                却下
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <div className="flex items-center gap-2 mb-4 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-lg font-semibold">削除確認</h3>
            </div>
            
            <p className="text-gray-700 mb-4">
              「<strong>{deleteTarget.name}</strong>」を削除してもよろしいですか？
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => deleteContract(deleteTarget.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" />
                削除
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractManager;
