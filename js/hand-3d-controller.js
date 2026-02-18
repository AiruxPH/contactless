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
        this.camera.position.set(0, 0, 3); // Positioned further back for context
        this.camera.lookAt(0, 0, 0);

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

        // Hand Model Group
        this.handGroup = new THREE.Group();
        this.scene.add(this.handGroup);

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
        const jointGeometry = new THREE.SphereGeometry(0.015, 16, 16);
        const jointMaterial = new THREE.MeshPhongMaterial({
            color: 0x00f2ff,
            emissive: 0x00f2ff,
            emissiveIntensity: 1
        });

        for (let i = 0; i < 21; i++) {
            const joint = new THREE.Mesh(jointGeometry, jointMaterial);
            this.joints.push(joint);
            this.handGroup.add(joint);
        }

        // Define bone connections (pairs of indices)
        this.boneConnections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // Index
            [5, 9], [9, 10], [10, 11], [11, 12], // Middle
            [9, 13], [13, 14], [14, 15], [15, 16], // Ring
            [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [0, 17], // Palm base
            // Cyber Fan: Tip connections
            [4, 8], [8, 12], [12, 16], [16, 20]
        ];

        const segmentMaterial = new THREE.MeshPhongMaterial({
            color: 0x00f2ff,
            transparent: true,
            opacity: 0.4,
            emissive: 0x00f2ff,
            emissiveIntensity: 0.5
        });

        for (let i = 0; i < this.boneConnections.length; i++) {
            const segmentGeometry = new THREE.CylinderGeometry(0.005, 0.005, 1, 8);
            const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
            this.segments.push(segment);
            this.handGroup.add(segment);
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
        if (!data || (!data.landmarks && !data.worldLandmarks)) {
            this.hideHand();
            return;
        }

        const useWorld = !!data.worldLandmarks;
        const landmarks = useWorld ? data.worldLandmarks : data.landmarks;
        const isMirror = this.gestureDetector.isMirror;

        // Apply global hand position from screen-space wrist (landmarks[0])
        // Map 0 -> 1 normalized to -4 -> 4 in Three.js units
        const wrist = data.landmarks[0];
        if (wrist) {
            const screenX = (wrist.x - 0.5) * 4;
            const screenY = (0.5 - wrist.y) * 3;
            this.handGroup.position.set(isMirror ? -screenX : screenX, screenY, 0);
        }

        // Anchor joints to wrist (landmark 0) to prevent relative drift
        const wristAnchor = useWorld ? landmarks[0] : null;

        // 1. Update Joints
        landmarks.forEach((lm, i) => {
            if (this.joints[i]) {
                let x, y, z;

                if (useWorld) {
                    // World landmarks (meters) relative to wristAnchor
                    x = (lm.x - wristAnchor.x) * 10;
                    y = (wristAnchor.y - lm.y) * 10;
                    z = (wristAnchor.z - lm.z) * 10;
                    if (isMirror) x = -x;
                } else {
                    // Fallback to screen space relative to wrist (since handGroup is at wrist pos)
                    x = (lm.x - data.landmarks[0].x) * 4;
                    y = (data.landmarks[0].y - lm.y) * 3;
                    z = -lm.z * 2;
                    if (isMirror) x = -x;
                }

                this.joints[i].position.set(x, y, z);
                this.joints[i].visible = true;
            }
        });

        // 2. Update Bone Segments
        // CRITICAL: Update group matrix so children have valid world positions for lookAt
        this.handGroup.updateMatrixWorld(true);

        const targetWorldPos = new THREE.Vector3();
        this.boneConnections.forEach((conn, i) => {
            const startJoint = this.joints[conn[0]];
            const endJoint = this.joints[conn[1]];
            const segment = this.segments[i];

            if (segment && startJoint.visible && endJoint.visible) {
                const startPos = startJoint.position;
                const endPos = endJoint.position;

                const distance = startPos.distanceTo(endPos);
                segment.scale.y = distance;
                segment.position.copy(startPos).lerp(endPos, 0.5);

                // CRITICAL FIX: lookAt needs a WORLD position.
                // Since joints are siblings in handGroup, we must get the world position of the target.
                endJoint.getWorldPosition(targetWorldPos);
                segment.lookAt(targetWorldPos);

                segment.rotateX(Math.PI / 2);
                segment.visible = true;
            } else if (segment) {
                segment.visible = false;
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
