[![NPM Version](https://img.shields.io/npm/v/%40sie-js%2Fsie-tool)](https://www.npmjs.com/package/@sie-js/sie-tool)

# SUMMARY

A console utility for working with Siemens phones (SGold/SGold2).

Works on all major operating systems: Linux, macOS, and Windows.

> [!NOTE]
> All these functions are also available from the browser: [Web Tools](https://siemens-mobile-hacks.github.io/web-tools/).

# INSTALL

### OSX & Linux
1. Install the latest version of [Node.js](https://nodejs.org/en/download/).
2. Install the package:

   ```bash
   npm install -g @sie-js/sie-tool@latest
   ```

### Windows
1. Find and install USB drivers for your phone.
2. Install scoop: https://scoop.sh/
3. Run in PowerShell:
   ```
   scoop bucket add main
   scoop install main/nodejs
   npm install -g @sie-js/sie-tool@latest
   ```

# USAGE

```
Usage: sie-tool [options] [command]

CLI tool for Siemens phones.

Options:
  -v, --version              output the version number
  -p, --port <port>          serial port name (default: "/dev/ttyUSB0")
  -b, --baudrate <baudrate>  limit maximum baudrate (0 - use maximum) (default: "0")
  -V, --verbose              Increase verbosity
  -h, --help                 display help for command

Memory dumper (CGSN):
  memory-read [options]      Read and save phone memory
  memory-read-all [options]  Read and save all available phone memory blocks
  memory-list                List available memory blocks

Screenshotter (BFC):
  screenshot [options]       Make screenshot of phone screen

Boot:
  boot [options]             Boot code to the phone

Commands:
  list-ports                 List available serial ports.
  help [command]             display help for command
```
