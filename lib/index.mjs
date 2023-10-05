import { python } from 'pythonia';

const pyhiveapi = await python('pyhiveapi');

console.log('Got pyhiveapi');

const DEVICE_REQUIRED = 'DEVICE_SRP_AUTH'; // not exposed as a seperate const as yet
const SMS_REQUIRED = await pyhiveapi.SMS_REQUIRED;

console.log('SMS_REQUIRED: ' + await pyhiveapi.SMS_REQUIRED);

const session = await pyhiveapi.Hive$({
  username: 'bernard.gorman@gmail.com',
  password: '!KWbG9&MSDwNI40c',
});
// This time tell the auth object about the device:
session.auth.device_group_key = '-7T1lVm39';
session.auth.device_key = 'eu-west-1_bb0f8082-a4d7-4758-949b-f4bccfdf88ce';
session.auth.device_password = '+urgPXQrT464k4u1BoYOPtN7bFrB86k1A0ZDe29Xqx/zAc9qTzauBA==';

const login = await session.login();

if ((await login.get('ChallengeName')) == DEVICE_REQUIRED) {
  await session.deviceLogin();
} else {
  console.log('Are you sure device is registered?');
}

if ((await login.get('ChallengeName')) == SMS_REQUIRED) {
  const code = input('Enter 2FA code: ');
  await session.sms2fa(code, login);
  await session.auth.device_registration('HomebridgeDevice');
}

// Device data is need for future device logins
const deviceData = await session.auth.get_device_data();
console.log(deviceData);

await session.startSession();

const WaterHeaters = await session.deviceList['water_heater'];

console.log(WaterHeaters);

for await (const WaterHeater of WaterHeaters) {
  console.log('WaterHeater Name : ' + await WaterHeater['hiveName']);
  console.log('Get operation modes : ' + await session.hotwater.getOperationModes());
  console.log('Current mode : ' + await session.hotwater.getMode(WaterHeater));
  console.log('Get state : ' + await session.hotwater.getState(WaterHeater));
  console.log('Get whether boost is currently On/Off: ' + await session.hotwater.getBoost(WaterHeater));
  console.log('Get boost time remaining : ' + await session.hotwater.getBoostTime(WaterHeater));
  console.log('Get schedule now/next/later : ' + await session.hotwater.getScheduleNowNextLater(WaterHeater));
  console.log('Set mode to OFF : ' + await session.hotwater.setMode(WaterHeater, 'OFF'));
  console.log('Turn boost on for 30 minutes : ' + await session.hotwater.setBoostOn(WaterHeater, 30));
  console.log('Turn boost off : ' + await session.hotwater.setBoostOff(WaterHeater));
}

python.exit();
