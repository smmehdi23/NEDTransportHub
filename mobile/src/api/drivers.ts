import { apiClient } from './client';
import type { DriverVerificationStatus, VehicleRead } from './types';

export interface UploadFileAsset {
  uri: string;
  name: string;
  type: string;
}

export const driversApi = {
  async submitVehicle(params: {
    plate_number: string;
    model: string;
    seat_capacity: number;
    licence_document: UploadFileAsset;
    registration_document: UploadFileAsset;
    university_id_document: UploadFileAsset;
  }): Promise<VehicleRead> {
    const form = new FormData();
    form.append('plate_number', params.plate_number);
    form.append('model', params.model);
    form.append('seat_capacity', String(params.seat_capacity));
    form.append('licence_document', params.licence_document as unknown as Blob);
    form.append('registration_document', params.registration_document as unknown as Blob);
    form.append('university_id_document', params.university_id_document as unknown as Blob);

    const { data } = await apiClient.post<VehicleRead>('/drivers/vehicles', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async resubmitVehicle(
    vehicleId: number,
    params: {
      plate_number?: string;
      model?: string;
      seat_capacity?: number;
      licence_document?: UploadFileAsset;
      registration_document?: UploadFileAsset;
      university_id_document?: UploadFileAsset;
    },
  ): Promise<VehicleRead> {
    const form = new FormData();
    if (params.plate_number) form.append('plate_number', params.plate_number);
    if (params.model) form.append('model', params.model);
    if (params.seat_capacity !== undefined) form.append('seat_capacity', String(params.seat_capacity));
    if (params.licence_document) {
      form.append('licence_document', params.licence_document as unknown as Blob);
    }
    if (params.registration_document) {
      form.append('registration_document', params.registration_document as unknown as Blob);
    }
    if (params.university_id_document) {
      form.append('university_id_document', params.university_id_document as unknown as Blob);
    }

    const { data } = await apiClient.put<VehicleRead>(`/drivers/vehicles/${vehicleId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async getMyVehicles(): Promise<VehicleRead[]> {
    const { data } = await apiClient.get<VehicleRead[]>('/drivers/vehicles');
    return data;
  },

  async getMyVehicle(vehicleId: number): Promise<VehicleRead> {
    const { data } = await apiClient.get<VehicleRead>(`/drivers/vehicles/${vehicleId}`);
    return data;
  },

  async getVerificationStatus(): Promise<DriverVerificationStatus> {
    const { data } = await apiClient.get<DriverVerificationStatus>('/drivers/verification-status');
    return data;
  },
};
