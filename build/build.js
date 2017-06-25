const path = require('path')
const rollup = require('rollup')
const buble = require('rollup-plugin-buble')

rollup.rollup({
    entry: path.join(__dirname, '../src/index.js'),
    plugins: [buble()]
}).then(bunlde => {
    bunlde.write({
        format: 'umd',
        moduleName: 'Vue',
        dest: path.join(__dirname, '../dist/vue.js'),
        sourceMap: true
    })
    console.log('build done!')
})