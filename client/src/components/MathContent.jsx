import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)\s]+)\)|<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
const LATEX_PATTERN = /(\$\$[\s\S]+?\$\$|\\\[(?:[\s\S]+?)\\\]|\\\((?:[\s\S]+?)\\\)|\$[^$\n]+\$|\\begin\{([^}]+)\}[\s\S]+?\\end\{\2\})/g;

const tryKatex = (raw, displayMode) => {
  const attempts = [raw, raw.replace(/\\\\/g, '\\')];
  for (const source of attempts) {
    try {
      return katex.renderToString(source, {
        throwOnError: false,
        displayMode,
        strict: 'ignore',
        trust: true,
        output: 'html',
      });
    } catch {
      // try next
    }
  }
  return null;
};

const stripDelimiters = (chunk) => {
  if (chunk.startsWith('$$') && chunk.endsWith('$$')) {
    return { latex: chunk.slice(2, -2).trim(), display: true };
  }
  if (chunk.startsWith('\\[') && chunk.endsWith('\\]')) {
    return { latex: chunk.slice(2, -2).trim(), display: true };
  }
  if (chunk.startsWith('\\(') && chunk.endsWith('\\)')) {
    return { latex: chunk.slice(2, -2).trim(), display: false };
  }
  if (chunk.startsWith('$') && chunk.endsWith('$')) {
    return { latex: chunk.slice(1, -1).trim(), display: false };
  }
  if (chunk.startsWith('\\begin')) {
    return { latex: chunk, display: true };
  }
  return { latex: chunk, display: false };
};

const renderLatexHtml = (chunk) => {
  const { latex, display } = stripDelimiters(chunk);
  return tryKatex(latex, display) || chunk;
};

const splitLatex = (text) => {
  const parts = [];
  let last = 0;
  const re = new RegExp(LATEX_PATTERN.source, 'g');
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: 'text', value: text.slice(last, match.index) });
    }
    parts.push({ type: 'latex', value: match[0] });
    last = re.lastIndex;
  }
  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) });
  }
  return parts.length ? parts : [{ type: 'text', value: text }];
};

const tokenize = (input) => {
  const text = String(input || '');
  if (!text.trim()) return [];

  const tokens = [];
  let last = 0;
  const re = new RegExp(IMAGE_PATTERN.source, 'gi');
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push(...splitLatex(text.slice(last, match.index)));
    }
    tokens.push({
      type: 'image',
      url: match[2] || match[3],
      alt: match[1] || 'Question diagram',
    });
    last = re.lastIndex;
  }
  if (last < text.length) {
    tokens.push(...splitLatex(text.slice(last)));
  }
  return tokens;
};

const TextChunk = ({ value }) => {
  if (!value) return null;
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  if (looksHtml) {
    const safe = value.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    return <span dangerouslySetInnerHTML={{ __html: safe }} />;
  }
  return <span className="whitespace-pre-wrap">{value}</span>;
};

const MathContent = ({ text, className = '' }) => {
  const tokens = useMemo(() => tokenize(text), [text]);
  if (!tokens.length) return null;

  return (
    <div className={`math-content leading-relaxed ${className}`}>
      {tokens.map((token, idx) => {
        if (token.type === 'image') {
          return (
            <span key={idx} className="block my-2">
              <img
                src={token.url}
                alt={token.alt}
                className="max-h-64 max-w-full rounded-lg border border-gray-200 shadow-sm object-contain bg-white p-1"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              {token.alt && token.alt !== 'Question diagram' && (
                <span className="block text-[11px] text-gray-500 italic mt-1">{token.alt}</span>
              )}
            </span>
          );
        }
        if (token.type === 'latex') {
          return (
            <span
              key={idx}
              className="inline-block align-middle mx-0.5"
              dangerouslySetInnerHTML={{ __html: renderLatexHtml(token.value) }}
            />
          );
        }
        return <TextChunk key={idx} value={token.value} />;
      })}
    </div>
  );
};

export default MathContent;
