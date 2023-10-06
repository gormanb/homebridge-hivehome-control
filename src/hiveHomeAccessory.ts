/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable indent */
import {PlatformAccessory, Service} from 'homebridge';

import {HiveHomeControllerPlatform} from './platform';
import {HotWaterMode} from './util/hiveHelpers';
import {Log} from './util/log';

/**
 * An instance of this class is created for each accessory. Exposes both the
 * WindowCovering and Battery services for the device.
 */
export class HiveHomeAccessory {
  private static readonly kRefreshInterval = 5000;

  private readonly kModeName = 'Mode';
  private readonly kBoostName = 'Boost';
  private readonly kStateName = 'State';

  private modeService: Service;
  private boostService: Service;
  private modeTypes: Service[];

  private hiveDevice: any;

  private readonly kHwModes = [
    HotWaterMode.kManualOn,
    HotWaterMode.kSchedule,
    HotWaterMode.kManualOff,
  ];

  private currentState = {
    [this.kModeName]: 2,
    [this.kBoostName]: false,
    [this.kStateName]: false,
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
    if (!this.accessory.getService(this.kBoostName)) {
      this.accessory.addService(
          Service.Switch, this.kBoostName, this.kBoostName);
    }
    this.boostService = <Service>this.accessory.getService(this.kBoostName);

    if (!this.accessory.getService(this.kModeName)) {
      this.accessory
          .addService(Service.Television, this.kModeName, this.kModeName)
          .setCharacteristic(Characteristic.ConfiguredName, this.kModeName)
          .setCharacteristic(
              Characteristic.SleepDiscoveryMode,
              Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
    }
    this.modeService = <Service>this.accessory.getService(this.kModeName);

    // Extract the current list of InputSources from the accessory.
    this.modeTypes = this.accessory.services.filter(
        elem => elem instanceof this.platform.Service.InputSource);

    for (let id = 0; id < this.kHwModes.length; ++id) {
      // Check whether this source already exists, and create it if necessary.
      let modeType =
          this.modeTypes.find(elem => elem.subtype === this.kHwModes[id]);
      if (!modeType) {
        Log.info('Creating new mode:', this.kHwModes[id]);
        modeType = this.accessory.addService(
            this.platform.Service.InputSource, this.kHwModes[id],
            this.kHwModes[id]);
        this.modeService.addLinkedService(modeType);
      }
      // Set the characteristics of the input source to match the app list.
      modeType.setCharacteristic(this.platform.Characteristic.Identifier, id)
          .setCharacteristic(
              this.platform.Characteristic.ConfiguredName, this.kHwModes[id])
          .setCharacteristic(
              this.platform.Characteristic.IsConfigured,
              this.platform.Characteristic.IsConfigured.CONFIGURED)
          .setCharacteristic(
              this.platform.Characteristic.InputSourceType,
              this.platform.Characteristic.InputSourceType.OTHER);
    }

    //
    // Register handlers for all dynamic characteristics.
    //
    this.boostService.getCharacteristic(Characteristic.On)
        .onGet(() => this.currentState[this.kBoostName])
        .onSet(
            (active) => this.setDeviceState(this.kBoostName, <boolean>active));

    this.modeService.getCharacteristic(Characteristic.Active)
        .onGet(() => this.currentState[this.kStateName]);

    this.modeService.getCharacteristic(Characteristic.ActiveIdentifier)
        .onGet(() => this.currentState[this.kModeName])
        .onSet((val) => this.setDeviceState(this.kModeName, <number>val));

    //
    // Begin monitoring the device for state changes.
    //
    this.updateDeviceState();
    setInterval(
        () => this.updateDeviceState(), HiveHomeAccessory.kRefreshInterval);
  }

  // Get the device power state and push to Homekit when it changes.
  async updateDeviceState() {
    const lastState = Object.assign({}, this.currentState);
    this.currentState[this.kBoostName] =
        (await this.hiveSession.hotwater.getBoost(this.hiveDevice) === 'ON');
    this.currentState[this.kStateName] =
        (await this.hiveSession.hotwater.getState(this.hiveDevice) === 'ON');
    const modeIndex = this.kHwModes.indexOf(
        await this.hiveSession.hotwater.getMode(this.hiveDevice));
    this.currentState[this.kModeName] =
        (modeIndex >= 0 ? modeIndex : this.currentState[this.kModeName]);
    if (JSON.stringify(lastState) !== JSON.stringify(this.currentState)) {
      this.updateHomekitState();
    }
  }

  async setDeviceState(serviceName: string, newState: number|boolean) {
    switch (serviceName) {
      case this.kBoostName:
        if (newState) {
          await this.hiveSession.hotwater.setBoostOn(this.hiveDevice, 60);
          Log.info('Enabled Hot Water Boost for 60 minutes');
        } else {
          await this.hiveSession.hotwater.setBoostOff(this.hiveDevice);
          Log.info('Turned off Hot Water Boost');
        }
        break;
      case this.kModeName:
        await this.hiveSession.hotwater.setMode(
            this.hiveDevice, this.kHwModes[<number>newState]);
        Log.info('Set Hot Water mode to:', this.kHwModes[<number>newState]);
    }
    this.currentState[serviceName] = newState;
    this.updateHomekitState();
  }

  async updateHomekitState() {
    this.boostService.updateCharacteristic(
        this.platform.Characteristic.On, this.currentState[this.kBoostName]);
    this.modeService.updateCharacteristic(
        this.platform.Characteristic.Active,
        this.currentState[this.kStateName]);
    this.modeService.updateCharacteristic(
        this.platform.Characteristic.ActiveIdentifier,
        this.currentState[this.kModeName]);
  }
}
