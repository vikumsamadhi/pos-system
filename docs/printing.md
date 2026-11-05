# Receipts and printing

## What is implemented

- `electron/printing/escpos.ts` builds a complete ESC/POS byte stream for an
  80 mm (48 column) printer:
  - `ESC @` init, code page 437/PC437 selection
  - store header, address, phone, cashier, receipt no, timestamp
  - item lines with quantity and line total, wrapping long names
  - subtotal, discount, tax, double-width/height total, cash, change
  - footer text, feed, `GS V` full cut, drawer kick (`ESC p 0 25 250`)
- `buildReceiptHtml` renders the same content as an HTML page with
  `@page { size: 80mm auto; margin: 0 }` for on-screen preview and PDF/print
  through a normal driver.
- After each sale the renderer can:
  - **Print receipt** → passes the base64 bytes to `receipt:print`
  - **Preview & save** → loads the HTML into an iframe and writes it to
    `<userData>/receipts/<receipt-no>.html`

## What is not implemented yet

`receipt:print` currently returns an honest result:

- no `printer_name` in settings → `printed: false` with the byte count
- a printer configured → `printed: false` explaining that raw device output is
  not wired yet

It does not pretend to print. Do not mark printing as done until a real printer
proves it.

## Wiring the real printer (next step)

Pick one path once the hardware is known:

1. **Windows driver, HTML path** — install the vendor driver, set
   `printer_name`, then print the receipt HTML with
   `webContents.print({ silent: true, deviceName, printBackground: true })`
   from a hidden `BrowserWindow`. Works with any installed 80 mm printer.
2. **Raw ESC/POS over USB** — use a library such as `node-thermal-printer` or
   write to the Windows printer share with `copy /b file \\localhost\share`.
   Needed for drawer kick and cut when the driver mangles the stream.
3. **Network printer (Ethernet/Wi-Fi)** — raw socket to port 9100:

   ```ts
   const socket = net.connect(9100, printerHost)
   socket.write(bytes)
   socket.end()
   ```

   This is the simplest path when the printer has an IP address.

Record the chosen printer model, connection and driver in this file when known.

## Test without hardware

- Compare byte output against `ESC/POS` references (init `1B 40`, cut `1D 56 00`).
- Open the saved HTML receipt in a browser with print preview at 80 mm.
- Send the bytes to a virtual serial port or a file and inspect them with a hex
  viewer.
