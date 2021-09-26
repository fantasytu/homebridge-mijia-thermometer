import { CAPABILITIES_FLAGS, FRAMECONTROL_FLAGS, EVENT_TYPES } from './settings';
import crypto from "crypto";

export class Parser {

  private buffer;
  private bindKey;
  private baseByteLength;

  private frameControl;
  private version;
  private productId;
  private frameCounter;
  private macAddress;
  private capabilities;

  private eventType;
  private eventLength;
  private event;

  constructor(buffer, bindKey:string) {
    this.baseByteLength = 5;
    if (buffer == null) {
      throw new Error("A buffer must be provided.");
    }
    this.buffer = buffer;
    if (buffer.length < this.baseByteLength) {
      throw new Error(
        `Service data length must be >= 5 bytes. ${this.toString()}`
      );
    }
    this.bindKey = bindKey;
  }

  parse() {
    this.frameControl = this.parseFrameControl();
    this.version = this.parseVersion();
    this.productId = this.parseProductId();
    this.frameCounter = this.parseFrameCounter();
    this.macAddress = this.parseMacAddress();
    this.capabilities = this.parseCapabilities();

    if (this.frameControl.isEncrypted) {
      this.decryptPayload();
    }

    this.eventType = this.parseEventType();
    this.eventLength = this.parseEventLength();
    this.event = this.parseEventData();
    return {
      frameControl: this.frameControl,
      event: this.event,
      productId: this.productId,
      frameCounter: this.frameCounter,
      macAddress: this.macAddress,
      eventType: this.eventType,
      capabilities: this.capabilities,
      eventLength: this.eventLength,
      version: this.version,
    };
  }

  parseFrameControl() {
    const frameControl = this.buffer.readUInt16LE(0);
    return Object.keys(FRAMECONTROL_FLAGS).reduce((map, flag) => {
      map[flag] = (frameControl & FRAMECONTROL_FLAGS[flag]) !== 0;
      return map;
    }, {});
  }

  parseVersion() {
    return this.buffer.readUInt8(1) >> 4;
  }

  parseProductId() {
    return this.buffer.readUInt16LE(2);
  }

  parseFrameCounter() {
    return this.buffer.readUInt8(4);
  }

  parseMacAddress() {
    if (!this.frameControl.hasMacAddress) {
      return null;
    }
    const macBuffer = this.buffer.slice(
      this.baseByteLength,
      this.baseByteLength + 6
    );
    return Buffer.from(macBuffer).reverse().toString("hex");
  }

  get capabilityOffset() {
    if (!this.frameControl.hasMacAddress) {
      return this.baseByteLength;
    }
    return 11;
  }

  parseCapabilities() {
    if (!this.frameControl.hasCapabilities) {
      return null;
    }
    const capabilities = this.buffer.readUInt8(this.capabilityOffset);
    return Object.keys(CAPABILITIES_FLAGS).reduce((map, flag) => {
      map[flag] = (capabilities & CAPABILITIES_FLAGS[flag]) !== 0;
      return map;
    }, {});
  }

  get eventOffset() {
    let offset = this.baseByteLength;
    if (this.frameControl.hasMacAddress) {
      offset = 11;
    }
    if (this.frameControl.hasCapabilities) {
      offset += 1;
    }

    return offset;
  }

  parseEventType() {
    if (!this.frameControl.hasEvent) {
      return null;
    }
    return this.buffer.readUInt16LE(this.eventOffset);
  }

  parseEventLength() {
    if (!this.frameControl.hasEvent) {
      return null;
    }
    return this.buffer.readUInt8(this.eventOffset + 2);
  }

  decryptPayload() {
    const msgLength = this.buffer.length;
    const eventLength = msgLength - this.eventOffset;

    if (eventLength < 3) {
      return;
    }
    if (this.bindKey == null) {
      throw Error("Sensor data is encrypted. Please configure a bindKey.");
    }

    const encryptedPayload = this.buffer.slice(this.eventOffset, msgLength);

    const nonce = Buffer.concat([
      this.buffer.slice(5, 11), //mac_reversed
      this.buffer.slice(2, 4), //device_type
      this.buffer.slice(4, 5), //frame_cnt
      encryptedPayload.slice(-7, -4), //ext_cnt
    ]);

    const decipher = crypto.createDecipheriv(
      "aes-128-ccm",
      Buffer.from(this.bindKey, "hex"), //key
      nonce, //iv
      { authTagLength: 4 }
    );

    const ciphertext = encryptedPayload.slice(0, -7);

    decipher.setAuthTag(encryptedPayload.slice(-4));
    decipher.setAAD(Buffer.from("11", "hex"), {
      plaintextLength: ciphertext.length,
    });

    const receivedPlaintext = decipher.update(ciphertext);

    decipher.final();

    this.buffer = Buffer.concat([
      this.buffer.slice(0, this.eventOffset),
      receivedPlaintext,
    ]);
  }

  parseEventData() {
    if (!this.frameControl.hasEvent) {
      return null;
    }
    switch (this.eventType) {
      case EVENT_TYPES.temperature: {
        return this.parseTemperatureEvent();
      }
      case EVENT_TYPES.humidity: {
        return this.parseHumidityEvent();
      }
      case EVENT_TYPES.battery: {
        return this.parseBatteryEvent();
      }
      case EVENT_TYPES.temperatureAndHumidity: {
        return this.parseTemperatureAndHumidityEvent();
      }
      case EVENT_TYPES.illuminance: {
        return this.parseIlluminanceEvent();
      }
      case EVENT_TYPES.fertility: {
        return this.parseFertilityEvent();
      }
      case EVENT_TYPES.moisture: {
        return this.parseMoistureEvent();
      }
      default: {
        throw new Error(
          `Unknown event type: ${this.eventType}. ${this.toString()}`
        );
      }
    }
  }

  parseTemperatureEvent() {
    return {
      temperature: this.buffer.readInt16LE(this.eventOffset + 3) / 10,
    };
  }

  parseHumidityEvent() {
    return {
      humidity: this.buffer.readUInt16LE(this.eventOffset + 3) / 10,
    };
  }

  parseBatteryEvent() {
    return {
      battery: this.buffer.readUInt8(this.eventOffset + 3),
    };
  }

  parseTemperatureAndHumidityEvent() {
    const temperature = this.buffer.readInt16LE(this.eventOffset + 3) / 10;
    const humidity = this.buffer.readUInt16LE(this.eventOffset + 5) / 10;
    return { temperature, humidity };
  }

  parseIlluminanceEvent() {
    return {
      illuminance: this.buffer.readUIntLE(this.eventOffset + 3, 3),
    };
  }

  parseFertilityEvent() {
    return {
      fertility: this.buffer.readInt16LE(this.eventOffset + 3),
    };
  }

  parseMoistureEvent() {
    return {
      moisture: this.buffer.readInt8(this.eventOffset + 3),
    };
  }

  toString() {
    return this.buffer.toString("hex");
  }
}
