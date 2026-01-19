# DailyDigest App - Publishing Guide

## 🚀 Publishing Options

### Option 1: Expo Publish (Easiest - For Testing & Demo)
Share your app with anyone via a link. They need Expo Go app.

**Steps:**
```bash
cd "C:\Users\Sowjanya Narisetty\Desktop\NewsApplication\news-app"
npx expo publish
```

**Result:** You'll get a shareable link like: `exp://exp.host/@username/daily-digest`

---

### Option 2: Build APK for Android (Share File)
Create an APK file that anyone can install on Android.

**Steps:**

1. **Install EAS CLI:**
```bash
npm install -g eas-cli
```

2. **Login to Expo:**
```bash
eas login
```

3. **Configure EAS Build:**
```bash
eas build:configure
```

4. **Build APK:**
```bash
eas build -p android --profile preview
```

**Result:** You'll get a download link for the APK file. Share this file with anyone!

---

### Option 3: Publish to Google Play Store

**Prerequisites:**
- Google Play Developer Account ($25 one-time fee)
- App signing key

**Steps:**

1. **Update app.json:**
```json
{
  "expo": {
    "name": "DailyDigest",
    "slug": "daily-digest",
    "version": "1.0.0",
    "android": {
      "package": "com.dailydigest.app",
      "versionCode": 1
    }
  }
}
```

2. **Build for Production:**
```bash
eas build -p android
```

3. **Submit to Play Store:**
```bash
eas submit -p android
```

---

### Option 4: Build IOS App (Mac Required)

**Prerequisites:**
- Mac computer
- Apple Developer Account ($99/year)
- Xcode installed

**Steps:**

1. **Build for iOS:**
```bash
eas build -p ios
```

2. **Submit to App Store:**
```bash
eas submit -p ios
```

---

## 📋 Pre-Publishing Checklist

Before publishing, make sure:

- [ ] App name is finalized (currently: "DailyDigest")
- [ ] App icon is created (512x512 PNG)
- [ ] Splash screen is designed
- [ ] App bundle ID is unique (com.dailydigest.app)
- [ ] Version number is set (1.0.0)
- [ ] Privacy policy is ready (for app stores)
- [ ] App description is written
- [ ] Screenshots are taken (for app stores)

---

## 🎨 Required Assets for Publishing

### 1. App Icon
- Size: 1024x1024 PNG
- No transparency
- Round corners will be added automatically

### 2. Splash Screen
- Size: 1242x2436 PNG (iPhone)
- Should include logo and background

### 3. Feature Graphic (Google Play)
- Size: 1024x500 PNG
- Used in Play Store listing

### 4. Screenshots
- At least 2 screenshots
- Show key features of the app

---

## 🔧 Quick Build Commands

### For Quick Testing (APK):
```bash
cd news-app
eas build -p android --profile preview
```

### For Production (AAB for Play Store):
```bash
eas build -p android --profile production
```

### For Development Build:
```bash
eas build -p android --profile development
```

---

## 📱 Recommended: Start with APK

The easiest way to share your app with testers:

1. Build APK (takes 10-20 minutes)
2. Download the APK file
3. Share via Google Drive, email, etc.
4. Users install directly on Android

**Command:**
```bash
eas build -p android --profile preview
```

---

## 🎯 What I Recommend for You

**Step 1:** Build an APK first for testing
**Step 2:** Share with friends/testers
**Step 3:** Get feedback
**Step 4:** Then publish to Play Store

Would you like me to help you build the APK now?


