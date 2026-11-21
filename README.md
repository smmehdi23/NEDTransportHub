# NED Transport Hub — Full-Stack Mobile App

A campus carpooling and ride-sharing platform for **NED University of Engineering & Technology**, built with a **React Native (Expo + TypeScript)** mobile app and a **Python FastAPI** backend.

## Project Structure

```text
NED Transport Hub/
├── backend/                     # FastAPI backend (cleanly extracted from nth_backend)
│   ├── app/
│   │   ├── core/                # Config, database, JWT/WS auth, security
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── routers/             # REST & WebSocket routers (/api/v1/*)
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/            # Matching, maps, fare split, OTP, realtime, SMS/email
│   │   └── main.py              # FastAPI app + CORS middleware + /health
│   ├── tests/                   # Pytest integration suite
│   ├── .env.example
│   ├── pytest.ini
│   └── requirements.txt
├── mobile/                      # React Native (Expo + TypeScript) mobile app
│   ├── src/
│   │   ├── api/                 # Centralized Axios client, SecureStore tokens, typed services
│   │   ├── components/          # Figma-matched UI primitives + LiveMap (react-native-maps)
│   │   ├── config/              # Environment URL & Karachi/NED coordinate presets
│   │   ├── context/             # AuthContext (session + NetInfo) & RideFlowContext
│   │   ├── navigation/          # React Navigation Native Stack + Bottom Tabs
│   │   ├── screens/             # Onboarding, Rider, Driver, Trip/Chat/Payment/Safety, Profile
│   │   ├── theme.ts             # Figma color, radius & shadow tokens
│   │   └── utils/               # Date/time/PKR formatting helpers
│   ├── .env.example
│   ├── app.json
│   └── App.tsx
└── NED Transport Hub frontend/  # Original Figma web prototype (includes Admin Web Dashboard)
```

---

## 1. Backend Setup (`/backend`)

Create a fresh virtual environment, install dependencies, configure `.env`, and run Uvicorn bound to `0.0.0.0` so both emulators and physical phones on your Wi-Fi can reach it:

### Windows (PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copy and edit .env if needed (DATABASE_URL, SECRET_KEY, CORS_ORIGINS=*, SMTP, MAPBOX_TOKEN)
Copy-Item .env.example .env -ErrorAction SilentlyContinue

# Start the API server (accessible via localhost, 10.0.2.2, and LAN IP)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### macOS / Linux
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify the server is running:
- Health check: `http://localhost:8000/health`
- Interactive Swagger docs: `http://localhost:8000/docs`
- Run backend tests: `pytest` (from inside `backend/`)

---

## 2. Mobile App Setup (`/mobile`)

```powershell
cd mobile
npm install
```

### Configure Backend URL (`mobile/.env`)
- **Android Emulator**: automatically defaults to `http://10.0.2.2:8000`
- **iOS Simulator / Web**: automatically defaults to `http://localhost:8000`
- **Physical Phone (Expo Go on same Wi-Fi)**: find your PC's IPv4 address (`ipconfig` on Windows) and set it in `mobile/.env`:
  ```env
  EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000
  ```

### Run the App
```powershell
cd mobile
npm start
```
Then press `a` (Android Emulator), `i` (iOS Simulator), `w` (Web), or scan the QR code in **Expo Go**. *(Using `npm start` automatically loads [node20-polyfill.cjs](file:///c:/MY%20DATA/VS%20Code%20projects/NED%20Transport%20Hub/mobile/node20-polyfill.cjs) so Expo works cleanly on Node.js 20.x too.)*

---

## 3. Full-Stack Screen-to-API Integration Map

| Feature Area | Mobile Screens | FastAPI Endpoints (`/api/v1`) |
| --- | --- | --- |
| **Auth & Onboarding** | `Splash`, `Welcome`, `Login`, `Signup`, `OtpVerify`, `ForgotPassword`, `ResetPassword` | `POST /auth/register`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password` |
| **Profile** | `Profile`, `EditProfile` | `GET /users/me`, `PATCH /users/me` |
| **Driver Verification** | `BecomeDriver`, `DriverDocs`, `DriverVehicle`, `DriverStatus` | `POST /drivers/vehicles` (multipart upload), `PUT /drivers/vehicles/{id}`, `GET /drivers/vehicles`, `GET /drivers/verification-status` |
| **Find & Book Rides** | `Home`, `FindRide`, `PickLocation`, `SearchResults`, `NoRides`, `ResultsMap`, `RideDetails`, `FareReview`, `WaitingForSeats`, `BookingConfirmed`, `CancelBooking` | `GET /rides/search`, `GET /rides`, `GET /rides/{id}`, `GET /maps/geocode`, `/maps/route`, `/maps/fare-estimate`, `/maps/gates`, `POST /polls`, `POST /bookings`, `GET /bookings`, `POST /bookings/{id}/fare`, `POST /bookings/{id}/cancel` |
| **Driver Operations** | `DriverHome`, `OfferRide`, `DriverRides`, `DriverRequests`, `DriverStart`, `DriverActive`, `DriverDone` | `POST /rides`, `GET /rides?mine=true`, `POST /rides/{id}/cancel`, `POST /rides/{id}/start`, `POST /rides/{id}/complete`, `GET /bookings?as_driver=true`, `POST /bookings/{id}/respond`, `GET /polls` |
| **Live Tracking** | `ActiveRide`, `DriverActive` | `GET /tracking/rides/{id}`, `POST /tracking/rides/{id}/location`, `WS /tracking/ws/{id}?token=...` |
| **Real-Time Chat** | `ChatList`, `Chat` | `GET /chat/{booking_id}/messages`, `POST /chat/{booking_id}/messages`, `WS /ws/chat/{booking_id}?token=...` |
| **Payments & History** | `Payment`, `PaymentSuccess`, `PaymentFailed`, `PaymentHistory`, `MyRides` | `GET /payments/booking/{id}`, `POST /payments/booking/{id}/pay`, `POST /payments/booking/{id}/confirm-cash`, `GET /payments/history`, `GET /history` |
| **Ratings** | `RateRide` | `GET /ratings/rides/{id}/pending`, `POST /ratings`, `GET /ratings/users/{id}` |
| **Safety & Notifications** | `TrustedContacts`, `SosActive`, `ReportIssue`, `Notifications`, `Offline` | `GET/POST/DELETE /safety/contacts`, `POST /safety/trips/{id}/share`, `POST /safety/sos`, `POST /safety/reports`, `GET /safety/reports/mine`, `GET /notifications`, `POST /notifications/read-all`, `POST /notifications/{id}/read` |
