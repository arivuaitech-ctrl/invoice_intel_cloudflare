import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export const cameraService = {
    async takePhoto(): Promise<{ base64: string; format: string } | null> {
        try {
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Camera // Force camera for "scan"
            });

            if (image.base64String) {
                return {
                    base64: image.base64String,
                    format: image.format
                };
            }
            return null;
        } catch (error) {
            console.error('Camera error:', error);
            return null;
        }
    },

    async requestPermissions() {
        try {
            const permissions = await Camera.requestPermissions();
            return permissions;
        } catch (error) {
            console.error('Permission error:', error);
            return null;
        }
    }
};
