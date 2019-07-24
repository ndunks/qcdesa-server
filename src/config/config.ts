/**
 * This config will be loaded on server (production build)
 */
export default {
    host: '127.0.0.1', // listen on local, must be proxied by http
    port: 8888,
    debug: false,
    passcode: 'barasoft',
    data: `${process.cwd()}/data`,
    api_url: '/api',
    public_path: `${process.cwd()}/data/public`,
    public_url: '/api/public'
} as Config
