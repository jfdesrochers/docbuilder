#!/usr/bin/env node
const { program } = require('commander');
const { version } = require('./package.json');
const markdownToPDF = require('./docbuilder');
const path = require('path');
const fs = require('fs');

function walk(dir, ext) {
    let results = [];
    let list = fs.readdirSync(dir);
    for (let item of list) {
        item = path.resolve(dir, item);
        let stat = fs.statSync(item);
        if (stat.isDirectory()) {
            results = results.concat(walk(item, ext));
        } else {
            if (item.endsWith(ext)) results.push(item);
        }
    }
    return results;
}

program.version(version)
    .requiredOption('-i, --input <folder or file>', 'path to the markdown file to convert. If a folder is specified, all markdown files in that folder (and subfolders) will be converted.')
    .option('-o, --output <path>', 'full path to the PDF file to output. If omitted, the PDF file will have the same name and path as the markdown input. If the input is a folder, this argument is ignored.')
    .option('-s, --size <pagesize>', 'sets a custom page size. Specify width,height in points. Example: -s 612,792 for portrait letter.')
    .option('-m, --margins <margins>', 'sets custom margins. Specify all four margins in points, like left,top,right,bottom. Example: -m 36,48,36,48.')
    .option('-z --imgsize <size>', 'sets a maximum size for images. Specify either in points (like -z 300) or in percentage of page size (like -z 50%).')
    .parse();

const options = program.opts();

let pageSize, pageMargins, imgMaxSize;

if (options.size) {
    let size = options.size.split(',');
    if (size.length !== 2) {
        console.error('ERROR: The size argument must be two numbers separated by a comma. Ex.: 612,792');
        process.exit(1);
    }
    pageSize = {width: parseInt(size[0]), height: parseInt(size[1])};
    if (isNaN(pageSize.width) || isNaN(pageSize.height)) {
        console.error('ERROR: The size argument must be two numbers separated by a comma. Ex.: 612,792');
        process.exit(1);
    }
}

if (options.margins) {
    pageMargins = options.margins.split(',');
    if (pageMargins.length !== 4) {
        console.error('ERROR: The margins argument must be four numbers separated by a comma. Ex.: 36,48,36,48');
        process.exit(1);
    }
    for (let i = 0; i < pageMargins.length; i++) {
        pageMargins[i] = parseInt(pageMargins[i]);
        if (isNaN(pageMargins[i])) {
            console.error('ERROR: The margins argument must be four numbers separated by a comma. Ex.: 36,48,36,48');
            process.exit(1);
        }
    }
}

if (options.imgsize) {
    let isPercent = false;
    if (options.imgsize.endsWith('%')) {
        isPercent = true;
        options.imgsize = options.imgsize.slice(0, options.imgsize.length - 1);
    }
    imgMaxSize = parseInt(options.imgsize);
    if (isNaN(imgMaxSize)) {
        console.error('ERROR: The imgsize argument must be a valid number or percentage. Ex.: 300 or 50%');
        process.exit(1);
    }
    if (isPercent) {
        if (imgMaxSize >= 100) {
            console.error('ERROR: The imgsize must be less than 100%.');
            process.exit(1);
        }
        imgMaxSize = imgMaxSize / 100;
    }
}

try {
    let info = fs.statSync(options.input, {throwIfNoEntry: false});
    if (!info) {
        console.error('ERROR: The input file or directory entered is invalid.');
        process.exit(1);
    }
    if (info.isDirectory()) {
        let items = walk(options.input, '.md');
        for (let item of items) {
            let output = item.replace(/\.md$/, '.pdf');
            markdownToPDF(item, output, pageSize, pageMargins, imgMaxSize);
            console.log(path.basename(item), '->', path.basename(output));
        }
    } else {
        let output;
        if (options.output) {
            let stat = fs.statSync(options.output, {throwIfNoEntry: false});
            if (stat && !stat.isDirectory()) {
                output = options.output;
            }
        }
        output = output || options.input.replace(/\.md$/, '.pdf');
        markdownToPDF(options.input, output, pageSize, pageMargins, imgMaxSize);
        console.log(path.basename(options.input), '->', path.basename(output));
    }
} catch (err) {
    console.error('An error occured', err);
    process.exit(1);
}