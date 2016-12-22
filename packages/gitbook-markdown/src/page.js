const { State, Block, Text, Inline, INLINES, BLOCKS, MARKS } = require('markup-it');
const markdown = require('markup-it/lib/markdown');

const RAW_START = 'raw';
const RAW_END   = 'endraw';

/**
 * Create a templating node.
 * @param {String} expr
 * @return {Node}
 */
function createTemplatingNode(expr) {
    return Inline.create({
        type: INLINES.TEMPLATE,
        data: {
            type: 'expr',
            text: expr
        }
    });
}

/**
 * Escape a code block.
 * @param  {Block} block
 * @return {Array<Node>} blocks
 */
function escapeCodeBlock(block) {
    return [
        Block.create({
            type: BLOCKS.TEXT,
            nodes: [
                createTemplatingNode(RAW_START)
            ]
        }),
        block,
        Block.create({
            type: BLOCKS.TEXT,
            nodes: [
                createTemplatingNode(RAW_END)
            ]
        })
    ];
}


/**
 * Escape a text node.
 * @param  {Text} node
 * @return {Array<Node>} nodes
 */
function escapeTextNode(node) {
    const ranges = node.getRanges();

    const nodes = ranges.reduce((result, range) => {
        const hasCode = range.marks.some(mark => mark.type == MARKS.CODE);
        const text = Text.createFromRanges([ range ]);

        if (hasCode) {
            return result.concat([
                createTemplatingNode(RAW_START),
                text,
                createTemplatingNode(RAW_END)
            ]);
        }

        return result.concat([ text ]);
    }, []);

    return nodes;
}


/**
 * Annotate a block container.
 * @param  {Node} parent
 * @return {Node}
 */
function annotateNode(parent, levelRaw) {
    let { nodes } = parent;

    nodes = nodes.reduce((out, node) => {
        if (node.type === BLOCKS.CODE) {
            return out.concat(escapeCodeBlock(node));
        }

        else if (node.kind == 'text') {
            return out.concat(escapeTextNode(node));
        }

        return out.concat([node]);
    }, []);

    return parent.merge({ nodes });
}

/**
 * Add templating "raw" to code blocks to
 * avoid nunjucks processing their content.
 *
 * @param {String} src
 * @return {String}
 */
function preparePage(src) {
    let levelRaw = 0;

    const state = State.create(markdown);
    let document = state.deserializeToDocument(src);

    document = document.mapDescendants((node) => {
        if (node.type === INLINES.TEMPLATE) {
            const { type, text } = node.data;

            if (type === 'expr') {
                if (text === 'raw') {
                    levelRaw = levelRaw + 1;
                } else if (text == 'endraw') {
                    levelRaw = 0;
                }
            }

            return node;
        } else if (node.kind !== 'text') {
            return annotateNode(node, levelRaw);
        } else {
            return node;
        }
    });

    return state.serializeDocument(document);
}

module.exports = {
    prepare: preparePage
};