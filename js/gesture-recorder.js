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
            { id: 'scroll_right', label: 'Scroll Right (Next)', defaultGesture: 'swipe-left' },
            { id: 'zoom_in', label: 'Zoom In', defaultGesture: 'tilt-up' }, // Example default
            { id: 'zoom_out', label: 'Zoom Out', defaultGesture: 'tilt-down' }
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
        return this.mappings[actionId] || this.actions.find(a => a.id === actionId)?.defaultGesture;
    }

    getActionForGesture(gesture) {
        // Reverse lookup: Find action that has this gesture mapped
        // 1. Check Custom Mappings
        for (const [actionId, mappedGesture] of Object.entries(this.mappings)) {
            if (mappedGesture === gesture) return actionId;
        }

        // 2. Check Defaults (if not overridden)
        for (const action of this.actions) {
            if (!this.mappings[action.id] && action.defaultGesture === gesture) {
                return action.id;
            }
        }
        return null;
    }

    saveMapping(actionId, gesture) {
        this.mappings[actionId] = gesture;
        localStorage.setItem('gestureMappings', JSON.stringify(this.mappings));
        this.renderActionList(this.container);

        // Notify user
        const event = new CustomEvent('mappingUpdated', { detail: { actionId, gesture } });
        window.dispatchEvent(event);
    }

    resetMappings() {
        this.mappings = {};
        localStorage.removeItem('gestureMappings');
        this.renderActionList(this.container);
    }

    renderActionList(container) {
        this.container = container;
        container.innerHTML = '';

        this.actions.forEach(action => {
            const currentGesture = this.getMapping(action.id);

            const card = document.createElement('div');
            card.className = 'action-card';

            card.innerHTML = `
                <div>
                    <strong>${action.label}</strong>
                    <div style="margin-top: 5px;">
                        <span class="gesture-badge">${currentGesture}</span>
                        ${this.mappings[action.id] ? '<span style="font-size: 0.8em; color: #888;">(Custom)</span>' : '<span style="font-size: 0.8em; color: #aaa;">(Default)</span>'}
                    </div>
                </div>
                <button class="btn-record" data-id="${action.id}">Record</button>
            `;

            const btn = card.querySelector('.btn-record');
            btn.addEventListener('click', (e) => {
                if (this.isRecording && this.recordingAction === action.id) {
                    this.stopRecording();
                } else {
                    this.startRecording(action.id, btn);
                }
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
