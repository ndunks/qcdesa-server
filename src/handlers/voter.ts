import config from "@/config/config";
import { existsSync, readFileSync, mkdirSync, constants, openSync, writeFileSync } from "fs";
import { Router } from "express";
import * as WS from "ws";
import { isDate } from "util";

const dataFile = `${config.data}/data.json`;
const router = Router();

function handleWsMessage(){

}
router.post('/check', (req, res) => {
    let index = req.body.id || -1;
    const dataJson = JSON.parse(readFileSync(dataFile, 'utf8'));
    echo("VOTER CHECK", index)
    if (dataJson[index] && req.body && req.body.passcode) {
        res.send({
            valid: req.body.passcode == dataJson[index].passcode
        })
    } else {
        throw { status: 404, message: 'Not valid' };
    }
});

router.ws('/voting/:id', (ws, req) => {
    let index = req.params.id || -1,
        valid = false,
        passcode = req.headers['sec-websocket-protocol'] || '';

    const dataJson = JSON.parse(readFileSync(dataFile, 'utf8'));

    valid = dataJson[index] && passcode == dataJson[index].passcode;


    if (!valid) {
        return ws.close(undefined, 'Invalid');
    }
    try {
        const voteFile = `${config.public_path}/${index}.json`;
        let voteData = existsSync(voteFile) ?
            JSON.parse(readFileSync(voteFile, 'utf8') || '{}') : {};

        const file = openSync(voteFile, constants.O_WRONLY | constants.O_CREAT);
        ws.send("welcome", (err) => {
            if(err){
                echo('WS SEND ERROR', err);
                ws.terminate();
                ws = undefined;
            }
        })
        echo("WS OKKEEEYY");
    } catch (error) {
        echo("WS ERR", error);
        ws.terminate()
        //ws.close(undefined, error.message);
    }

})
module.exports = router;