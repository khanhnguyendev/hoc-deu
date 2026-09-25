import { Children, type ReactNode } from 'react'

/** `<Steps>` — a numbered list of `<Step>`s. An empty list renders nothing (the check rejects it). */
function Steps({ children }: { children?: ReactNode }) {
  if (Children.count(children) === 0) return null
  return (
    <ol className="list-decimal space-y-3 pl-6 marker:font-semibold marker:text-muted-foreground">
      {children}
    </ol>
  )
}

/** `<Step title?>` — one numbered step; its content may be a line of text or paragraphs. */
function Step({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <li className="space-y-1 pl-1">
      {title && <p className="font-semibold">{title}</p>}
      <div className="space-y-2">{children}</div>
    </li>
  )
}

export { Step, Steps }
