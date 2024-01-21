// The name of the device registered with Hive for device login.
export const kHiveDeviceName = 'HomebridgeHiveHomeDevice';

// Minimum duration between device status refreshes from the server.
export const kScanIntervalSecs = 15;

// The field in the login response which determines the type of auth required.
export const kChallengeName = 'ChallengeName';

// The string returned from the server to indicate a device login is required.
export const DEVICE_LOGIN_REQUIRED = 'DEVICE_SRP_AUTH';

// Important fields in the Hive device data response.
export enum HiveData {
  kId = 'hiveID',
  kType = 'hiveType',
  kName = 'hiveName'
}

// Enum of native Hive device type strings.
export enum HiveType {
  kHeating = 'heating',
  kHotWater = 'hotwater'
}

// Map of hiveType to device display names.
export const HiveTypeName = {
  [HiveType.kHeating]: 'Heating',
  [HiveType.kHotWater]: 'Hot Water',
};

// Enum of Hive device types used in PyHiveApi.
export enum PyHiveType {
  kHeating = 'climate',
  kHotWater = 'water_heater'
}

// Important auth fields in the PyHiveApi session object.
export enum PyHiveAuth {
  kDevKey = 'device_key',
  kDevGroupKey = 'device_group_key',
  kDevPassword = 'device_password'
}

// Heating / Hot Water operation modes. Note that we have to send MANUAL to the
// server to turn hot water on, but when we query the state it will return ON.
export enum HeatingMode {
  kOn = 'ON',
  kOff = 'OFF',
  kManual = 'MANUAL',
  kSchedule = 'SCHEDULE'
}
