// Import the pre-proxified version of pymport.
import {pymport} from 'pymport/proxified';

// Export the actual pyhiveapi library via pymport.
export const pyhiveapi = pymport('pyhiveapi');

// The name of the device registered with Hive for device login.
export const kHiveDeviceName = 'HomebridgeHiveHomeDevice';

// Minimum duration between device status refreshes from the server.
export const kScanIntervalSecs = 15;

// The field in the login response which determines the type of auth required.
export const kChallengeName = 'ChallengeName';

// The string returned from the server to indicate a device login is required.
export const DEVICE_LOGIN_REQUIRED = 'DEVICE_SRP_AUTH';

// Heating / Hot Water operation modes. Note that we have to send MANUAL to the
// server to turn hot water on, but when we query the state it will return ON.
export enum HeatingMode {
  kOn = 'ON',
  kOff = 'OFF',
  kManual = 'MANUAL',
  kSchedule = 'SCHEDULE'
}
