import React from 'react';

interface BlogContentRendererProps {
  content: string;
  className?: string;
}

export const BlogContentRenderer: React.FC<BlogContentRendererProps> = ({ content, className = '' }) => {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let currentBulletList: string[] = [];
  let currentNumberedList: { number: number; text: string }[] = [];
  let listKey = 0;

  const flushBulletList = () => {
    if (currentBulletList.length > 0) {
      elements.push(
        <ul key={`ul-${listKey++}`} className="list-disc list-inside mb-4 space-y-1">
          {currentBulletList.map((item, i) => (
            <li key={i} className="text-foreground">{renderInlineStyles(item)}</li>
          ))}
        </ul>
      );
      currentBulletList = [];
    }
  };

  const flushNumberedList = () => {
    if (currentNumberedList.length > 0) {
      const startNumber = currentNumberedList[0].number;
      elements.push(
        <ol key={`ol-${listKey++}`} start={startNumber} className="list-decimal list-inside mb-4 space-y-1">
          {currentNumberedList.map((item, i) => (
            <li key={i} className="text-foreground">{renderInlineStyles(item.text)}</li>
          ))}
        </ol>
      );
      currentNumberedList = [];
    }
  };

  const flushLists = () => {
    flushBulletList();
    flushNumberedList();
  };

  const renderInlineStyles = (text: string): React.ReactNode => {
    // First handle links [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const processLinks = (str: string, keyPrefix: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      
      while ((match = linkRegex.exec(str)) !== null) {
        // Add text before the link
        if (match.index > lastIndex) {
          parts.push(str.slice(lastIndex, match.index));
        }
        // Add the link
        parts.push(
          <a 
            key={`${keyPrefix}-link-${match.index}`}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80 transition-colors"
          >
            {match[1]}
          </a>
        );
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text
      if (lastIndex < str.length) {
        parts.push(str.slice(lastIndex));
      }
      
      return parts.length > 0 ? parts : [str];
    };

    // Process links first, then bold and italic within non-link parts
    const processTextStyles = (input: string | React.ReactNode, keyPrefix: string): React.ReactNode => {
      if (typeof input !== 'string') return input;
      
      // Handle bold text **text**
      const boldParts = input.split(/(\*\*[^*]+\*\*)/g);
      
      return boldParts.map((boldPart, boldIndex) => {
        if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
          return <strong key={`${keyPrefix}-b-${boldIndex}`} className="font-semibold">{boldPart.slice(2, -2)}</strong>;
        }
        
        // Handle italic within non-bold parts
        const italicParts = boldPart.split(/(\*[^*]+\*)/g);
        return italicParts.map((italicPart, italicIndex) => {
          if (italicPart.startsWith('*') && italicPart.endsWith('*') && italicPart.length > 2) {
            return <em key={`${keyPrefix}-i-${boldIndex}-${italicIndex}`} className="italic">{italicPart.slice(1, -1)}</em>;
          }
          return italicPart;
        });
      });
    };

    // First process links, then styles within each part
    const linkedParts = processLinks(text, 'main');
    return linkedParts.map((part, idx) => {
      if (typeof part === 'string') {
        return <React.Fragment key={`frag-${idx}`}>{processTextStyles(part, `style-${idx}`)}</React.Fragment>;
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      flushLists();
      return;
    }

    // Heading 2: ## text
    if (trimmedLine.startsWith('## ')) {
      flushLists();
      elements.push(
        <h2 key={index} className="font-playfair font-semibold text-xl text-foreground mt-6 mb-2">
          {renderInlineStyles(trimmedLine.slice(3))}
        </h2>
      );
      return;
    }

    // Heading 3: ### text
    if (trimmedLine.startsWith('### ')) {
      flushLists();
      elements.push(
        <h3 key={index} className="font-playfair font-semibold text-lg text-foreground mt-4 mb-2">
          {renderInlineStyles(trimmedLine.slice(4))}
        </h3>
      );
      return;
    }

    // Numbered list: 1. text, 2. text, etc.
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s(.+)/);
    if (numberedMatch) {
      flushBulletList();
      currentNumberedList.push({ 
        number: parseInt(numberedMatch[1], 10), 
        text: numberedMatch[2] 
      });
      return;
    }

    // Bullet points: - text or * text
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      flushNumberedList();
      currentBulletList.push(trimmedLine.slice(2));
      return;
    }

    // Regular paragraph
    flushLists();
    elements.push(
      <p key={index} className="mb-3 text-foreground">{renderInlineStyles(trimmedLine)}</p>
    );
  });

  flushLists();
  
  return <div className={className}>{elements}</div>;
};
