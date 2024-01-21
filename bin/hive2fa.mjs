#!/usr/bin/env node

/* eslint-disable no-undef */
/* eslint-disable no-console */

import enquirer_default from 'enquirer';
import {python} from 'pythonia';

// Gracefully shut down python before exiting.
process.on('exit', () => {
  try {
    python.exit();
  } catch (ex) {
    // Ignore exception if already exited.
  }
});

// Obtain references to the libraries we need.
const pyhiveapi = await python('pyhiveapi');
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
const hiveSession = await pyhiveapi.Hive$(hiveCredentials);

// Function to attempt 2FA authentication.
async function do2faAuth() {
  // Perform the initial login with just username and password.
  const login = await hiveSession.login();

  // Check whether the login requested a 2FA authentication.
  const challengeName = await login.get('ChallengeName');
  if (challengeName !== await pyhiveapi.SMS_REQUIRED) {
    console.log(`Server requested '${challengeName}' not 2FA, exiting`);
    process.exit();
  }
  // Prompt the user to enter the 2FA code.
  const sms2fa = await prompt({
    type: 'input',
    name: 'code',
    message: '2FA required. Check your phone for an SMS code and enter it:',
  });
  // Try to log in using the supplied code.
  try {
    await hiveSession.sms2fa(sms2fa.code, login);
  } catch (ex) {
    console.log('2FA failed with error:', ex.message);
    return false;
  }
  // Register the deice and use the device details to log in.
  await hiveSession.auth.device_registration(kHiveDeviceName);
  await hiveSession.deviceLogin();
  return true;
}

// If the 2FA auth doesn't work, keep trying.
while (!(await do2faAuth())) {
  console.log('Retrying auth...');
}

// Print the device data for users to supply in the Homebridge config.
const [groupKey, devKey, devPwd] = await hiveSession.auth.get_device_data();
console.log('Set the following in the plugin\'s configuration screen:', {
  'Device Group Key': await groupKey,
  'Device Key': await devKey,
  'Device Password': await devPwd,
});

// Exit python to allow node to exit.
python.exit();