// DOM要素の取得
const myIdEl = document.getElementById('my-id');
const copyBtn = document.getElementById('copy-btn');
const targetIdInput = document.getElementById('target-id');
const connectBtn = document.getElementById('connect-btn');
const connectionStatusEl = document.getElementById('connection-status');
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const pingBtn = document.getElementById('ping-btn');
const pingResultEl = document.getElementById('ping-result');

let peer = null;
let currentConnection = null;
let pingStartTime = 0;

// PeerJSの初期化 (PeerJSの公式クラウドサーバーを利用)
function initPeer() {
    // IDを空白にするとランダムなIDが割り当てられます
    peer = new Peer();

    // サーバーに接続し、自分のIDを取得した時のイベント
    peer.on('open', (id) => {
        myIdEl.textContent = id;
    });

    // 他のユーザーから接続要求が来た時のイベント
    peer.on('connection', (conn) => {
        setupConnection(conn);
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        addLog(`エラー: ${err.type}`, 'red');
    });
}

// 接続のセットアップ
function setupConnection(conn) {
    if (currentConnection) {
        currentConnection.close();
    }
    
    currentConnection = conn;
    
    // 接続が確立した時
    conn.on('open', () => {
        connectionStatusEl.textContent = `接続中: ${conn.peer}`;
        connectionStatusEl.style.color = 'green';
        sendBtn.disabled = false;
        pingBtn.disabled = false;
        targetIdInput.disabled = true;
        connectBtn.disabled = true;
        addLog(`[System] ${conn.peer} と接続しました`);
    });

    // データを受信した時
    conn.on('data', (data) => {
        if (data.type === 'message') {
            addLog(`[相手] ${data.content}`);
        } else if (data.type === 'ping') {
            // pingを受け取ったら、すぐpongを返す
            conn.send({ type: 'pong', timestamp: data.timestamp });
        } else if (data.type === 'pong') {
            // pongを受け取ったら、RTT(往復時間)を計算
            const rtt = Date.now() - pingStartTime;
            pingResultEl.textContent = `${rtt} ms`;
        }
    });

    // 接続が切断された時
    conn.on('close', () => {
        connectionStatusEl.textContent = '切断されました';
        connectionStatusEl.style.color = 'red';
        sendBtn.disabled = true;
        pingBtn.disabled = true;
        targetIdInput.disabled = false;
        connectBtn.disabled = false;
        addLog('[System] 接続が切断されました');
        currentConnection = null;
    });
}

// コピーボタンの処理
copyBtn.addEventListener('click', () => {
    const id = myIdEl.textContent;
    if (id && id !== '取得中...') {
        navigator.clipboard.writeText(id).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'コピーしました！';
            setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
        });
    }
});

// 接続ボタンの処理
connectBtn.addEventListener('click', () => {
    const targetId = targetIdInput.value.trim();
    if (!targetId) {
        alert('接続先のIDを入力してください');
        return;
    }
    
    connectionStatusEl.textContent = '接続試行中...';
    // 相手に接続
    const conn = peer.connect(targetId);
    setupConnection(conn);
});

// メッセージ送信処理
function sendMessage() {
    const msg = messageInput.value.trim();
    if (!msg || !currentConnection) return;

    currentConnection.send({ type: 'message', content: msg });
    addLog(`[あなた] ${msg}`);
    messageInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Ping送信処理
pingBtn.addEventListener('click', () => {
    if (!currentConnection) return;
    
    pingStartTime = Date.now();
    pingResultEl.textContent = '計測中...';
    currentConnection.send({ type: 'ping', timestamp: pingStartTime });
});

// ログ表示ユーティリティ
function addLog(message, color = 'black') {
    const div = document.createElement('div');
    div.textContent = message;
    div.style.color = color;
    div.style.marginBottom = '5px';
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// アプリの起動
initPeer();
