declare interface Config {

    /**
     * API Server listen IP, may be localhost or all interface 0.0.0.0
     */
    host: string

    /**
     * API Server listen port, this port may be proxied via Nginx
     */
    port: number

    /**
     * If true, verbose message will displayed
     */
    debug: boolean

    /**
     * Default passcode
     */
    passcode: string

    /**
     * Data directory
     * 
     * default is in `${process.pwd()}/data`
     */
    data: string

    /**
     * Location of Local path to store accessible data from public
     * this location can be exposed directly in HTTP Server nginx/apache
     * 
     * location ^ /data {
     *  alias {server_dir}/data/public
     * }
     * 
     * default is {data}/public
     */
    public_path: string

    /**
     * Accessible public_path via Web Browser on client, 
     * depend on how you configured the HTTP Server
     * 
     * default is `/public`
     */
    public_url: string

    /**
     * Prefixed API Url
     */
    api_url: string
}

declare namespace NodeJS {
    interface Global {
        echo(...args): void
    }
}