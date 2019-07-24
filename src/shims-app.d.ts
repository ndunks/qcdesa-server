declare interface Config {

    /**
     * If true, verbose message will displayed
     */
    debug: boolean

    /**
     * Location of Local path to store accessible data from public
     * this location must be exposed in HTTP Server nginx/apache
     */
    public_path: string

    /**
     * Accessible public_path via Web Browser on client, 
     * depend on how you configured the HTTP Server
     */
    public_url: string
}

declare namespace NodeJS {
    interface Global {
        echo(...args): void
    }
}