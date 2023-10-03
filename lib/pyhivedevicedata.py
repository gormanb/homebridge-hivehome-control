from pyhiveapi import Hive, SMS_REQUIRED

session = Hive(username="bernard.gorman@gmail.com", password="!KWbG9&MSDwNI40c")
login = session.login()

if login.get("ChallengeName") == SMS_REQUIRED:
    code = input("Enter 2FA code: ")
    session.sms2fa(code, login)

# Device data is need for future device logins
session.auth.device_registration("HomebridgeDevice")
deviceData = session.auth.get_device_data()
print("[Group Key, Key, Password]:")
print(deviceData)

