import config from "@/config/config";
import { Router } from "express";
import { existsSync, readFileSync } from "fs";
const dataFile = `${config.data}/data.json`;

const router = Router();
router.get('/list', (req, res) => {
    if( existsSync(dataFile) ){
        res.send( JSON.parse( readFileSync(dataFile, 'utf8') ).map( v => {
            delete v.passcode;
            return v;
        }) );
    }else{
        res.send([])
    }
});
router.get('/', (req, res) => {
    res.send( config.debug ? config : {
        ok: true
    })
})

export default router;