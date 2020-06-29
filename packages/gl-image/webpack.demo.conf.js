const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  devtool: 'none',
  devServer: {
      clientLogLevel: 'warning',
      hot: true,
      contentBase: path.join(__dirname, "./demo"), 
      compress: true,
      host: '0.0.0.0',
      port: 8081,
      // useLocalIp: true,
      open: true,
      overlay: { 
          warnings: false, 
          errors: true 
      }
  },
  plugins: [
      new HtmlWebpackPlugin({
        title: 'tfjs blazeface model demo',
        inject: 'body',
        template: path.join(__dirname, './demo/index.html'),
      }),
      new webpack.HotModuleReplacementPlugin()
  ],
  context: path.resolve(__dirname),
  entry: {
    'demo': path.resolve(__dirname, './demo/index.ts'),
  },
  output: {
      path: path.resolve(__dirname, './dist'),
      filename: '[name].js',
      publicPath: '/'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          include: [
            path.resolve(__dirname, './demo'),
            path.resolve(__dirname, './src')          
          ],
          use: [
            {
              loader: 'babel-loader',
            }
          ]
        },
        {
          test: /\.(ts|tsx)$/,
          include: [
            path.resolve(__dirname, './demo'),
            path.resolve(__dirname, './src')          
          ],
          use: [
            {
              loader: 'babel-loader',
            },
            {
              loader: 'ts-loader',
            }
          ]
        },
        {
          test: /\.less$/,
          use: [
            {
              loader: 'style-loader',
            },
            {
              loader: 'css-loader',
            },
            {
              loader: 'less-loader',
              options: {
                javascriptEnabled: true,
              }
            }
          ]
        },
        {
          test: /\.(png|jpg)$/,
          use: [
            {
              loader: 'url-loader',
            }
          ]
        }
      ]
  },
  node: {
    setImmediate: false,
    dgram: 'empty',
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    child_process: 'empty',
    path: 'empty',
  }
}
