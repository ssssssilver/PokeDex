const config = require('./config');

App({
  onLaunch() {
    if (config.useCloudApi && wx.cloud) {
      const options = { traceUser: true };
      if (config.cloudEnv) {
        options.env = config.cloudEnv;
      }
      wx.cloud.init(options);
    }
  },

  globalData: {
    appName: 'PokeChill'
  }
});
