
# Homebridge Hive Home Control Plugin

This plugin exposes [Hive Home](https://www.hivehome.com/) features that are not natively available in Homekit; currently, this includes Hot Water and Heating Boost functions. A [Hive Hub](https://www.hivehome.com/shop/connectivity/hive-hub) and Hive account are required. Other devices such as thermostats are not handled by the plugin, since the Hive Hub already provides these as Homekit accessories.

## Installation

Install the plugin via the Homebridge UI. Before it can be used, the plugin configuration must be populated with your Hive `User Credentials` as well as the `Device Credentials` obtained via SMS two-factor authentication. To obtain the `Device Credentials`, do the following:

- From a terminal on your Homebridge machine, run `npx homebridge-hivehome-control`
- Follow the on-screen instructions. Enter your Hive `username` and `password`, then enter the 2FA code you receive via SMS.
- Once this is done, the script will show your `Device Group Key`, `Device Key` and `Device Password` credentials on screen.
- Copy these values exactly as they appear into the relevant fields of the plugin's configuration screen.

## Instructions

The plugin will expose a single `Heating Boost` switch for each Hive thermostat in your home. For each water heater, it will also create a `Hot Water` accessory containing two switches, `Manual` and `Boost`. The former will turn the hot water on until you turn it off, while the latter will boost it for a set period. Boost duration for both Heating and Hot Water, along with the target temperature for the former, can be set via the plugin's configuration.