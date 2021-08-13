'use strict';

import { AccessoryConfig, AccessoryPlugin, API, Characteristic, Logging, Service } from "homebridge";
import { NobleScanner } from "./noblescanner";

export class MijiaThermometerAccessory implements AccessoryPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  private readonly log: Logging;
  private readonly config: AccessoryConfig;
  private readonly api: API;
  private nobleScanner: NobleScanner;

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

    this.nobleScanner = new NobleScanner(log, this.config.bindKey, this.config.address);
  }

  get serialNumber() {
    return this.config.address != null
      ? this.config.address.replace(/:/g, "")
      : "LYWSD03MMC";
  }

  get temperatureName() {
    return this.config.temperatureName || "Temperature";
  }

  get humidityName() {
    return this.config.humidityName || "Humidity";
  }

  get batteryLevelThreshold() {
    return this.config.lowBattery || 10;
  }

  onCharacteristicGetValue(field, callback) {
    const value = this[field];
    if (value == null) {
      callback(new Error(`Undefined characteristic value for ${field}`));
    } else {
      callback(null, value);
    }
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
    const accessoryInformation = new this.Service.AccessoryInformation()
      .setCharacteristic(this.Characteristic.Manufacturer, "Xiaomi Mijia")
      .setCharacteristic(this.Characteristic.Model, "LYWSD03MMC")
      .setCharacteristic(this.Characteristic.FirmwareRevision, packageConf.version)
      .setCharacteristic(this.Characteristic.SerialNumber, this.serialNumber);

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
}
