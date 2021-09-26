'use strict';

import { AccessoryConfig, AccessoryPlugin, API, Characteristic, Logging, Service } from "homebridge";
import { NobleScanner } from "./noblescanner";
import fs from 'fs';
import mkdirp from 'mkdirp';
import { CACHE_DIRECTORY } from './settings';

export class MijiaThermometerAccessory implements AccessoryPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  private readonly log: Logging;
  private readonly config: AccessoryConfig;
  private readonly api: API;

  private cachedInfo;
  private deviceFile;

  private nobleScanner;

  private latestTemperature;
  private latestHumidity;
  private latestBatteryLevel;

  private lastUpdatedAt;

  private readonly informationService;
  private readonly temperatureService;
  private readonly humidityService;
  private readonly batteryService;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config;
    this.api = api;

    // get service & characteristic
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.loadCachedInfo();

    this.informationService = this.getInformationService();
    this.temperatureService = this.getTemperatureService();
    this.humidityService = this.getHumidityService();
    this.batteryService = this.getBatteryService();

    this.log.debug('Plugin Loaded');

    this.nobleScanner = this.setupScanner(config);
  }

  get temperatureName() {
    return this.config.temperatureName || "Temperature";
  }

  get humidityName() {
    return this.config.humidityName || "Humidity";
  }

  get temperature() {
    if (this.latestTemperature == null) {
      return 0;
    }
    return this.latestTemperature + (this.config.temperatureOffset ?? 0);
  }

  get humidity() {
    if (this.latestHumidity == null) {
      return 0;
    }
    return this.latestHumidity + (this.config.humidityOffset ?? 0);
  }

  get batteryLevel() {
    return this.latestBatteryLevel ?? 100;
  }

  get batteryStatus() {
    let batteryStatus;
    if (this.batteryLevel == null) {
      batteryStatus = undefined;
    } else if (this.batteryLevel > this.batteryLevelThreshold) {
      batteryStatus = this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
    } else {
      batteryStatus = this.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
    }
    return batteryStatus;
  }

  get batteryLevelThreshold() {
    return this.config.lowBattery || 10;
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.temperatureService,
      this.humidityService,
      this.batteryService
    ];
  }

  getInformationService() {
    const packageConf = require('../package.json');
    const version = packageConf.version;
    const accessoryInformation = new this.Service.AccessoryInformation();
    accessoryInformation
      .setCharacteristic(this.Characteristic.Name, this.config.name)
      .setCharacteristic(this.Characteristic.Manufacturer, "Xiaomi Mijia")
      .setCharacteristic(this.Characteristic.Model, this.cachedInfo.model ?? "LYWSD03MMC")
      .setCharacteristic(this.Characteristic.SerialNumber, this.cachedInfo.serialNumber ?? this.config.address.replace(/:/g, ""))
      .setCharacteristic(this.Characteristic.FirmwareRevision, this.cachedInfo.softwareRevision ?? version)
      .setCharacteristic(this.Characteristic.HardwareRevision, this.cachedInfo.hardwareRevision ?? 0)
      .setCharacteristic(this.Characteristic.SoftwareRevision, this.cachedInfo.softwareRevision ?? 0);

    return accessoryInformation;
  }

  getTemperatureService() {
    const temperatureService = new this.Service.TemperatureSensor(this.temperatureName);
    temperatureService
      .getCharacteristic(this.Characteristic.CurrentTemperature)
      .on("get", this.onCharacteristicGetValue.bind(this, "temperature"));
    return temperatureService;
  }

  getHumidityService() {
    const humidityService = new this.Service.HumiditySensor(this.humidityName);
    humidityService
      .getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
      .on("get", this.onCharacteristicGetValue.bind(this, "humidity"));
    return humidityService;
  }

  getBatteryService() {
    const batteryService = new this.Service.BatteryService("Battery");
    batteryService
      .getCharacteristic(this.Characteristic.BatteryLevel)
      .on("get", this.onCharacteristicGetValue.bind(this, "batteryLevel"));
    batteryService.setCharacteristic(
      this.Characteristic.ChargingState,
      this.Characteristic.ChargingState.NOT_CHARGEABLE
    );
    batteryService
      .getCharacteristic(this.Characteristic.StatusLowBattery)
      .on("get", this.onCharacteristicGetValue.bind(this, "batteryStatus"));
    return batteryService;
  }

  setupScanner(config) {
    if (config.address == null) {
      this.log.warn("address is not set.");
      return;
    }

    const scanner = new NobleScanner(this.log, this.config.address, this.config.bindKey);

    scanner.on("updateModelNumber", (newValue => {
      this.cachedInfo.modelNumber = newValue.replace(/\0/g, '');
      this.log.debug(`Model Number updated: ${newValue}`);
      this.saveCachedInfo();
    }));

    scanner.on("updateSerialNumber", (newValue => {
      this.cachedInfo.serialNumber = newValue.replace(/\0/g, '').replace(/--/g, '');
      this.log.debug(`Serial Number updated: ${newValue}`);
      this.saveCachedInfo();
    }));

    scanner.on("updateFirmwareRevision", (newValue => {
      this.cachedInfo.firmwareRevision = newValue.replace(/\0/g, '');
      this.log.debug(`Firmware Revision updated: ${newValue}`);
      this.saveCachedInfo();
    }));

    scanner.on("updateHardwareRevision", (newValue => {
      this.cachedInfo.hardwareRevision = newValue.replace(/\0/g, '');
      this.log.debug(`Hardware Revision updated: ${newValue}`);
      this.saveCachedInfo();
    }));

    scanner.on("updateSoftwareRevision", (newValue => {
      this.cachedInfo.softwareRevision = newValue.replace(/\0/g, '');
      this.log.debug(`Software Revision updated: ${newValue}`);
      this.saveCachedInfo();
    }));

    scanner.on("updateBatteryLevel", (newValue => {
      this.latestBatteryLevel = newValue;

      this.batteryService.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(this.latestBatteryLevel);
      this.log.debug(`Battery Level updated: ${newValue}`);
    }));

    scanner.on("updateTemperature", (newValue => {
      this.latestTemperature = newValue;
      this.lastUpdatedAt = Date.now();

      this.temperatureService.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(this.latestTemperature);
      this.log.debug(`Temperature updated: Temp: ${newValue}°C`);
    }));

    scanner.on("updateHumidity", (newValue => {
      this.latestTemperature = newValue;
      this.lastUpdatedAt = Date.now();

      this.humidityService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(this.latestHumidity);
      this.log.debug(`Humidity updated: Humi: ${newValue}}%`);
    }));

    scanner.on("updateThermometer", (newValue => {
      const {temp, hum, bat} = newValue;
      this.latestTemperature = temp;
      this.latestHumidity = hum;
      this.lastUpdatedAt = Date.now();

      this.temperatureService.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(this.latestTemperature);
      this.humidityService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(this.latestHumidity);
      this.log.debug(`Thermometer updated: Temp: ${temp}°C, Humi: ${hum}%,  vbat: ${bat}mV`);
    }));

    scanner.on("error", (error) => {
      this.log.error(`Error: ${error}`);
    });

    return scanner;
  }

  onCharacteristicGetValue(field, callback) {
    const value = this[field];
    if (value == null) {
      callback(new Error(`Undefined characteristic value for ${field}`));
    } else {
      callback(null, value);
    }
  }

  loadCachedInfo() {
    // check if the CACHE_DIRECTORY exists, if not then create it
    if (fs.existsSync(CACHE_DIRECTORY) === false) {
      mkdirp(CACHE_DIRECTORY);
    }

    this.deviceFile = CACHE_DIRECTORY + 'deviceInfo_' + this.config.address.replace(/:/g, "");

    try {
      this.cachedInfo = JSON.parse(fs.readFileSync(this.deviceFile).toString());
      this.log.info(`Cached info file found for device(${this.config.address})`);
      this.log.debug(`Cache info for device:\n ${JSON.stringify(this.cachedInfo, null, 2)} `);
      this.log.info(`Loading cached info to Information Service.`);
    } catch (err) {
      this.log.debug('Cached info file for this device do not exist.');
      this.cachedInfo = {};
    }
  }

  saveCachedInfo() {
    // save model name and deviceId
    fs.writeFile(this.deviceFile, JSON.stringify(this.cachedInfo), (err) => {
      if (err) {
        this.log.warn('[Writing cache info to file]Warning: %s', err);
      } else {
        this.log.info('Device Info cached!');
      }
    });
  }
}
