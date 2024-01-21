/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable indent */
import {PlatformConfig} from 'homebridge';
import {python} from 'pythonia';

import {Log} from '../util/log';

import {DEVICE_LOGIN_REQUIRED, HeatingMode, kChallengeName, kScanIntervalSecs, PyHiveAuth, PyHiveType} from './hive-api';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: this is the recommended way to exit pythonia
process.on('exit', () => python.exit());

// Translate a mode to the format suitable for a request to the server.
export function translateModeForRequest(mode: HeatingMode) {
  return (mode === HeatingMode.kOn ? HeatingMode.kManual : mode);
}

// Start a new Hive session using pyhiveapi.
export async function startHiveSession(config: PlatformConfig) {
  const pyhiveapi = await python('pyhiveapi');
  const hiveSession = await pyhiveapi.Hive$({
    username: config.hiveUsername,
    password: config.hivePassword,
  });

  // Tell the auth object about the device if we have already registered it.
  hiveSession.auth[PyHiveAuth.kDevGroupKey] = config.deviceGroupKey;
  hiveSession.auth[PyHiveAuth.kDevKey] = config.deviceKey;
  hiveSession.auth[PyHiveAuth.kDevPassword] = config.devicePassword;

  // Perform the login.
  const login = await hiveSession.login();

  // If the device is already registered, log in using its information.
  const challengeName = await login.get(kChallengeName);
  if (challengeName === DEVICE_LOGIN_REQUIRED) {
    await hiveSession.deviceLogin();
  } else {
    Log.error('Could not log in. Are you sure the device is registered?');
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
  const deviceList: any[] = [];
  for (const deviceType of [PyHiveType.kHeating, PyHiveType.kHotWater]) {
    for await (const hiveDevice of await hiveSession.deviceList[deviceType]) {
      deviceList.push(hiveDevice);
    }
  }
  return deviceList;
}
