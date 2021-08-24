#!/usr/bin/env node
const {program} = require('commander');
const {version} = require('./package.json');
const markdownToPDF = require('./docbuilder');
const path = require('path');

program.version(version)
       .requiredOption('-i, --input <path>', 'full path to the markdown file to convert.')
       .requiredOption('-o, --output <path>', 'full path to the PDF file to output.')
       .parse();

const options = program.opts();

markdownToPDF(options.input, options.output);
console.log(path.basename(options.input), '->', path.basename(options.output));