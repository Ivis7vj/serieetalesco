# SERIEE Mobile Build Guide

Follow these steps to build and export the SERIEE APK.

## Prerequisites
- Android Studio installed.
- Node.js and NPM installed.
- Capacitor setup completed (`npx cap add android`).

## 🛠 Build Workflow (Step-by-Step)

### 1. Build the React Web Bundle
Run this in the `client` directory:
```bash
npm run build
```

### 2. Sync with Capacitor
This copies the `dist` folder into the native Android project:
```bash
npx cap sync
```

### 3. Open Android Studio
```bash
npx cap open android
```

### 4. Generate APK in Android Studio
1. Wait for the **Gradle Sync** to finish (bar at the bottom).
2. Go to the top menu: **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
3. Once finished, a popup will appear at the bottom right. Click **Locate**.
4. Your APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`.

### 5. Generate Signed Release APK (For Play Store)
1. Go to **Build** -> **Generate Signed Bundle / APK...**
2. Select **APK** and click **Next**.
3. Create or choose a **Key store path**.
4. Fill in the credentials (remember them!).
5. Select **release** build variant.
6. Click **Finish**.

---

## ⚡ Over-The-Air (OTA) Updates
The app is equipped with **Capacitor Live Updates**.
- When you make changes to the Web code (React), you can push them OTA without the user needing to download a new APK.
- The app will check for updates on launch and show a minimalist popup to the user.

## 📱 Troubleshooting Native Share
- If sharing fails on a specific device, ensure the `Filesystem` and `Share` plugins are correctly synced in Android Studio.
- Run `npx cap sync` after any package installation.
