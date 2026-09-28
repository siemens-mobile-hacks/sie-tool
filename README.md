[![NPM Version](https://img.shields.io/npm/v/%40sie-js%2Fsie-tool)](https://www.npmjs.com/package/@sie-js/sie-tool)

# SUMMARY

A console utility for working with Siemens phones (EGOLD/SGOLD/SGOLD2).

Works on all major operating systems: Linux, macOS, and Windows.

> [!NOTE]
> All these functions are also available from the browser: [Web Tools](https://tools.siepatch.dev).

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

Memory dumper (CGSN/BFB):
  memory-read [options]      Read and save phone memory
  memory-read-all [options]  Read and save all available phone memory blocks
  memory-list [options]      List available memory blocks

Screenshotter (BFC/BFB):
  screenshot [options]       Make screenshot of phone screen

Boot:
  boot [options]             Boot code to the phone

Commands:
  list-ports                 List available serial ports.
  help [command]             display help for command
```

The tool tries to guess the phone protocol automatically. You can also select it explicitly:

```bash
sie-tool memory-list --protocol bfb       # EGOLD
sie-tool memory-list --protocol cgsn      # SGOLD/SGOLD2
sie-tool screenshot --protocol bfb        # EGOLD
sie-tool screenshot --protocol bfc        # SGOLD/SGOLD2
```

# AI-assisted contributions

We are not against AI. We are against vibe coding, AI slop, and attempts to offload engineering work to a model. This project prioritizes quality, not development speed or results at any cost.

1. **Do not use AI-generated text in human-to-human communication.**

   Write comments, discussions, PR descriptions, and responses to reviewers yourself.

2. **Do not let AI submit PRs or commits.**

   The author must always be a human who has personally reviewed the changes and takes responsibility for them.

4. **Do not submit code primarily designed or written by AI.**

   Architecture, algorithms, code organization, and the final implementation must be decided by a human. AI may only be used as an auxiliary tool.

6. **You must understand all the code you submit.**

   You must be able to explain every change, justify your decisions, and fix any problems yourself. If you do not understand the code, open a feature request instead of a PR.

8. **Code must be simple, clear, and tested.**

   Follow KISS, the project's coding style, and its existing architecture. Do not introduce unnecessary abstractions, dependencies, or untested changes.

AI slop PRs will be closed without review.
