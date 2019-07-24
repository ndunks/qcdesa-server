import config from "@/config/config";
import { existsSync, readFileSync, mkdirSync, createWriteStream, openSync, writeFileSync } from "fs";
import { Router, Request } from "express";

const dataFile = `${config.data}/data.json`;

const router = Router();
router.post('/check', (req, res) => {
    let index = req.body.id || -1;
    const dataJson = JSON.parse( readFileSync(dataFile, 'utf8') );
    if( dataJson[ index ] && req.body && req.body.passcode ){
        res.send({
          valid: req.body.passcode == dataJson[ index ].passcode
        })
    }else{
        throw {status: 404, message: 'Not valid'};
    }
});

export default router;