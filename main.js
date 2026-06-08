// DOM要素の取得
const myIdEl = document.getElementById('my-id');
const copyBtn = document.getElementById('copy-btn');
const targetIdInput = document.getElementById('target-id');
const connectBtn = document.getElementById('connect-btn');
const connectionListEl = document.getElementById('connection-list');
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const pingBtn = document.getElementById('ping-btn');
const pingResultEl = document.getElementById('ping-result');
const qrcodeEl = document.getElementById('qrcode');

let peer = null;
let connections = {}; // 複数接続を管理するオブジェクト { 'peerId': conn }
let isHost = true; // 自分が誰かに接続しにいったら false（クライアント）になる
let pingStartTime = 0;

// PeerJSの初期化
function initPeer() {
    peer = new Peer();

    peer.on('open', (id) => {
        myIdEl.textContent = id;
        
        // 自分のIDを含む招待URLを作成してQRコードを生成
        const inviteUrl = window.location.href.split('?')[0] + '?target=' + id;
        qrcodeEl.innerHTML = '';
        new QRCode(qrcodeEl, {
            text: inviteUrl,
            width: 128,
            height: 128,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.L
        });

        checkUrlParamsAndConnect();
    });

    // 誰かから接続要求が来た時のイベント（自分がホストの場合）
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
    // 接続が確立した時
    conn.on('open', () => {
        connections[conn.peer] = conn;
        updateConnectionList();
        
        // クライアントの場合は自分がホストでないと認識する
        if (!isHost) {
            targetIdInput.disabled = true;
            connectBtn.disabled = true;
        }

        sendBtn.disabled = false;
        pingBtn.disabled = false;
        addLog(`[System] ${conn.peer} と接続しました`);
    });

    // データを受信した時
    conn.on('data', (data) => {
        if (data.type === 'message') {
            addLog(`[${conn.peer.substring(0, 4)}...] ${data.content}`);
            // もし自分がホストなら、他の全員にもこのメッセージを中継（リレー）する
            if (isHost) {
                broadcastMessage(data.content, conn.peer);
            }
        } else if (data.type === 'ping') {
            conn.send({ type: 'pong', timestamp: data.timestamp });
        } else if (data.type === 'pong') {
            const rtt = Date.now() - pingStartTime;
            pingResultEl.textContent = `${rtt} ms`;
        }
    });

    // 接続が切断された時
    conn.on('close', () => {
        delete connections[conn.peer];
        updateConnectionList();
        
        addLog(`[System] ${conn.peer} が切断されました`);
        
        if (Object.keys(connections).length === 0) {
            sendBtn.disabled = true;
            pingBtn.disabled = true;
            if (!isHost) {
                targetIdInput.disabled = false;
                connectBtn.disabled = false;
                isHost = true; // 誰もいなくなったらまたホストになれる
            }
        }
    });
}

// 接続中ユーザー一覧の更新UI
function updateConnectionList() {
    const peerIds = Object.keys(connections);
    connectionListEl.innerHTML = '';
    
    if (peerIds.length === 0) {
        connectionListEl.innerHTML = '<li>誰もいません</li>';
        return;
    }

    peerIds.forEach(id => {
        const li = document.createElement('li');
        li.textContent = id;
        li.style.color = 'green';
        connectionListEl.appendChild(li);
    });
}

// 接続ボタンの処理
connectBtn.addEventListener('click', () => {
    const targetId = targetIdInput.value.trim();
    if (!targetId) {
        alert('接続先のIDを入力してください');
        return;
    }
    
    // 自分から誰かに接続しに行くので、自分はクライアント（参加者）になる
    isHost = false; 
    
    const conn = peer.connect(targetId);
    setupConnection(conn);
});

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

// メッセージを全員に送信（ブロードキャスト）
// excludePeerId は、中継時に送信元に送り返さないための除外設定
function broadcastMessage(content, excludePeerId = null) {
    Object.values(connections).forEach(conn => {
        if (conn.peer !== excludePeerId) {
            conn.send({ type: 'message', content: content });
        }
    });
}

// メッセージ送信処理
function sendMessage() {
    const msg = messageInput.value.trim();
    if (!msg || Object.keys(connections).length === 0) return;

    // 自分自身にログを表示
    addLog(`[あなた] ${msg}`);
    
    // 全員に送信
    broadcastMessage(msg);
    messageInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Ping送信処理（全員へ）
pingBtn.addEventListener('click', () => {
    if (Object.keys(connections).length === 0) return;
    
    pingStartTime = Date.now();
    pingResultEl.textContent = '計測中...';
    
    // 全員にPingを投げる
    Object.values(connections).forEach(conn => {
        conn.send({ type: 'ping', timestamp: pingStartTime });
    });
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

// URLパラメータのチェックと自動接続
function checkUrlParamsAndConnect() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('target');
    
    if (targetId) {
        targetIdInput.value = targetId;
        addLog(`[System] URLからIDを検出しました: ${targetId}`);
        setTimeout(() => {
            connectBtn.click();
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 500);
    }
}

// アプリの起動
initPeer();
