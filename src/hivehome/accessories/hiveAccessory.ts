/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable indent */
import {PlatformAccessory, PlatformConfig, Service} from 'homebridge';
import {PyObject} from 'pymport/proxified';

import {HiveHomeControllerPlatform} from '../../platform';
import {Log} from '../../util/log';
import {updateHiveData} from '../hive-helpers';

/**
 * Base class to implement functionality common to all Hive accessories.
 */
export class HiveAccessory {
  protected static readonly kRefreshInterval = 5000;

  protected readonly config: PlatformConfig;

  protected currentState = {};
  protected hiveDevice: any;

  constructor(
      protected readonly platform: HiveHomeControllerPlatform,
      protected readonly accessory: PlatformAccessory,
      protected readonly hiveSession: any,
  ) {
    // We must explicitly convert the POJSO into a PyObject dict.
    this.hiveDevice = PyObject.dict(accessory.context.device);

    // Store a reference to the plugin configuration for later use.
    this.config = platform.config;

    // Begin monitoring the device for state changes.
    this.updateDeviceState();
    setInterval(() => this.updateDeviceState(), HiveAccessory.kRefreshInterval);
  }

  // Adds a new service to the device, and returns it.
  protected addService(type, name, subType, configuredName): Service {
    // Convenience references to Characteristic and Service.
    const Characteristic = this.platform.Characteristic;

    // Add the new service, then add ConfiguredName as a new Characteristic.
    const newService = this.accessory.addService(type, name, subType);
    newService.addOptionalCharacteristic(Characteristic.ConfiguredName);
    newService.setCharacteristic(Characteristic.ConfiguredName, configuredName);

    return newService;
  }

  // Get the device power state and push to Homekit when it changes.
  private async updateDeviceState() {
    // Update the hive device from the server. If we fail, return immediately.
    if (!updateHiveData(this.hiveSession, this.hiveDevice)) {
      return;
    }

    // Check whether the derived class' services have been initialized.
    if (!this.servicesReady()) {
      Log.debug('Services not yet initialized:', this.accessory.displayName);
      return;
    }

    // Retrieve the newly-updated device data.
    const lastState = Object.assign({}, this.currentState);
    this.updateDeviceAndCurrentState();

    // Check whether any attributes have changed.
    if (JSON.stringify(lastState) !== JSON.stringify(this.currentState)) {
      Log.debug(`Updating ${this.accessory.displayName}:`, this.currentState);
      this.updateHomekitState();
    }
  }

  // Implemented by subclasses. Confirms that all accessory services are ready.
  protected servicesReady(): boolean {
    return false;
  }

  // Implemented by subclasses. Updates this.hiveDevice and this.currentState
  // based on the recently-updated Hive data.
  protected updateDeviceAndCurrentState() {
    // TBI
  }

  // Implemented by subclasses. Updates Homekit with the current state.
  protected async updateHomekitState() {
    // TBI
  }
}
