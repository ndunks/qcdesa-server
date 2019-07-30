/**
 * This config will be loaded on server (production build)
 * For development / local configuration, copy this config
 * as `config.local.ts` and change to fit your local development
 */
export default {
    host: '0.0.0.0',
    port: 8888,
    debug: false,

    /**
     * Passcode can be changed via commandline args:
     * `node index.js --passcode "otherpass"`
     * Note: it a default admin password, and work before `${data}/passcode` file created!
     */
    passcode: 'barasoft',
    data: `${process.cwd()}/data`,
    api_url: '/api',
    public_path: `${process.cwd()}/data/public`,
    public_url: '/api/public'
} as Config
