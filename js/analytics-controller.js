export default class AnalyticsController {
    constructor(gestureDetector) {
        this.gestureDetector = gestureDetector;
        this.lastFrameTime = Date.now();
        this.lastHandPos = null;
        this.smoothedSpeed = 0; // Filtered speed for stable display

        // Element caching
        this.elements = {
            speed: document.getElementById('stat-speed'),
            facing: document.getElementById('stat-facing'),
            pitch: document.getElementById('stat-pitch'),
            yaw: document.getElementById('stat-yaw'),
            handedness: document.getElementById('stat-handedness'),
            gimbalSync: document.getElementById('stat-gimbal-sync'),
            wristZ: document.getElementById('stat-wristz'),

            pinch: document.getElementById('stat-pinch'),

            scale: document.getElementById('stat-scale'),
            ring: document.getElementById('stat-ring'),
            log: document.getElementById('gesture-log'),
            table: document.getElementById('landmark-table'),
            gimbalToggle: document.getElementById('toggle-gimbal')
        };


        this.init();
    }

    init() {
        window.addEventListener('handFrame', (e) => this.handleFrame(e.detail));
        window.addEventListener('handGesture', (e) => this.handleGesture(e.detail));

        if (this.elements.gimbalToggle) {
            this.elements.gimbalToggle.addEventListener('change', (e) => {
                this.gestureDetector.showGimbalLines = e.target.checked;
            });
        }
    }



    handleFrame(data) {
        console.log("Analytics received frame:", !!data?.landmarks);
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

        // 1.5 Signal Conditioning: EMA + Dead-Zone
        const alpha = 0.2; // Smoothing factor
        this.smoothedSpeed = (this.smoothedSpeed * (1 - alpha)) + (speed * alpha);

        // Noise Gate: Increased to 50px/s to handle micro-vibrations on high-res displays
        if (this.smoothedSpeed < 50) this.smoothedSpeed = 0;

        // 2. Update Basic Stats
        this.elements.speed.textContent = `${this.smoothedSpeed.toFixed(1)} px/s`;
        if (this.elements.facing) {
            this.elements.facing.textContent = data.isFacingCamera ? 'TRUE' : 'FALSE';
            this.elements.facing.style.color = data.isFacingCamera ? '#4ade80' : '#f87171';
        }
        if (this.elements.pitch) this.elements.pitch.textContent = `${(data.pitch || 0).toFixed(1)}°`;
        if (this.elements.yaw) this.elements.yaw.textContent = `${(data.yaw || 0).toFixed(1)}°`;
        if (this.elements.handedness) {
            this.elements.handedness.textContent = data.handedness || 'N/A';
            // Color coding for instant identification
            if (data.handedness === 'Right') {
                this.elements.handedness.style.color = '#38bdf8'; // Sky Blue
            } else if (data.handedness === 'Left') {
                this.elements.handedness.style.color = '#f472b6'; // Pinkish/Rose
            } else {
                this.elements.handedness.style.color = '#94a3b8'; // Muted
            }
        }

        if (this.elements.gimbalSync) {
            const isSync = !!data.handedness;
            this.elements.gimbalSync.textContent = isSync ? 'ACTIVE' : 'INACTIVE';
            this.elements.gimbalSync.style.color = isSync ? '#38bdf8' : '#64748b';

            // If Left hand, emphasize that inversion is happening
            if (data.handedness === 'Left') {
                this.elements.gimbalSync.textContent = 'ACTIVE (Inverted)';
            }
        }
        if (this.elements.wristZ) this.elements.wristZ.textContent = (data.worldWristZ || 0).toFixed(4);



        if (this.elements.ring) {
            this.elements.ring.textContent = data.isRingClosed ? 'GRIPPED' : 'RELEASED';
            this.elements.ring.style.color = data.isRingClosed ? '#4ade80' : '#64748b';
        }

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
