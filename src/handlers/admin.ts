import config from "@/config/config";
import { existsSync, readFileSync, mkdirSync, createWriteStream, writeFileSync } from "fs";
import { Router, Request } from "express";
import { extname } from "path";
import { Response } from "express-serve-static-core";
const passcodeFile = `${config.data}/passcode`;
const dataFile = `${config.public_path}/data.json`;
const dataPasscodeFile = `${config.data}/passcode.data.json`;
const router = Router();

function checkPasscode(req: Request) {
    let value: string | null = null;
    // First, check on header
    if (req.headers['authorization'] && req.headers.authorization.match(/^passcode\s/i)) {
        value = req.headers.authorization.match(/^passcode\s(.+)$/i)[1];
    } else if (typeof (req.body) == 'object' && req.body.passcode) {
        // fallback get from request body
        value = req.body.passcode;
    }
    if (existsSync(passcodeFile)) {
        return readFileSync(passcodeFile, 'utf8') == value;
    } else {
        // Default is passcode
        return value == config.passcode;
    }
}
// Store file in 2 locations
function updateData(data: any[]) {
    const passcodes = existsSync(dataPasscodeFile) ?
        JSON.parse(readFileSync(dataPasscodeFile, 'utf8')) : [];

    // Remove passcode, store on private data dir
    data.forEach((v, i) => {
        if (typeof (passcodes[i]) == 'undefined') {
            passcodes[i] = [];
        }
        if (v.locations) {
            v.locations.forEach((vv, ii) => {
                if (vv) {
                    passcodes[i][ii] = vv.passcode || passcodes[i][ii] || '';
                    delete vv.passcode;
                } else {
                    echo('Skip empty object location', vv);
                }
            })
        }
    });

    writeFileSync(dataFile, JSON.stringify(data));
    // Writes passcode in private dir
    writeFileSync(dataPasscodeFile, JSON.stringify(passcodes));
}

router.get('/quickcount', (req, res, next) => {

    if (!checkPasscode(req)) {
        return next({ status: 403, message: 'Forbiden' })
    }
    if (existsSync(dataFile)) {
        res.sendFile(dataFile);
    } else {
        res.send([])
    }
})

router.put('/quickcount', (req, res, next) => {
    if (!checkPasscode(req)) {
        return next({ status: 403, message: 'Forbiden' })
    }
    if (!req.body || !req.body.name) {
        return next({ status: 401, message: 'Tidak lengkap' })
    }
    let dataJson = [];
    if (existsSync(dataFile)) {
        dataJson = JSON.parse(readFileSync(dataFile, 'utf8'));
    }
    dataJson.push(req.body);
    updateData(dataJson);
    res.send({ ok: true });
})

router.patch('/quickcount/:index', (req, res, next) => {
    if (!checkPasscode(req)) {
        return next({ status: 403, message: 'Forbiden' })
    }
    if (!req.body || !Object.keys(req.body).length) {
        return next({ status: 401, message: 'Tidak lengkap' })
    }
    let index = req.params.index || -1;
    let dataJson = [];
    if (existsSync(dataFile)) {
        dataJson = JSON.parse(readFileSync(dataFile, 'utf8'));
    }
    if (!dataJson[index]) {
        return next({ status: 404, message: 'Tidak ditemukan' })
    }
    dataJson[index] = { ...dataJson[index], ...req.body };
    updateData(dataJson);
    res.send({ ok: true });
})

router.post('/', (req, res) => {
    echo('Check login admin');
    let valid = checkPasscode(req);
    res.send({ valid });
})

function handleFileUpload(req: Request, res: Response, next: Function) {
    if (!checkPasscode(req)) {
        return next({ status: 403, message: 'Forbiden' })
    }
    echo('File Handle', req.params);
    const ext = extname(req.params.name || 'image.png')
    const dir = 'image';
    const fileDir = `${config.public_path}/${dir}`;
    // Generate filename
    const filename = `${Date.now().toString(36)}${ext}`;
    const fileDest = `${fileDir}/${filename}`;
    const url = `${config.public_url}/${dir}/${filename}`;
    try {
        if (!existsSync(fileDir)) {
            mkdirSync(fileDir, { recursive: true });
        }
        const f = createWriteStream(fileDest, {
            autoClose: true
        });
        f.once('close', () => {
            res.send({
                url,
                size: f.bytesWritten
            })
        })
        req.pipe(f);
    } catch (error) {
        return next(error)
    }
}

router.put('/upload/:name', handleFileUpload)
router.post('/upload/:name', handleFileUpload)

export default router;