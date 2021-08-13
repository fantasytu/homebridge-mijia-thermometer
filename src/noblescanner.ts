import { Logging } from "homebridge";
import { noble } from "noble";

export class NobleScanner {
  private readonly log: Logging;
  private scanning = false;

  private bindKey: string;
  private address: string;

  constructor(log: Logging, bindKey: string, address: string) {
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

  onDiscover(peripheral) {
    this.log.debug('Peripheral discovered (' + peripheral.id +
              ' with address <' + peripheral.address +  ', ' + peripheral.addressType + '>,' +
              ' connectable ' + peripheral.connectable + ',' +
              ' RSSI ' + peripheral.rssi + ':');

    const serviceData = peripheral.advertisement.serviceData;
    if (serviceData && serviceData.length) {
      this.log.debug('\tService data:');
      for (const i in serviceData) {
        this.log.debug('\t\t' + JSON.stringify(serviceData[i].uuid) + ': ' + JSON.stringify(serviceData[i].data.toString('hex')));
      }
    }
    if (peripheral.advertisement.manufacturerData) {
      this.log.debug('\tManufacturer data:');
      this.log.debug('\t\t' + JSON.stringify(peripheral.advertisement.manufacturerData.toString('hex')));
    }
    if (peripheral.advertisement.txPowerLevel !== undefined) {
      this.log.debug('\tTX power level is:');
      this.log.debug('\t\t' + peripheral.advertisement.txPowerLevel);
    }

    // peripheral.once('connect', this.onConnect.bind(this));
    // peripheral.once('servicesDiscover', this.onServicesDiscover.bind(this));
    // peripheral.once('characteristicsDiscover', this.onCharacteristicsDiscover.bind(this));
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

  onConnect() {
    this.log.debug("Device connected");
  }

  onServicesDiscover(services) {
    this.log.debug("Service discovered");
  }

  onCharacteristicsDiscover(characteristics) {
    this.log.debug("Characteristics discovered");
  }
}
