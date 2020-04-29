'use strict'

const dahua = require('node-dahua-api');
const TelegramBot = require('node-telegram-bot-api');
const winston = require('winston');
const onvif = require('onvif');

const argv = require('yargs')
    .option('bottoken', {
        alias: 't',
        type: 'string',
        description: 'Telegram Bot Token'
      })
      .option('chatid', {
          alias: 'c',
          type: 'string',
          description: 'Telegram conversation to post messages to'
      })
      .option('username', {
        alias: 'u',
        type: 'string',
        description: 'Username to connect to discovered cams'
      })
      .option('password', {
        alias: 'p',
        type: 'string',
        description: 'Password to connect to discovered cams'
      })
    .option('logLevel', {
        alias: 'l',
        type: 'string',
        description: 'Logging level (debug/info/warn/error)'
      })
      .default('logLevel', 'info')
      .demandOption(['bottoken', 'chatid'])
    .argv;

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.simple()
    ),
    transports: [
        new winston.transports.Console()
    ]
});

let bot = new TelegramBot(argv.bottoken);

onvif.Discovery.probe(function(err, cams) {
    // function will be called only after timeout (5 sec by default)
    if (err) { 
        logger.error("Failed to discover cameras: " + err);
        throw err; 
    }
    cams.forEach(function(camInfo) {
        logger.info(`Camera discovered at: ${camInfo.hostname}`);
        
        let cam = new dahua.DahuaCam({
            host: camInfo.hostname,
            port: camInfo.port,
            user: argv.username,
            pass: argv.password
        });
        
        cam.on("alarm", (code, action, index) => {
            if(code === "VideoMotion" && action === "Start") {
                cam.getSnapshot(0)
                .then(buf => {

                    console.log(buf.length);
                

                    bot.sendPhoto(
                        argv.chatid,
                        buf,
                        {}, {
                            filename: `${camInfo.hostname}-snapshot.jpg`,
                            contentType: 'image/jpeg',
                        }
                    )
                    .then(() => logger.debug(`Published to Telegram`))
                    .catch(err => logger.error(err));
                })
                .catch(err => logger.error(err));
            }
        });
    });
});