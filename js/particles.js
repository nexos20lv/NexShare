/* NexShare — Space Stars (adapted from nexos20lv.github.io) */
class SpaceStars {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx    = this.canvas.getContext('2d');
        this.stars  = [];
        this.rotX   = 0; this.rotY = 0;
        this.raf    = null; this.active = true;
        this._resize = () => this._onResize();
        window.addEventListener('resize', this._resize);
        this._onResize(); this._init(); this._tick();
    }
    _onResize() {
        this.W  = this.canvas.width  = window.innerWidth;
        this.H  = this.canvas.height = window.innerHeight;
        this.cx = this.W / 2; this.cy = this.H / 2;
        this.R  = Math.hypot(this.cx, this.cy) * 1.25;
    }
    _init() {
        this.stars = [];
        for (let i = 0; i < 5000; i++) {
            const u = Math.random(), v = Math.random();
            const phi = Math.acos(2 * v - 1), th = 2 * Math.PI * u;
            const r   = this.R * Math.cbrt(Math.random());
            this.stars.push({
                x: r * Math.sin(phi) * Math.cos(th),
                y: r * Math.sin(phi) * Math.sin(th),
                z: r * Math.cos(phi),
                size:  Math.random() * 1.2 + 0.3,
                alpha: Math.random() * 0.6 + 0.4,
            });
        }
    }
    _tick() {
        if (!this.active) return;
        this.rotX -= 0.0006; this.rotY -= 0.0004;
        const cosX = Math.cos(this.rotX), sinX = Math.sin(this.rotX);
        const cosY = Math.cos(this.rotY), sinY = Math.sin(this.rotY);
        this.ctx.clearRect(0, 0, this.W, this.H);
        for (const s of this.stars) {
            const { x, y, z } = s;
            const y1 = y * cosX - z * sinX, z1 = y * sinX + z * cosX;
            const x2 = x * cosY + z1 * sinY, z2 = -x * sinY + z1 * cosY;
            const fov = this.R * 1.4, d = fov / (fov + z2);
            if (d <= 0) continue;
            const px = this.cx + x2 * d, py = this.cy + y1 * d;
            if (px < -2 || px > this.W + 2 || py < -2 || py > this.H + 2) continue;
            const sz = Math.max(0.3, s.size * d), a = s.alpha * Math.min(1, d * 1.2);
            this.ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
            this.ctx.beginPath(); this.ctx.arc(px, py, sz, 0, Math.PI * 2); this.ctx.fill();
        }
        this.raf = requestAnimationFrame(() => this._tick());
    }
    destroy() {
        this.active = false;
        if (this.raf) cancelAnimationFrame(this.raf);
        window.removeEventListener('resize', this._resize);
    }
}
