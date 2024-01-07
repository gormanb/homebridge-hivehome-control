#!/usr/bin/env node

/* eslint-disable no-undef */
/* eslint-disable no-console */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {pymport, PyObject} from 'pymport/proxified';
import enquirer_default from 'enquirer';

const pyhiveapi = pymport('pyhiveapi');
const {prompt} = enquirer_default;

// The name of the device registered with Hive for device login.
const kHiveDeviceName = 'HomebridgeHiveHomeDevice';

// Ask the user for their Hive email and password.
const hiveCredentials = await prompt([
  {
    type: 'input',
    name: 'username',
    message: 'Enter Hive username (email):',
  },
  {
    type: 'password',
    name: 'password',
    message: 'Enter Hive password:',
  },
]);

// Use these credentials to create a Hive session.
const hiveSession = pyhiveapi.Hive(hiveCredentials);

async function do2faAuth() {
  // Perform the initial login with just username and password.
  const login = hiveSession.login();

  // Check whether the login requested a 2FA authentication.
  const challengeName = login.get('ChallengeName').toString();
  if (challengeName === pyhiveapi.SMS_REQUIRED.toString()) {
    const sms2fa = await prompt({
      type: 'input',
      name: 'code',
      message: '2FA required. Check your phone for an SMS code and enter it:',
    });
    try {
      hiveSession.sms2fa(sms2fa.code, login);
    } catch (ex) {
      console.log('2FA failed with error:', ex.message);
      return false;
    }
    hiveSession.auth.device_registration(kHiveDeviceName);
    hiveSession.deviceLogin();
  } else {
    console.log('Unexpected response from server: ', challengeName);
    return false;
  }
  return true;
}

// If the 2FA auth doesn't work, keep trying.
while (!(await do2faAuth())) {
  console.log('Retrying 2FA auth...');
}

// Print the device data for users to supply in the Homebridge config.
const [groupKey, devKey, devPwd] = hiveSession.auth.get_device_data();
console.log('Set the following in the plugin\'s configuration screen:', {
  'Device Group Key': groupKey.toString(),
  'Device Key': devKey.toString(),
  'Device Password': devPwd.toString(),
});
