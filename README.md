# Homebridge Mijia Thermometer Plugin

[![npm](https://img.shields.io/npm/v/homebridge-mijia-thermometer.svg)](https://www.npmjs.com/package/homebridge-mijia-thermometer)
[![github](https://img.shields.io/github/package-json/v/fantasytu/homebridge-mijia-thermometer.svg)](http://github.com/fantasytu/homebridge-mijia-thermometer)
[![license](https://img.shields.io/github/license/fantasytu/homebridge-mijia-thermometer.svg)](http://github.com/fantasytu/homebridge-mijia-thermometer)
[![donate](https://img.shields.io/badge/Donate-Paypal-blue.svg)](https://paypal.me/fantasytu)
[![donate-alipay](https://img.shields.io/badge/捐赠-支付宝-blue.svg)](https://qr.alipay.com/fkx16957oe24tjvvxtdmfa4)

This is a [Homebridge](https://github.com/nfarina/homebridge) plugin to provide for Xiaomi Mijia Thermometer(specifically LYWSD03MMC).

**If you like this plugin, don't hesitate to "Star".**

## Installation

```
sudo npm i -g homebridge-mijia-thermometer@latest
```

These libraries and their dependencies are required by the [Noble](https://www.npmjs.com/package/noble) library and provide access to the kernel Bluetooth subsystem:

#### Ubuntu/Debian/Raspbian

```sh
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
```

#### Fedora/CentOS/Other-RPM based

```sh
sudo yum install bluez bluez-libs bluez-libs-devel
sudo yum install systemd-devel
sudo yum provides */libudev.h
```

For more detailed information and descriptions for other platforms please see the [Noble documentation](https://github.com/noble/noble#readme).

## Configuration

Configuration on [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x) is supported.

Alternatively, you could update your Homebridge `config.json` file according to these parameters.


| Key                     | Default                             |                                                                             |
|-------------------------|-------------------------------------|-----------------------------------------------------------------------------|
| `accessory`             | `MijiaThermometer`                  | Required. The name of this plugin.                                          |
| `name`                  | `Thermometer`                       | Required. The name of this accessory. This will appear in your Home app.    |
| `address`               | `a0:c1:0c:d4:e1:6b`                 | Required. The address of the device.                                        |
| `bindKey`               | `bhrthjb9mg4980hu80xvosbgzf1toh8p`  | Required. The key to decyrpt BLE data.                                      |
| `humidityName`          | `"Humidity"`                        | Optional. Name of the humidity sensor as it will appear in your Home app.   |
| `temperatureName`       | `"Temperature"`                     | Name of the temperature sensor as it will appear in your Home app.          |
| `lowBattery`            | `10`                                | At what battery percentage Homekit should start warning about low battery.  |
| `temperatureOffset`     | `0`                                 | An offset to calibrate temperature values if measured incorrectly.          |
| `humidityOffset`        | `0`                                 | An offset to calibrate humidity values if measured incorrectly.             |

#### Getting BindKey

[post](https://github.com/mKeRix/room-assistant/issues/277).

#### Automatically Retrieved Model, Serial Number and Firmware Revision

Version 1.6 supports to retrieve model, serial number and firmware revision via BLE advertisement.

Since information service is initialized before the Bluetooth scanner, so the information retrieved is cached into a file (stored at '~/.homebridge/.MijiaThermometer/') that will be loaded at the **SECOND** boot. So in order to make sure this function works well, it is highly suggested to reboot Homebridge after your device is connected and **four** of these following messages have been displayed in console.

```
Device Info cached!
```

## Tested On

* iOS 15
* Apple Home
* Homebridge 1.3.4 ( running on Centos 8 with Bluetooth Chip RTL8761B )

## Other issues

### Running without root/sudo (Linux-specific)

Run the following command:

```sh
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
```

This grants the [node](https://github.com/abandonware/noble) binary `cap_net_raw` privileges, so it can start/stop BLE advertising.

### Using Bluetooth 5.0 USB Dongle with RTL8761B chipset on Linux kernel 5.10

Tutorial is listed in this [git](https://github.com/linuxonly1993/rtl8761b_bt_5_linux).

## Troubleshooting

If you have any issue, contact me(**f.tu@me.com**) or just submit an [issues](https://github.com/fantasytu/homebridge-mijia-thermometer/issues).
