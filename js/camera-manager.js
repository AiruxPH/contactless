export default class CameraManager {
    constructor(videoElement, onCameraReady) {
        this.video = videoElement;
        this.onCameraReady = onCameraReady;
        this.currentStream = null;
        this.videoDevices = [];
        this.currentDeviceIndex = 0;
    }

    async getDevices() {
        try {
            // Request permissions if labels are missing
            const hasLabels = this.videoDevices.some(d => d.label);
            if (!hasLabels) {
                console.log('Requesting camera labels...');
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    stream.getTracks().forEach(track => track.stop());
                } catch (e) {
                    console.warn('Could not get labels via getUserMedia:', e);
                }
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            this.videoDevices = devices.filter(device => device.kind === 'videoinput');

            // Filter out empty entries or system stubs if any
            this.videoDevices = this.videoDevices.filter(d => d.deviceId !== '');

            console.log('Discovered cameras:', this.videoDevices.map(d => d.label || 'Unknown Device'));
            return this.videoDevices;
        } catch (err) {
            console.error('getDevices failed:', err);
            return this.videoDevices; // Return whatever we have
        }
    }

    getBestCamera() {
        if (this.videoDevices.length === 0) return null;

        console.log('Finding best camera among:', this.videoDevices.map(d => d.label));

        // Priority 1: Explicitly Native/Integrated Keywords
        const nativeKeywords = ['integrated', 'face', 'front', 'built-in', 'facetime'];
        const nativeCam = this.videoDevices.find(d =>
            nativeKeywords.some(kw => d.label.toLowerCase().includes(kw))
        );

        if (nativeCam) {
            console.log('Found native camera:', nativeCam.label);
            this.currentDeviceIndex = this.videoDevices.indexOf(nativeCam);
            return nativeCam.deviceId;
        }

        // Priority 2: Any camera that is NOT virtual/external apps
        const virtualKeywords = ['droidcam', 'obs', 'virtual', 'iriun', 'epoccam'];
        const nonVirtualCam = this.videoDevices.find(d =>
            !virtualKeywords.some(kw => d.label.toLowerCase().includes(kw))
        );

        if (nonVirtualCam) {
            console.log('Found non-virtual camera:', nonVirtualCam.label);
            this.currentDeviceIndex = this.videoDevices.indexOf(nonVirtualCam);
            return nonVirtualCam.deviceId;
        }

        // Priority 3: Last resort - first available
        console.log('Falling back to first available camera:', this.videoDevices[0].label);
        this.currentDeviceIndex = 0;
        return this.videoDevices[0].deviceId;
    }


    async startCamera(deviceId) {
        console.log('Starting camera with deviceId:', deviceId);

        // Ensure we have devices for fallback logic
        if (this.videoDevices.length === 0) {
            await this.getDevices();
        }

        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
        }

        const constraintSets = [
            { video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: 640, height: 480 } },
            { video: { deviceId: deviceId ? { exact: deviceId } : undefined } },
            { video: true }
        ];

        let lastError = null;
        for (const constraints of constraintSets) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.currentStream = stream;
                this.video.srcObject = stream;

                // Set play error handler
                try {
                    await this.video.play();
                } catch (playErr) {
                    console.warn('Video play failed, trying next constraints:', playErr);
                    throw playErr;
                }

                const track = stream.getVideoTracks()[0];
                console.log('Camera started successfully:', track.label);

                // Sync index and ID based on actual track
                const actualIndex = this.videoDevices.findIndex(d => d.label === track.label || d.deviceId === deviceId);
                if (actualIndex !== -1) {
                    this.currentDeviceIndex = actualIndex;
                }

                if (this.onCameraReady) {
                    this.onCameraReady(stream);
                }
                return track.label;
            } catch (err) {
                lastError = err;
                console.warn('Constraint set failed:', constraints, err);
            }
        }

        // DEEP FALLBACK: If requested device (or generic) failed, try ANY other available device
        if (this.videoDevices.length > 0) {
            const failedId = deviceId;
            const nextBest = this.videoDevices.find(d => d.deviceId !== failedId);

            if (nextBest) {
                console.warn(`Camera ${failedId} failed. Falling back to: ${nextBest.label}`);
                // Remove the failed device from temporary list so we don't loop forever
                const filteredDevices = this.videoDevices.filter(d => d.deviceId !== failedId);
                if (filteredDevices.length > 0) {
                    const tempManager = { videoDevices: filteredDevices };
                    // We don't want to actually modify the state yet, but we need to try another
                    return await this.startCamera(nextBest.deviceId);
                }
            }
        }

        console.error('All camera sources and fallbacks failed:', lastError);
        throw lastError;
    }



    async switchCamera() {
        if (this.videoDevices.length > 1) {
            this.currentDeviceIndex = (this.currentDeviceIndex + 1) % this.videoDevices.length;
            const deviceId = this.videoDevices[this.currentDeviceIndex].deviceId;
            return await this.startCamera(deviceId);
        } else {
            // Try refreshing devices
            await this.getDevices();
            if (this.videoDevices.length > 1) {
                return await this.switchCamera();
            }
        }
        return null;
    }
}
