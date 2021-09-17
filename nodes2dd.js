const path = require('path');
const { getInfofromJPEGfile, getInfofromPNGfile, convertImageDimsForPrint } = require('./imgtools');

class NodeParser {
    constructor({ mdPath, pageSize, pageMargins, styles, keywords, imgMaxSize }) {
        this.mdPath = mdPath || '';
        this.pageWidth = pageSize.width;
        this.pageHeight = pageSize.height;
        this.styles = styles;
        this.keywords = keywords;
        this.imgMaxSize = imgMaxSize;
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

    parseHeading(node) {
        if (!node.childNodes) return '';
        return { text: this.parseNodes(node.childNodes), style: ['heading', node.nodeName] };
    }

    parseParagraph(node) {
        if (!node.childNodes) return '';

        // Okay, so PDFMake has a limitation that we can't have inline images.
        // To get around this, we first check if our child nodes contain images.
        const imgIndexes = [];
        for (let i = 0; i < node.childNodes.length; i++) {
            if (node.childNodes[i].nodeName === 'img') imgIndexes.push(i);
        }

        let tag;

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
            if (['blockquote'].indexOf(node.parentNode.nodeName) > -1) {
                // Don't put paragraph styling inside some other elements.
                tag = { text: this.parseNodes(node.childNodes) };
            } else {
                tag = { text: this.parseNodes(node.childNodes), style: 'paragraph' };
            }
        }
        return tag;
    }

    parseBoldItalic(node, mod) {
        if (!node.childNodes) return '';
        if (mod === 'bold') {
            // We have a special case where if the parent is a blockquote and
            // if the text content matches a keyword, we render an admonition.
            // For this node, it would change the font color.

            let fontColor = null;

            if (
                (node.parentNode.nodeName === 'blockquote' || node.parentNode.parentNode.nodeName === 'blockquote') &&
                node.parentNode.childNodes.find(c => c.nodeName !== '#text') === node // First child
            ) {
                let label = node.childNodes[0].value;
                label = label.trim().toLowerCase();
                for (let kw in this.keywords) {
                    if (this.keywords[kw].indexOf(label) > -1) fontColor = this.styles[kw].borderColor;
                }
            }

            return fontColor ? { text: this.parseNodes(node.childNodes), bold: true, color: fontColor } :
                { text: this.parseNodes(node.childNodes), bold: true };
        } else if (mod === 'italic') {
            return { text: this.parseNodes(node.childNodes), italics: true };
        }
    }

    parsePreformatted(node) {
        if (!node.childNodes) return '';
        return {
            table: {
                widths: ['*'],
                body: [this.parseNodes(node.childNodes)]
            },
            layout: {
                paddingLeft: () => this.styles.preformatted.padding,
                paddingRight: () => this.styles.preformatted.padding,
                paddingTop: () => this.styles.preformatted.padding,
                paddingBottom: () => this.styles.preformatted.padding,
                defaultBorder: false
            },
            style: 'preformatted'
        };
    }

    parseSpan(node) {
        if (!node.childNodes) return '';
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
            return { text: this.parseNodes(node.childNodes), style: this.parseCodeStyle(codeClass) };
        } else {
            return { text: this.parseNodes(node.childNodes) };
        }
    }

    parseCode(node) {
        if (!node.childNodes) return '';
        if (node.parentNode.nodeName === 'pre') {
            return { text: this.parseNodes(node.childNodes), style: ['code', 'preCode'] };
        } else {
            return { text: this.parseNodes(node.childNodes), style: ['code', 'inlineCode'] };
        }
    }

    parseBlockQuote(node) {
        if (!node.childNodes) return '';

        let admonition = null;

        // If the first element inside the blockquote is bold text,
        // we look for admonition keywords.
        let firstElem = node.childNodes.find(c => c.nodeName !== '#text');
        if (firstElem.nodeName === 'p') firstElem = firstElem.childNodes.find(c => c.nodeName !== '#text');
        if (firstElem && (firstElem.nodeName === 'strong' || firstElem.nodeName === 'b')) {
            let label = firstElem.childNodes && firstElem.childNodes[0].value || '';
            label = label.trim().toLowerCase();
            for (let kw in this.keywords) {
                if (this.keywords[kw].indexOf(label) > -1) admonition = kw;
            }
        }

        return {
            table: {
                widths: ['*'],
                body: [[this.parseNodes(node.childNodes)]]
            },
            layout: {
                vLineWidth: (i) => (i === 0 ? 3 : 0),
                hLineWidth: () => 0,
                vLineColor: () => this.styles[admonition ? admonition : 'blockquote'].borderColor,
                paddingLeft: () => this.styles.blockquote.paddingLeft,
                paddingRight: () => this.styles.blockquote.paddingTop,
                paddingTop: () => this.styles.blockquote.paddingRight,
                paddingBottom: () => this.styles.blockquote.paddingBottom
            },
            style: admonition ? ['blockquote', admonition] : 'blockquote'
        }
    }

    parseLink(node) {
        if (!node.childNodes) return '';
        let href = '';
        for (let attr of node.attrs) {
            if (attr.name === 'href') {
                href = attr.value;
                break;
            }
        }
        return { text: this.parseNodes(node.childNodes), link: href, style: 'link' };
    }

    parseList(node) {
        if (!node.childNodes) return '';
        const li = [];
        for (let child of node.childNodes) {
            if (child.nodeName === 'li') {
                // If the li doesn't contain a paragraph, we wrap it in a 'text' element
                // to prevent the erroneous creation of paragraphs for inline items.
                if (child.childNodes.some(c => c.nodeName === 'p')) {
                    li.push(this.parseNodes(child.childNodes));
                } else {
                    li.push({ text: this.parseNodes(child.childNodes) });
                }
            }
        }
        if (!li.length) return '';
        let tag = {};
        tag[node.nodeName === 'ul' ? 'ul' : 'ol'] = li;
        return tag;
    }

    parseHorizontalRule(node) {
        return {
            table: {
                widths: ['*'],
                body: [[''], ['']]
            },
            layout: {
                hLineWidth: (i, node) => ((i === 0 || i === node.table.body.length) ? 0 : 1),
                vLineWidth: () => 0,
                hLineColor: () => this.styles.horizontalRule.borderColor
            },
            marginBottom: 8
        };
    }

    parseTable(node) {
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
        if (!head || !body) return '';

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
            return { text: this.parseNodes(th.childNodes), style };
        });
        if (!headerLine || headerLine.length === 0) return '';

        const dataRows = body.filter(f => f.nodeName === 'tr').map(tr => tr.childNodes.filter(f => f.nodeName === 'td').map(td => {
            const style = [];
            computeAlignment(td, style);
            if (style.length)
                return { text: this.parseNodes(td.childNodes), style };
            else
                return this.parseNodes(td.childNodes);
        }));
        if (!dataRows || dataRows.length === 0) return '';

        const dataArray = [headerLine, ...dataRows];
        return {
            table: {
                widths: Array.from({ length: headerLine.length }, () => 'auto'),
                body: dataArray,
                headerRows: 1
            },
            layout: 'lightHorizontalLines',
            style: 'table'
        };
    }

    parseImage(node) {
        let src, alt;
        for (let attr of node.attrs) {
            if (attr.name === 'src') src = attr.value;
            if (attr.name === 'alt') alt = attr.value;
        }
        if (!src) return '';

        const rejectImage = () => {
            // If we have an 'alt' attribute, we show that instead
            if (alt) {
                return {
                    table: {
                        widths: ['auto'],
                        body: [[alt]]
                    },
                    style: 'table'
                }
            } else return '';
        };

        // We do not accept http/https/file/etc. urls at this time.
        if (/^\w+:\/\//.test(src)) {
            console.error(`ERROR: We cannot accept image URLs at this time. [${src}]`);
            return rejectImage();
        }

        // We also reject images if no markdown path is specified (cannot make absolute path).
        if (!this.mdPath) {
            console.error('ERROR: No base path for images was specified.');
            return rejectImage();
        }

        // Remove leading slash, if any, and resolve the complete path.
        src = src.replace(/^\//, '');
        src = path.resolve(this.mdPath, src);

        let imgWidth, imgHeight, imgDPI;

        try {
            if (src.toLowerCase().endsWith('.jpg') || src.toLowerCase().endsWith('.jpeg')) {
                [imgWidth, imgHeight, imgDPI] = getInfofromJPEGfile(src);
            } else if (src.toLowerCase().endsWith('.png')) {
                [imgWidth, imgHeight, imgDPI] = getInfofromPNGfile(src);
            } else {
                console.error(`ERROR: Image file format is wrong, expected JPEG or PNG. [${src}]`);
                return rejectImage();
            }
        } catch (err) {
            console.error(err);
            return rejectImage();
        }

        if (isNaN(imgWidth) || isNaN(imgHeight) || isNaN(imgDPI)) {
            console.error(`ERROR: Could not read the picture's dimensions. [${imgWidth}, ${imgHeight}, ${imgDPI}]`);
            return rejectImage();
        }

        [imgWidth, imgHeight] = convertImageDimsForPrint(imgWidth, imgHeight, imgDPI);

        const adjustedWidth = this.pageWidth - this.marginLeft - this.marginRight;
        const overrideWidth = this.imgMaxSize ? this.imgMaxSize < 1 ? adjustedWidth * this.imgMaxSize : this.imgMaxSize : adjustedWidth;

        let fitDims = Math.min(imgWidth, overrideWidth);

        if (alt) {
            return [
                { image: src, fit: [fitDims, fitDims] },
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
            return { image: src, style: 'image' };
        }
    }

    parseTag(node) {
        let tag = null;
        switch (node.nodeName) {
            case '#text':
                tag = this.parseText(node);
                break;

            case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
                tag = this.parseHeading(node);
                break;

            case 'p':
                tag = this.parseParagraph(node);
                break;

            case 'strong': case 'b':
                tag = this.parseBoldItalic(node, 'bold');
                break;

            case 'em': case 'i':
                tag = this.parseBoldItalic(node, 'italic');
                break;

            case 'pre':
                tag = this.parsePreformatted(node);
                break;

            case 'span':
                tag = this.parseSpan(node);
                break;

            case 'code':
                tag = this.parseCode(node);
                break;

            case 'blockquote':
                tag = this.parseBlockQuote(node);
                break;

            case 'a':
                tag = this.parseLink(node);
                break;

            case 'ul': case 'ol':
                tag = this.parseList(node);
                break;

            case 'hr':
                tag = this.parseHorizontalRule(node);
                break;

            case 'table':
                tag = this.parseTable(node);
                break;

            case 'img':
                tag = this.parseImage(node);
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