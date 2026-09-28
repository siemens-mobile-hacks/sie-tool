import { sprintf } from "sprintf-js";
import { SerialPort } from "serialport";
import { getUSBDeviceName } from "@sie-js/serial";
import type { CLIBaseOptions } from "#src/cli.js";
import type { AppCommand } from "#src/utils/command.js";

export const cliListSerialPorts: AppCommand<CLIBaseOptions> = async (options) => {
	for (const port of await SerialPort.list()) {
		if (port.productId == null)
			continue;
		const vid = parseInt(port.vendorId!, 16);
		const pid = parseInt(port.productId, 16);
		const usbName = getUSBDeviceName(vid, pid);
		const selected = port.path === options.port ? " <-- selected" : "";
		console.log(sprintf("%s %04x:%04x %s%s", port.path, vid, pid, usbName ?? port.manufacturer, selected));
	}
}
