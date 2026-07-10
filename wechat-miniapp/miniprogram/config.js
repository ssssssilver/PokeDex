const defaults = {
  appVersion: '1.0.0',
  cloudEnv: '',
  useCloudApi: false,
  useRemoteApi: false,
  useStaticApi: false,
  apiBaseUrl: '',
  staticBaseUrl: '',
  requestTimeoutMs: 10000,
  pageSize: 30
};

let local = {};
try {
  local = require('./config.local');
} catch (error) {
  local = {};
}

module.exports = Object.assign({}, defaults, local);
