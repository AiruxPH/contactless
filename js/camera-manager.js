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
            // Request permissions first to get labels
            await navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
                stream.getTracks().forEach(track => track.stop());
            }).catch(e => console.warn('Permission request for labels failed:', e));

            const devices = await navigator.mediaDevices.enumerateDevices();
            this.videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log('Available video devices:', this.videoDevices);

            return this.videoDevices;
        } catch (err) {
            console.error('Error enumerating devices:', err);
            return [];
        }
    }

    getBestCamera() {
        if (this.videoDevices.length === 0) return null;

        // Priority 1: DroidCam
        const droidCam = this.videoDevices.find(d => d.label.toLowerCase().includes('droidcam'));
        if (droidCam) {
            this.currentDeviceIndex = this.videoDevices.indexOf(droidCam);
            return droidCam.deviceId;
        }

        // Priority 2: Fallback to the first available camera
        this.currentDeviceIndex = 0;
        return this.videoDevices[0].deviceId;
    }


    async startCamera(deviceId) {
        console.log('Starting camera with deviceId:', deviceId);
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
                await this.video.play();

                const track = stream.getVideoTracks()[0];
                console.log('Camera started successfully with label:', track.label);

                // Sync index if we fell back to a different camera than requested
                const actualIndex = this.videoDevices.findIndex(d => d.label === track.label);
                if (actualIndex !== -1) this.currentDeviceIndex = actualIndex;

                if (this.onCameraReady) {
                    this.onCameraReady(stream);
                }
                return track.label;
            } catch (err) {
                lastError = err;
                console.warn('Failed with constraints:', constraints, err);
            }
        }

        // If we reached here, the requested deviceId (or general video) failed.
        // Try one last ditch effort: Start ANY available camera from the list that isn't the one we just tried
        if (deviceId && this.videoDevices.length > 1) {
            const fallbackDevice = this.videoDevices.find(d => d.deviceId !== deviceId);
            if (fallbackDevice) {
                console.log('Requested camera failed. Attempting fallback to:', fallbackDevice.label);
                return await this.startCamera(fallbackDevice.deviceId);
            }
        }

        console.error('All camera constraint sets and fallbacks failed:', lastError);
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
