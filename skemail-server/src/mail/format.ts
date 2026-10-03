import render from 'dom-serializer';
import { Element, isTag, Text } from 'domhandler';
import { convert } from 'html-to-text';
import { DomUtils, parseDocument } from 'htmlparser2';

/** Gmail's own quote style, so replies read the same in other clients as a native Gmail thread. */
const QUOTE_STYLE = 'margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex';
/** The attribution ("On <date>, <name> <address> wrote:") is at most this many paragraphs at the top of a quote. */
const MAX_ATTRIBUTION_BLOCKS = 3;

const isSkiffQuote = (el: Element) => el.name === 'blockquote' && /\bskiff_quote\b/.test(el.attribs.class ?? '');
const isEmptyBlock = (el: Element) =>
  !DomUtils.textContent(el).trim() && !DomUtils.findOne((e) => e.name === 'img', [el]);

/**
 * skemail-web quotes replies as an unstyled `<blockquote class="skiff_quote">` (styled by Skiff's own CSS) whose
 * first paragraphs are the attribution, split across lines. Other clients show that as a bare indent, and Gmail
 * folds the split attribution into its "•••" quoted-text toggle. This rewrites each quote the way Gmail writes
 * one: the attribution as a single line above the quote, and the quote with a left border.
 */
export function formatOutboundHtml(html: string): string {
  const doc = parseDocument(html);
  for (const quote of DomUtils.findAll(isSkiffQuote, doc.children)) {
    const blocks = quote.children.filter(isTag);
    const end = blocks.findIndex((b) => /wrote:\s*$/.test(DomUtils.textContent(b)));
    if (end >= 0 && end < MAX_ATTRIBUTION_BLOCKS) {
      const attribution = blocks
        .slice(0, end + 1)
        .map((b) => DomUtils.textContent(b).trim())
        .join(' ');
      blocks.slice(0, end + 1).forEach((b) => DomUtils.removeElement(b));
      // Drop the blank line the editor leaves between the attribution and the quoted message.
      const next = blocks[end + 1];
      if (next && isEmptyBlock(next)) DomUtils.removeElement(next);
      const attr = new Element('div', { class: 'gmail_attr' }, [new Text(attribution), new Element('br', {})]);
      DomUtils.prepend(quote, attr);
    }
    quote.attribs = { class: 'gmail_quote', style: QUOTE_STYLE };
  }
  return render(doc, { encodeEntities: 'utf8' });
}

/**
 * Plain-text alternative built from the HTML. The editor's own text part loses line breaks (paragraphs come out
 * joined by tabs), and a text part that does not match the HTML part counts against a message in spam filters.
 */
export function htmlToPlainText(html: string): string {
  // The editor writes blank lines as empty paragraphs, which html-to-text would drop.
  const doc = parseDocument(html);
  for (const p of DomUtils.findAll((el) => el.name === 'p' && isEmptyBlock(el), doc.children)) {
    DomUtils.appendChild(p, new Element('br', {}));
  }
  const text = convert(render(doc, { encodeEntities: 'utf8' }), {
    wordwrap: 78,
    selectors: [
      { selector: 'p', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
      { selector: 'div', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
      { selector: 'blockquote', options: { leadingLineBreaks: 2, trailingLineBreaks: 1, trimEmptyLines: true } },
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
      { selector: 'img', format: 'skip' }
    ]
  });
  // Empty paragraphs next to <br>s produce runs of blank lines (">" inside quotes); keep one of each run.
  const isBlank = (line: string) => /^(>\s*)*$/.test(line);
  const lines: string[] = [];
  for (const line of text.split('\n').map((l) => l.replace(/\s+$/, ''))) {
    if (isBlank(line) && lines.length && lines[lines.length - 1] === line) continue;
    lines.push(line);
  }
  return lines.join('\n').trim();
}
