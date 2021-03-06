var net = require('net');
var fs = require('fs');
var util = require('util');
var logging = require('./lib/logging'), logger = logging.logger;

var configFile = process.argv[2] || "config/config.json";
logger.info('using '+ configFile + ' as configuration source');
var config = JSON.parse(fs.readFileSync(configFile));
logger = logging.setupLogging(config.debug, config.loggers);

var RedisProxy = require('./lib/redis_proxy');
var redis_proxy = new RedisProxy(config);
var bindAddress = config.bind_address || "127.0.0.1",
    listenPort = config.listen_port || 9999;


var server = net.createServer(function (socket) {
  var id = socket.remoteAddress+':'+socket.remotePort
  logger.debug('client connected ' + id);
  socket.on('end', function() {
    logger.info('client disconnected');
    // Hack to get the connection identifier, so that we can release the connection
    // the usual socket.remoteAddress, socket.remotePort don't seem to work after connection has ended.
    if(this._peername){
      redis_proxy.quit(this._peername.address+':'+this._peername.port);
    }
  });

  socket.on('data', function(data) {
    var command = data.toString('utf8'), id = socket.remoteAddress+':'+socket.remotePort;
    redis_proxy.sendCommand(command, id, function(err, response) {
      if( response) response.unpipe();
      if(err){
        return socket.write("-ERR Error Happened "+ err);
      }
      response.pipe(socket);
    })
  });
});

redis_proxy.watch();

server.listen(listenPort, bindAddress);
logger.info("Redis proxy is listening on " +bindAddress+" : " + listenPort);
