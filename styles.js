const defaultStyle = {
    alignment: 'left',
    font: 'Roboto',
    fontSize: 12,
    lineHeight: 1.4
};

const defaultKeywords = {
    info: ['info', 'note', 'information'],
    hint: ['hint', 'tip', 'conseil', 'indice', 'suggestion'],
    warning: ['warning', 'caution', 'watch-out', 'attention', 'avertissement'],
    danger: ['danger', 'error', 'issue', 'problem', 'alert', 'erreur', 'problème', 'alerte']
};

const rem = defaultStyle.fontSize;

const styleSheet = {
    link: {
        decoration: 'underline'
    },
    heading: {
        bold: true,
        lineHeight: 1.25,
        marginBottom: 0.5 * rem,
    },
    h1: {
        fontSize: 2 * rem
    },
    h2: {
        fontSize: 1.5 * rem
    },
    h3: {
        fontSize: 1.25 * rem
    },
    h4: {
        fontSize: 1 * rem
    },
    h5: {
        fontSize: 0.875 * rem
    },
    h6: {
        fontSize: 0.85 * rem,
        color: '#6a737b'
    },
    paragraph: {
        marginBottom: 0.6 * rem
    },
    blockquote: {
        fillColor: '#f9fafb',
        borderColor: '#6b7280',
        lineHeight: 1.4,
        marginBottom: 0.7 * rem,
        paddingLeft: 6,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 0
    },
    info: {
        fillColor: '#eff6ff',
        borderColor: '#3b82f6'
    },
    hint: {
        fillColor: '#ecfdf5',
        borderColor: '#10b981'
    },
    warning: {
        fillColor: '#fffbeb',
        borderColor: '#f59e0b'
    },
    danger: {
        fillColor: '#fef2f2',
        borderColor: '#ef4444'
    },
    horizontalRule: {
        borderColor: '#d1d1d1'
    },
    table: {
        marginBottom: 0.7 * rem,
        lineHeight: 1.0,
    },
    image: {
        marginBottom: 0.7 * rem
    },
    imageAlt: {
        color: '#a31515',
        fontSize: 0.75 * rem,
        marginBottom: 0.7 * rem
    },
    tableHeader: {
        bold: true
    },
    alignCenter: {
        alignment: 'center'
    },
    alignRight: {
        alignment: 'right'
    },
    preformatted: {
        preserveLeadingSpaces: true,
        marginBottom: 0.7 * rem,
        lineHeight: 1.357,
        padding: 4
    },
    code: {
        font: 'UbuntuMono'
    },
    preCode: {
        /*fillColor: '#f6f8fa',*/
        fontSize: 0.85 * rem
    },
    inlineCode: {
        color: '#a31515'
        /*background: '#f6f8fa'*/
    },
    codeKeyword: {
        color: '#d73a49'
    },
    codeTitle: {
        color: '#6f42c1'
    },
    codeVariable: {
        color: '#005cc5'
    },
    codeString: {
        color: '#032f62'
    },
    codeSymbol: {
        color: '#e36209'
    },
    codeComment: {
        color: '#6a737d'
    },
    codeName: {
        color: '#22863a'
    },
    codeSubst: {
        color: '#24292e'
    },
    codeSection: {
        color: '#005cc5',
        bold: true
    },
    codeBullet: {
        color: '#735c0f'
    },
    codeEmphasis: {
        color: '#24292e',
        italics: true
    },
    codeStrong: {
        color: '#24292e',
        bold: true
    },
    codeAddition: {
        color: '#22863a',
        background: '#f0fff4'
    },
    codeDeletion: {
        color: '#b31d28',
        background: '#ffeef0'
    }
};

module.exports = {defaultStyle, defaultKeywords, styleSheet};