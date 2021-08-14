import { Logging } from "homebridge";
import noble from "@abandonware/noble";
import { EventEmitter } from "events";
import { INFO_SERVICE_UUID, BAT_SERVICE_UUID, MI_SERVICE_UUID, MI_CHARACTERISTIC_UUID } from './settings';

export class NobleScanner extends EventEmitter {
  private readonly log: Logging;
  private scanning = false;

  private address: string;

  constructor(log: Logging, address: string) {
    super();

    this.log = log;
    this.address = address;

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
      this.scanning = true;
    } catch (e) {
      this.scanning = false;
      this.log.error(e);
    }
  }

  stop() {
    this.scanning = false;
    noble.stopScanning();
  }

  async onDiscover(peripheral) {
    this.log.debug('Peripheral discovered (' + peripheral.id +
              ' with address <' + peripheral.address +  ', ' + peripheral.addressType + '>,' +
              ' connectable ' + peripheral.connectable + ',' +
              ' RSSI ' + peripheral.rssi + ')');

    if (peripheral.address === this.address.toLowerCase() ) {
      try {
        await noble.stopScanningAsync();

        this.log.debug(`${peripheral.address} (${peripheral.advertisement.localName}) Connecting`);
        await peripheral.connectAsync();
        this.log.debug(`${peripheral.address} (${peripheral.advertisement.localName}) Connected`);

        const services = await peripheral.discoverServicesAsync([INFO_SERVICE_UUID, BAT_SERVICE_UUID, MI_SERVICE_UUID]);
        for (const service of services) {

            const characteristics = await service.discoverCharacteristicsAsync([]);
            for (const characteristic of characteristics) {
                if (characteristic.name === null && characteristic.uuid === MI_CHARACTERISTIC_UUID) {
                    characteristic.on('data', this.onReadThermometer.bind(this));
                    characteristic.readAsync();
                }

                if (characteristic.name != null){
                  const cleanCharacteristicName = characteristic.name.replace(/\s+/g,"");
                  const onReadCharacteristic = `onRead${cleanCharacteristicName}`;
                  if (this[onReadCharacteristic] != null && characteristic.properties.includes("read")) {
                      characteristic.on('data', this[onReadCharacteristic].bind(this));
                      characteristic.readAsync();
                  }
                }

            }
        }

      } catch (error) {
        this.log.error(`Warning: ${error}`);
      }
    }
  }

  onScanStart() {
    this.log.debug("Started scanning.");
  }

  onScanStop() {
    this.log.debug("Stopped scanning.");
  }

  onWarning(message) {
    this.log.info("Warning: ", message);
  }

  onStateChange(state) {
    if (state === "poweredOn") {
      this.start();
    } else {
      this.log.info(`Stop scanning. (${state})`);
      this.stop();
    }
  }

  onConnect(error) {
    this.log.debug("Device connected");
  }

  onServicesDiscover(services) {
    this.log.debug("Service discovered");
  }

  onCharacteristicsDiscover(characteristics) {
    this.log.debug("Characteristics discovered");
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

  onReadBatteryLevel(data, isNotification) {
    this.log.debug(`Characteristic Battery Level Found`);
    this.log.debug(`Characteristics data read: ${data.readUInt16LE(0)}`);

    this.emit("updateBatteryLevel", data.readUInt16LE(0));
  }

  onReadThermometer(data, isNotification) {
    this.log.debug(`Characteristic Thermometer Found`);
    this.log.debug(`Characteristics data read: ${data.toString('hex')}`);
    const temp = data.readUInt16LE(0) / 100;
    const hum = data.readUInt8(2);

    this.emit("updateThermometer", {temp, hum});
  }

  onNotify(state) {
    this.log.debug("Characteristics notification received.");
  }
}
