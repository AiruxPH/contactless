export default class GestureRecorder {
    constructor(gestureDetector) {
        this.gestureDetector = gestureDetector;
        this.mappings = this.loadMappings();
        this.isRecording = false;
        this.recordingAction = null;
        this.container = null;

        this.actions = [
            { id: 'scroll_up', label: 'Scroll Up', defaultGesture: 'swipe-up' },
            { id: 'scroll_down', label: 'Scroll Down', defaultGesture: 'swipe-down' },
            { id: 'scroll_left', label: 'Scroll Left (Prev)', defaultGesture: 'swipe-right' }, // Logic: Swipe Right moves content Left (Back) usually, but name is confusing. Sticking to navigation connection.
            { id: 'scroll_right', label: 'Scroll Right (Next)', defaultGesture: 'swipe-left' }
        ];

        this.init();
    }

    init() {
        this.gestureDetector.onGesture((gesture, data) => {
            if (this.isRecording && this.recordingAction) {
                this.saveMapping(this.recordingAction, gesture);
                this.stopRecording();
            }
        });
    }

    loadMappings() {
        const saved = localStorage.getItem('gestureMappings');
        return saved ? JSON.parse(saved) : {};
    }

    getMapping(actionId) {
        // Return array of gestures (custom or default)
        const custom = this.mappings[actionId];
        if (custom && custom.length > 0) return custom;

        const def = this.actions.find(a => a.id === actionId)?.defaultGesture;
        return def ? [def] : [];
    }

    saveMapping(actionId, gesture) {
        if (!this.mappings[actionId]) {
            this.mappings[actionId] = [];
        }

        // Avoid duplicates
        if (!this.mappings[actionId].includes(gesture)) {
            this.mappings[actionId].push(gesture);
            localStorage.setItem('gestureMappings', JSON.stringify(this.mappings));
            this.renderActionList(this.container);

            // Notify user
            const event = new CustomEvent('mappingUpdated', { detail: { actionId, gestures: this.mappings[actionId] } });
            window.dispatchEvent(event);
        }
    }

    removeMapping(actionId, gestureToRemove) {
        if (this.mappings[actionId]) {
            this.mappings[actionId] = this.mappings[actionId].filter(g => g !== gestureToRemove);

            // If empty, removing the key causes revert to default. 
            // If we want "no gesture", we might need an explicit empty array handling or just assume default fallback.
            // For now, if empty, we remove key to revert to default.
            if (this.mappings[actionId].length === 0) {
                delete this.mappings[actionId];
            }

            localStorage.setItem('gestureMappings', JSON.stringify(this.mappings));
            this.renderActionList(this.container);

            const event = new CustomEvent('mappingUpdated', { detail: { actionId, gestures: this.mappings[actionId] } });
            window.dispatchEvent(event);
        }
    }

    resetMappings() {
        this.mappings = {};
        localStorage.removeItem('gestureMappings');
        this.renderActionList(this.container);
        // Force update
        window.dispatchEvent(new CustomEvent('mappingUpdated', { detail: { reset: true } }));
    }

    renderActionList(container) {
        this.container = container;
        container.innerHTML = '';

        this.actions.forEach(action => {
            const currentGestures = this.getMapping(action.id);
            const isCustom = !!this.mappings[action.id];

            const card = document.createElement('div');
            card.className = 'action-card';

            // Gestures HTML
            const gesturesHtml = currentGestures.map(g => `
                <span class="gesture-badge" style="display:inline-flex; align-items:center;">
                    ${g}
                    ${isCustom ? `<span class="remove-gesture" data-action="${action.id}" data-gesture="${g}" style="margin-left:5px; cursor:pointer; color:#888;">&times;</span>` : ''}
                </span>
            `).join(' ');

            card.innerHTML = `
                <div>
                    <strong>${action.label}</strong>
                    <div style="margin-top: 5px; display:flex; flex-wrap:wrap; gap:5px;">
                        ${gesturesHtml}
                        ${!isCustom && currentGestures.length > 0 ? '<span style="font-size: 0.8em; color: #aaa; align-self:center;">(Default)</span>' : ''}
                    </div>
                </div>
                <button class="btn-record" data-id="${action.id}">+ Add</button>
            `;

            // Record Button
            const btn = card.querySelector('.btn-record');
            btn.addEventListener('click', (e) => {
                if (this.isRecording && this.recordingAction === action.id) {
                    this.stopRecording();
                } else {
                    this.startRecording(action.id, btn);
                }
            });

            // Remove Buttons
            card.querySelectorAll('.remove-gesture').forEach(remBtn => {
                remBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent card clicks if any
                    const act = remBtn.dataset.action;
                    const gest = remBtn.dataset.gesture;
                    this.removeMapping(act, gest);
                });
            });

            container.appendChild(card);
        });
    }

    startRecording(actionId, btnElement) {
        // Reset others
        if (this.container) {
            this.container.querySelectorAll('.btn-record').forEach(b => {
                b.textContent = 'Record';
                b.classList.remove('recording');
            });
        }

        this.isRecording = true;
        this.recordingAction = actionId;

        btnElement.textContent = 'Waiting...';
        btnElement.classList.add('recording');

        document.getElementById('recording-indicator').style.display = 'block';
    }

    stopRecording() {
        this.isRecording = false;
        this.recordingAction = null;

        document.getElementById('recording-indicator').style.display = 'none';

        // UI refresh happens in saveMapping
        if (this.container) this.renderActionList(this.container);
    }
}
