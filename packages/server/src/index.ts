import { Platform } from '@liveview/shared-utils';

export * from './server';
export * from './workspace';

export enum DeviceType {
  Device,
  Simulator
}

export interface CommonDeviceData {
  identifier: string
  name: string
  platform: Platform
  version: string
}

export interface DeviceInfo extends CommonDeviceData {
  type: DeviceType
}
