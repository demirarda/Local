# LOCAL Pulse - React Native App

Production-ready React Native implementation of the LOCAL Pulse feed screen.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Expo CLI installed globally: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# 1. Create new Expo project
npx create-expo-app local-pulse-app
cd local-pulse-app

# 2. Install dependencies
npm install expo-linear-gradient

# 3. Copy files
# - Copy PulseScreen.tsx to your project root
# - Replace App.tsx with the provided App.tsx

# 4. Start the app
npx expo start
```

## 📱 Features Implemented

### ✅ UI Components
- **Header**
  - Create Ritual button (gold gradient)
  - L. logo (centered)
  - Menu button
  - Filter tabs (horizontal scroll)

- **Hero Special Event Card**
  - Background image with overlay
  - Special Event badge (gold)
  - Event details (time, title, location)
  - Verified venue badge
  - Tags (Music, Social, Vibrant)
  - Friend avatars stack
  - "Get Seat" button (gold gradient)

- **Memory Share Card**
  - Image preview
  - Host badge
  - Memory details
  - "View" button (gold gradient)

- **Live Now Card**
  - Live indicator (red dot)
  - LIVE badge
  - Friend avatars
  - Seats left counter
  - "Join" button (red gradient)

- **Venue Activity Card**
  - Dark gradient background
  - Venue name and verification
  - Rituals list (3 items)
  - "See All" button

- **Friend Activity Card**
  - Friend icon header
  - Activity details
  - Tags (Calm, Active)
  - "Join Them" button

- **Starting Soon Card**
  - Horizontal layout
  - Countdown timer

- **Bottom Navigation**
  - 3 tabs (Pulse, City Rhythm, Social Passport)
  - Active state with gold gradient

### 🎨 Design System

**Colors:**
- Background: `#f5f0e8` (cream/beige)
- Gold Gradient: `#e8b86d` → `#d4a05a`
- Red Gradient: `#e74c3c` → `#c0392b`
- Dark Gradient: `#2a2a2a` → `#1a1a1a`

**Typography:**
- System fonts (SF Pro on iOS, Roboto on Android)
- Font weights: 400, 500, 600, 700, 900
- Sizes: 11px - 64px

**Spacing:**
- Padding: 8, 12, 16, 20px
- Gap: 8, 12px
- Border radius: 12, 16, 20, 24px

**Shadows:**
- Card shadow: `rgba(0,0,0,0.06)` with 8px radius
- Button shadow: `rgba(212,160,90,0.4)` with 12px radius

## 📂 File Structure

```
local-pulse-app/
├── App.tsx                 # Entry point
├── PulseScreen.tsx         # Main Pulse feed screen
├── package.json            # Dependencies
└── assets/                 # Images and fonts
```

## 🔧 Customization

### Change Colors
Edit the gradient colors in `styles`:
```typescript
colors={['#e8b86d', '#d4a05a']}  // Gold gradient
colors={['#e74c3c', '#c0392b']}  // Red gradient
```

### Add Navigation
Install React Navigation:
```bash
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
```

### Connect to Backend
Replace static data with API calls:
```typescript
const [events, setEvents] = useState([]);

useEffect(() => {
  fetch('https://api.local.app/pulse')
    .then(res => res.json())
    .then(data => setEvents(data));
}, []);
```

## 📱 Platform Support

- ✅ iOS (iPhone 12+)
- ✅ Android (API 21+)
- ✅ Expo Go app
- ✅ Web (via Expo Web)

## 🎯 Next Steps

1. **Add Navigation**
   - Implement tab navigation
   - Add screen transitions

2. **Connect Backend**
   - Integrate tRPC or REST API
   - Add authentication

3. **Add Interactions**
   - Pull-to-refresh
   - Infinite scroll
   - Like/bookmark actions

4. **Optimize Performance**
   - Image lazy loading
   - FlatList virtualization
   - Memoization

5. **Add Animations**
   - React Native Reanimated
   - Gesture handlers
   - Skeleton loaders

## 📄 License

MIT License - Free to use for personal and commercial projects.

## 🤝 Support

For questions or issues, contact: support@local.app
