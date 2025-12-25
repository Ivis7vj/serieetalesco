import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.seriee.app',
    appName: 'SERIEE',
    webDir: 'dist',
    plugins: {
        StatusBar: {
            style: 'DARK',
            backgroundColor: '#000000'
        },
        SplashScreen: {
            backgroundColor: '#000000',
            showSpinner: false,
            androidScaleType: 'CENTER_CROP',
            splashFullScreen: true,
            splashImmersive: true
        },
        CapacitorUpdater: {
            autoUpdate: false,
            statsUrl: "", // Optional: Your stats server
        }
    },
    android: {
        allowMixedContent: true
    }
};

export default config;
