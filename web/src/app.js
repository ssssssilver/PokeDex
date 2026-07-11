import withWeapp, { cacheOptions } from "@tarojs/with-weapp";
import { Block } from "@tarojs/components";
import React from "react";
import Taro from "@tarojs/taro";
const config = require("./config.js");
import "./app.scss";
cacheOptions.setOptionsToCache({
  onLaunch() {
    if (config.useCloudApi && Taro.cloud) {
      const options = {
        traceUser: true
      };
      if (config.cloudEnv) {
        options.env = config.cloudEnv;
      }
      Taro.cloud.init(options);
    }
  },
  globalData: {
    appName: 'PokeChill'
  }
});
@withWeapp(cacheOptions.getOptionsFromCache(), true)
class App extends React.Component {
  render() {
    return this.props.children;
  }
}
export default App;