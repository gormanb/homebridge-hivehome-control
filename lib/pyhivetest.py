from pyhiveapi import Hive, SMS_REQUIRED

DEVICE_REQUIRED = "DEVICE_SRP_AUTH" # not exposed as a seperate const as yet

session = Hive(
    username="bernard.gorman@gmail.com",
    password="!KWbG9&MSDwNI40c",
)
# This time tell the auth object about the device:
session.auth.device_group_key = "-7T1lVm39"
session.auth.device_key = "eu-west-1_bb0f8082-a4d7-4758-949b-f4bccfdf88ce"
session.auth.device_password = "+urgPXQrT464k4u1BoYOPtN7bFrB86k1A0ZDe29Xqx/zAc9qTzauBA=="

login = session.login()

if login.get("ChallengeName") == DEVICE_REQUIRED:
    session.deviceLogin() #Note - this will fail if you do not adapt session.py first - see below!
else:
    print("Are you sure device is registered?")

if login.get("ChallengeName") == SMS_REQUIRED:
    code = input("Enter 2FA code: ")
    session.sms2fa(code, login)

# Device data is need for future device logins
deviceData = session.auth.get_device_data()
print(deviceData)

session.startSession()

WaterHeaters = session.deviceList["water_heater"]

if len(WaterHeaters) >= 1:
    WaterHeater_1 = WaterHeaters[0]
    print("WaterHeater 1 : " + str(WaterHeater_1["hiveName"]))
    print("Get operation modes : " + str(session.hotwater.getOperationModes()))
    print("Current mode : " + str(session.hotwater.getMode(WaterHeater_1)))
    print("Get state : " + str(session.hotwater.getState(WaterHeater_1)))
    print("Get whether boost is currently On/Off: " + str(session.hotwater.getBoost(WaterHeater_1)))
    print("Get boost time remaining : " + str(session.hotwater.getBoostTime(WaterHeater_1)))
    print("Get schedule now/next/later : " + str(session.hotwater.getScheduleNowNextLater(WaterHeater_1)))
    print("Set mode to ON : " + str(session.hotwater.setMode(WaterHeater_1, "MANUAL")))
    print("Current mode : " + str(session.hotwater.getMode(WaterHeater_1)))
    print("Set mode to SCHEDULE : " + str(session.hotwater.setMode(WaterHeater_1, "SCHEDULE")))
    print("Set mode to OFF : " + str(session.hotwater.setMode(WaterHeater_1, "OFF")))
    print("Turn boost on for 30 minutes : " + str(session.hotwater.setBoostOn(WaterHeater_1, 30)))
    print("Get whether boost is currently On/Off: " + str(session.hotwater.getBoost(WaterHeater_1)))
    print("Turn boost off : " + str(session.hotwater.setBoostOff(WaterHeater_1)))
