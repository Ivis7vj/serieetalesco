
import { toPng } from 'html-to-image';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { triggerErrorAutomation } from './errorAutomation';

/**
 * Converts a DOM ref to a PNG data URL
 */
export const generateShareImage = async (ref, options = {}) => {
    if (!ref) return null;
    const target = ref.current || ref;

    try {
        // Initial attempt with fonts
        return await toPng(target, {
            pixelRatio: 2,
            backgroundColor: '#000000',
            cacheBust: true,
            skipFonts: false,
            ...options
        });
    } catch (error) {
        console.warn("Retrying share image generation without fonts (CORS/SecurityError):", error);
        try {
            // FALLBACK attempt: skip fonts to bypass SecurityError on cross-origin CSS
            return await toPng(target, {
                pixelRatio: 1.5,
                backgroundColor: '#000000',
                cacheBust: true,
                skipFonts: true,
                ...options
            });
        } catch (retryError) {
            console.error("Critical failure in sticker generation:", retryError);
            throw retryError;
        }
    }
};

/**
 * Converts Base64 Data URL to File object
 */
export const base64ToFile = (dataUrl, filename) => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
};

/**
 * Native sharing for Capacitor
 */
export const sharePoster = async (dataUrl, title = 'SERIEE', text = 'My series rating') => {
    try {
        const filename = `seriee_share_${Date.now()}.png`;

        if (!window.Capacitor) {
            // WEB FLOW
            if (navigator.share) {
                const file = base64ToFile(dataUrl, filename);
                await navigator.share({
                    title,
                    text,
                    files: [file]
                });
            } else {
                const link = document.createElement('a');
                link.download = filename;
                link.href = dataUrl;
                link.click();
            }
            return;
        }

        // CAPACITOR NATIVE FLOW
        // Filesystem.writeFile needs the base64 string without the "data:image/png;base64," prefix
        const base64Data = dataUrl.split(',')[1];

        const savedFile = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.Cache
        });

        await Share.share({
            title,
            text,
            files: [savedFile.uri]
        });
    } catch (error) {
        triggerErrorAutomation(error);
    }
};
