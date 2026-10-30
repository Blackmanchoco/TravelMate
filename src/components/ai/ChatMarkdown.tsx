import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMarkdownProps {
  content: string;
}

function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="min-w-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          h1: ({ children }) => <h1 className="my-3 text-lg font-bold text-fg">{children}</h1>,
          h2: ({ children }) => <h2 className="my-3 text-base font-bold text-fg">{children}</h2>,
          h3: ({ children }) => <h3 className="my-2 font-bold text-fg">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-4 border-line pl-3 text-muted">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => (
            <code className={`${className ?? ""} rounded bg-tint px-1.5 py-0.5 font-mono text-[0.9em] text-fg`}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-control bg-fg p-3 text-xs leading-6 text-tint">
              {children}
            </pre>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent underline decoration-accent underline-offset-2"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <table className="my-3 w-full border-collapse text-left text-xs">{children}</table>
          ),
          th: ({ children }) => <th className="border border-line bg-bg px-2 py-1 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-line px-2 py-1 align-top">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default ChatMarkdown;
