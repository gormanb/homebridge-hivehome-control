/* eslint-disable indent */
import {API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service} from 'homebridge';

import {HiveAccessory} from './hivehome/accessories/hiveAccessory';
import {HiveHeatingAccessory} from './hivehome/accessories/hiveHeatingAccessory';
import {HiveHotWaterAccessory} from './hivehome/accessories/hiveHotWaterAccessory';
import {HiveData, HiveType, HiveTypeName} from './hivehome/hive-api';
import {getHiveDeviceList, startHiveSession} from './hivehome/hive-helpers';
import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {Log} from './util/log';

// How long we wait after a failed discovery attempt before retrying.
const kDiscoveryRefreshInterval = 5000;

/**
 * This class is the entry point for the plugin. It is responsible for parsing
 * the user config, discovering accessories, and registering them.
 */
export class HiveHomeControllerPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
      this.api.hap.Characteristic;

  // This array is used to track restored cached accessories.
  public readonly cachedAccessories: PlatformAccessory[] = [];

  // This array records the handlers which wrap each accessory.
  public readonly accessoryHandlers: HiveAccessory[] = [];

  // Classes for reflective instantiation based on Hive type.
  private readonly hiveAccessories = {
    [HiveType.kHeating]: HiveHeatingAccessory,
    [HiveType.kHotWater]: HiveHotWaterAccessory,
  };

  constructor(
      private readonly logger: Logger,
      public readonly config: PlatformConfig,
      public readonly api: API,
  ) {
    // Configure the custom log with the Homebridge logger and debug config.
    Log.configure(logger, config.enableDebugLog);

    // If the config is not valid, bail out immediately. We will not discover
    // any new accessories or register any handlers for cached accessories.
    const validationErrors = this.validateConfig(config);
    if (validationErrors.length > 0) {
      Log.error('Plugin suspended. Invalid configuration:', validationErrors);
      return;
    }

    // Notify the user that we have completed platform initialization.
    Log.debug('Finished initializing platform');

    // This event is fired when Homebridge has restored all cached accessories.
    // We must add handlers for these, and check for any new accessories.
    this.api.on('didFinishLaunching', () => {
      Log.debug('Finished restoring all cached accessories from disk');
      this.discoverDevices();
    });
  }

  // Validate that the plugin configuration conforms to the expected format.
  private validateConfig(config: PlatformConfig): string[] {
    const validationErrors: string[] = [];
    if (!config.hiveUsername) {
      validationErrors.push('No Hive username specified');
    }
    if (!config.hivePassword) {
      validationErrors.push('No Hive password specified');
    }
    if (!config.deviceGroupKey) {
      validationErrors.push('No Hive Device Group Key specified');
    }
    if (!config.deviceKey) {
      validationErrors.push('No Hive Device Key specified');
    }
    if (!config.devicePassword) {
      validationErrors.push('No Hive Device Password specified');
    }
    if (config.heatingBoostMins <= 0) {
      validationErrors.push('Heating Boost Duration is not > 0');
    }
    if (config.heatingBoostTemp <= 0) {
      validationErrors.push('Heating Boost Temperature is not > 0');
    }
    if (config.hotWaterBoostMins <= 0) {
      validationErrors.push('Hot Water Boost Duration is not > 0');
    }
    return validationErrors;
  }

  /**
   * This function is invoked for each cached accessory that homebridge restores
   * from disk at startup. Here we add the cached accessories to a list which
   * will be examined later during the 'discoverDevices' phase.
   */
  public configureAccessory(accessory: PlatformAccessory) {
    Log.info('Loading accessory from cache:', accessory.displayName);
    this.cachedAccessories.push(accessory);
  }

  /**
   * Discover and register accessories. Accessories must only be registered
   * once; previously created accessories must not be registered again, to
   * avoid "duplicate UUID" errors.
   */
  private async discoverDevices() {
    // Discover accessories. If we fail to discover anything, schedule another
    // discovery attempt in the future.
    const hiveSession = await startHiveSession(this.config);

    if (!hiveSession) {
      Log.error('Login failed. Please check your credentials.');
      return;
    }

    const deviceList = await getHiveDeviceList(hiveSession);
    Log.debug('Discovered devices:', deviceList);

    // Iterate over the discovered devices and create handlers for each.
    for await (const hiveDevice of deviceList) {
      // Generate a unique id for the accessory from its device ID.
      const uuid = this.api.hap.uuid.generate(await hiveDevice[HiveData.kId]);
      const deviceType = await hiveDevice[HiveData.kType];
      const displayName =
          `${await hiveDevice[HiveData.kName]} ${HiveTypeName[deviceType]}`;

      // See if an accessory with the same uuid already exists.
      let accessory =
          this.cachedAccessories.find(accessory => accessory.UUID === uuid);

      // If the accessory does not yet exist, we need to create it.
      if (!accessory) {
        Log.info('Adding new accessory:', displayName);
        accessory = new this.api.platformAccessory(displayName, uuid);
        this.api.registerPlatformAccessories(
            PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      // Make sure the accessory stays in sync with any device config changes.
      accessory.context.device = hiveDevice;
      this.api.updatePlatformAccessories([accessory]);

      // Create the accessory handler for this accessory.
      this.accessoryHandlers.push(
          new this.hiveAccessories[deviceType](this, accessory, hiveSession));
    }

    if (this.accessoryHandlers.length === 0) {
      Log.warn(
          'Failed to find devices. Retry in', kDiscoveryRefreshInterval, 'ms');
      setTimeout(() => this.discoverDevices(), kDiscoveryRefreshInterval);
    }
  }
}
