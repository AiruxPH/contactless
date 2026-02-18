export default class AnalyticsController {
    constructor(gestureDetector) {
        this.gestureDetector = gestureDetector;
        this.lastFrameTime = Date.now();
        this.lastHandPos = null;

        // Element caching
        this.elements = {
            speed: document.getElementById('stat-speed'),
            tilt: document.getElementById('stat-tilt'),
            pinch: document.getElementById('stat-pinch'),
            scale: document.getElementById('stat-scale'),
            log: document.getElementById('gesture-log'),
            table: document.getElementById('landmark-table')
        };

        this.init();
    }

    init() {
        window.addEventListener('handFrame', (e) => this.handleFrame(e.detail));
        window.addEventListener('handGesture', (e) => this.handleGesture(e.detail));
    }


    handleFrame(data) {
        if (!data || !data.landmarks) return;

        const now = Date.now();
        const dt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        const landmarks = data.landmarks;
        const wrist = landmarks[0];

        // 1. Calculate Speed (Wrist move in pixels)
        let speed = 0;
        if (this.lastHandPos && dt > 0) {
            const dx = (wrist.x - this.lastHandPos.x) * window.innerWidth;
            const dy = (wrist.y - this.lastHandPos.y) * window.innerHeight;
            speed = Math.sqrt(dx * dx + dy * dy) / dt;
        }
        this.lastHandPos = { x: wrist.x, y: wrist.y };

        // 2. Update Basic Stats
        this.elements.speed.textContent = `${speed.toFixed(1)} px/s`;
        this.elements.tilt.textContent = `${((data.tiltAngle || 0) * (180 / Math.PI)).toFixed(1)}°`;
        this.elements.pinch.textContent = (data.pinchDistance || 0).toFixed(3);
        this.elements.scale.textContent = (data.handScale || 0).toFixed(3);

        // 3. Update Landmark Table (Throttle updates or just landmarks)
        this.updateTable(landmarks);
    }

    updateTable(landmarks) {
        // Optimized: only update if table is empty or periodically? 
        // For analytics, full updates are expected.
        let html = '';
        landmarks.forEach((p, i) => {
            const x = Math.round(p.x * window.innerWidth);
            const y = Math.round(p.y * window.innerHeight);
            const z = p.z ? p.z.toFixed(4) : 'N/A';

            // Highlight tips
            const isTip = [4, 8, 12, 16, 20].includes(i);
            const rowClass = isTip ? 'class="highlight"' : '';

            html += `<tr ${rowClass}>
                <td>${i}</td>
                <td>${x}</td>
                <td>${y}</td>
                <td>${z}</td>
            </tr>`;
        });
        this.elements.table.innerHTML = html;
    }

    handleGesture(detail) {
        const { gesture, data } = detail;
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const entry = document.createElement('div');
        entry.className = 'log-entry';

        let dataStr = '';
        if (data) {
            if (data.velocity) dataStr = ` (Vel: ${data.velocity.toFixed(2)})`;
            if (data.angle) dataStr = ` (Ang: ${((data.angle) * 180 / Math.PI).toFixed(1)}°)`;
        }

        entry.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-name">${gesture}</span>
            <span class="log-data">${dataStr}</span>
        `;

        this.elements.log.prepend(entry);

        // Keep log manageable
        if (this.elements.log.children.length > 50) {
            this.elements.log.removeChild(this.elements.log.lastChild);
        }
    }
}
