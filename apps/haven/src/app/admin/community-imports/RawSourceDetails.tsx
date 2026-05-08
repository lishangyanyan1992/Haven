"use client";

type RawSourceDetailsProps = {
  authorName: string;
  body: string;
  comments: string[];
  sourceUrl: string;
  title: string;
};

export function RawSourceDetails({ authorName, body, comments, sourceUrl, title }: RawSourceDetailsProps) {
  return (
    <details className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
      <summary className="cursor-pointer text-body-sm font-medium">
        Open raw source details
      </summary>

      <div className="mt-4 space-y-3">
        {sourceUrl && (
          <p className="text-body-sm break-all">
            <span className="font-medium">Source URL:</span> {sourceUrl}
          </p>
        )}
        {authorName && (
          <p className="text-body-sm">
            <span className="font-medium">Original author:</span> {authorName}
          </p>
        )}
        {title && (
          <p className="text-body-sm">
            <span className="font-medium">Original title:</span> {title}
          </p>
        )}
        {body && (
          <p className="text-body-sm whitespace-pre-wrap">{body}</p>
        )}
        {comments.length > 0 && (
          <div className="space-y-2">
            <p className="text-body-sm font-medium">Top comments</p>
            {comments.slice(0, 3).map((comment) => (
              <p key={comment} className="text-caption whitespace-pre-wrap">
                {comment}
              </p>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
