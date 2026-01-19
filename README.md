# DailyDigest - Cross-Platform News Application

A comprehensive news aggregation system with mobile applications for iOS and Android, built with modern technologies and designed for scalability.

## 🏗 Project Structure

```
NewsApplication/
├── news-app/              # Mobile application (Expo/React Native)
│   └── [See news-app/README.md for details]
├── news-app-api/         # Backend API (Node.js/Express) [To be implemented]
├── docker-compose.yml    # Docker orchestration [To be implemented]
└── README.md             # This file
```

## 📱 Mobile App (Frontend)

The mobile application is built with React Native and Expo, featuring:

- ✅ Modern, news-focused UI design
- ✅ Cross-platform support (iOS & Android)
- ✅ User authentication (with mock backend)
- ✅ News feed with categories and search
- ✅ Bookmarks and offline support
- ✅ Light/Dark mode
- ✅ Smooth animations and interactions

**Status**: ✅ **READY FOR DEMO**

[View Mobile App Documentation](./news-app/README.md)

### Quick Start (Mobile App)

```bash
cd news-app
npm install
npm start
```

Then press `i` for iOS simulator or `a` for Android emulator, or scan QR code with Expo Go app.

## 🚀 Current Development Status

### ✅ Phase 1: Frontend Development (COMPLETED)
- [x] Project structure and setup
- [x] Theme system with light/dark mode
- [x] Navigation system (authentication + main app)
- [x] Authentication screens (Splash, Login, Signup)
- [x] Main app screens (Home, Categories, Search, Bookmarks, Profile)
- [x] Reusable UI components
- [x] Mock data service with 40+ realistic articles
- [x] State management with Zustand
- [x] TypeScript integration
- [x] Documentation

### 🚧 Phase 2: Backend Development (NEXT)
- [ ] Set up Docker infrastructure
- [ ] PostgreSQL database setup
- [ ] Redis cache setup
- [ ] Express.js API with TypeScript
- [ ] JWT authentication
- [ ] Rate limiting middleware
- [ ] News API endpoints
- [ ] Supabase integration

### 🚧 Phase 3: Data Pipeline (FUTURE)
- [ ] n8n setup in Docker
- [ ] NewsAPI.org integration
- [ ] Data transformation workflows
- [ ] Duplicate detection
- [ ] Scheduled execution

### 🚧 Phase 4: Production Deployment (FUTURE)
- [ ] AWS RDS setup
- [ ] AWS ElastiCache setup
- [ ] AWS Lambda deployment
- [ ] Supabase Cloud migration
- [ ] CI/CD pipeline

## 🎨 App Features

### Authentication
- Email/password signup and login
- OAuth integration ready (Google, GitHub)
- Secure token storage
- Automatic session management

### News Reading
- Browse latest news from multiple sources
- Filter by 8 categories (Technology, Business, Sports, etc.)
- Search articles by keywords
- Pull-to-refresh for latest updates
- Infinite scroll pagination

### Personalization
- Bookmark favorite articles
- Dark mode support
- Persistent settings
- Offline article caching

### User Experience
- Smooth animations and transitions
- Modern, clean interface
- Responsive design
- Fast performance with caching

## 🛠 Technology Stack

### Frontend
- **Framework**: React Native with Expo SDK
- **Language**: TypeScript
- **Navigation**: React Navigation v6
- **State Management**: Zustand
- **UI**: Custom components with modern design
- **Animations**: React Native Reanimated
- **Storage**: AsyncStorage

### Backend (To be implemented)
- **Runtime**: Node.js v20 LTS
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL v15.5+
- **Cache**: Redis v7.2+
- **Auth**: Supabase
- **Data Pipeline**: n8n v1.36+

### DevOps
- **Containerization**: Docker & Docker Compose
- **Cloud**: AWS (RDS, ElastiCache, Lambda)
- **Version Control**: Git

## 📋 System Architecture

```
┌─────────────────┐
│   Mobile App    │ (React Native/Expo)
│  (iOS/Android)  │
└────────┬────────┘
         │
         │ HTTPS/REST
         │
┌────────▼────────┐
│   Backend API   │ (Node.js/Express)
│  Authentication │ - JWT Tokens
│  Rate Limiting  │ - 100 req/hour
│  Caching        │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ Redis │ │ Postgres│
│ Cache │ │   DB    │
└───────┘ └──┬────┘
             │
        ┌────▼─────┐
        │   n8n    │ (Data Pipeline)
        │ Workflows│ - Fetch news
        └──────────┘ - Transform data
```

## 🎯 Key Design Decisions

### Easy Rebranding
The app is designed to be easily rebranded by changing a few configuration files:
- `src/constants/appConfig.ts` - App name, tagline, API endpoints
- `app.json` - Expo configuration
- `src/theme/colors.ts` - Color scheme

### Mock Data for Development
- 40+ realistic news articles across all categories
- Simulates API delays for realistic testing
- Easy to swap with real API calls

### Scalable Architecture
- Separation of concerns (UI, business logic, data)
- TypeScript for type safety
- Modular component structure
- Ready for backend integration

## 📱 Demo Instructions

### Running the Mobile App

1. **Install dependencies**:
   ```bash
   cd news-app
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Run on device**:
   - **iOS**: Press `i` (Mac only) or use Expo Go app
   - **Android**: Press `a` or use Expo Go app
   - **Web**: Press `w`

4. **Test the app**:
   - Login with any email/password (mock authentication)
   - Browse news articles
   - Try different categories
   - Search for articles
   - Bookmark articles
   - Toggle dark mode in Profile
   - View article details

## 🔄 Next Steps

1. **Backend Development**: Implement the Express.js API with PostgreSQL and Redis
2. **Docker Setup**: Create docker-compose.yml for local development
3. **n8n Pipeline**: Configure news fetching workflows
4. **API Integration**: Connect mobile app to real backend
5. **Testing**: Add unit tests and integration tests
6. **Deployment**: Set up AWS infrastructure and deploy

## 📚 Documentation

- [Mobile App README](./news-app/README.md) - Detailed frontend documentation
- [Backend API README](./news-app-api/README.md) - To be created
- [Docker Setup Guide](./DOCKER.md) - To be created
- [Deployment Guide](./DEPLOYMENT.md) - To be created

## 🐛 Known Issues & Limitations

- Mock authentication (any email/password works)
- Mock data (not fetching from real news APIs yet)
- OAuth not fully implemented (requires backend)
- No push notifications yet
- No analytics tracking yet

## 🤝 Contributing

This is a demonstration project. For production use:
1. Replace mock authentication with real backend
2. Implement proper error handling and validation
3. Add comprehensive testing
4. Set up proper security measures
5. Implement analytics and monitoring

## 📄 License

MIT License - Free to use for personal and commercial projects

## 📧 Contact

For questions or feedback:
- Email: support@dailydigest.com
- GitHub: [Repository URL]

---

**Built with ❤️ for the news lover in all of us**

