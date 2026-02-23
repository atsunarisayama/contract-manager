// ============================================================
// Vercelサーバーレス関数：/api/chat
// 場所：contract-manager-app/api/chat.js
//
// 役割：
//   - フロントエンドからメッセージを受け取る
//   - APIキーをVercel環境変数から取得（外部には見えない）
//   - GeminiAPIを呼んで結果を返す
//
// Vercelの環境変数に設定が必要：
//   GEMINI_API_KEY = あなたのGeminiAPIキー
// ============================================================

export default async function handler(req, res) {
  // POSTメソッド以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  // APIキーはVercel環境変数から取得（コードには書かない）
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }]
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]) {
  return res.status(500).json({ error: 'Invalid response from Gemini', debug: JSON.stringify(data) });
}

    const text = data.candidates[0].content.parts[0].text;
    return res.status(200).json({ text });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
