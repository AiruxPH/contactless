import * as THREE from 'three';

export default class Hand3DController {
    constructor(canvas, gestureDetector) {
        this.canvas = canvas;
        this.gestureDetector = gestureDetector;
        this.scene = new THREE.Scene();

        // Dark background
        this.scene.background = new THREE.Color(0x0a0a0c);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 1000);
        this.camera.position.z = 1.5; // Slightly closer for hand detail

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.updateRendererSize();
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0x38bdf8, 2, 10);
        pointLight.position.set(2, 2, 2);
        this.scene.add(pointLight);

        // Hand Model Parts
        this.joints = [];
        this.segments = [];
        this.createHandModel();

        // Responsive handles
        window.addEventListener('resize', () => this.onWindowResize());

        // Start Loop
        this.init();
    }

    createHandModel() {
        // Create 21 joints (spheres)
        const jointGeometry = new THREE.SphereGeometry(0.02, 16, 16);
        const jointMaterial = new THREE.MeshPhongMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.5 });

        for (let i = 0; i < 21; i++) {
            const joint = new THREE.Mesh(jointGeometry, jointMaterial);
            this.joints.push(joint);
            this.scene.add(joint);
        }

        // Define bone connections (pairs of indices)
        this.boneConnections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // Index
            [5, 9], [9, 10], [10, 11], [11, 12], // Middle
            [9, 13], [13, 14], [14, 15], [15, 16], // Ring
            [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [0, 17] // Palm base
        ];

        const segmentMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });

        for (let i = 0; i < this.boneConnections.length; i++) {
            const segmentGeometry = new THREE.CylinderGeometry(0.008, 0.008, 1, 8);
            const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
            this.segments.push(segment);
            this.scene.add(segment);
        }
    }

    init() {
        // Hook into gesture detector frame emitter
        // Since we don't have a direct emitter for 3D landmarks yet in GD, 
        // we'll listen to the handFrame event if it exists or add it.

        const animate = () => {
            requestAnimationFrame(animate);
            this.renderer.render(this.scene, this.camera);
        };
        animate();

        // Listen for tracking data
        this.gestureDetector.onHandFrame = (data) => this.updateHand(data);
    }

    updateHand(data) {
        if (!data || !data.landmarks) {
            this.hideHand();
            return;
        }

        const landmarks = data.landmarks;

        // 1. Update Joints
        landmarks.forEach((lm, i) => {
            if (this.joints[i]) {
                // Map MediaPipe (0-1) to Three.js (-1 to 1)
                // Normalize and flip Y 
                const x = (lm.x - 0.5) * 4; // Scale it up for visibility
                const y = (0.5 - lm.y) * 3;
                const z = -lm.z * 2; // MediaPipe Z is depth relative to wrist

                this.joints[i].position.set(x, y, z);
                this.joints[i].visible = true;
            }
        });

        // 2. Update Bone Segments
        this.boneConnections.forEach((conn, i) => {
            const start = this.joints[conn[0]].position;
            const end = this.joints[conn[1]].position;
            const segment = this.segments[i];

            if (segment) {
                const distance = start.distanceTo(end);
                segment.scale.y = distance;
                segment.position.copy(start).lerp(end, 0.5);
                segment.lookAt(end);
                segment.rotateX(Math.PI / 2);
                segment.visible = true;
            }
        });

        // 3. Status UI Update
        const presenceEl = document.getElementById('hand-presence');
        if (presenceEl) presenceEl.textContent = 'Detected';

        const engagementEl = document.getElementById('engagement-status');
        if (engagementEl) {
            engagementEl.textContent = data.isRingClosed ? 'GRIPPED' : 'Released';
            engagementEl.style.color = data.isRingClosed ? '#00FF00' : '#38bdf8';
        }

        const pauseEl = document.getElementById('pause-status');
        if (pauseEl) {
            pauseEl.textContent = data.isPaused ? 'PAUSED' : 'ACTIVE';
            pauseEl.style.color = data.isPaused ? '#ff0000' : '#38bdf8';
        }
    }

    hideHand() {
        this.joints.forEach(j => j.visible = false);
        this.segments.forEach(s => s.visible = false);

        // Reset UI Status
        const presenceEl = document.getElementById('hand-presence');
        if (presenceEl) presenceEl.textContent = 'Searching...';

        const gestureEl = document.getElementById('hand-gesture');
        if (gestureEl) gestureEl.textContent = '---';

        const engagementEl = document.getElementById('engagement-status');
        if (engagementEl) {
            engagementEl.textContent = 'Released';
            engagementEl.style.color = '#38bdf8';
        }

        const pauseEl = document.getElementById('pause-status');
        if (pauseEl) {
            pauseEl.textContent = 'ACTIVE';
            pauseEl.style.color = '#38bdf8';
        }
    }

    updateRendererSize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        this.renderer.setSize(width, height, false);
    }

    onWindowResize() {
        this.updateRendererSize();
        this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera.updateProjectionMatrix();
    }
}
