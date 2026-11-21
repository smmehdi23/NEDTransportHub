import React, { createContext, useContext, useState } from 'react';
import { NED_UNIVERSITY_COORDS } from '../config/env';
import type { UploadFileAsset } from '../api';

export interface SelectedLocation {
  name: string;
  subtitle?: string;
  lat: number;
  lng: number;
}

export interface DriverDocDraft {
  licence?: UploadFileAsset;
  registration?: UploadFileAsset;
  universityId?: UploadFileAsset;
}

interface RideFlowContextValue {
  pickup: SelectedLocation;
  dropoff: SelectedLocation;
  setPickup: (loc: SelectedLocation) => void;
  setDropoff: (loc: SelectedLocation) => void;
  driverDocs: DriverDocDraft;
  setDriverDocs: React.Dispatch<React.SetStateAction<DriverDocDraft>>;
  clearDriverDocs: () => void;
}

const DEFAULT_PICKUP: SelectedLocation = {
  name: 'Gulshan-e-Iqbal, Block 13',
  subtitle: 'Near Disco Bakery, University Road',
  lat: 24.9204,
  lng: 67.0942,
};

const DEFAULT_DROPOFF: SelectedLocation = {
  name: NED_UNIVERSITY_COORDS.name,
  subtitle: 'University Road, Karachi',
  lat: NED_UNIVERSITY_COORDS.latitude,
  lng: NED_UNIVERSITY_COORDS.longitude,
};

const RideFlowContext = createContext<RideFlowContextValue | undefined>(undefined);

export function RideFlowProvider({ children }: { children: React.ReactNode }) {
  const [pickup, setPickup] = useState<SelectedLocation>(DEFAULT_PICKUP);
  const [dropoff, setDropoff] = useState<SelectedLocation>(DEFAULT_DROPOFF);
  const [driverDocs, setDriverDocs] = useState<DriverDocDraft>({});

  const clearDriverDocs = () => setDriverDocs({});

  return (
    <RideFlowContext.Provider
      value={{
        pickup,
        dropoff,
        setPickup,
        setDropoff,
        driverDocs,
        setDriverDocs,
        clearDriverDocs,
      }}
    >
      {children}
    </RideFlowContext.Provider>
  );
}

export function useRideFlow(): RideFlowContextValue {
  const ctx = useContext(RideFlowContext);
  if (!ctx) {
    throw new Error('useRideFlow must be used inside RideFlowProvider');
  }
  return ctx;
}
