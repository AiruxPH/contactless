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

            // Prioritize DroidCam if found and not already set
            if (this.currentDeviceIndex === 0) {
                const droidCamIndex = this.videoDevices.findIndex(d => d.label.toLowerCase().includes('droidcam'));
                if (droidCamIndex !== -1) {
                    this.currentDeviceIndex = droidCamIndex;
                }
            }
            return this.videoDevices;
        } catch (err) {
            console.error('Error enumerating devices:', err);
            return [];
        }
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

                if (this.onCameraReady) {
                    this.onCameraReady(stream);
                }
                return track.label;
            } catch (err) {
                lastError = err;
                console.warn('Failed with constraints:', constraints, err);
            }
        }

        console.error('All camera constraint sets failed:', lastError);
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
