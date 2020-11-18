export * from './server';
export * from './workspace';

export interface TransferInfo {
  from: string
  to: string
}

export enum Platform {
  Android = 'android',
  Ios = 'ios'
}

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
