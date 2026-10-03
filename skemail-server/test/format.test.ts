import { describe, expect, it } from 'vitest';

import { formatOutboundHtml, htmlToPlainText } from '../src/mail/format';

const P = '<p dir="auto" style="padding: 0px; margin: 0px; min-height: 1em;">';
const p = (inner = '') => `${P}${inner}</p>`;

// A reply as skemail-web composes it (Compose editor + skiff_quote).
const REPLY =
  p('Hi Alice') +
  p() +
  p('This is Bob, thank you for reaching out.') +
  p('<br>Regards,') +
  p('Bob') +
  p() +
  '<blockquote class="skiff_quote skiff_quote" data-skiff-sender="Alice Doe" data-skiff-mail="true" isopen="false">' +
  p('On Sat, 03 Oct 2026 07:46:33 GMT, Alice Doe') +
  p('&lt;alice@example.com&gt; wrote:') +
  p() +
  p('Hi there this is from gmail') +
  p('<br>') +
  p('Regards,') +
  p('Alice') +
  '</blockquote>';

describe('outbound HTML', () => {
  it('turns a skiff quote into a Gmail-style quote with a one-line attribution above it', () => {
    const html = formatOutboundHtml(REPLY);

    expect(html).toContain(
      '<blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">'
    );
    expect(html).toContain(
      '<div class="gmail_attr">On Sat, 03 Oct 2026 07:46:33 GMT, Alice Doe &lt;alice@example.com&gt; wrote:<br></div>'
    );
    // The attribution sits before the quoted message, not inside it as separate paragraphs.
    expect(html.indexOf('gmail_attr')).toBeLessThan(html.indexOf('Hi there this is from gmail'));
    expect(html).not.toContain('skiff_quote');
    expect(html).not.toContain(p('On Sat, 03 Oct 2026 07:46:33 GMT, Alice Doe'));
    // The message itself is untouched.
    expect(html.startsWith(p('Hi Alice') + p() + p('This is Bob, thank you for reaching out.'))).toBe(true);
  });

  it('leaves messages without a quote as they are', () => {
    const html = p('Hello <b>there</b> &amp; welcome');
    expect(formatOutboundHtml(html)).toBe(html);
  });

  it('keeps quotes without a recognisable attribution, only restyled', () => {
    const html = formatOutboundHtml(`<blockquote class="skiff_quote">${p('Just quoted text')}</blockquote>`);
    expect(html).toBe(
      '<blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">' +
        p('Just quoted text') +
        '</blockquote>'
    );
  });
});

describe('plain-text alternative', () => {
  it('keeps line breaks and blank lines, and quotes the reply with ">"', () => {
    expect(htmlToPlainText(formatOutboundHtml(REPLY))).toBe(
      [
        'Hi Alice',
        '',
        'This is Bob, thank you for reaching out.',
        '',
        'Regards,',
        'Bob',
        '',
        'On Sat, 03 Oct 2026 07:46:33 GMT, Alice Doe <alice@example.com> wrote:',
        '',
        '> Hi there this is from gmail',
        '>',
        '> Regards,',
        '> Alice'
      ].join('\n')
    );
  });

  it('shows links once when the text is the URL', () => {
    expect(
      htmlToPlainText(
        p('See <a href="https://example.org">https://example.org</a> or <a href="https://x.test/a">docs</a>')
      )
    ).toBe('See https://example.org or docs [https://x.test/a]');
  });
});
