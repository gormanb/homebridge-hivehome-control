import {PlatformConfig} from 'homebridge';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {pymport, PyObject} from 'pymport/proxified';

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

// Import the pyhiveapi Python library via pymport.
const pyhiveapi = pymport('pyhiveapi');

// Translate a mode to the format suitable for a request to the server.
export function translateModeForRequest(mode: HotWaterMode) {
  return (mode === HotWaterMode.kOn ? HotWaterMode.kManual : mode);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function startHiveSession(config: PlatformConfig) {
  const hiveSession = pyhiveapi.Hive({
    username: config.hiveUsername,
    password: config.hivePassword,
  });

  // Tell the auth object about the device if we have already registered it.
  hiveSession.auth.__setattr__('device_group_key', config.deviceGroupKey);
  hiveSession.auth.__setattr__('device_key', config.deviceKey);
  hiveSession.auth.__setattr__('device_password', config.devicePassword);

  // Perform the login.
  const login = hiveSession.login();

  // If the device is already registered, log in using its information.
  const challengeName = login.get('ChallengeName').toString();
  const DEVICE_REQUIRED = 'DEVICE_SRP_AUTH';
  if (challengeName === DEVICE_REQUIRED) {
    hiveSession.deviceLogin();
  } else {
    Log.error('Could not log in. Are you sure device is registered?');
    Log.debug('Login replied with:', challengeName);
    return null;
  }

  // Set the minimum interval between refreshes from the server.
  hiveSession.updateInterval(kScanIntervalSecs);

  // Return the logged-in session object.
  hiveSession.startSession();
  return hiveSession;
}

// Update Hive data and catch any exceptions that occur.
export function updateHiveData(hiveSession, hiveDevice) {
  try {
    return hiveSession.updateData(hiveDevice);
  } catch (ex) {
    // Do nothing here. We expect periodic failures at the moment due to a race
    // condition caused by the unasync packaging of pyhiveapi.
    // Log.debug('Error updating Hive data:', ex);
  }
  return false;
}

// Retrieve a list of all hot water devices from the Hive session.
export function getHiveDeviceList(hiveSession) {
  const waterHeaters = hiveSession.deviceList.__getitem__('water_heater');
  return waterHeaters.toJS();
}
