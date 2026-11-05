const { spawn } = require('child_process');
const path = require('path');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronExe = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
const child = spawn(electronExe, ['.'], {
  cwd: __dirname,
  env,
  stdio: 'inherit'
});

child.on('exit', (code) => console.log('Electron exited with code:', code));
