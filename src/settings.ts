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
export const BAT_SERVICE_UUID = '180f'

export const CACHE_DIRECTORY = '~/.homebridge/.MijiaThermometer';
