/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable indent */
import {PlatformAccessory, Service} from 'homebridge';

import {HiveHomeControllerPlatform} from './platform';
import {HotWaterMode, translateModeForRequest} from './util/hiveHelpers';
import {Log} from './util/log';

/**
 * An instance of this class is created for each accessory. Exposes both the
 * WindowCovering and Battery services for the device.
 */
export class HiveHomeAccessory {
  private static readonly kRefreshInterval = 5000;

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

    this.hiveDevice = accessory.context.device;

    //
    // Create one switch for each service offered by this hot water device.
    //
    if (!this.accessory.getService(this.kManualName)) {
      this.accessory
          .addService(Service.Switch, this.kManualName, this.kManualName)
          .setCharacteristic(Characteristic.Name, this.kManualName);
    }
    this.manualService = <Service>this.accessory.getService(this.kManualName);

    if (!this.accessory.getService(this.kBoostName)) {
      this.accessory
          .addService(Service.Switch, this.kBoostName, this.kBoostName)
          .setCharacteristic(Characteristic.Name, this.kBoostName);
    }
    this.boostService = <Service>this.accessory.getService(this.kBoostName);

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
  async updateDeviceState() {
    // Update the hive device from the server.
    if (await this.hiveSession.updateData(this.hiveDevice)) {
      this.hiveDevice =
          await this.hiveSession.hotwater.getWaterHeater(this.hiveDevice);
    }

    // Check whether any attributes have changed.
    const lastState = Object.assign({}, this.currentState);
    let result;
    if ((result = await this.hiveSession.hotwater.getBoost(this.hiveDevice))) {
      this.currentState[this.kBoostName] = result;
    }
    if ((result = await this.hiveSession.hotwater.getMode(this.hiveDevice))) {
      this.currentState[this.kManualName] = result;
    }
    if (JSON.stringify(lastState) !== JSON.stringify(this.currentState)) {
      Log.debug('Updating state:', this.currentState);
      this.updateHomekitState();
    }
  }

  async setDeviceState(serviceName: string, newState: HotWaterMode) {
    switch (serviceName) {
      case this.kBoostName:
        if (newState === HotWaterMode.kOn) {
          await this.hiveSession.hotwater.setBoostOn(this.hiveDevice, 60);
          Log.info('Enabled Hot Water Boost for 60 minutes');
        } else {
          await this.hiveSession.hotwater.setBoostOff(this.hiveDevice);
          Log.info('Turned off Hot Water Boost');
        }
        break;
      case this.kManualName:
        await this.hiveSession.hotwater.setMode(
            this.hiveDevice, translateModeForRequest(newState));
        Log.info('Set Hot Water mode to:', newState);
    }
    this.currentState[serviceName] = newState;
    this.updateHomekitState();
  }

  async updateHomekitState() {
    this.boostService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState[this.kBoostName] === HotWaterMode.kOn);
    this.manualService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState[this.kManualName] === HotWaterMode.kOn);
  }
}
