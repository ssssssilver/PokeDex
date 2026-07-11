export default {
   logger: {
    quiet: false,
    stats: true
  },
  mini: {},
  h5: {
    devServer: {
      proxy: {
        '/api': 'http://127.0.0.1:8787',
        '/assets': 'http://127.0.0.1:8787',
        '/health': 'http://127.0.0.1:8787'
      }
    }
  }
}
