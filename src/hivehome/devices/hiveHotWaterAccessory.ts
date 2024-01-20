/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable indent */
import {PlatformAccessory, Service} from 'homebridge';

import {HiveHomeControllerPlatform} from '../../platform';
import {Log} from '../../util/log';
import {HeatingMode} from '../hive-api';
import {translateModeForRequest} from '../hive-helpers';

import {HiveAccessory} from './hiveAccessory';

/**
 * An instance of this class is created for each Hot Water accessory. Exposes
 * both the Manual and Boost services for the Hot Water device.
 */
export class HiveHotWaterAccessory extends HiveAccessory {
  private readonly kManualName = 'Manual';
  private readonly kBoostName = 'Boost';

  private manualService: Service;
  private boostService: Service;

  constructor(
      protected readonly platform: HiveHomeControllerPlatform,
      protected readonly accessory: PlatformAccessory,
      protected readonly hiveSession: any,
  ) {
    // Initialize the base class first, then initialize the services.
    super(platform, accessory, hiveSession);

    // Convenience references to Characteristic and Service.
    const Characteristic = this.platform.Characteristic;
    const Service = this.platform.Service;

    //
    // Create one switch for each service offered by this hot water device.
    //
    if (!this.accessory.getService(this.kManualName)) {
      const manualConName = `${this.accessory.displayName} ${this.kManualName}`;
      this.accessory
          .addService(Service.Switch, this.kManualName, this.kManualName)
          .setCharacteristic(Characteristic.ConfiguredName, manualConName);
    }
    this.manualService = <Service>this.accessory.getService(this.kManualName);

    if (!this.accessory.getService(this.kBoostName)) {
      const boostConName = `${this.accessory.displayName} ${this.kBoostName}`;
      this.accessory
          .addService(Service.Switch, this.kBoostName, this.kBoostName)
          .setCharacteristic(Characteristic.ConfiguredName, boostConName);
    }
    this.boostService = <Service>this.accessory.getService(this.kBoostName);

    //
    // Register handlers for all dynamic characteristics.
    //
    this.manualService.getCharacteristic(Characteristic.On)
        .onGet(() => this.currentState[this.kManualName] === HeatingMode.kOn)
        .onSet(
            (active) => this.setDeviceState(
                this.kManualName, active ? HeatingMode.kOn : HeatingMode.kOff));

    this.boostService.getCharacteristic(Characteristic.On)
        .onGet(() => this.currentState[this.kBoostName] === HeatingMode.kOn)
        .onSet(
            (active) => this.setDeviceState(
                this.kBoostName, active ? HeatingMode.kOn : HeatingMode.kOff));
  }

  // Return true if both services have been initialized.
  protected servicesReady(): boolean {
    return !!(this.boostService && this.manualService);
  }

  // Get the device power state and push to Homekit when it changes.
  protected updateDeviceAndCurrentState() {
    // Retrieve the newly-updated device data...
    this.hiveDevice = this.hiveSession.hotwater.getWaterHeater(this.hiveDevice);

    // ... and use it to populate the current state.
    this.currentState[this.kBoostName] =
        this.hiveSession.hotwater.getBoost(this.hiveDevice).toString();
    this.currentState[this.kManualName] =
        this.hiveSession.hotwater.getMode(this.hiveDevice).toString();
  }

  // Push the current state to Homekit.
  protected async updateHomekitState() {
    this.boostService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState[this.kBoostName] === HeatingMode.kOn);
    this.manualService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState[this.kManualName] === HeatingMode.kOn);
  }

  // Apply the state requested by Homekit.
  private async setDeviceState(serviceName: string, newState: HeatingMode) {
    switch (serviceName) {
      case this.kBoostName:
        if (newState === HeatingMode.kOn) {
          this.hiveSession.hotwater.setBoostOn(
              this.hiveDevice, this.config.hotWaterBoostMins);
          Log.info(`Enabled ${this.accessory.displayName} Boost for ${
              this.config.hotWaterBoostMins} minutes`);
        } else {
          this.hiveSession.hotwater.setBoostOff(this.hiveDevice);
          Log.info(`Turned off ${this.accessory.displayName} Boost`);
        }
        break;
      case this.kManualName:
        this.hiveSession.hotwater.setMode(
            this.hiveDevice, translateModeForRequest(newState));
        Log.info(`Set ${this.accessory.displayName} mode:`, newState);
    }
    this.currentState[serviceName] = newState;
  }
}
