/**
 * This is the name of the accessory that users will use to register the plugin in the Homebridge config.json
 */
export const ACCESSORY_NAME = 'MijiaThermometer';

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = 'homebridge-mijia-thermometer';

/**
 * This is the uuids of services and characteristics that provides data.
 */
export const MI_SERVICE_UUID = 'ebe0ccb07a0a4b0c8a1a6ff2997da3a6';
export const MI_CHARACTERISTIC_UUID = 'ebe0ccc17a0a4b0c8a1a6ff2997da3a6';
export const INFO_SERVICE_UUID = '180a';
// export const BAT_SERVICE_UUID = '180f'
export const ADVERTISEMENT_SERVICE_UUID = "fe95";

export const CACHE_DIRECTORY = '~/.homebridge/.MijiaThermometer';

export const CAPABILITIES_FLAGS = {
  connectable: 1 << 0,
  central: 1 << 1,
  secure: 1 << 2,
  io: (1 << 3) | (1 << 4),
};

export const FRAMECONTROL_FLAGS = {
  isFactoryNew: 1 << 0,
  isConnected: 1 << 1,
  isCentral: 1 << 2,
  isEncrypted: 1 << 3,
  hasMacAddress: 1 << 4,
  hasCapabilities: 1 << 5,
  hasEvent: 1 << 6,
  hasCustomData: 1 << 7,
  hasSubtitle: 1 << 8,
  hasBinding: 1 << 9,
};

export const EVENT_TYPES = {
  temperature: 4100,
  humidity: 4102,
  illuminance: 4103,
  moisture: 4104,
  fertility: 4105,
  battery: 4106,
  temperatureAndHumidity: 4109,
};
