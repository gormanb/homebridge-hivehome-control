/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable indent */
import {PlatformAccessory, Service} from 'homebridge';

import {HiveHomeControllerPlatform} from '../../platform';
import {Log} from '../../util/log';
import {HeatingMode} from '../hive-api';

import {HiveAccessory} from './hiveAccessory';

/**
 * An instance of this class is created for each Heating accessory. Exposes the
 * Boost service for the Heating device.
 */
export class HiveHeatingAccessory extends HiveAccessory {
  private readonly kBoostName = 'Boost';
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
    // Create a switch for the Boost service offered by this heating device.
    //
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
    this.boostService.getCharacteristic(Characteristic.On)
        .onGet(() => this.currentState[this.kBoostName] === HeatingMode.kOn)
        .onSet(
            (active) => this.setDeviceState(
                this.kBoostName, active ? HeatingMode.kOn : HeatingMode.kOff));
  }

  // Return true if services have been initialized.
  protected servicesReady(): boolean {
    return !!this.boostService;
  }

  // Get the device power state and push to Homekit when it changes.
  protected updateDeviceAndCurrentState() {
    // Retrieve the newly-updated device data...
    this.hiveDevice = this.hiveSession.heating.getClimate(this.hiveDevice);

    // ... and use it to populate the current state.
    this.currentState[this.kBoostName] =
        this.hiveSession.heating.getBoostStatus(this.hiveDevice).toString();
  }

  // Push the current state to Homekit.
  protected async updateHomekitState() {
    this.boostService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState[this.kBoostName] === HeatingMode.kOn);
  }

  private async setDeviceState(serviceName: string, newState: HeatingMode) {
    if (newState === HeatingMode.kOn) {
      this.hiveSession.heating.setBoostOn(
          this.hiveDevice, this.config.heatingBoostMins,
          this.config.heatingBoostTemp);
      Log.info(`Enabled ${this.accessory.displayName} Boost to ${
          this.config.heatingBoostTemp} degrees for ${
          this.config.heatingBoostMins} minutes`);
    } else {
      this.hiveSession.heating.setBoostOff(this.hiveDevice);
      Log.info(`Turned off ${this.accessory.displayName} Boost`);
    }
    this.currentState[serviceName] = newState;
  }
}
