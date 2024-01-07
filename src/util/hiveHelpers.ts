import {PlatformConfig} from 'homebridge';
import {python} from 'pythonia';

import {Log} from './log';

// The name of the device registered with Hive for device login.
export const kHiveDeviceName = 'HomebridgeHiveHomeDevice';

// Minimum duration between device status refreshes from the server.
const kScanIntervalSecs = 15;

// Hot Water operation modes. Note that we have to send MANUAL to the server to
// turn hot water on, but when we query the state it will return ON.
export enum HotWaterMode {
  kOn = 'ON',
  kOff = 'OFF',
  kManual = 'MANUAL',
  kSchedule = 'SCHEDULE'
}

// Return the singleton pyhiveapi object, or create it if it doesn't yet exist.
let pyhiveapi;
async function getPyHiveApi() {
  return (pyhiveapi || (pyhiveapi = await python('pyhiveapi')));
}

// Translate a mode to the format suitable for a request to the server.
export function translateModeForRequest(mode: HotWaterMode) {
  return (mode === HotWaterMode.kOn ? HotWaterMode.kManual : mode);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function startHiveSession(config: PlatformConfig) {
  const pyhiveapi = await getPyHiveApi();
  const hiveSession = await pyhiveapi.Hive$({
    username: config.hiveUsername,
    password: config.hivePassword,
  });

  // Tell the auth object about the device if we have already registered it.
  hiveSession.auth.device_group_key = config.deviceGroupKey;
  hiveSession.auth.device_key = config.deviceKey;
  hiveSession.auth.device_password = config.devicePassword;

  // Perform the login.
  const login = await hiveSession.login();

  // If the device is already registered, log in using its information.
  const challengeName = await login.get('ChallengeName');
  const DEVICE_REQUIRED = 'DEVICE_SRP_AUTH';
  if (challengeName === DEVICE_REQUIRED) {
    await hiveSession.deviceLogin();
  } else {
    Log.error('Could not log in. Are you sure device is registered?');
    Log.debug('Login replied with:', challengeName);
    return null;
  }

  // Set the minimum interval between refreshes from the server.
  await hiveSession.updateInterval(kScanIntervalSecs);

  // Return the logged-in session object.
  await hiveSession.startSession();
  return hiveSession;
}

// Update Hive data and catch any exceptions that occur.
export async function updateHiveData(hiveSession, hiveDevice) {
  try {
    return await hiveSession.updateData(hiveDevice);
  } catch (ex) {
    Log.debug('Error updating Hive data:', ex);
  }
  return false;
}

// Retrieve a list of all hot water devices from the Hive session.
export async function getHiveDeviceList(hiveSession) {
  const waterHeaters = await hiveSession.deviceList['water_heater'];
  return waterHeaters;
}
