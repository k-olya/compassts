import { useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import api from "virtual:libcompass-api";

type Documentation = Pick<(typeof api.entries)[number], "description" | "tags">;

function Markdown({ text }: { text: string }) {
  const markdown = text.replace(/\{@link\s+([^}| ]+)(?:\s*\|?\s*([^}]+))?\}/g, (_match, target: string, label?: string) => {
    const symbol = target.split(".")[0];
    return api.entries.some(entry => entry.name === symbol) ? `[${label ?? target}](#api-${symbol})` : `\`${label ?? target}\``;
  });
  return <div className="docs-markdown" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(markdown, { async: false })) }} />;
}

function Documentation({ description, tags }: Documentation) {
  return <>
    {description && <Markdown text={description} />}
    {tags.map((tag, index) => (
      <div className="docs-tag" key={index}>
        <h4>{({ param: "Parameter", returns: "Returns", throws: "Throws", remarks: "Remarks", example: "Example", see: "See also", typeParam: "Type parameter" } as Record<string, string>)[tag.name] ?? tag.name}</h4>
        <Markdown text={tag.text} />
      </div>
    ))}
  </>;
}

export default function Docs() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("Sketch");
  const search = query.trim().toLowerCase();
  const entries = api.entries.filter(entry => [entry.name, entry.description, ...entry.members.flatMap(member => [member.name, member.description])].some(text => text.toLowerCase().includes(search)));
  const entry = entries.find(entry => entry.name === selected) ?? entries[0];

  return <>
    <div className="docs-search">
      <input type="search" aria-label="Search libcompass documentation" placeholder="Search classes, functions, members…" value={query} onChange={event => setQuery(event.target.value)} />
    </div>
    <div className="docs-body" onClick={event => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#api-"]');
      if (!link) return;
      event.preventDefault();
      setQuery("");
      setSelected(link.hash.slice(5));
    }}>
      <nav className="docs-index" aria-label="libcompass API">
        {entries.map(item => <button type="button" key={item.name} aria-current={item.name === entry?.name ? "page" : undefined} onClick={() => setSelected(item.name)}>{item.name}</button>)}
        {!entries.length && <p>No matching API entries.</p>}
      </nav>
      {entry && <article className="docs-article" key={entry.name} aria-label={`${entry.name} documentation`}>
        <span className="docs-kind">{entry.kind}</span>
        <h2>{entry.name}</h2>
        <pre className="docs-signature"><code>{entry.signature}</code></pre>
        <Documentation {...entry} />
        {entry.members.map((member, index) => <section className="docs-member" key={index}>
          <h3>{member.name}</h3>
          <pre className="docs-signature"><code>{member.signature}</code></pre>
          <Documentation {...member} />
        </section>)}
      </article>}
    </div>
  </>;
}
