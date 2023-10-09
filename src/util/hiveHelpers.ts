import {PlatformConfig} from 'homebridge';
import {python} from 'pythonia';

import {Log} from './log';

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
    username: 'bernard.gorman@gmail.com',
    password: '!KWbG9&MSDwNI40c',
  });

  // Tell the auth object about the device if we have already registered it.
  hiveSession.auth.device_group_key = '-7T1lVm39';
  hiveSession.auth.device_key =
      'eu-west-1_bb0f8082-a4d7-4758-949b-f4bccfdf88ce';
  hiveSession.auth.device_password =
      '+urgPXQrT464k4u1BoYOPtN7bFrB86k1A0ZDe29Xqx/zAc9qTzauBA==';

  // Perform the login.
  const login = await hiveSession.login();

  // On the first attempt, we will be challenged to input an SMS code.
  if ((await login.get('ChallengeName')) === await pyhiveapi.SMS_REQUIRED) {
    Log.info('Enter 2FA code: ');
    await hiveSession.sms2fa('code', login);
    await hiveSession.auth.device_registration('HomebridgeDevice');

    // Device data is needed for future device logins
    const deviceData = await hiveSession.auth.get_device_data();
    Log.debug('[Group Key, Key, Password]: ', deviceData);
  }

  // If the device is already registered, log in using its information.
  const DEVICE_REQUIRED = 'DEVICE_SRP_AUTH';
  if ((await login.get('ChallengeName')) === DEVICE_REQUIRED) {
    await hiveSession.deviceLogin();
  } else {
    Log.error('Could not log in. Are you sure device is registered?');
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
