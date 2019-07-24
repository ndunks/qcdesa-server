import config from "@/config/config";

// Catch all error handler
server.use((err: Error | string, req, res, next) => {
    if (config.debug) {
        //@ts-ignore
        console.error('API ERROR', err.message);
    }

    (res.headersSent ? res : res.status(err['status'] || 500))
        .send({
            error: err['message'] || err
        })
})

// Page not found handler
server.use((req, res, next) => {
    (res.headersSent ? res : res.status(404))
        .send({
            error: 'Nothing here'
        })
})
