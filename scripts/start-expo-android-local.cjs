const { spawn, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { homedir } = require('node:os');
const { join } = require('node:path');

const sdkLocations = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
  process.platform === 'win32' && process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
    : process.platform === 'darwin' ? join(homedir(), 'Library', 'Android', 'sdk') : join(homedir(), 'Android', 'Sdk')];
const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';
const adb = sdkLocations.filter(Boolean).map((sdk) => join(sdk, 'platform-tools', adbName)).find(existsSync) ?? adbName;
const apiPort = '5185';
const apiTunnel = `tcp:${apiPort}`;
const reverse = spawnSync(adb, ['-e', 'reverse', apiTunnel, apiTunnel], { stdio: 'inherit' });
if (reverse.status !== 0) {
  console.error('No se pudo conectar la API local. Abre el emulador de Android Studio y vuelve a ejecutar el comando.');
  process.exit(1);
}

const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'start', '--go', '--localhost', '--port', '8082', '--android', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_OFFLINE: '1', EFACT_EXPO_ANDROID_LOCAL: '1', EXPO_PUBLIC_API_BASE_URL: `http://localhost:${apiPort}` },
});

child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
