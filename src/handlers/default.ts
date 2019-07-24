import config from "@/config/config";

server.get('/', (req, res) => {
    res.send( config.debug ? config : {
        ok: true
    })
})
