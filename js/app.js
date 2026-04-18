/* NexShare — UI orchestration (no ES modules, works on file://) */

/* ── Star background ── */
new SpaceStars('star-canvas');

/* ── Header scroll ── */
window.addEventListener('scroll', () => {
    document.querySelector('header').classList.toggle('scrolled', window.scrollY > 20);
});

/* ── Toast ── */
function toast(msg, type, duration) {
    type     = type     || 'info';
    duration = duration || 4000;
    var icons = { success: 'bi-check-circle-fill', error: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
    var tc = document.getElementById('toast-container');
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = '<i class="bi ' + (icons[type] || icons.info) + '"></i><span>' + msg + '</span>';
    tc.appendChild(el);
    setTimeout(function() {
        el.style.transition = 'all .3s ease';
        el.style.opacity    = '0';
        el.style.transform  = 'translateX(20px)';
        setTimeout(function() { el.remove(); }, 300);
    }, duration);
}

/* ── File icon ── */
function fileIcon(name) {
    var ext = (name.split('.').pop() || '').toLowerCase();
    if (['jpg','jpeg','png','gif','webp','svg','avif'].indexOf(ext) > -1) return 'bi-file-image';
    if (['mp4','mov','avi','mkv','webm'].indexOf(ext) > -1)               return 'bi-file-play';
    if (['mp3','ogg','flac','wav','aac'].indexOf(ext) > -1)               return 'bi-file-music';
    if (ext === 'pdf')                                                     return 'bi-file-pdf';
    if (['zip','rar','7z','tar','gz','bz2'].indexOf(ext) > -1)            return 'bi-file-zip';
    if (['js','ts','py','go','rs','c','cpp','java','html','css'].indexOf(ext) > -1) return 'bi-file-code';
    if (['doc','docx','odt'].indexOf(ext) > -1)                            return 'bi-file-word';
    if (['xls','xlsx','csv'].indexOf(ext) > -1)                            return 'bi-file-excel';
    return 'bi-file-earmark';
}

function esc(s) {
    return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }
    // Fallback for file://
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(_) {}
    document.body.removeChild(ta);
    return Promise.resolve();
}

/* ══════════════════════════════════════════
 *  SENDER PANEL
 * ══════════════════════════════════════════ */
var dropZone   = document.getElementById('drop-zone');
var fileInput  = document.getElementById('file-input');
var fileListEl = document.getElementById('file-list');
var fileFooter = document.getElementById('file-footer');
var fileCount  = document.getElementById('file-count');
var sendBtn    = document.getElementById('send-btn');
var clearBtn   = document.getElementById('clear-btn');
var sharePanel = document.getElementById('share-panel');
var sharePanelBody = document.getElementById('share-panel-body');
var sharePanelDone = document.getElementById('share-panel-done');
var senderCard = document.querySelector('.sender-card');

var selectedFiles = [];
var senderXfer    = null;

/* Drag & drop */
dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', function()  { dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', function(e) {
    e.preventDefault(); dropZone.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', function() {
    addFiles(fileInput.files);
    fileInput.value = '';
});

function addFiles(list) {
    var incoming = Array.from(list);
    var errors   = NexTransfer.validateFiles(incoming);
    if (errors.length) { errors.forEach(function(m) { toast(m, 'error', 6000); }); return; }
    incoming.forEach(function(f) {
        if (!selectedFiles.find(function(x) { return x.name === f.name && x.size === f.size; }))
            selectedFiles.push(f);
    });
    renderFileList();
}

function renderFileList() {
    fileListEl.innerHTML = '';
    selectedFiles.forEach(function(f, i) {
        var div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML =
            '<i class="bi ' + fileIcon(f.name) + ' file-icon"></i>' +
            '<div class="file-info">' +
                '<div class="file-name">' + esc(f.name) + '</div>' +
                '<div class="file-size">' + NexTransfer.formatBytes(f.size) + '</div>' +
            '</div>' +
            '<button class="file-remove" data-i="' + i + '" title="Retirer"><i class="bi bi-x"></i></button>';
        fileListEl.appendChild(div);
    });

    var has = selectedFiles.length > 0;
    fileListEl.classList.toggle('hidden', !has);
    fileFooter.classList.toggle('hidden', !has);
    dropZone.classList.toggle('has-files', has);
    if (!has) sharePanel.classList.add('hidden');

    if (has) {
        var total = selectedFiles.reduce(function(s, f) { return s + f.size; }, 0);
        fileCount.textContent = selectedFiles.length + ' fichier' + (selectedFiles.length > 1 ? 's' : '') + ' · ' + NexTransfer.formatBytes(total);
    }
}

fileListEl.addEventListener('click', function(e) {
    var btn = e.target.closest('.file-remove');
    if (!btn) return;
    selectedFiles.splice(parseInt(btn.dataset.i), 1);
    renderFileList();
});

clearBtn.addEventListener('click', function() {
    selectedFiles = [];
    if (senderXfer) { senderXfer.destroy(); senderXfer = null; }
    senderCard.classList.remove('transfer-mode');
    sharePanel.classList.add('hidden');
    sharePanelBody.classList.remove('hidden');
    sharePanelDone.classList.add('hidden');
    renderFileList();
});

sendBtn.addEventListener('click', function() {
    if (!selectedFiles.length) { toast('Ajoutez au moins un fichier.', 'error'); return; }
    if (senderXfer) { senderXfer.destroy(); }
    senderXfer = buildSender(selectedFiles);
    senderXfer.initSender(selectedFiles);
});

function buildSender(files) {
    var xfer = new NexTransfer();

    xfer.addEventListener('code', function(e) {
        var code = e.detail.code;
        sharePanelDone.classList.add('hidden');
        sharePanelBody.classList.remove('hidden');
        document.getElementById('share-code').textContent = code;
        sharePanel.classList.remove('hidden');
        senderCard.classList.add('transfer-mode');
        setStatus('waiting', 'En attente de connexion…');

        var shareUrl = location.origin + location.pathname + '?code=' + code;
        var canvas = document.getElementById('qr-canvas');
        if (typeof QRCode !== 'undefined') {
            QRCode.toCanvas(canvas, shareUrl, { width: 150, margin: 4,
                color: { dark: '#e2d9f3', light: '#03001400' } }, function() {});
        }

        updateExpiry(100);
        toast('Code généré ! Partagez-le avec le destinataire.', 'info');
    });

    xfer.addEventListener('status', function(e) {
        var s = e.detail.state, m = e.detail.message;
        setStatus(s === 'connected' ? 'connected' : s === 'rejected' ? 'error' : 'waiting', m);
        if (s === 'connected') toast('Pair connecté !', 'success');
        if (s === 'rejected')  toast('Transfert refusé.', 'error');
    });

    xfer.addEventListener('transfer-start', function() {
        senderCard.classList.add('transfer-mode');
        setStatus('transfer', 'Transfert en cours…');
        openProgress('Envoi en cours…', files.map(function(f) { return { name: f.name, size: f.size }; }));
    });

    xfer.addEventListener('file-start', function(e) { markPF(e.detail.index, 'active'); });
    xfer.addEventListener('file-done',  function(e) { markPF(e.detail.index, 'done'); });
    xfer.addEventListener('progress',   function(e) { updateProgress(e.detail); });

    xfer.addEventListener('complete', function() {
        closeProgress();
        toast('Transfert terminé !', 'success');
        senderCard.classList.remove('transfer-mode');
        sharePanelBody.classList.add('hidden');
        sharePanelDone.classList.remove('hidden');
        sharePanelDone.innerHTML = doneBanner('Transfert réussi !', 'Tous les fichiers ont été envoyés.', function() {
            selectedFiles = []; renderFileList();
            sharePanel.classList.add('hidden');
            sharePanelBody.classList.remove('hidden');
            sharePanelDone.classList.add('hidden');
            sharePanelDone.innerHTML = '';
            senderXfer = null;
        });
    });

    xfer.addEventListener('expiry', function(e) { updateExpiry(e.detail.percent, e.detail.secondsLeft); });

    xfer.addEventListener('expired', function() {
        toast('Session expirée (30 min). Regénérez un code.', 'error', 6000);
        senderCard.classList.remove('transfer-mode');
        sharePanelBody.classList.remove('hidden');
        sharePanelDone.classList.add('hidden');
        sharePanelDone.innerHTML = '';
        sharePanel.classList.add('hidden');
        selectedFiles = []; renderFileList(); senderXfer = null;
    });

    xfer.addEventListener('error', function(e) { toast(e.detail.message, 'error', 6000); });

    return xfer;
}

document.getElementById('copy-link-btn').addEventListener('click', function() {
    var code = document.getElementById('share-code').textContent;
    var url  = location.origin + location.pathname + '?code=' + code;
    copyToClipboard(url).then(function() { toast('Lien copié !', 'success'); });
});

document.getElementById('copy-code-btn').addEventListener('click', function() {
    var code = document.getElementById('share-code').textContent;
    copyToClipboard(code).then(function() { toast('Code copié !', 'success'); });
});

/* ══════════════════════════════════════════
 *  RECEIVER PANEL
 * ══════════════════════════════════════════ */
var codeInput  = document.getElementById('code-input');
var connectBtn = document.getElementById('connect-btn');
var recvArea   = document.getElementById('recv-area');
var recvXfer   = null;

connectBtn.addEventListener('click', startReceiver);
codeInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') startReceiver(); });

function startReceiver() {
    var raw = codeInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length !== 6) { toast('Le code doit contenir 6 caractères.', 'error'); return; }
    if (recvXfer) { recvXfer.destroy(); }
    recvXfer = buildReceiver();
    recvXfer.initReceiver(raw);
}

function buildReceiver() {
    var xfer = new NexTransfer();

    showRecvUI('<div class="spinner"></div><div class="text-muted" style="text-align:center;margin-top:.5rem">Connexion…</div>');

    xfer.addEventListener('incoming', function(e) {
        var files = e.detail.files, totalSize = e.detail.totalSize;
        var listHtml = files.map(function(f) {
            return '<div class="file-item">' +
                '<i class="bi ' + fileIcon(f.name) + ' file-icon"></i>' +
                '<div class="file-info">' +
                    '<div class="file-name">' + esc(f.name) + '</div>' +
                    '<div class="file-size">' + NexTransfer.formatBytes(f.size) + '</div>' +
                '</div></div>';
        }).join('');

        showRecvUI(
            '<div class="incoming-label">Fichiers entrants</div>' +
            '<div class="file-list" style="max-height:200px">' + listHtml + '</div>' +
            '<div class="incoming-total">' + files.length + ' fichier' + (files.length > 1 ? 's' : '') + ' · ' + NexTransfer.formatBytes(totalSize) + '</div>' +
            '<div class="incoming-actions">' +
                '<button class="btn btn-primary" id="accept-btn"><i class="bi bi-download"></i> Accepter</button>' +
                '<button class="btn btn-danger"  id="decline-btn"><i class="bi bi-x-lg"></i> Refuser</button>' +
            '</div>'
        );

        document.getElementById('accept-btn').addEventListener('click', function() {
            xfer.accept();
            openProgress('Réception en cours…', files);
        });
        document.getElementById('decline-btn').addEventListener('click', function() {
            xfer.reject(); showRecvUI(''); recvXfer = null;
            toast('Transfert refusé.', 'info');
        });
    });

    xfer.addEventListener('file-start', function(e) { markPF(e.detail.index, 'active'); });
    xfer.addEventListener('file-done',  function(e) { markPF(e.detail.index, 'done'); });
    xfer.addEventListener('progress',   function(e) { updateProgress(e.detail); });

    xfer.addEventListener('complete', function() {
        closeProgress();
        toast('Fichiers reçus !', 'success');
        showRecvUI(doneBanner('Fichiers reçus !', 'Les téléchargements ont démarré.', function() {
            showRecvUI(''); codeInput.value = ''; recvXfer = null;
        }, "Recevoir d'autres fichiers"));
    });

    xfer.addEventListener('error', function(e) {
        toast(e.detail.message, 'error', 6000);
        showRecvUI(''); recvXfer = null;
    });

    return xfer;
}

function showRecvUI(html) {
    recvArea.innerHTML = html ? '<div class="incoming-card">' + html + '</div>' : '';
}

/* ══════════════════════════════════════════
 *  PROGRESS OVERLAY
 * ══════════════════════════════════════════ */
var overlay    = document.getElementById('progress-overlay');
var pBar       = document.getElementById('progress-bar');
var pPct       = document.getElementById('progress-pct');
var pSpeed     = document.getElementById('progress-speed');
var pEta       = document.getElementById('progress-eta');
var pTitle     = document.getElementById('progress-title');
var pFilesList = document.getElementById('progress-files');

function openProgress(title, files) {
    pTitle.textContent  = title;
    pBar.style.width    = '0%';
    pPct.textContent    = '0%';
    pSpeed.textContent  = '0 B/s';
    pEta.textContent    = '--:--';
    pFilesList.innerHTML = (files || []).map(function(f, i) {
        return '<div class="prog-file-row" id="pf-' + i + '">' +
            '<i class="bi ' + fileIcon(f.name || '') + '"></i>' +
            '<span>' + esc(f.name || '') + '</span></div>';
    }).join('');
    overlay.classList.remove('hidden');
}

function updateProgress(d) {
    pBar.style.width   = (d.percent || 0) + '%';
    pPct.textContent   = (d.percent || 0) + '%';
    pSpeed.textContent = NexTransfer.formatBytes(d.speed || 0) + '/s';
    pEta.textContent   = NexTransfer.formatTime(d.remaining);
}

function markPF(i, state) {
    var el = document.getElementById('pf-' + i);
    if (!el) return;
    el.className = 'prog-file-row ' + state;
    if (state === 'done') el.querySelector('i').className = 'bi bi-check-lg';
}

function closeProgress() {
    pBar.style.width = '100%';
    setTimeout(function() { overlay.classList.add('hidden'); }, 800);
}

/* ══════════════════════════════════════════
 *  HELPERS
 * ══════════════════════════════════════════ */
function setStatus(dotClass, message) {
    var d = document.getElementById('status-dot');
    var t = document.getElementById('status-text');
    if (d) d.className = 'status-dot ' + dotClass;
    if (t) t.textContent = message;
}

function updateExpiry(pct, secondsLeft) {
    var fill  = document.getElementById('expiry-fill');
    var label = document.getElementById('expiry-label');
    if (fill)  fill.style.width = pct + '%';
    if (label && secondsLeft !== undefined) {
        var m = Math.floor(secondsLeft / 60), s = secondsLeft % 60;
        label.textContent = 'Expire dans ' + m + ':' + String(s).padStart(2, '0');
    }
}

var _doneBtnCounter = 0;
function doneBanner(title, sub, onReset, btnLabel) {
    btnLabel = btnLabel || 'Nouveau transfert';
    var id = 'done-btn-' + (++_doneBtnCounter);
    setTimeout(function() {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', onReset);
    }, 0);
    return '<div style="text-align:center;padding:.5rem 0">' +
        '<i class="bi bi-check-circle-fill done-icon"></i>' +
        '<div class="done-title">' + title + '</div>' +
        '<div class="done-sub">' + sub + '</div>' +
        '<button class="btn btn-secondary mt-sm" id="' + id + '"><i class="bi bi-arrow-clockwise"></i> ' + btnLabel + '</button>' +
        '</div>';
}

/* ── Auto-fill code from URL ── */
(function() {
    var urlCode = new URLSearchParams(location.search).get('code');
    if (urlCode) {
        codeInput.value = urlCode.toUpperCase();
        var transfer = document.querySelector('.transfer-section');
        if (transfer) transfer.scrollIntoView({ behavior: 'smooth' });
        setTimeout(startReceiver, 700);
    }
})();
