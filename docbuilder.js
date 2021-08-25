const parse5 = require('parse5');
const PDFPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');

const hljs = require('highlight.js');
const md = require('markdown-it')({
    html: false,
    highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return '<pre class="hljs"><code>' +
                    hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                    '</code></pre>';
            } catch (__) { }
        }

        return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
    }
});

// Set to true to generate intermediary debug files.
const DEBUG = false;

function _dStringifyParsed(parsed) {
    let cache = new Set();
    let result = JSON.stringify(parsed, function(_, value) {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                return;
            }
            cache.add(value);
        }
        return value;
    }, 2);
    cache.clear();
    cache = null;
    return result;
}

const { NodeParser } = require('./nodes2dd');
const { styleSheet, defaultStyle, defaultKeywords } = require('./styles');

const fonts = {
    Roboto: {
        normal: path.join(__dirname, 'fonts', 'Roboto', 'Roboto-Regular.ttf'),
        bold: path.join(__dirname, 'fonts', 'Roboto', 'Roboto-Medium.ttf'),
        italics: path.join(__dirname, 'fonts', 'Roboto', 'Roboto-Italic.ttf'),
        bolditalics: path.join(__dirname, 'fonts', 'Roboto', 'Roboto-MediumItalic.ttf')
    },
    UbuntuMono: {
        normal: path.join(__dirname, 'fonts', 'UbuntuMono', 'UbuntuMono-Regular.ttf'),
        bold: path.join(__dirname, 'fonts', 'UbuntuMono', 'UbuntuMono-Bold.ttf'),
        italics: path.join(__dirname, 'fonts', 'UbuntuMono', 'UbuntuMono-Italic.ttf'),
        bolditalics: path.join(__dirname, 'fonts', 'UbuntuMono', 'UbuntuMono-BoldItalic.ttf')
    },
}

function markdownToPDF(inputFile, outputFile, pageSize, pageMargins) {
    pageSize = pageSize || {width: 612, height: 792};
    pageMargins = pageMargins || 36;

    const mdcontent = fs.readFileSync(inputFile, 'utf-8');

    const htmlcontent = md.render(mdcontent);
    if (DEBUG) fs.writeFileSync(path.join(__dirname, 'debug.html'), htmlcontent, 'utf-8');

    const parsedcontent = parse5.parse(htmlcontent);
    if (DEBUG) fs.writeFileSync(path.join(__dirname, 'debug_parsed.json'), _dStringifyParsed(parsedcontent), 'utf-8');

    const nodeParser = new NodeParser({
        mdPath: path.dirname(inputFile),
        pageSize,
        pageMargins,
        styles: styleSheet,
        keywords: defaultKeywords
    });

    const dd = {
        content: nodeParser.parseNodes(parsedcontent.childNodes[0].childNodes[1].childNodes),
        pageSize,
        pageMargins,
        styles: styleSheet,
        defaultStyle
    };

    if (DEBUG) fs.writeFileSync(path.join(__dirname, 'debug_dd.json'), JSON.stringify(dd, null, 2), 'utf-8');

    const printer = new PDFPrinter(fonts)
    const pdfDoc = printer.createPdfKitDocument(dd);
    pdfDoc.pipe(fs.createWriteStream(outputFile));
    pdfDoc.end();
}

module.exports = markdownToPDF;