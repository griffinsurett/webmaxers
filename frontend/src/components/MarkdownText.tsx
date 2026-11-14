import type { ReactNode } from "react";

const URL_RE = /(https?:\/\/[^\s]+)/g;

function cleanUrl(raw: string): string {
  return raw.replace(/[.,!?;:)"']+$/, "");
}

type LinkRenderer = (href: string, key: string) => ReactNode;

function defaultLinkRenderer(href: string, key: string): ReactNode {
  return (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:opacity-75 transition-opacity">
      {href}
    </a>
  );
}

function renderInline(text: string, baseKey: string, linkRenderer: LinkRenderer): ReactNode[] {
  const INLINE_RE = /(\*\*(.+?)\*\*|\*(.+?)\*|https?:\/\/[^\s]+)/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[0].startsWith("**")) {
      parts.push(<strong key={`${baseKey}-b${i++}`} className="font-semibold text-heading">{m[2]}</strong>);
    } else if (m[0].startsWith("*")) {
      parts.push(<em key={`${baseKey}-i${i++}`} className="italic">{m[3]}</em>);
    } else {
      parts.push(linkRenderer(cleanUrl(m[0]), `${baseKey}-u${i++}`));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MarkdownText({
  text,
  className = "",
  linkRenderer = defaultLinkRenderer,
}: {
  text: string;
  className?: string;
  linkRenderer?: LinkRenderer;
}) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;
  let key = 0;

  const flushList = () => {
    if (!listItems.length) return;
    if (listType === "ol") {
      nodes.push(<ol key={key++} className="list-decimal list-outside pl-4 my-1 space-y-0.5">{listItems}</ol>);
    } else {
      nodes.push(<ul key={key++} className="list-disc list-outside pl-4 my-1 space-y-0.5">{listItems}</ul>);
    }
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const ulMatch = line.match(/^[-*]\s+(.*)/);
    const olMatch = line.match(/^\d+\.\s+(.*)/);

    if (ulMatch) {
      if (listType === "ol") flushList();
      listType = "ul";
      listItems.push(<li key={key++}>{renderInline(ulMatch[1], String(key), linkRenderer)}</li>);
    } else if (olMatch) {
      if (listType === "ul") flushList();
      listType = "ol";
      listItems.push(<li key={key++}>{renderInline(olMatch[1], String(key), linkRenderer)}</li>);
    } else {
      flushList();
      if (line.trim() === "") {
        nodes.push(<div key={key++} className="h-1.5" />);
      } else {
        nodes.push(
          <p key={key++} className="m-0">
            {renderInline(line, String(key), linkRenderer)}
          </p>
        );
      }
    }
  }
  flushList();

  return <div className={`wrap-break-word space-y-0.5 ${className}`}>{nodes}</div>;
}
