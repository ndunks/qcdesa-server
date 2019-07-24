import * as express from "express";
import * as fs from "fs";
import config from "@/config/config";

declare global {
    function echo(...args): void
}

if( ! fs.existsSync(config.data) ){
    fs.mkdirSync(config.data, {recursive: true});
    if(!fs.existsSync(config.public_path)){
        fs.mkdirSync(config.public_path, {recursive: true});
    }
}
if( ! fs.existsSync(config.public_path) ){
    console.error('Public Storage is not exist or not accessible', config.public_path)
    process.exit(1);
}
try {
    fs.accessSync( config.data, fs.constants.W_OK );
    fs.accessSync( config.public_path, fs.constants.W_OK );
} catch (error) {
    console.error(error.message);
    process.exit(1)
}


/** Overide config property from command arguments */
process.argv.reduce( ( param , current, index, array) => {
    if( param.length ){
        config[param] = current;
        return '';
    }
    return current[0] == '-' ? current.replace(/^-+/,'') : ''
}, '' )

/** Wrap console log */
global.echo = (...args) => {
    config.debug && console.log(...args)
}
const server = express();
const router = express.Router();
const expresw= require("express-ws")(server);

console.debug("Mode %s, Loaded config %s", process.env.NODE_ENV, config);

/** Setup JSON Parser */
server.use(express.json())

/** Serve Static files */
server.use([config.public_url, '/public'], express.static(config.public_path))

/** Load all handlers */
router.use('/', require('@/handlers/default') );
router.use('/admin', require('@/handlers/admin') );
router.use('/voter', require('@/handlers/voter') );

/** Error handler */

// Catch all error handler
router.use((err: Error | string, req, res, next) => {
    //@ts-ignore
    echo('API ERROR', err.message);

    (res.headersSent ? res : res.status(err['status'] || 500))
        .send({
            error: err['message'] || err
        })
})

// Page not found handler
router.use((req, res, next) => {
    echo('API NOTFOUND', req.url);
    (res.headersSent ? res : res.status(404))
        .send({
            error: 'Nothing here'
        })
})



server.use(config.api_url, router);


server.listen(config.port, config.host,  () => echo('Api Listening on', `http://${config.host}:${config.port}/`) )
