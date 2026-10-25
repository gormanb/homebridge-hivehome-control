/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable indent */
import {PlatformConfig} from 'homebridge';
import {join} from 'path';
import {python} from 'pythonia';

import {Log} from '../util/log';

// eslint-disable-next-line max-len
import {HeatingMode, HiveData, HiveTypeName, kScanIntervalSecs, PyHiveAuth, PyHiveType} from './hive-api';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: this is the recommended way to exit pythonia
process.on('exit', () => python.exit());

// Translate a mode to the format suitable for a request to the server.
export function translateModeForRequest(mode: HeatingMode) {
  return (mode === HeatingMode.kOn ? HeatingMode.kManual : mode);
}

// Start a new Hive session using pyhiveapi.
export async function startHiveSession(config: PlatformConfig) {
  // Add our local pylib directory to the python path and import pyhiveapi.
  const pylibDir = join(__dirname, '..', '..', 'pylib');
  await (await python('sys')).path.insert(0, pylibDir);
  const pyhiveapi = await python('pyhiveapi');

  // Start the Hive session with the specified username and password.
  const hiveSession = await pyhiveapi.Hive$({
    username: config.hiveUsername,
    password: config.hivePassword,
  });

  // Tell the auth object about the device if we have already registered it.
  hiveSession.auth[PyHiveAuth.kDevGroupKey] = config.deviceGroupKey;
  hiveSession.auth[PyHiveAuth.kDevKey] = config.deviceKey;
  hiveSession.auth[PyHiveAuth.kDevPassword] = config.devicePassword;

  // Perform the login. v1.0.10+ handles the DEVICE_SRP_AUTH challenge internally.
  const login = await hiveSession.login();

  // A successful login returns an AuthenticationResult; anything else is a failure.
  if (!await login.get('AuthenticationResult')) {
    Log.error('Could not log in. Are you sure the device is registered?');
    Log.debug('Login replied with:', login);
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

// Retrieve a list of all valid hot water and heating devices from Hive.
export async function getHiveDeviceList(hiveSession) {
  const deviceList: any[] = [];
  // The PyHiveType enum lists the device categories used by the python library.
  for (const deviceType of [PyHiveType.kHeating, PyHiveType.kHotWater]) {
    for await (const hiveDevice of await hiveSession.deviceList[deviceType]) {
      // HiveType specifies Hive native categories, a subset of PyHiveType.
      // Ensure the device is one of the categories supported by this plugin.
      if (HiveTypeName[await hiveDevice[HiveData.kType]]) {
        deviceList.push(hiveDevice);
      }
    }
  }
  return deviceList;
}
