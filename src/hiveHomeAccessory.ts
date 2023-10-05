/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable indent */
import {PlatformAccessory, Service} from 'homebridge';

import {HiveHomeControllerPlatform} from './platform';
import {HotWaterState} from './util/hiveHelpers';
import {Log} from './util/log';

/**
 * An instance of this class is created for each accessory. Exposes both the
 * WindowCovering and Battery services for the device.
 */
export class HiveHomeAccessory {
  private static readonly kRefreshInterval = 5000;

  private readonly kManualName = 'Manual';
  private readonly kBoostName = 'Boost';
  private readonly kScheduleName = 'Schedule';

  private manualService: Service;
  private boostService: Service;
  private scheduleService: Service;

  private hiveDevice: any;

  private currentState = HotWaterState.kManualOff;

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
      this.accessory.addService(Service.Switch, this.kManualName)
          .setCharacteristic(Characteristic.ConfiguredName, this.kManualName);
    }
    this.manualService = <Service>this.accessory.getService(this.kManualName);

    if (!this.accessory.getService(this.kBoostName)) {
      this.accessory.addService(Service.Switch, this.kBoostName)
          .setCharacteristic(Characteristic.ConfiguredName, this.kBoostName);
    }
    this.boostService = <Service>this.accessory.getService(this.kBoostName);

    if (!this.accessory.getService(this.kScheduleName)) {
      this.accessory.addService(Service.Switch, this.kScheduleName)
          .setCharacteristic(Characteristic.ConfiguredName, this.kScheduleName);
    }
    this.scheduleService =
        <Service>this.accessory.getService(this.kScheduleName);

    //
    // Register handlers for all dynamic characteristics.
    //
    this.manualService.getCharacteristic(Characteristic.On)
        .onGet(() => this.currentState === HotWaterState.kManualOn)
        .onSet(
            (active) => this.setDeviceState(
                active ? HotWaterState.kManualOn : HotWaterState.kManualOff));

    this.boostService.getCharacteristic(Characteristic.On)
        .onGet(() => this.currentState === HotWaterState.kBoost)
        .onSet(
            (active) => this.setDeviceState(
                active ? HotWaterState.kBoost : HotWaterState.kManualOff));

    this.manualService.getCharacteristic(Characteristic.On)
        .onGet(() => this.currentState === HotWaterState.kSchedule)
        .onSet(
            (active) => this.setDeviceState(
                active ? HotWaterState.kSchedule : HotWaterState.kManualOff));

    //
    // Begin monitoring the device for state changes.
    //
    this.updateDeviceState();
    setInterval(
        () => this.updateDeviceState(), HiveHomeAccessory.kRefreshInterval);
  }

  // Get the device power state and push to Homekit when it changes.
  async updateDeviceState() {
    const lastState = this.currentState;
    if (await this.hiveSession.hotwater.getBoost(this.hiveDevice) === 'ON') {
      this.currentState = HotWaterState.kBoost;
    } else {
      this.currentState =
          await this.hiveSession.hotwater.getMode(this.hiveDevice);
    }
    if (lastState !== this.currentState) {
      this.updateHomekitState();
    }
  }

  async setDeviceState(newState: HotWaterState) {
    if (newState === HotWaterState.kBoost) {
      await this.hiveSession.hotwater.setBoostOn(this.hiveDevice, 60);
      Log.info('Enabled Hot Water Boost for 60 minutes');
    } else if (this.currentState === HotWaterState.kBoost) {
      await this.hiveSession.hotwater.setBoostOff(this.hiveDevice);
      Log.info('Turned off Hot Water Boost');
    } else {
      await this.hiveSession.hotwater.setMode(this.hiveDevice, newState);
      Log.info('Set Hot Water mode to:', newState);
    }
    this.currentState = newState;
    this.updateHomekitState();
  }

  async updateHomekitState() {
    this.manualService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState === HotWaterState.kManualOn);
    this.boostService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState === HotWaterState.kBoost);
    this.scheduleService.updateCharacteristic(
        this.platform.Characteristic.On,
        this.currentState === HotWaterState.kSchedule);
  }
}
