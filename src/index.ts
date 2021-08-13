import { API } from 'homebridge';

import { ACCESSORY_NAME } from './settings';
import { MijiaThermometerAccessory } from './accessory';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerAccessory(ACCESSORY_NAME, MijiaThermometerAccessory);
};
