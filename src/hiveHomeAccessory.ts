/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable indent */
import {PlatformAccessory, PlatformConfig, Service} from 'homebridge';
import {PyObject} from 'pymport/proxified';

import {HotWaterMode} from './hivehome/hive-api';
import {translateModeForRequest, updateHiveData} from './hivehome/hive-helpers';
import {HiveHomeControllerPlatform} from './platform';
import {Log} from './util/log';

/**
 * An instance of this class is created for each accessory. Exposes both the
 * WindowCovering and Battery services for the device.
 */
export class HiveHomeAccessory {
  private static readonly kRefreshInterval = 5000;

  private readonly config: PlatformConfig;

  private readonly kManualName = 'Manual';
  private readonly kBoostName = 'Boost';

  private manualService: Service;
  private boostService: Service;

  private hiveDevice: any;

  private currentState = {
    [this.kManualName]: HotWaterMode.kOff,
    [this.kBoostName]: HotWaterMode.kOff,
  };

  constructor(
      private readonly platform: HiveHomeControllerPlatform,
      private readonly accessory: PlatformAccessory,
      private readonly hiveSession: any,
  ) {
    // Convenience references to Characteristic and Service.
    const Characteristic = this.platform.Characteristic;
    const Service = this.platform.Service;

    // We must explicitly convert the POJSO into a PyObject dict.
    this.hiveDevice = PyObject.dict(accessory.context.device);

    // Store a reference to the plugin configuration for later use.
    this.config = platform.config;

    //
    // Create one switch for each service offered by this hot water device.
    //
    if (!this.accessory.getService(this.kManualName)) {
      this.accessory
          .addService(Service.Switch, this.kManualName, this.kManualName)
          .addOptionalCharacteristic(Characteristic.ConfiguredName);
    }
    this.manualService =
        (<Service>this.accessory.getService(this.kManualName))
            .setCharacteristic(Characteristic.ConfiguredName, this.kManualName);

    if (!this.accessory.getService(this.kBoostName)) {
      this.accessory
          .addService(Service.Switch, this.kBoostName, this.kBoostName)
          .addOptionalCharacteristic(Characteristic.ConfiguredName);
    }
    this.boostService =
        (<Service>this.accessory.getService(this.kBoostName))
            .setCharacteristic(Characteristic.ConfiguredName, this.kBoostName);

    //
    // Register handlers for all dynamic characteristics.
    //
    this.manualService.getCharacteristic(Characteristic.On)
        .onGet(() => this.currentState[this.kManualName] === HotWaterMode.kOn)
        .onSet(
            (active) => this.setDeviceState(
                this.kManualName,
                active ? HotWaterMode.kOn : HotWaterMode.kOff));

    this.boostService.getCharacteristic(Characteristic.On)
        .onGet(() => this.currentState[this.kBoostName] === HotWaterMode.kOn)
        .onSet(
            (active) => this.setDeviceState(
                this.kBoostName,
                active ? HotWaterMode.kOn : HotWaterMode.kOff));

    //
    // Begin monitoring the device for state changes.
    //
    this.updateDeviceState();
    setInterval(
        () => this.updateDeviceState(), HiveHomeAccessory.kRefreshInterval);
  }

  // Get the device power state and push to Homekit when it changes.
  private async updateDeviceState() {
    // Update the hive device from the server. If we fail, return immediately.
    if (!updateHiveData(this.hiveSession, this.hiveDevice)) {
      return;
    }

    // Retrieve the newly-updated device data.
    this.hiveDevice = this.hiveSession.hotwater.getWaterHeater(this.hiveDevice);

    // Check whether any attributes have changed.
    const lastState = Object.assign({}, this.currentState);
    this.currentState[this.kBoostName] =
        this.hiveSession.hotwater.getBoost(this.hiveDevice).toString();
    this.currentState[this.kManualName] =
        this.hiveSession.hotwater.getMode(this.hiveDevice).toString();
    if (JSON.stringify(lastState) !== JSON.stringify(this.currentState)) {
      Log.debug('Updating state:', this.currentState);
      this.updateHomekitState();
    }
  }

  private async setDeviceState(serviceName: string, newState: HotWaterMode) {
    switch (serviceName) {
      case this.kBoostName:
        if (newState === HotWaterMode.kOn) {
          this.hiveSession.hotwater.setBoostOn(
              this.hiveDevice, this.config.hotWaterBoostMins);
          Log.info(`Enabled Hot Water Boost for ${
              this.config.hotWaterBoostMins} minutes`);
        } else {
          this.hiveSession.hotwater.setBoostOff(this.hiveDevice);
          Log.info('Turned off Hot Water Boost');
        }
        break;
      case this.kManualName:
        this.hiveSession.hotwater.setMode(
            this.hiveDevice, translateModeForRequest(newState));
        Log.info('Set Hot Water mode to:', newState);
    }
    this.currentState[serviceName] = newState;
    this.updateHomekitState();
  }

  private async updateHomekitState() {
    this.boostService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState[this.kBoostName] === HotWaterMode.kOn);
    this.manualService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState[this.kManualName] === HotWaterMode.kOn);
  }
}
