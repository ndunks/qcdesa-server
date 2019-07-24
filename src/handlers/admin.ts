import config from "@/config/config";
import { existsSync, readFileSync } from "fs";
const passcodeFile = `${config.data}/passcode`;

server.post('/admin', (req, res) => {
    let valid = false;
    // get passcode file
    if( existsSync(passcodeFile) ) {
        valid = readFileSync(passcodeFile, 'utf8') == req.body.passcode;
    }else{
        // Default is 'barasoft'
        valid = req.body.passcode == 'barasoft';
    }

    res.send({ valid });
})