'use strict';

import { AccessoryConfig, AccessoryPlugin, API, Characteristic, Logging, Service } from "homebridge";
import { NobleScanner } from "./noblescanner";

export class MijiaThermometerAccessory implements AccessoryPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  private readonly log: Logging;
  private readonly config: AccessoryConfig;
  private readonly api: API;

  private nobleScanner;

  private latestTemperature;
  private latestHumidity;
  private latestBatteryLevel;

  private latestManufacturer;
  private latestModelNumber;
  private latestSerialNumber;
  private latestFirmwareRevision;

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

  get manufacturer() {
    return this.latestManufacturer ?? "Xiaomi Mijia";
  }

  get modelNumber() {
    return this.latestModelNumber ?? "LYWSD03MMC";
  }

  get serialNumber() {
    return this.latestSerialNumber ?? this.config.address.replace(/:/g, "");
  }

  get firmwareRevision() {
    const packageConf = require('../package.json');
    const version = packageConf.version;
    return this.latestFirmwareRevision ?? version;
  }

  get temperature() {
    if (this.latestTemperature == null) {
      return 0;
    }
    return this.latestTemperature + this.config.temperatureOffset;
  }

  get humidity() {
    if (this.latestHumidity == null) {
      return 0;
    }
    return this.latestHumidity + this.config.humidityOffset;
  }

  get batteryLevel() {
    return this.latestBatteryLevel ?? 0;
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
    const accessoryInformation = new this.Service.AccessoryInformation();
    accessoryInformation
      .getCharacteristic(this.Characteristic.Manufacturer)
      .on("get", this.onCharacteristicGetValue.bind(this, "manufacturer"));
    accessoryInformation
      .getCharacteristic(this.Characteristic.Model)
      .on("get", this.onCharacteristicGetValue.bind(this, "modelNumber"));
    accessoryInformation
      .getCharacteristic(this.Characteristic.SerialNumber)
      .on("get", this.onCharacteristicGetValue.bind(this, "serialNumber"));
    accessoryInformation
      .getCharacteristic(this.Characteristic.FirmwareRevision)
      .on("get", this.onCharacteristicGetValue.bind(this, "firmwareRevision"));

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

    const scanner = new NobleScanner(this.log, this.config.address);

    // scanner.on("updateModelNumber", (newValue => {
    //   this.modelNumber = newValue;
    //
    //   this.informationService.getCharacteristic(this.Characteristic.Model).updateValue(this.modelNumber);
    //   this.log.debug(`Model Number updated: ${newValue}`);
    // }));
    //
    // scanner.on("updateSerialNumber", (newValue => {
    //   this.serialNumber = newValue;
    //
    //   this.informationService.getCharacteristic(this.Characteristic.SerialNumber).updateValue(this.serialNumber);
    //   this.log.debug(`Serial Number updated: ${newValue}`);
    // }));
    //
    // scanner.on("updateFirmwareRevision", (newValue => {
    //   this.firmwareRevision = newValue;
    //
    //   this.informationService.getCharacteristic(this.Characteristic.FirmwareRevision).updateValue(this.firmwareRevision);
    //   this.log.debug(`Firmware Revision updated: ${newValue}`);
    // }));

    scanner.on("updateBatteryLevel", (newValue => {
      this.latestBatteryLevel = newValue;

      this.batteryService.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(this.latestBatteryLevel);
      this.log.debug(`Battery Level updated: ${newValue}`);
    }));

    scanner.on("updateThermometer", (newValue => {
      const {temp, hum, bat} = newValue;
      this.latestTemperature = temp;
      this.latestHumidity = hum;
      this.lastUpdatedAt = Date.now();

      this.temperatureService.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(this.latestTemperature);
      this.humidityService.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(this.latestHumidity);
      this.log.debug(`Thermometer updated: Temp: ${temp}°C, , Humi: ${hum}%,  vbat: ${bat}mV`);
    }));

    scanner.on("error", (error) => {
      this.log.error(error);
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
}
