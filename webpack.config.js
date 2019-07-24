const fs = require("fs");
const { join } = require('path')
const Webpack = require("webpack")

function nodeExternal() {
    var nodeExternal = {};
    var pkg = JSON.parse(fs.readFileSync(join(__dirname, 'package.json'), { encoding: 'utf-8' }));
    // Only devDepencies will be marked as external, we bundled depencies too
    Object.keys(pkg.devDependencies)
        .forEach(function (name) {
            nodeExternal[name] = "require('" + name + "')";
        });

    return nodeExternal;
}

/**
 * @type {Webpack.Configuration}
 */
const configBase = {
    target: 'node',
    mode: "production",
    context: join(__dirname, 'src'),
    entry: "./index.ts",
    output: {
        filename: 'index.js',
        path: join(__dirname, 'dist')
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: [/node_modules/]
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js'],
        alias: {
            '@': join(__dirname, "src")
        }
    },
    externals: nodeExternal()
};

// Config replace if local exists
if (fs.existsSync('src/config/config.local.ts')) {

    /**
     * NOTE: Please always use @/config when importing config in ts file.
     * Avoid using relative path
     */
    configBase.resolve.alias = {
        ...{ '@/config/config': '@/config/config.local' },
        ...configBase.resolve.alias
    }
}
/**
 * @type {Webpack.Configuration}
 */
const configDevelopment = {
    mode: "development",
    output: {
        filename: 'index.js',
        path: join(__dirname, 'build')
    },
    devtool: "cheap-source-map",
}
module.exports = (env, argv) => {
    console.log('WEBPACK MODE', argv.mode);
    if (argv.mode === 'development') {
        return { ...configBase, ...configDevelopment }
    } else {
        return configBase;
    }

};