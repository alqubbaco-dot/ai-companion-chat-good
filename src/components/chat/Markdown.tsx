import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "@/lib/i18n";

function CodeBlock({ code, language }: { code: string; language: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-2xl border-2 border-line bg-code-bg">
      <div className="flex items-center justify-between border-b border-code-fg/15 px-4 py-2">
        <span className="font-mono text-[11px] text-code-fg/60">{language || "code"}</span>
        <button onClick={copy} className="font-mono text-[11px] text-butter hover:opacity-80">
          {copied ? t("copied") : t("copyCode")}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-left font-mono text-[13px] leading-relaxed text-code-fg" dir="ltr">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="text-[15px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 ps-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1 ps-5 last:mb-0">{children}</ol>
          ),
          a: ({ children, href }) => (
            <a href={href} className="font-semibold text-teal underline underline-offset-2">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-s-4 border-butter bg-butter/15 px-3 py-2 text-[14px]">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => (
            <h3 className="mb-2 font-display text-lg font-bold">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-2 font-display text-base font-bold">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-1 font-display text-[15px] font-bold">{children}</h4>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-2xl border-2 border-line">
              <table className="w-full text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b-2 border-line bg-butter/30 px-3 py-2 text-start font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-line/40 px-3 py-2">{children}</td>
          ),
          code: ({ className, children }) => {
            const text = String(children).replace(/\n$/, "");
            const language = /language-(\w+)/.exec(className ?? "")?.[1] ?? "";
            if (!className && !text.includes("\n")) {
              return (
                <code className="rounded-md bg-ink/10 px-1.5 py-0.5 font-mono text-[13px]">
                  {children as ReactNode}
                </code>
              );
            }
            return <CodeBlock code={text} language={language} />;
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
