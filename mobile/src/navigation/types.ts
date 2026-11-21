import type { BookingRead, RideMatchRead, RideRead } from '../api';

export type MainTabParamList = {
  HomeTab: undefined;
  MyRidesTab: undefined;
  ChatTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  // Onboarding & Auth
  Splash: undefined;
  Welcome: undefined;
  Login: { email?: string } | undefined;
  Signup: undefined;
  OtpVerify: {
    email: string;
    purpose: 'verify_email' | 'reset_password';
  };
  ForgotPassword: undefined;
  ResetPassword: { email: string; otp: string };

  // Main Tabs
  MainTabs: { screen?: keyof MainTabParamList } | undefined;

  // Rider Flow
  FindRide: undefined;
  PickLocation: { target: 'pickup' | 'dropoff'; returnTo?: 'FindRide' | 'OfferRide' | 'SearchResults' };
  SearchResults: {
    query?: string;
    pickupLat?: number;
    pickupLng?: number;
    dropoffLat?: number;
    dropoffLng?: number;
    pickupName?: string;
    dropoffName?: string;
  } | undefined;
  NoRides: { pickupName?: string; dropoffName?: string } | undefined;
  ResultsMap: { matches: RideMatchRead[] };
  RideDetails: { rideId: number; ride?: RideRead };
  FareReview: { bookingId: number; booking?: BookingRead; ride?: RideRead };
  WaitingForSeats: { bookingId: number; rideId: number };
  BookingConfirmed: { bookingId: number; rideId: number };
  CancelBooking: { bookingId: number; driverName?: string };

  // Driver Flow
  DriverHome: undefined;
  BecomeDriver: undefined;
  DriverDocs: { resubmitVehicleId?: number } | undefined;
  DriverVehicle: { resubmitVehicleId?: number } | undefined;
  DriverStatus: undefined;
  OfferRide: { pollId?: number; originName?: string; destName?: string; originLat?: number; originLng?: number; destLat?: number; destLng?: number } | undefined;
  DriverRides: undefined;
  DriverRequests: { rideId: number };
  DriverStart: { rideId: number };
  DriverActive: { rideId: number };
  DriverDone: { rideId: number };

  // Active Ride, Payment, Chat, Safety
  ActiveRide: { rideId: number; bookingId?: number };
  Chat: { bookingId: number; peerName?: string; subtitle?: string };
  Payment: { bookingId: number; rideId: number; driverName?: string };
  PaymentSuccess: {
    amount: number;
    method: string;
    transactionId: string;
    driverName?: string;
    rideId: number;
    statusLabel?: string;
  };
  PaymentFailed: {
    bookingId: number;
    rideId: number;
    amount: number;
    method: string;
    reason?: string;
    driverName?: string;
  };
  RateRide: { rideId: number; driverName?: string };
  SosActive: { rideId: number; autoTrigger?: boolean };
  ReportIssue: { rideId?: number; reportedUserId?: number } | undefined;
  Offline: undefined;

  // Profile & History
  EditProfile: undefined;
  TrustedContacts: undefined;
  Notifications: undefined;
  PaymentHistory: undefined;
};
