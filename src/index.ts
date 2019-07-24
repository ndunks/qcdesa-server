import config from "./config/config";

import { existsSync } from "fs";
if( ! existsSync(config.public_path ) ){
    console.error('Storage is not exist or not accessible', config.public_path)
    process.exit(1);
}

declare global {
    function echo(...args): void
}

/** Wrap console log */
global.echo = (...args) => {
    config.debug && console.log(...args)
}

console.debug("Mode %s, Loaded config %s", process.env.NODE_ENV, config);

