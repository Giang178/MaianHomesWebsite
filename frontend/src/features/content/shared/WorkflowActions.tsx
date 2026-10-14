'use client';

import type { ContentAction } from '../contracts/generated';

type Props = {
  canPublish: boolean;
  publicationStatus?: string;
  workflowStatus?: string;
  busy?: boolean;
  onAction: (action: ContentAction) => void;
};

export default function WorkflowActions({
  canPublish,
  publicationStatus,
  workflowStatus,
  busy,
  onAction,
}: Props) {
  const isPublished = publicationStatus === 'PUBLISHED';
  const isArchived = publicationStatus === 'ARCHIVED';
  const hasPendingDraft = workflowStatus === 'DRAFT';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canPublish && (
        <>
          {isArchived ? (
            <button
              disabled={busy}
              onClick={() => onAction('restore')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
            >
              Khôi phục
            </button>
          ) : isPublished ? (
            <>
              {hasPendingDraft && (
                <button
                  disabled={busy}
                  onClick={() => onAction('publish')}
                  className="btn-gold text-xs font-bold py-1 px-2.5 rounded-lg shadow-2xs"
                  title="Xuất bản bản nháp mới nhất ra website"
                >
                  Cập nhật xuất bản
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => onAction('unpublish')}
                className="text-xs font-medium text-amber-700 hover:text-amber-800 hover:underline px-1 py-0.5"
              >
                Gỡ xuất bản
              </button>
            </>
          ) : (
            <button
              disabled={busy}
              onClick={() => onAction('publish')}
              className="btn-gold text-xs font-bold py-1 px-2.5 rounded-lg shadow-2xs"
            >
              Xuất bản
            </button>
          )}
        </>
      )}
    </div>
  );
}
