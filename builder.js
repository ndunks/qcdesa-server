#!/usr/bin/env node
/**
 * This is the builder script to make developer life easier
 */
const fs = require("fs");
const cp = require("child_process");

process.argv.mode = process.argv.filter(v => v.indexOf('--mode') === 0 || v.indexOf('--dev') === 0)
    .reduce((i, v) => v.split('=')[1] || 'development', 'production');

const webpack = require('webpack');
const webpackConfig = require('./webpack.config')(process.env, process.argv);


const compiler = webpack(webpackConfig);

if (process.argv.mode == 'production') {
    /**
     * Production build finish here
     */
    compiler.run((err, stats) => {
        if (err) {
            console.error(err);
        } else {
            process.stdout.write(stats.toString({
                chunks: false,  // Makes the build much quieter
                colors: true,    // Shows colors in the console
                version: false,
                hash: false,
                builtAt: false,
                entrypoints: false,
                chunkModules: false,
                modules: false
            }) + "\n");
        }
    })
    return;
}

/**
 * DEVELOPMENT MODE RUNTIME
 */
if (require('os').platform() == 'linux') {
    /**
     * Mount Tmpfs directory for faster build in linux filesystem
     * *require sudo without prompt!*
     */
    if (!fs.existsSync(compiler.outputPath)) {
        fs.mkdirSync(compiler.outputPath);
    }
    const isMounted = fs.readFileSync('/proc/mounts', { encoding: 'utf8' }).indexOf(compiler.outputPath) > 0;
    if (isMounted) {
        console.log("Tmpfs already mounted")
    } else {
        console.log(`Mounting tmpfs on ${compiler.outputPath}`);
        console.log(cp.execSync(`sudo mount -t tmpfs none "${compiler.outputPath}"`).toString())
    }
}

compiler.hooks.beforeCompile.tapAsync('builder.js', (params, next) => {
    process.stdout.write("\n---- Start Building ----\n");
    next()
})
compiler.hooks.afterCompile.tapAsync('builder.js', (params, next) => {
    process.stdout.write("\n---- Done Building ----\n");
    next()
})

let proc;
compiler.watch({
    aggregateTimeout: 500,
}, (err, stats) => {
    if (err) {
        process.stderr.write(err);
    } else {
        process.stdout.write(stats.toString({
            chunks: false,  // Makes the build much quieter
            colors: true,    // Shows colors in the console
            version: false,
            hash: false,
            builtAt: false,
            entrypoints: false,
            chunkModules: false,
            modules: false
        }) + "\n");
        if (proc) {
            proc.kill()
        }

        console.log('-'.repeat(70))
        const jsOutput = `${compiler.outputPath}/${webpackConfig.output.filename}`;
        proc = cp.spawn('node', ['--inspect', jsOutput], {
            stdio: ['ignore', 'inherit', 'inherit'],
        });
    }
})