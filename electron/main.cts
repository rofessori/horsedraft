import { app, BrowserWindow, Menu, shell } from "electron";
import path from "node:path";

// This file is CommonJS (.cts -> .cjs) on purpose: package.json has "type": "module" for Vite and the
// scripts, but Electron's main process loads its entry with require(), so the shell must stay CJS.

// Loads the Vite build from disk in production, or the Vite dev server when HORSEDRAFT_DEV_URL is set.
const DEV_URL = process.env.HORSEDRAFT_DEV_URL;
// Automation hooks: keep the remembered setup (localStorage) in a separate profile directory, and
// open the window without taking keyboard focus so a test run never swallows what the developer types.
const USER_DATA = process.env.HORSEDRAFT_USER_DATA;
const INACTIVE = process.env.HORSEDRAFT_INACTIVE === "1";
if (USER_DATA) app.setPath("userData", path.resolve(USER_DATA));

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    title: "HorseDraft",
    backgroundColor: "#8a5a2b",
    show: !INACTIVE,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (INACTIVE) win.once("ready-to-show", () => win.showInactive());
  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: "appMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [{ role: "togglefullscreen" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "toggleDevTools" }],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

void app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
