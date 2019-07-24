/**
 * This config will be loaded on server (production build)
 */
export default {
    debug: true,
    public_path:  `${process.cwd()}/data`,
    public_url:  '/data'
} as Config