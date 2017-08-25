const path = require('path');

const webpack = require('webpack');

const merge = require('webpack-merge');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlPlugin = require('html-webpack-plugin');
const HtmlIncludeAssetsPlugin = require('html-webpack-include-assets-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const OptimizeCSSPlugin = require('optimize-css-assets-webpack-plugin');
const FriendlyErrorsPlugin = require('friendly-errors-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');
const CleanPlugin = require('clean-webpack-plugin');
const autoPrefix = require('autoprefixer');

const absPath = filename => path.resolve(__dirname, filename);

const cssLoader = (env, type, vue) => {
    const loaders = [{
        loader: 'css-loader',
        options: {
            minimize: env === 'production',
            sourceMap: env !== 'production'
        }
    }];
    if (!vue) {
        loaders.push({
            loader: 'postcss-loader',
            options: {
                sourceMap: env !== 'production',
                plugins: [autoPrefix()]
            }
        });
    }
    if (type && type !== 'css') {
        loaders.push({
            loader: `${type}-loader`,
            options: {
                sourceMap: env !== 'production'
            }
        });
    }
    return env === 'production' ? ExtractTextPlugin.extract({
        use: loaders,
        fallback: `${vue ? 'vue-' : ''}style-loader`
    }) : [`${vue ? 'vue-' : ''}style-loader`].concat(loaders);
};


function getBaseConfig(env) {
    return {

        entry: {
            'agent-center': './src/main.js'
        },

        output: {
            path: absPath('dist')
        },

        module: {
            rules: [{
                test: /\.vue$/,
                loader: 'vue-loader',
                options: {
                    loaders: {
                        css: cssLoader(env, '', true),
                        scss: cssLoader(env, 'sass', true)
                    }
                }
            }, {
                // webpack bug fix
                test: require.resolve('snapsvg'),
                loader: 'imports-loader?this=>window,fix=>module.exports=0'
            }, {
                test: /\.js$/,
                include: absPath('src'),
                loader: 'babel-loader'
            }, {
                test: /\.s?css$/,
                use: cssLoader(env, 'sass')
            }, {
                test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
                loader: env === 'production' ? 'url-loader' : 'file-loader',
                options: {
                    limit: 8192,
                    name: 'img/[name].[hash:8].[ext]'
                }
            }, {
                test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
                loader: 'file-loader',
                options: {
                    name: 'font/[name].[hash:8].[ext]',
                }
            }]
        },

        plugins: [

            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify(env)
                },
            }),

            new CleanPlugin(['dist'], {
                verbose: false,
                dry: false
            })
        ]
    }
}

function getDevelopmentConfig(env) {
    return {
        // development

        devtool: 'source-map',

        output: {
            filename: 'js/[name].js'
        },

        externals: {
            vue: 'Vue',
            vuex: 'Vuex',
            snapsvg: 'Snap',
            axios: 'axios',
            lodash: '_'
        },

        devServer: {
            hot: true,
            quiet: true,
            noInfo: true,
            port: 8080,
            clientLogLevel: "error",
            proxy: {
                '/api': {
                    target: 'http://localhost:8081',
                    secure: false
                }
            }
        },

        watchOptions: {
            ignored: /node_modules/
        },

        plugins: [

            new webpack.optimize.CommonsChunkPlugin({
                name: 'commons',
                minChunks(module) {
                    return module.context && module.context.indexOf('node_modules') !== -1;
                }
            }),

            new webpack.optimize.CommonsChunkPlugin({
                name: 'manifest',
                chunks: ['commons']
            }),

            new HtmlPlugin({
                template: './src/index.html',
                chunksSortMode: 'dependency',
                inject: 'head',
                minify: false
            }),

            new HtmlPlugin({
                template: './src/render.html',
                filename: 'render.html',
                chunksSortMode: 'dependency',
                inject: 'head',
                minify: false
            }),

            new CopyPlugin([
                {from: absPath('src/asserts'), to: absPath('dist/'), ignore: ['.*']},
                {from: 'node_modules/vue/dist/vue.js', to: 'js/vendor/'},
                {from: 'node_modules/vuex/dist/vuex.js', to: 'js/vendor/'},
                {from: 'node_modules/snapsvg/dist/snap.svg.js', to: 'js/vendor/'},
                {from: 'node_modules/lodash/lodash.js', to: 'js/vendor/'},
                {from: 'node_modules/axios/dist/axios.js', to: 'js/vendor/'}
            ]),

            new HtmlIncludeAssetsPlugin({
                assets: [
                    'js/vendor/vue.js',
                    'js/vendor/vuex.js',
                    'js/vendor/snap.svg.js',
                    'js/vendor/lodash.js',
                    'js/vendor/axios.js'
                ],
                append: false
            }),

            new webpack.HotModuleReplacementPlugin(),
            new webpack.NoEmitOnErrorsPlugin(),
            new FriendlyErrorsPlugin()
        ]
    }
}

function getProductionConfig(target) {

    if (!/\bbrowser|module\b/i.test(target)) {
        target = 'module';
    }

    let baseConfig = {
        // production

        devtool: '',

        output: {
            filename: 'js/[name].js',
            chunkFilename: 'js/[id].[chunkhash].js'
        },

        plugins: [

            new OptimizeCSSPlugin({
                cssProcessorOptions: {
                    safe: true
                }
            }),

            new webpack.optimize.CommonsChunkPlugin({
                name: 'commons',
                children: true
            }),

            new webpack.optimize.CommonsChunkPlugin({
                name: 'manifest',
                chunks: ['commons']
            }),

            new webpack.optimize.OccurrenceOrderPlugin()
        ]
    };

    let extraConfig = target === 'browser' ? {

        // web browser

        externals: {
            vue: 'Vue',
            vuex: 'Vuex',
            snapsvg: 'Snap',
            lodash: '_',
            axios: 'axios'
        },

        output: {
            filename: 'js/[name].min.js',
            chunkFilename: 'js/[id].[chunkhash].min.js'
        },

        plugins: [

            new webpack.optimize.UglifyJsPlugin({
                compress: {
                    warnings: false,
                    drop_console: false,
                },
                sourceMap: false
            }),

            new ExtractTextPlugin('css/[name].min.css'),

            new CopyPlugin([
                {from: absPath('src/asserts'), to: absPath('dist/'), ignore: ['.*']},
                {from: 'node_modules/vue/dist/vue.min.js', to: 'js/vendor/'},
                {from: 'node_modules/vuex/dist/vuex.min.js', to: 'js/vendor/'},
                {from: 'node_modules/snapsvg/dist/snap.svg-min.js', to: 'js/vendor/'},
                {from: 'node_modules/lodash/lodash.min.js', to: 'js/vendor/'},
                {from: 'node_modules/axios/dist/axios.min.js', to: 'js/vendor/'}
            ]),

            new HtmlPlugin({
                template: './src/index.html',
                chunksSortMode: 'dependency',
                inject: 'head',
                minify: false
            }),

            new HtmlPlugin({
                template: './src/render.html',
                filename: 'render.html',
                chunksSortMode: 'dependency',
                inject: 'head',
                minify: false
            }),

            new HtmlIncludeAssetsPlugin({
                assets: [
                    'js/vendor/vue.min.js',
                    'js/vendor/vuex.min.js',
                    'js/vendor/snap.svg-min.js',
                    'js/vendor/lodash.min.js',
                    'js/vendor/axios.min.js'
                ],
                append: false
            }),

            new ZipPlugin({
                path: absPath('dist'),
                filename: 'dist.all.zip',
                exclude: [/dist\.all\.zip$/],
            })
        ]

    } : {
        // node module

        output: {
            library: 'AgentCenter',
            libraryTarget: 'umd'
        },

        externals: [
            'snapsvg',
            'vue',
            'vuex',
            'lodash',
            'axios',
            'eve'
        ],

        plugins: [

            new ExtractTextPlugin('css/[name].css'),

            new CopyPlugin([
                {from: absPath('src/asserts'), to: absPath('dist/'), ignore: ['.*']}
            ])
        ]
    };

    return merge(baseConfig, extraConfig);
}


module.exports = env => {
    let target;
    if (!/\bdevelopment|production\b/.test(env)) {
        target = env ? env : 'browser';
        env = 'production';
    } else {
        target = 'browser';
    }
    return merge(getBaseConfig(env), env === 'production' ? getProductionConfig(target) : getDevelopmentConfig(env));
};