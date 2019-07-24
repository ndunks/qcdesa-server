import config from "@/config/config";
import { Router } from "express";

const router = Router();

router.get('/', (req, res) => {
    res.send( config.debug ? config : {
        ok: true
    })
})
export default router;