const path = require('path');
const {getInfofromJPEGfile, getInfofromPNGfile, convertImageDimsForPrint} = require('./imgtools');

class NodeParser {
    constructor (mdPath, pageSize, pageMargins) {
        this.mdPath = mdPath || '';
        this.pageWidth = pageSize.width;
        this.pageHeight = pageSize.height;
        if (Array.isArray(pageMargins)) {
            if (pageMargins.length === 4) {
                this.marginLeft = pageMargins[0];
                this.marginTop = pageMargins[1];
                this.marginRight = pageMargins[2];
                this.marginBottom = pageMargins[3];
            } else if (pageMargins.length === 2) {
                this.marginLeft = pageMargins[0];
                this.marginTop = pageMargins[1];
                this.marginRight = pageMargins[0];
                this.marginBottom = pageMargins[1];
            }
        } else {
            if (isNaN(pageMargins)) pageMargins = 0;
            this.marginLeft = pageMargins;
            this.marginTop = pageMargins;
            this.marginRight = pageMargins;
            this.marginBottom = pageMargins;
        }
    }

    parseText(node) {
        if (node.value === '\n') {
            if (node.parentNode.nodeName === 'pre' || node.parentNode.nodeName === 'code') {
                return node.value;
            } else {
                return '';
            }
        } else {
            return node.value;
        }
    }

    parseTag(node) {
        let tag = null;
        switch (node.nodeName) {
            case '#text':
                tag = this.parseText(node);
                break;

            case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
                if (!node.childNodes) break;
                tag = { text: this.parseNodes(node.childNodes), style: ['heading', node.nodeName] };
                break;

            case 'p':
                if (!node.childNodes) break;

                // Okay, so PDFMake has a limitation that we can't have inline images.
                // So we check if our child nodes contain images.
                const imgIndexes = [];
                for (let i = 0; i < node.childNodes.length; i++) {
                    if (node.childNodes[i].nodeName === 'img') imgIndexes.push(i);
                }

                if (imgIndexes.length > 0) {
                    // We have inline images. So we pull them out and split the paragraph
                    // in multiple smaller paragraphs so that we may insert the images in
                    // between. It will look like crap, but at least it will work.
                    tag = [];
                    let currentIdx = 0;
                    for (let i of imgIndexes) {
                        if (i > currentIdx)
                            tag.push({ text: this.parseNodes(node.childNodes.slice(currentIdx, i)), style: 'paragraph' });
                        tag.push(this.parseTag(node.childNodes[i]));
                        currentIdx = i + 1;
                    }
                    if (currentIdx < node.childNodes.length) {
                        tag.push({ text: this.parseNodes(node.childNodes.slice(currentIdx, node.childNodes.length)), style: 'paragraph' });
                    }
                } else {
                    // We don't have inline images. Carry-on with the program.
                    if (['li', 'blockquote'].indexOf(node.parentNode.nodeName) > -1) {
                        // Don't put paragraph styling inside some other elements.
                        tag = { text: this.parseNodes(node.childNodes) };
                    } else {
                        tag = { text: this.parseNodes(node.childNodes), style: 'paragraph' };
                    }
                }
                break;

            case 'strong': case 'b':
                if (!node.childNodes) break;
                tag = { text: this.parseNodes(node.childNodes), bold: true };
                break;

            case 'em': case 'i':
                if (!node.childNodes) break;
                tag = { text: this.parseNodes(node.childNodes), italics: true };
                break;

            case 'pre':
                if (!node.childNodes) break;
                tag = {
                    table: {
                        widths: ['*'],
                        body: [this.parseNodes(node.childNodes)]
                    },
                    layout: {
                        paddingLeft: () => 4,
                        paddingRight: () => 4,
                        paddingTop: () => 4,
                        paddingBottom: () => 4,
                        defaultBorder: false
                    },
                    style: 'preformatted'
                }
                break;

            case 'span':
                if (!node.childNodes) break;
                let codeClass = '';
                for (let attr of node.attrs) {
                    if (attr.name === 'class') {
                        let classNames = attr.value;
                        classNames.split(' ').forEach((c) => {
                            if (c.startsWith('hljs-')) {
                                codeClass = c.slice(5, c.length);
                            }
                        });
                        break;
                    }
                }

                if (codeClass) {
                    tag = { text: this.parseNodes(node.childNodes), style: this.parseCodeStyle(codeClass) }
                } else {
                    tag = { text: this.parseNodes(node.childNodes) }
                }

                break;

            case 'code':
                if (!node.childNodes) break;
                if (node.parentNode.nodeName === 'pre') {
                    tag = { text: this.parseNodes(node.childNodes), style: ['code', 'preCode'] };
                } else {
                    tag = { text: this.parseNodes(node.childNodes), style: ['code', 'inlineCode'] };
                }
                break;

            case 'blockquote':
                if (!node.childNodes) break;
                tag = {
                    table: {
                        widths: ['*'],
                        body: [[this.parseNodes(node.childNodes)]]
                    },
                    layout: {
                        vLineWidth: (i) => (i === 0 ? 3 : 0),
                        hLineWidth: () => 0,
                        vLineColor: () => '#005cc5',
                        paddingLeft: () => 6,
                        paddingRight: () => 4,
                        paddingTop: () => 4,
                        paddingBottom: () => 0
                    },
                    style: 'blockquote'
                }
                break;

            case 'a':
                if (!node.childNodes) break;
                let href = '';
                for (let attr of node.attrs) {
                    if (attr.name === 'href') {
                        href = attr.value;
                        break;
                    }
                }
                tag = { text: this.parseNodes(node.childNodes), link: href, style: 'link' };
                break;

            case 'ul': case 'ol':
                if (!node.childNodes) break;
                const li = [];
                for (let child of node.childNodes) {
                    if (child.nodeName === 'li') {
                        li.push(this.parseNodes(child.childNodes));
                    }
                }
                if (!li.length) break;
                tag = {};
                tag[node.nodeName === 'ul' ? 'ul' : 'ol'] = li;
                break;

            case 'hr':
                tag = {
                    table: {
                        widths: ['*'],
                        body: [[''], ['']]
                    },
                    layout: {
                        hLineWidth: (i, node) => ((i === 0 || i === node.table.body.length) ? 0 : 1),
                        vLineWidth: () => 0,
                        hLineColor: () => '#d1d1d1'
                    },
                    marginBottom: 8
                };
                break;

            case 'table':
                let head, body;
                for (let child of node.childNodes) {
                    if (child.nodeName === 'thead') {
                        for (let hd of child.childNodes) {
                            if (hd.nodeName === 'tr') {
                                head = hd.childNodes;
                                break;
                            }
                        }
                    } else if (child.nodeName === 'tbody') {
                        body = child.childNodes;
                    }
                }
                if (!head || !body) break;

                const computeAlignment = (node, style) => {
                    for (let attr of node.attrs) {
                        if (attr.name === 'style' && attr.value.startsWith('text-align:')) {
                            let align = attr.value.slice(11, attr.value.length).trim().toLowerCase();
                            if (align === 'center')
                                style.push('alignCenter')
                            else if (align === 'right')
                                style.push('alignRight')
                            break;
                        }
                    }
                }

                const headerLine = head.filter(f => f.nodeName === 'th').map(th => {
                    const style = ['tableHeader'];
                    computeAlignment(th, style);
                    return {text: this.parseNodes(th.childNodes), style};
                });
                if (!headerLine || headerLine.length === 0) break;

                const dataRows = body.filter(f => f.nodeName === 'tr').map(tr => tr.childNodes.filter(f => f.nodeName === 'td').map(td => {
                    const style = [];
                    computeAlignment(td, style);
                    if (style.length)
                        return {text: this.parseNodes(td.childNodes), style};
                    else
                        return this.parseNodes(td.childNodes);
                }));
                if (!dataRows || dataRows.length === 0) break;

                const dataArray = [headerLine, ...dataRows];
                tag = {
                    table: {
                        widths: Array.from({length: headerLine.length}, () => 'auto'),
                        body: dataArray,
                        headerRows: 1
                    },
                    layout: 'lightHorizontalLines',
                    style: 'table'
                };
                break;

            case 'img':
                let src, alt;
                for (let attr of node.attrs) {
                    if (attr.name === 'src') src = attr.value;
                    if (attr.name === 'alt') alt = attr.value;
                }
                if (!src) break;

                const rejectImage = () => {
                    // If we have an 'alt' attribute, we show that instead
                    if (alt) {
                        tag = {
                            table: {
                                widths: ['auto'],
                                body: [[alt]]
                            },
                            style: 'table'
                        }
                    }
                };

                // We do not accept http/https/file/etc. urls at this time.
                if (/^\w+:\/\//.test(src)) {
                    console.error(`ERROR: We cannot accept image URLs at this time. [${src}]`);
                    rejectImage();
                    break;
                }

                // We also reject images if no markdown path is specified (cannot make absolute path).
                if (!this.mdPath) {
                    console.error('ERROR: No base path for images was specified.');
                    rejectImage();
                    break;
                }

                // Remove leading slash, if any, and resolve the complete path.
                src = src.replace(/^\//, '');
                src = path.resolve(src);

                let imgWidth, imgHeight, imgDPI;

                try {
                    if (src.toLowerCase().endsWith('.jpg') || src.toLowerCase().endsWith('.jpeg')) {
                        [imgWidth, imgHeight, imgDPI] = getInfofromJPEGfile(src);
                    } else if (src.toLowerCase().endsWith('.png')) {
                        [imgWidth, imgHeight, imgDPI] = getInfofromPNGfile(src);
                    } else {
                        console.error(`ERROR: Image file format is wrong, expected JPEG or PNG. [${src}]`);
                        rejectImage();
                        break;
                    }
                } catch (err) {
                    console.error(err);
                    rejectImage();
                    break;
                }

                if (isNaN(imgWidth) || isNaN(imgHeight) || isNaN(imgDPI)) {
                    console.error(`ERROR: Could not read the picture's dimensions. [${imgWidth}, ${imgHeight}, ${imgDPI}]`);
                    rejectImage();
                    break;
                }

                [imgWidth, imgHeight] = convertImageDimsForPrint(imgWidth, imgHeight, imgDPI);

                let fitDims = Math.min(imgWidth, this.pageWidth - this.marginLeft - this.marginRight);

                if (alt) {
                    tag = [
                        {image: src, fit: [fitDims, fitDims]},
                        {
                            table: {
                                widths: ['auto'],
                                body: [[alt]]
                            },
                            style: 'imageAlt',
                            layout: 'noBorders'
                        }
                    ];
                } else {
                    tag = {image: src, style: 'image'};
                }
                break;
        }
        return tag;
    }

    parseCodeStyle(codeClass) {
        switch (codeClass) {
            case 'doctag':
            case 'keyword':
            case 'template-tag':
            case 'template-variable':
            case 'type':
                return 'codeKeyword';
            case 'title':
                return 'codeTitle';
            case 'attr':
            case 'attribute':
            case 'literal':
            case 'meta':
            case 'number':
            case 'operator':
            case 'variable':
            case 'selector-attr':
            case 'selector-class':
            case 'selector-id':
                return 'codeVariable';
            case 'regexp':
            case 'string':
                return 'codeString';
            case 'built_in':
            case 'symbol':
                return 'codeSymbol';
            case 'comment':
            case 'code':
            case 'formula':
                return 'codeComment';
            case 'name':
            case 'quote':
            case 'selector-tag':
            case 'selector-pseudo':
                return 'codeName';
            case 'subst':
                return 'codeSubst';
            case 'section':
                return 'codeSection';
            case 'bullet':
                return 'codeBullet';
            case 'emphasis':
                return 'codeEmphasis';
            case 'strong':
                return 'codeStrong';
            case 'addition':
                return 'codeAddition';
            case 'deletion':
                return 'codeDeletion';
            default:
                return '';
        }
    }

    parseNodes(nodeList) {
        let results;
        if (nodeList.length === 1 && nodeList[0].nodeName === '#text') {
            results = this.parseText(nodeList[0]);
        } else {
            results = [];
            for (let node of nodeList) {
                const tag = this.parseTag(node);
                if (tag) results.push(tag);
            }
        }
        return results;
    }
}

module.exports = { NodeParser };