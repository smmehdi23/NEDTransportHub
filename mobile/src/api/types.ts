export type UserRole = 'rider' | 'driver' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'removed';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type RideStatus = 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';
export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
export type FareStatus = 'none' | 'proposed' | 'accepted' | 'declined';
export type PaymentMethod = 'online' | 'cash';
export type PaymentStatus = 'pending' | 'successful' | 'outstanding' | 'refunded';
export type RefundStatus = 'none' | 'initiated' | 'completed' | 'failed';
export type PollStatus = 'open' | 'converted' | 'closed';
export type ReportStatus = 'open' | 'in_review' | 'resolved';
export type SOSStatus = 'active' | 'resolved';

export interface MessageResponse {
  message: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RidePreferences {
  quiet_ride: boolean;
  music_allowed: boolean;
  smoking_allowed: boolean;
  luggage_space_needed: boolean;
}

export interface UserRead {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  role: UserRole;
  account_status: AccountStatus;
  is_email_verified: boolean;
  is_driver_verified: boolean;
  ride_preferences: RidePreferences;
  created_at: string;
}

export interface UserUpdate {
  name?: string;
  phone?: string | null;
  department?: string | null;
  ride_preferences?: RidePreferences;
}

export interface UserBrief {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

export interface DocumentLinks {
  licence: string;
  registration: string;
  university_id: string;
}

export interface VehicleRead {
  id: number;
  plate_number: string;
  model: string;
  seat_capacity: number;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  owner: UserBrief;
  documents: DocumentLinks;
}

export interface DriverVerificationStatus {
  role: UserRole;
  is_driver_verified: boolean;
  vehicles: VehicleRead[];
}

export interface DriverBrief {
  id: number;
  name: string;
  rating_avg: number | null;
  rating_count: number;
}

export interface RideRead {
  id: number;
  driver: DriverBrief;
  vehicle_model: string;
  origin_name: string;
  destination_name: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  route: [number, number][];
  distance_km: number;
  duration_min: number;
  departure_time: string;
  total_seats: number;
  available_seats: number;
  estimated_fare: number;
  status: RideStatus;
  notes: string | null;
  poll_id: number | null;
  vehicle_plate: string | null;
  driver_phone: string | null;
  created_at: string;
}

export interface RideMatchRead {
  ride: RideRead;
  pickup_distance_m: number;
  dropoff_distance_m: number | null;
  time_diff_min: number;
  score: number;
}

export interface RidePage {
  items: RideRead[];
  total: number;
  page: number;
  page_size: number;
}

export interface RideCreate {
  vehicle_id: number;
  poll_id?: number | null;
  origin_name: string;
  destination_name: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  route?: [number, number][] | null;
  departure_time: string;
  total_seats: number;
  estimated_fare?: number | null;
  notes?: string | null;
}

export interface FareEstimate {
  distance_km: number;
  duration_min: number;
  rate_per_km: number;
  total_cost: number;
  people_sharing: number;
  fare_per_passenger: number;
  route_source: string;
}

export interface RoutePreview {
  route: [number, number][];
  distance_km: number;
  duration_min: number;
  source: string;
}

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

export interface CampusGatesResponse {
  night_start_hour: number;
  night_end_hour: number;
  gate_radius_m: number;
  rule_enabled: boolean;
  gates: { name: string; lat: number; lng: number }[];
}

export interface PollCreate {
  origin_name: string;
  destination_name: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  departure_time: string;
  seats_needed: number;
  note?: string | null;
}

export interface PollRead {
  id: number;
  creator_id: number;
  creator_name: string;
  origin_name: string;
  destination_name: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  departure_time: string;
  seats_needed: number;
  note: string | null;
  status: PollStatus;
  vote_count: number;
  has_voted: boolean;
  created_at: string;
}

export interface PollPage {
  items: PollRead[];
  total: number;
  page: number;
  page_size: number;
}

export interface PassengerBrief {
  id: number;
  name: string;
  phone: string | null;
}

export interface BookingCreate {
  ride_id: number;
  pickup_name: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_name?: string | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  proposed_fare?: number;
}

export interface BookingRead {
  id: number;
  ride_id: number;
  passenger: PassengerBrief;
  origin_name: string;
  destination_name: string;
  departure_time: string;
  ride_status: string;
  pickup_name: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_name: string | null;
  status: BookingStatus;
  proposed_fare: number | null;
  fare_status: FareStatus;
  cancel_reason: string | null;
  created_at: string;
}

export interface PaymentRead {
  transaction_id: string;
  booking_id: number;
  amount: number;
  method: PaymentMethod | null;
  status: PaymentStatus;
  refund_status: RefundStatus;
  provider_reference: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PayResponse {
  payment: PaymentRead;
  checkout_url: string | null;
}

export interface NotificationRead {
  id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPage {
  items: NotificationRead[];
  total: number;
  unread: number;
  page: number;
  page_size: number;
}

export interface MessageRead {
  id: number;
  booking_id: number;
  sender_id: number;
  content: string;
  sent_at: string;
}

export interface TrackingSnapshot {
  ride_id: number;
  status: RideStatus;
  route: [number, number][];
  origin: [number, number];
  destination: [number, number];
  vehicle_plate: string;
  driver_name: string;
  location: { lat: number; lng: number; at: string } | null;
  eta_to_destination_min: number | null;
  eta_to_my_pickup_min: number | null;
  pickups: {
    booking_id: number;
    passenger: string;
    name: string;
    lat: number;
    lng: number;
  }[];
}

export interface RatingRead {
  id: number;
  ride_id: number;
  rater_id: number;
  rated_user_id: number;
  score: number;
  review: string | null;
  created_at: string;
}

export interface RatingSummary {
  user_id: number;
  average: number | null;
  count: number;
  recent: RatingRead[];
}

export interface PendingRatingPerson {
  user_id: number;
  name: string;
}

export interface ContactRead {
  id: number;
  name: string;
  phone: string;
}

export interface SOSRead {
  id: number;
  user_id: number;
  ride_id: number;
  lat: number | null;
  lng: number | null;
  message: string | null;
  status: SOSStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface ReportRead {
  id: number;
  ride_id: number;
  reporter_id: number;
  reported_user_id: number | null;
  description: string;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareRead {
  url: string;
  expires_at: string;
  contacts_notified: number;
}

export interface HistoryItem {
  role: 'driver' | 'passenger';
  bucket: 'upcoming' | 'completed' | 'cancelled';
  ride_id: number;
  booking_id: number | null;
  origin_name: string;
  destination_name: string;
  departure_time: string;
  ride_status: string;
  booking_status: string | null;
  fare: number | null;
}
