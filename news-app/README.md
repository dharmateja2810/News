# DailyDigest - Your Daily News, Curated

A modern, cross-platform news aggregation mobile application built with React Native and Expo.

## 🚀 Features

- **Beautiful UI/UX**: Modern, news-focused design with smooth animations
- **Cross-Platform**: Works seamlessly on both iOS and Android
- **User Authentication**: Sign up, login with email or OAuth (Google, GitHub)
- **News Feed**: Browse latest news articles with pull-to-refresh
- **Categories**: Filter news by Technology, Business, Sports, Entertainment, Health, Science, Politics
- **Search**: Search articles by keywords
- **Bookmarks**: Save articles to read later
- **Dark Mode**: Toggle between light and dark themes
- **Offline Support**: Cached articles available offline
- **Real-time Updates**: Auto-refresh news articles

## 📱 Screenshots

> Screenshots will be added once the app is running

## 🛠 Tech Stack

- **Frontend**: React Native, Expo SDK
- **Navigation**: React Navigation v6
- **State Management**: Zustand
- **UI Components**: Custom components with modern design
- **Icons**: Expo Vector Icons (Ionicons)
- **Animations**: React Native Reanimated, Expo Linear Gradient, Expo Blur
- **Storage**: AsyncStorage for local persistence
- **TypeScript**: Full type safety

## 📋 Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- For iOS: Xcode (Mac only)
- For Android: Android Studio

## 🏃‍♂️ Getting Started

### 1. Install Dependencies

\`\`\`bash
cd news-app
npm install
\`\`\`

### 2. Start the Development Server

\`\`\`bash
npm start
\`\`\`

This will start the Expo development server.

### 3. Run on Device/Emulator

#### iOS (Mac only)
\`\`\`bash
npm run ios
\`\`\`

#### Android
\`\`\`bash
npm run android
\`\`\`

#### Web
\`\`\`bash
npm run web
\`\`\`

#### Expo Go App
1. Install Expo Go on your phone
2. Scan the QR code from the terminal

## 📁 Project Structure

\`\`\`
news-app/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── NewsCard.tsx
│   │   ├── CategoryChip.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── EmptyState.tsx
│   ├── navigation/       # Navigation configuration
│   │   ├── AppNavigator.tsx
│   │   └── types.ts
│   ├── screens/          # App screens
│   │   ├── SplashScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── SignupScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── ArticleDetailScreen.tsx
│   │   ├── CategoriesScreen.tsx
│   │   ├── SearchScreen.tsx
│   │   ├── BookmarksScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── services/         # API and data services
│   │   ├── mockData.ts
│   │   └── newsService.ts
│   ├── store/            # State management
│   │   └── index.ts
│   ├── theme/            # Theme configuration
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── index.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   ├── utils/            # Utility functions
│   │   ├── formatters.ts
│   │   ├── storage.ts
│   │   └── hooks.ts
│   └── constants/        # App constants
│       └── appConfig.ts
├── assets/               # Images, fonts, icons
├── App.tsx               # App entry point
├── app.json              # Expo configuration
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md
\`\`\`

## 🎨 Customization & Rebranding

The app is designed to be easily rebranded. Here's how:

### 1. Change App Name

Edit `src/constants/appConfig.ts`:

\`\`\`typescript
export const APP_CONFIG = {
  APP_NAME: 'YourAppName',
  APP_TAGLINE: 'Your Tagline',
  APP_DESCRIPTION: 'Your description',
  // ... other settings
};
\`\`\`

### 2. Update App Configuration

Edit `app.json`:

\`\`\`json
{
  "expo": {
    "name": "YourAppName",
    "slug": "your-app-slug",
    // ... other settings
  }
}
\`\`\`

### 3. Change Theme Colors

Edit `src/theme/colors.ts` to customize the color scheme.

### 4. Replace Assets

Replace icons and splash screen in the `assets/` folder.

## 🔄 Current Status

### ✅ Completed
- Project structure and setup
- Theme system (light/dark mode)
- Navigation (auth + main flows)
- Authentication screens (Splash, Login, Signup)
- Main app screens (Home, Categories, Search, Bookmarks, Profile)
- Mock data service with 40+ realistic articles
- State management
- Beautiful UI components
- TypeScript integration

### 🚧 To Be Implemented (Backend Integration)
- Real API integration
- JWT token management
- User authentication with backend
- OAuth integration (Google, GitHub)
- Real-time news fetching
- Push notifications
- Analytics

## 🔌 Backend Integration

Currently, the app uses mock data. To connect to the backend:

1. Update `API_BASE_URL` in `src/constants/appConfig.ts`
2. Replace mock services in `src/services/` with real API calls
3. Implement proper token refresh logic
4. Add error handling and retry mechanisms

## 📝 Environment Variables

Create a `.env` file:

\`\`\`
API_BASE_URL=http://localhost:3000/api
GOOGLE_CLIENT_ID=your_google_client_id
GITHUB_CLIENT_ID=your_github_client_id
\`\`\`

## 🐛 Troubleshooting

### Metro Bundler Issues
\`\`\`bash
npm start -- --clear
\`\`\`

### iOS Build Issues
\`\`\`bash
cd ios && pod install && cd ..
\`\`\`

### Android Build Issues
\`\`\`bash
cd android && ./gradlew clean && cd ..
\`\`\`

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 📧 Contact

For questions or support, reach out to: support@dailydigest.com

---

**Built with ❤️ using React Native and Expo**

