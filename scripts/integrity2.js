#!/usr/bin/env node

'use strict'
const axios = require('axios').default
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const sri = require('sri-toolbox')
const files = yaml.load(
    fs.readFileSync(path.join(__dirname, '_files.yml')),
    'utf8',
)

// const { generateSri } = require('../lib/helpers')

const { configFile } = require('./generateFiles')

function buildPath(dir) {
    dir = dir
        .replace('/bootstrap/', '/twitter-bootstrap/')
        .replace('https://cdn.jsdelivr.net/', '')

    return path.join(__dirname, '../cdn', dir)
}

function exists(file) {
    const found = fs.existsSync(file)

    if (!found) {
        console.warn(`WARNING: ${file} not found`)
    }

    return found
}

async function generateSri(file) {
    const getFile = await axios.get(file).then((res) => {
        const sriHash = sri.generate({ algorithms: ['sha384'] }, res.data)
        return sriHash
    })
    return getFile
}

// // Bootswatch {3,4}
// ;['bootswatch3', 'bootswatch4'].forEach((key) => {
//     const bootswatch = buildPath(files[key].bootstrap)

//     files[key].themes.forEach((theme) => {
//         const file = bootswatch
//             .replace('SWATCH_VERSION', files[key].version)
//             .replace('SWATCH_NAME', theme.name)

//         if (exists(file)) {
//             theme.sri = generateSri(file)
//         }
//     })
// })

async function bootswatchSri(bs4 = false) {
    const baseLink = bs4
        ? files.bootswatch4.bootstrap
        : files.bootswatch3.bootstrap
    const themesArr = bs4 ? files.bootswatch4.themes : files.bootswatch3.themes
    const sris = themesArr.map(async (theme) => {
        let axiosLink = bs4
            ? baseLink.replace('SWATCH_VERSION', files.bootswatch4.version)
            : baseLink.replace('SWATCH_VERSION', files.bootswatch3.version)
        axiosLink = axiosLink.replace('SWATCH_NAME', theme.name)
        const remoteFile = await generateSri(axiosLink)
        theme.sri = remoteFile
        //console.log(remoteFile)
        return theme
    })
    return sris
}

// // Bootstrap
async function bootstrapSri() {
    const sris = files.bootstrap.map(async (bootstrap) => {
        const javascript = bootstrap.javascript
        const stylesheet = bootstrap.stylesheet
        let { javascriptBundle, javascriptEsm } = bootstrap

        if (javascript) {
            const remoteJs = await generateSri(javascript)
            bootstrap.javascriptSri = remoteJs
        }

        if (javascriptBundle) {
            const remoteBundle = await generateSri(javascriptBundle)
            bootstrap.javascriptBundleSri = remoteBundle
            //bootstrap.javascriptBundleSri = generateSri(javascriptBundle)
        }

        if (javascriptEsm) {
            const remoteEsm = await generateSri(javascriptEsm)
            bootstrap.javascriptEsmSri = remoteEsm
        }

        if (stylesheet) {
            const remoteCss = await generateSri(stylesheet)
            bootstrap.stylesheetSri = remoteCss
        }

        return bootstrap
    })
    return sris
}

//Font Awesome
async function fontAwesomeSri() {
    const sris = files['font-awesome'].map(async (fontawesome) => {
        const stylesheet = fontawesome.stylesheet
        const version = fontawesome.version
        if (stylesheet) {
            const remoteFile = await generateSri(stylesheet)
            fontawesome.stylesheetSri = remoteFile
            return fontawesome
        }
    })
    return sris
}

// Bootlint
async function bootlintSri() {
    const sris = files.bootlint.map(async (bootlint) => {
        const javascript = bootlint.javascript
        if (javascript) {
            const remoteFile = await generateSri(javascript)
            bootlint.javascriptSri = remoteFile
            return bootlint
        }
    })
    return sris
}

async function main() {
    const faPromises = await fontAwesomeSri()
    const faSri = await Promise.all(faPromises)

    const bootlintPromises = await bootlintSri()
    const blSri = await Promise.all(bootlintPromises)

    const bsPromises = await bootstrapSri()
    const bsSri = await Promise.all(bsPromises)

    const bs3Promises = await bootswatchSri()
    const b3Sri = await Promise.all(bs3Promises)

    const bs4Promises = await bootswatchSri(true)
    const b4Sri = await Promise.all(bs4Promises)

    files['font-awesome'] = faSri
    files.bootlint = blSri
    files.bootstrap = bsSri
    files.bootswatch3.themes = b3Sri
    files.bootswatch4.themes = b4Sri

    //console.log(files)
    //Create backup file
    fs.copyFileSync(configFile, `${configFile}.bak`)

    fs.writeFileSync(
        configFile,
        yaml.dump(files, {
            lineWidth: -1,
        }),
    )
}
main()