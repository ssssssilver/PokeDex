const defaults = {
  appVersion: '1.0.0',
  cloudEnv: '',
  useCloudApi: false,
  useRemoteApi: false,
  useStaticApi: true,
  apiBaseUrl: '',
  staticBaseUrl:
    'https://yilian-upload-prod-oss-bucket.oss-cn-shenzhen.aliyuncs.com/Server/pokechill',
  requestTimeoutMs: 10000,
  pageSize: 30,
}
let local = {}
try {
  local = require('./config.local.js')
} catch (error) {
  local = {}
}
module.exports = Object.assign({}, defaults, local)
