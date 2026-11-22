import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, type IconName } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import type { MainTabParamList, RootStackParamList } from './types';

const navigationRef = createNavigationContainerRef<RootStackParamList>();
const PUBLIC_ROUTES = new Set([
  'Splash',
  'Welcome',
  'Login',
  'Signup',
  'OtpVerify',
  'ForgotPassword',
  'ResetPassword',
]);

// Onboarding
import { SplashScreen } from '../screens/onboarding/SplashScreen';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { LoginScreen } from '../screens/onboarding/LoginScreen';
import { SignupScreen } from '../screens/onboarding/SignupScreen';
import { OtpVerifyScreen } from '../screens/onboarding/OtpVerifyScreen';
import { ForgotPasswordScreen } from '../screens/onboarding/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/onboarding/ResetPasswordScreen';

// Rider
import { HomeScreen } from '../screens/rider/HomeScreen';
import { FindRideScreen } from '../screens/rider/FindRideScreen';
import { PickLocationScreen } from '../screens/rider/PickLocationScreen';
import { SearchResultsScreen } from '../screens/rider/SearchResultsScreen';
import { NoRidesScreen } from '../screens/rider/NoRidesScreen';
import { ResultsMapScreen } from '../screens/rider/ResultsMapScreen';
import { RideDetailsScreen } from '../screens/rider/RideDetailsScreen';
import { FareReviewScreen } from '../screens/rider/FareReviewScreen';
import { WaitingForSeatsScreen } from '../screens/rider/WaitingForSeatsScreen';
import { BookingConfirmedScreen } from '../screens/rider/BookingConfirmedScreen';
import { CancelBookingScreen } from '../screens/rider/CancelBookingScreen';

// Driver
import { DriverHomeScreen } from '../screens/driver/DriverHomeScreen';
import { BecomeDriverScreen } from '../screens/driver/BecomeDriverScreen';
import { DriverDocsScreen } from '../screens/driver/DriverDocsScreen';
import { DriverVehicleScreen } from '../screens/driver/DriverVehicleScreen';
import { DriverStatusScreen } from '../screens/driver/DriverStatusScreen';
import { OfferRideScreen } from '../screens/driver/OfferRideScreen';
import { DriverRidesScreen } from '../screens/driver/DriverRidesScreen';
import { DriverRequestsScreen } from '../screens/driver/DriverRequestsScreen';
import { DriverStartScreen } from '../screens/driver/DriverStartScreen';
import { DriverActiveScreen } from '../screens/driver/DriverActiveScreen';
import { DriverDoneScreen } from '../screens/driver/DriverDoneScreen';

// Trip, Chat, Payment, Safety
import { ActiveRideScreen } from '../screens/trip/ActiveRideScreen';
import { ChatListScreen } from '../screens/trip/ChatListScreen';
import { ChatScreen } from '../screens/trip/ChatScreen';
import { PaymentScreen } from '../screens/trip/PaymentScreen';
import { PaymentSuccessScreen } from '../screens/trip/PaymentSuccessScreen';
import { PaymentFailedScreen } from '../screens/trip/PaymentFailedScreen';
import { RateRideScreen } from '../screens/trip/RateRideScreen';
import { SosActiveScreen } from '../screens/trip/SosActiveScreen';
import { ReportIssueScreen } from '../screens/trip/ReportIssueScreen';
import { OfflineScreen } from '../screens/trip/OfflineScreen';

// Profile & History
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { TrustedContactsScreen } from '../screens/profile/TrustedContactsScreen';
import { NotificationsScreen } from '../screens/profile/NotificationsScreen';
import { MyRidesScreen } from '../screens/profile/MyRidesScreen';
import { PaymentHistoryScreen } from '../screens/profile/PaymentHistoryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={[styles.tabPill, focused && styles.tabPillActive]}>
      <Icon name={name} size={20} color={focused ? colors.brand : colors.ink3} />
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.ink3,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          height: 70,
          paddingTop: 8,
          paddingBottom: 10,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="House" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MyRidesTab"
        component={MyRidesScreen}
        options={{
          tabBarLabel: 'My rides',
          tabBarIcon: ({ focused }) => <TabIcon name="Car" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatListScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ focused }) => <TabIcon name="MessageCircle" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="User" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    if (!navigationRef.isReady()) return;
    const current = navigationRef.getCurrentRoute()?.name;
    if (current && !PUBLIC_ROUTES.has(current)) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  }, [isAuthenticated, isLoading]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'slide_from_right',
        }}
      >
        {/* Onboarding & Auth */}
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />

        {/* Main Tabs */}
        <Stack.Screen name="MainTabs" component={MainTabs} />

        {/* Rider Flow */}
        <Stack.Screen name="FindRide" component={FindRideScreen} />
        <Stack.Screen name="PickLocation" component={PickLocationScreen} />
        <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
        <Stack.Screen name="NoRides" component={NoRidesScreen} />
        <Stack.Screen name="ResultsMap" component={ResultsMapScreen} />
        <Stack.Screen name="RideDetails" component={RideDetailsScreen} />
        <Stack.Screen name="FareReview" component={FareReviewScreen} />
        <Stack.Screen name="WaitingForSeats" component={WaitingForSeatsScreen} />
        <Stack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} />
        <Stack.Screen name="CancelBooking" component={CancelBookingScreen} />

        {/* Driver Flow */}
        <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
        <Stack.Screen name="BecomeDriver" component={BecomeDriverScreen} />
        <Stack.Screen name="DriverDocs" component={DriverDocsScreen} />
        <Stack.Screen name="DriverVehicle" component={DriverVehicleScreen} />
        <Stack.Screen name="DriverStatus" component={DriverStatusScreen} />
        <Stack.Screen name="OfferRide" component={OfferRideScreen} />
        <Stack.Screen name="DriverRides" component={DriverRidesScreen} />
        <Stack.Screen name="DriverRequests" component={DriverRequestsScreen} />
        <Stack.Screen name="DriverStart" component={DriverStartScreen} />
        <Stack.Screen name="DriverActive" component={DriverActiveScreen} />
        <Stack.Screen name="DriverDone" component={DriverDoneScreen} />

        {/* Active Ride, Payment, Chat, Safety */}
        <Stack.Screen name="ActiveRide" component={ActiveRideScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
        <Stack.Screen name="PaymentFailed" component={PaymentFailedScreen} />
        <Stack.Screen name="RateRide" component={RateRideScreen} />
        <Stack.Screen name="SosActive" component={SosActiveScreen} />
        <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
        <Stack.Screen name="Offline" component={OfflineScreen} />

        {/* Profile & History */}
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="TrustedContacts" component={TrustedContactsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabPill: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: colors.brandSubtle,
  },
});
