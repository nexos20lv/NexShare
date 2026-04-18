/* NexShare Transfer Engine — WebRTC P2P via PeerJS */

const CHUNK_SIZE  = 65536;
const MAX_BUFFER  = 4 * 1024 * 1024;
const CODE_CHARS  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PEER_PREFIX = 'nxs-';
const EXPIRY_MS   = 30 * 60 * 1000;

const BLOCKED_EXTS = new Set([
    '.exe','.bat','.cmd','.sh','.ps1','.vbs','.jar',
    '.msi','.app','.scr','.pif','.com','.cpl','.reg',
]);
const BLOCKED_TYPES = new Set([
    'application/x-msdownload','application/x-executable',
    'application/x-sh','application/x-bat','application/x-msdos-program',
]);

class NexTransfer extends EventTarget {
    constructor() {
        super();
        this.peer = null; this.conn = null; this.role = null;
        this.files = []; this.receivedMeta = null;
        this.recvBuffers = []; this.recvReceived = [];
        this._expiryTimer = null; this._expiryStart = null;
        this._transferDone = false;
    }

    static generateCode() {
        const arr = new Uint8Array(6);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => CODE_CHARS[b % CODE_CHARS.length]).join('');
    }

    static formatBytes(n) {
        n = Math.max(0, n || 0);
        if (n < 1024)       return n + ' B';
        if (n < 1048576)    return (n / 1024).toFixed(1) + ' KB';
        if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
        return (n / 1073741824).toFixed(2) + ' GB';
    }

    static formatTime(sec) {
        if (!isFinite(sec) || sec < 0) return '--:--';
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    static validateFiles(files) {
        const errors = [];
        for (const f of files) {
            const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
            if (BLOCKED_EXTS.has(ext) || BLOCKED_TYPES.has(f.type))
                errors.push('"' + f.name + '" est bloqué pour des raisons de sécurité.');
        }
        return errors;
    }

    _emit(type, detail) {
        const e = new Event(type);
        e.detail = detail || {};
        this.dispatchEvent(e);
    }

    /* ── SENDER ── */
    initSender(files) {
        this.role = 'sender'; this.files = Array.from(files);
        const code = NexTransfer.generateCode();
        this.peer = new Peer(PEER_PREFIX + code, this._cfg());
        this.peer.on('open', () => { this._emit('code', { code }); this._startExpiry(); });
        this.peer.on('connection', conn => {
            if (this.conn) { conn.close(); return; }
            this.conn = conn; this._onSenderConn(conn);
        });
        this.peer.on('error', err => {
            if (err.type === 'unavailable-id') { this.peer.destroy(); this.peer = null; this.initSender(files); }
            else this._emit('error', { message: this._fmtErr(err) });
        });
    }

    _onSenderConn(conn) {
        conn.on('open', () => {
            this._clearExpiry();
            this._emit('status', { state: 'connected', message: 'Pair connecté' });
            conn.send({
                type: 'meta',
                files: this.files.map(f => ({ name: f.name, size: f.size, fileType: f.type })),
                totalSize: this.files.reduce((s, f) => s + f.size, 0),
            });
        });
        conn.on('data', msg => {
            if (msg && msg.type === 'accept') this._doSend();
            if (msg && msg.type === 'reject') { this._emit('status', { state: 'rejected', message: 'Refusé par le destinataire' }); this.destroy(); }
        });
        conn.on('close', () => this._emit('status', { state: 'disconnected', message: 'Connexion fermée' }));
        conn.on('error', err => this._emit('error', { message: this._fmtErr(err) }));
    }

    async _doSend() {
        const totalSize = this.files.reduce((s, f) => s + f.size, 0);
        const tStart = Date.now(); let totalSent = 0;
        this._emit('transfer-start', { role: 'sender', fileCount: this.files.length });
        for (let i = 0; i < this.files.length; i++) {
            const file = this.files[i];
            this._emit('file-start', { index: i, name: file.name, size: file.size });
            this.conn.send({ type: 'file-start', index: i, name: file.name, size: file.size, fileType: file.type });
            const buffer = await file.arrayBuffer();
            const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
            for (let c = 0; c < totalChunks; c++) {
                await this._awaitBuf();
                const slice = buffer.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
                this.conn.send({ type: 'chunk', index: i, chunkIndex: c, totalChunks, data: new Uint8Array(slice) });
                totalSent += slice.byteLength;
                const elapsed = (Date.now() - tStart) / 1000 || 0.001;
                const speed = totalSent / elapsed;
                this._emit('progress', {
                    sent: totalSent, total: totalSize,
                    percent: Math.round(totalSent / totalSize * 100),
                    speed, remaining: (totalSize - totalSent) / speed,
                    fileIndex: i, fileName: file.name,
                });
            }
            this.conn.send({ type: 'file-end', index: i });
            this._emit('file-done', { index: i, name: file.name });
        }
        this.conn.send({ type: 'done' });
        this._transferDone = true;
        this._emit('complete', { role: 'sender' });
    }

    _awaitBuf() {
        return new Promise(resolve => {
            const check = () => {
                const dc = this.conn && this.conn.dataChannel;
                if (!dc || dc.bufferedAmount < MAX_BUFFER) return resolve();
                setTimeout(check, 50);
            };
            check();
        });
    }

    /* ── RECEIVER ── */
    initReceiver(code) {
        this.role = 'receiver';
        this.peer = new Peer(this._cfg());
        this.peer.on('open', () => {
            this._emit('status', { state: 'connecting', message: 'Connexion en cours…' });
            this.conn = this.peer.connect(PEER_PREFIX + code.trim().toUpperCase(), { reliable: true });
            this._onReceiverConn(this.conn);
        });
        this.peer.on('error', err => this._emit('error', { message: this._fmtErr(err) }));
    }

    _onReceiverConn(conn) {
        conn.on('open', () => this._emit('status', { state: 'connected', message: 'Connecté — attente des données…' }));
        conn.on('data', msg => this._handleData(msg));
        conn.on('close', () => { if (!this._transferDone) this._emit('status', { state: 'disconnected', message: 'Connexion interrompue' }); });
        conn.on('error', err => this._emit('error', { message: this._fmtErr(err) }));
    }

    _handleData(msg) {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'meta') {
            this.receivedMeta = msg.files;
            this.recvBuffers  = msg.files.map(() => []);
            this.recvReceived = msg.files.map(() => 0);
            this._emit('incoming', { files: msg.files, totalSize: msg.totalSize });
        } else if (msg.type === 'file-start') {
            this._emit('file-start', { index: msg.index, name: msg.name, size: msg.size });
        } else if (msg.type === 'chunk') {
            const { index, chunkIndex, data } = msg;
            this.recvBuffers[index][chunkIndex] = data;
            this.recvReceived[index] += data.byteLength;
            const totalReceived = this.recvReceived.reduce((a, b) => a + b, 0);
            const totalSize     = this.receivedMeta.reduce((a, f) => a + f.size, 0);
            this._emit('progress', {
                sent: totalReceived, total: totalSize,
                percent: Math.round(totalReceived / totalSize * 100),
                fileIndex: index, fileName: this.receivedMeta[index] && this.receivedMeta[index].name,
            });
        } else if (msg.type === 'file-end') {
            const meta = this.receivedMeta[msg.index];
            const blob = new Blob(this.recvBuffers[msg.index], { type: meta.fileType || 'application/octet-stream' });
            this._download(blob, meta.name);
            this._emit('file-done', { index: msg.index, name: meta.name });
        } else if (msg.type === 'done') {
            this._transferDone = true;
            this._emit('complete', { role: 'receiver' });
        }
    }

    accept() { if (this.conn) this.conn.send({ type: 'accept' }); }
    reject()  { if (this.conn) this.conn.send({ type: 'reject' }); this.destroy(); }

    _download(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    _startExpiry() {
        this._expiryStart = Date.now();
        this._expiryTimer = setInterval(() => {
            const elapsed = Date.now() - this._expiryStart;
            const pct  = Math.max(0, 100 - elapsed / EXPIRY_MS * 100);
            const left = Math.max(0, Math.ceil((EXPIRY_MS - elapsed) / 1000));
            this._emit('expiry', { percent: pct, secondsLeft: left });
            if (elapsed >= EXPIRY_MS) { this._emit('expired', {}); this.destroy(); }
        }, 1000);
    }

    _clearExpiry() { clearInterval(this._expiryTimer); this._expiryTimer = null; }

    _cfg() {
        return { config: { iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
        ]}};
    }

    _fmtErr(err) {
        const map = {
            'peer-unavailable': 'Code invalide ou expiré.',
            'network':          'Erreur réseau — vérifiez votre connexion.',
            'server-error':     'Serveur de signalisation indisponible.',
            'socket-error':     'Connexion WebSocket perdue.',
            'unavailable-id':   "Code déjà pris, génération d'un nouveau…",
        };
        return map[err.type] || err.message || 'Erreur inconnue.';
    }

    destroy() {
        this._clearExpiry();
        try { if (this.conn) this.conn.close(); } catch(_) {}
        try { if (this.peer) this.peer.destroy(); } catch(_) {}
        this.conn = null; this.peer = null;
    }
}
