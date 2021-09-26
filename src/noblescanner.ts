import { Logging } from "homebridge";
import noble from "@abandonware/noble";
import { EventEmitter } from "events";
import { Parser } from './parser';
import { INFO_SERVICE_UUID, MI_SERVICE_UUID, MI_CHARACTERISTIC_UUID, ADVERTISEMENT_SERVICE_UUID, EVENT_TYPES } from './settings';

export class NobleScanner extends EventEmitter {
  private readonly log: Logging;

  private address: string;
  private bindKey: string;

  private disconnectDelay = 3;
  private firstConnect = true;

  constructor(log: Logging, address: string, bindKey: string) {
    super();

    this.log = log;
    this.address = address;
    this.bindKey = bindKey;

    this.registerEvents();
  }

  registerEvents() {
    noble.on("discover", this.onDiscover.bind(this));
    noble.on("scanStart", this.onScanStart.bind(this));
    noble.on("scanStop", this.onScanStop.bind(this));
    noble.on("warning", this.onWarning.bind(this));
    noble.on("stateChange", this.onStateChange.bind(this));
  }

  start() {
    this.log.debug("Start scanning.");
    try {
      noble.startScanning([], true);
    } catch (error) {
      this.emit("error", error);
    }
  }

  stop() {
    noble.stopScanning();
  }

  async onDiscover(peripheral) {
    this.log.debug('Peripheral discovered (' + peripheral.id +
              ' with address <' + peripheral.address + '>,' +
              ' connectable ' + peripheral.connectable + ',' +
              ' RSSI ' + peripheral.rssi + ')');

    if (peripheral.address === this.address.toLowerCase() ) {
      if (this.firstConnect) {
        await this.onFirstConnect(peripheral);
      }
      await this.onParseAdvertisement(peripheral);
    }
  }

  onScanStart() {
    this.log.info("Started scanning.");
  }

  onScanStop() {
    this.log.info("Stopped scanning.");
  }

  onWarning(message) {
    this.log.warn("Warning: ", message);
  }

  onStateChange(state) {
    if (state === "poweredOn") {
      this.start();
    } else {
      this.log.info(`Stop scanning. (${state})`);
      this.stop();
    }
  }

  async onFirstConnect(peripheral) {
    try {
      await noble.stopScanningAsync();

      this.log.info(`${peripheral.address} (${peripheral.advertisement.localName}) Connecting`);
      await peripheral.connectAsync();
      this.log.info(`${peripheral.address} (${peripheral.advertisement.localName}) Connected`);

      peripheral.once('disconnect', this.onDisconnect.bind(this));

      const services = await peripheral.discoverServicesAsync([INFO_SERVICE_UUID, MI_SERVICE_UUID]);
      for (const service of services) {

          const characteristics = await service.discoverCharacteristicsAsync([]);
          for (const characteristic of characteristics) {
              if (characteristic.name === null && characteristic.uuid === MI_CHARACTERISTIC_UUID) {
                  characteristic.on('data', this.onReadThermometer.bind(this));
                  await characteristic.readAsync();
              }

              if (characteristic.name != null){
                const cleanCharacteristicName = characteristic.name.replace(/\s+/g,"");
                const onReadCharacteristic = `onRead${cleanCharacteristicName}`;
                if (this[onReadCharacteristic] != null && characteristic.properties.includes("read")) {
                    characteristic.on('data', this[onReadCharacteristic].bind(this));
                    this.log.debug(`${peripheral.address} Characteristic: ${onReadCharacteristic}`);
                    await characteristic.readAsync();
                }
              }

          }
      }

      this.log.info(`${peripheral.address} (${peripheral.advertisement.localName}) Init data synced. Ready disconnect and enter LE mode.`);

      setTimeout(() => {
        this.firstConnect = false;
        peripheral.disconnect();
        this.start();
      }, this.disconnectDelay * 1000);

    } catch (error) {
      this.emit("error", error);
    }
  }

  async onParseAdvertisement(peripheral) {
    try {
      const serviceData = peripheral.advertisement.serviceData.find(data => data.uuid.toLowerCase() === ADVERTISEMENT_SERVICE_UUID).data;

      this.log.debug(`${peripheral.address} (${peripheral.advertisement.localName}) serviceData: ${serviceData}`);

      const result = new Parser(serviceData, this.bindKey).parse();

      if (result == null) {
        return;
      }

      if (!result.frameControl.hasEvent) {
        this.log.debug("No event");
        return;
      }

      this.log.debug(`${result.eventType}`);

      switch (result.eventType) {
        case EVENT_TYPES.temperature: {
          const temperature = result.event.temperature;
          this.emit("updateTemperature", temperature);
          break;
        }
        case EVENT_TYPES.humidity: {
          const humidity = result.event.humidity;
          this.emit("updateHumidity", humidity);
          break;
        }
        case EVENT_TYPES.battery: {
          const battery = result.event.battery;
          this.emit("updateBatteryLevel", battery);
          break;
        }
        case EVENT_TYPES.temperatureAndHumidity: {
          const temperature = result.event.temperature;
          const humidity = result.event.humidity;
          this.emit("updateTemperature", temperature);
          this.emit("updateHumidity", humidity);
          break;
        }
        case EVENT_TYPES.illuminance: {
          const illuminance = result.event.illuminance;
          this.emit("updateIlluminance", illuminance);
          break;
        }
        case EVENT_TYPES.moisture: {
          const moisture = result.event.moisture;
          this.emit("updateMoisture", moisture);
          break;
        }
        case EVENT_TYPES.fertility: {
          const fertility = result.event.fertility;
          this.emit("updateFertility", fertility);
          break;
        }
        default: {
          this.emit("error", new Error(`Unknown event type ${result.eventType}`));
          return;
        }
      }
    } catch (error) {
      this.emit("error", error);
    }
  }

  onDisconnect() {
    this.log.debug(`Disconnected.`);
  }

  onReadModelNumberString(data, isNotification) {
    this.log.debug(`Characteristics Model Number String Found`);
    this.log.debug(`Characteristics data read: ${data.toString()}`);
    this.emit("updateModelNumber", data.toString());
  }

  onReadSerialNumberString(data, isNotification) {
    this.log.debug(`Characteristics Serial Number String Found`);
    this.log.debug(`Characteristics data read: ${data.toString()}`);
    this.emit("updateSerialNumber", data.toString());
  }

  onReadFirmwareRevisionString(data, isNotification) {
    this.log.debug(`Characteristic Firmware Revision String Found`);
    this.log.debug(`Characteristics data read: ${data.toString()}`);
    this.emit("updateFirmwareRevision", data.toString());
  }

  onReadHardwareRevisionString(data, isNotification) {
    this.log.debug(`Characteristic Hardware Revision String Found`);
    this.log.debug(`Characteristics data read: ${data.toString()}`);
    this.emit("updateHardwareRevision", data.toString());
  }

  onReadSoftwareRevisionString(data, isNotification) {
    this.log.debug(`Characteristic Software Revision String Found`);
    this.log.debug(`Characteristics data read: ${data.toString()}`);
    this.emit("updateSoftwareRevision", data.toString());
  }

  onReadThermometer(data, isNotification) {
    this.log.debug(`Characteristic Thermometer Found`);
    this.log.debug(`Characteristics data read: ${data.toString('hex')}`);
    const temp = data.readUInt16LE(0) / 100;
    const hum = data.readUInt8(2);
    const bat = data.readUInt16LE(3);

    this.emit("updateThermometer", {temp, hum, bat});
  }

  onNotify(state) {
    this.log.debug("Characteristics notification received.");
  }
}
